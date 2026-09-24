/**
 * Pure, I/O-free resilience primitives for the connection pool (WS-A3).
 *
 * Kept separate from pool.ts so the timing/state logic (backoff, circuit
 * breaker, error classification) is deterministically unit-testable without
 * spawning real downstream processes.
 */

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// --- Tunables (env-overridable) ---
export const MAX_RETRIES = envInt('MUX_MAX_RETRIES', 1);
export const CONNECT_TIMEOUT_MS = envInt('MUX_CONNECT_TIMEOUT_MS', 30_000);
export const CALL_TIMEOUT_MS = envInt('MUX_CALL_TIMEOUT_MS', 120_000);
export const POOL_MAX_SIZE = envInt('MUX_POOL_MAX_SIZE', 20);
export const BACKOFF_BASE_MS = envInt('MUX_BACKOFF_BASE_MS', 250);
export const BACKOFF_CAP_MS = envInt('MUX_BACKOFF_CAP_MS', 10_000);
export const BREAKER_FAILURE_THRESHOLD = envInt('MUX_BREAKER_THRESHOLD', 3);
export const BREAKER_COOLDOWN_MS = envInt('MUX_BREAKER_COOLDOWN_MS', 30_000);
export const NEGATIVE_CACHE_TTL_MS = envInt('MUX_NEGATIVE_CACHE_TTL_MS', 30_000);

/**
 * Exponential backoff with full jitter. Deterministic bounds:
 *   min = 0, max = min(cap, base * 2^attempt)
 * attempt is 0-based (first retry = attempt 0).
 */
export function backoffDelay(
  attempt: number,
  base: number = BACKOFF_BASE_MS,
  cap: number = BACKOFF_CAP_MS,
  rng: () => number = Math.random,
): number {
  const exp = Math.min(cap, base * 2 ** attempt);
  return Math.floor(rng() * exp);
}

/** Sleep helper (respects fake timers in tests that stub setTimeout). */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Classify a downstream error to decide whether a retry/reconnect is safe.
 * Validation errors (bad params, tool-level rejection) are NOT transient:
 * reconnecting and replaying doubles side effects for non-idempotent tools.
 */
export type FailureKind = 'validation' | 'transient';

// JSON-RPC: -32602 Invalid params, -32600 Invalid Request, -32601 Method not found.
const VALIDATION_JSONRPC_CODES = new Set([-32602, -32600, -32601]);

export function classifyError(err: unknown): FailureKind {
  if (err && typeof err === 'object') {
    const anyErr = err as { code?: unknown; data?: unknown; message?: unknown };
    if (typeof anyErr.code === 'number' && VALIDATION_JSONRPC_CODES.has(anyErr.code)) {
      return 'validation';
    }
    const msg = typeof anyErr.message === 'string' ? anyErr.message.toLowerCase() : '';
    if (
      msg.includes('invalid params') ||
      msg.includes('invalid_params') ||
      msg.includes('validation') ||
      msg.includes('schema') ||
      msg.includes('invalid arguments')
    ) {
      return 'validation';
    }
  }
  return 'transient';
}

export type BreakerState = 'closed' | 'open' | 'half-open';

/**
 * Per-server circuit breaker with cooldown.
 *
 * closed    -> normal; failures accumulate.
 * open      -> all attempts rejected until cooldown elapses (no cold spawns).
 * half-open -> one trial attempt allowed; success closes, failure re-opens.
 *
 * This bounds the "2 cold spawns per call, forever" cost of a permanently
 * dead downstream to threshold spawns per cooldown window.
 */
export class CircuitBreaker {
  private failures = 0;
  private state: BreakerState = 'closed';
  private openedAt = 0;

  constructor(
    private readonly threshold: number = BREAKER_FAILURE_THRESHOLD,
    private readonly cooldownMs: number = BREAKER_COOLDOWN_MS,
    private readonly now: () => number = Date.now,
  ) {}

  /** Whether a connection attempt is currently permitted. */
  canAttempt(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      if (this.now() - this.openedAt >= this.cooldownMs) {
        this.state = 'half-open';
        return true;
      }
      return false;
    }
    // half-open: allow the single trial (caller must record outcome)
    return true;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
    this.openedAt = 0;
  }

  recordFailure(): void {
    this.failures++;
    if (this.state === 'half-open' || this.failures >= this.threshold) {
      this.state = 'open';
      this.openedAt = this.now();
    }
  }

  getState(): BreakerState {
    return this.state;
  }

  /** ms until the breaker will next permit an attempt (0 if already permitted). */
  cooldownRemaining(): number {
    if (this.state !== 'open') return 0;
    return Math.max(0, this.cooldownMs - (this.now() - this.openedAt));
  }
}
