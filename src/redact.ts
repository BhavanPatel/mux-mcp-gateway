/**
 * Secret redaction for logs and crash reports (WS-C1).
 *
 * Two failure modes are covered:
 *  1. KEYED secrets — an object like `{ apiKey: "sk-..." }`. Redacted by key name.
 *  2. POSITIONAL secrets — a value with no secret-ish key, e.g. an interpolated
 *     `${TOKEN}` that landed in a stdio `command`/`args` array (registry.ts
 *     interpolation). Redacted by value SHAPE.
 *
 * Direction of safety: over-redact rather than leak. Logs are diagnostic; a
 * partially-masked file path is an acceptable cost to guarantee no token in
 * cleartext. Nothing here writes to stdout.
 */

const REDACTED = '[redacted]';

/** Key names whose values are always secret, regardless of shape. */
const SECRET_KEY_RE =
  /(pass(word|wd)?|secret|token|api[-_]?key|access[-_]?key|private[-_]?key|\bkey\b|bearer|authorization|auth|credential|cookie|session|client[-_]?secret)/i;

/**
 * Value-shape matchers for positional secrets (no key to key off of).
 * Deliberately conservative so ordinary args (paths, ports, SQL) survive.
 */
const SECRET_VALUE_PATTERNS: RegExp[] = [
  /\bBearer\s+[A-Za-z0-9._-]+/gi, // Authorization: Bearer <jwt>
  /\bghp_[A-Za-z0-9]{20,}/g, // GitHub PAT
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g, // GitHub fine-grained PAT
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/g, // Slack tokens
  /\bsk-[A-Za-z0-9]{20,}/g, // OpenAI-style keys
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS access key id
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g, // JWT
];

/** A bare, high-entropy token that is *entirely* secret-shaped (whole-string). */
const WHOLE_SECRET_RE = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9+/_\-=.]{24,}$/;

/**
 * Scrub secret-shaped substrings from a free string. Used for positional
 * command/args values where the secret has no key.
 */
export function redactString(input: string): string {
  if (typeof input !== 'string' || input.length === 0) return input;

  // Whole-string high-entropy token (e.g. an interpolated ${TOKEN} arg).
  if (WHOLE_SECRET_RE.test(input) && !/\s/.test(input)) return REDACTED;

  let out = input;
  for (const re of SECRET_VALUE_PATTERNS) {
    out = out.replace(re, REDACTED);
  }
  return out;
}

/**
 * Deep-redact an arbitrary value. Objects are walked; a value is redacted when
 * either its KEY matches SECRET_KEY_RE or its string VALUE is secret-shaped.
 * Cycles are handled via a seen-set.
 */
export function redactValue(value: unknown, keyHint?: string, seen = new WeakSet<object>()): unknown {
  if (keyHint && SECRET_KEY_RE.test(keyHint)) return REDACTED;

  if (typeof value === 'string') return redactString(value);
  if (value === null || typeof value !== 'object') return value;

  if (seen.has(value as object)) return '[circular]';
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((v) => redactValue(v, undefined, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET_KEY_RE.test(k) ? REDACTED : redactValue(v, k, seen);
  }
  return out;
}

/** Log-safe redaction of a tool-call arguments object (pool.ts leak). */
export function redactArgs(args: Record<string, unknown>): Record<string, unknown> {
  return redactValue(args) as Record<string, unknown>;
}

/**
 * Log-safe redaction of a spawn command + args (stdio.ts leak). The command
 * itself is rarely secret but its args frequently carry interpolated tokens.
 */
export function redactCommand(
  command: string | undefined,
  args: string[] | undefined,
): { command?: string; args?: string[] } {
  return {
    command: command === undefined ? undefined : redactString(command),
    args: args?.map((a) => redactString(a)),
  };
}
