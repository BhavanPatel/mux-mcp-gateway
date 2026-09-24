/**
 * Group 14 (WS-A3) — deterministic pool-policy unit tests.
 * Covers backoff timing bounds, circuit breaker spawn-bounding, and
 * error classification (validation vs transient). Imports compiled dist.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backoffDelay, classifyError, CircuitBreaker } from '../../dist/pool-policy.js';

test('backoffDelay: bounded by min(cap, base*2^attempt) with full jitter', () => {
  const base = 100;
  const cap = 10_000;
  // rng near 1 => returns close to the exponential ceiling
  assert.equal(
    backoffDelay(0, base, cap, () => 0.999999),
    Math.floor(0.999999 * 100),
  );
  assert.equal(
    backoffDelay(1, base, cap, () => 0.999999),
    Math.floor(0.999999 * 200),
  );
  assert.equal(
    backoffDelay(2, base, cap, () => 0.999999),
    Math.floor(0.999999 * 400),
  );
  // rng=0 => zero
  assert.equal(
    backoffDelay(5, base, cap, () => 0),
    0,
  );
  // capped
  assert.equal(
    backoffDelay(20, base, cap, () => 1),
    cap,
  );
});

test('backoffDelay: grows monotonically in the ceiling', () => {
  const ceil = (a) => backoffDelay(a, 100, 1e9, () => 0.999999999);
  assert.ok(ceil(0) < ceil(1));
  assert.ok(ceil(1) < ceil(2));
  assert.ok(ceil(2) < ceil(3));
});

test('CircuitBreaker: opens after threshold failures, then rejects attempts', () => {
  let now = 1000;
  const cb = new CircuitBreaker(3, 5000, () => now);
  assert.equal(cb.canAttempt(), true);
  cb.recordFailure();
  cb.recordFailure();
  assert.equal(cb.getState(), 'closed');
  assert.equal(cb.canAttempt(), true);
  cb.recordFailure(); // 3rd -> open
  assert.equal(cb.getState(), 'open');
  assert.equal(cb.canAttempt(), false);
});

test('CircuitBreaker: bounds spawn attempts for a permanently dead downstream', () => {
  // Simulate the pool: every "call" asks canAttempt(); a spawn only happens
  // when permitted. Assert spawns stay bounded, not 2-per-call-forever.
  let now = 0;
  const cb = new CircuitBreaker(3, 1000, () => now);
  let spawns = 0;
  const deadDownstream = () => {
    if (cb.canAttempt()) {
      spawns++;
      cb.recordFailure(); // spawn always fails
    }
  };
  // 100 calls within the first cooldown window
  for (let i = 0; i < 100; i++) deadDownstream();
  assert.equal(spawns, 3, 'only threshold spawns before breaker opens');

  // After cooldown, exactly one trial (half-open) per window
  now += 1000;
  for (let i = 0; i < 100; i++) deadDownstream();
  assert.equal(spawns, 4, 'one trial spawn after cooldown, then re-open');
});

test('CircuitBreaker: half-open success closes the breaker', () => {
  let now = 0;
  const cb = new CircuitBreaker(2, 1000, () => now);
  cb.recordFailure();
  cb.recordFailure(); // open
  assert.equal(cb.canAttempt(), false);
  now += 1000; // cooldown elapsed
  assert.equal(cb.canAttempt(), true); // half-open trial
  assert.equal(cb.getState(), 'half-open');
  cb.recordSuccess();
  assert.equal(cb.getState(), 'closed');
  assert.equal(cb.canAttempt(), true);
});

test('CircuitBreaker: half-open failure re-opens immediately', () => {
  let now = 0;
  const cb = new CircuitBreaker(2, 1000, () => now);
  cb.recordFailure();
  cb.recordFailure(); // open
  now += 1000;
  assert.equal(cb.canAttempt(), true); // half-open
  cb.recordFailure(); // fails the trial
  assert.equal(cb.getState(), 'open');
  assert.equal(cb.canAttempt(), false);
});

test('classifyError: JSON-RPC invalid-params is validation (no retry)', () => {
  assert.equal(classifyError({ code: -32602, message: 'Invalid params' }), 'validation');
  assert.equal(classifyError({ code: -32600 }), 'validation');
  assert.equal(classifyError({ code: -32601 }), 'validation');
});

test('classifyError: message-based validation detection', () => {
  assert.equal(classifyError(new Error('schema validation failed')), 'validation');
  assert.equal(classifyError(new Error('invalid arguments for tool')), 'validation');
});

test('classifyError: connection/transport errors are transient (retry ok)', () => {
  assert.equal(classifyError(new Error('ECONNREFUSED')), 'transient');
  assert.equal(classifyError(new Error('socket hang up')), 'transient');
  assert.equal(classifyError({ code: -32603, message: 'Internal error' }), 'transient');
  assert.equal(classifyError(undefined), 'transient');
});
