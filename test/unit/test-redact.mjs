/**
 * Unit tests for secret redaction (WS-C1).
 * Group-16 regression for pool.ts:113 and stdio.ts:17 cleartext leaks.
 * Run: node --test test/unit/test-redact.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { redactString, redactValue, redactArgs, redactCommand } from '../../dist/redact.js';

/** Assert a rendered log payload contains none of the given secret substrings. */
function assertNoSecret(rendered, secrets) {
  const hay = typeof rendered === 'string' ? rendered : JSON.stringify(rendered);
  for (const s of secrets) {
    assert.ok(!hay.includes(s), `expected secret ${JSON.stringify(s)} to be absent from ${hay}`);
  }
}

describe('redactValue — keyed secrets', () => {
  it('redacts values under secret-ish keys', () => {
    const out = redactValue({ apiKey: 'abcd1234efgh5678', token: 'zzz', password: 'hunter2' });
    assert.equal(out.apiKey, '[redacted]');
    assert.equal(out.token, '[redacted]');
    assert.equal(out.password, '[redacted]');
  });

  it('preserves ordinary values', () => {
    const out = redactValue({ limit: 10, query: 'hello world', name: 'sports' });
    assert.equal(out.limit, 10);
    assert.equal(out.query, 'hello world');
    assert.equal(out.name, 'sports');
  });

  it('walks nested objects and arrays', () => {
    const out = redactValue({ outer: { secret: 's3cr3t-value-here', list: [{ authToken: 'xyz' }] } });
    assert.equal(out.outer.secret, '[redacted]');
    assert.equal(out.outer.list[0].authToken, '[redacted]');
  });

  it('handles cycles without throwing', () => {
    const o = { name: 'ok' };
    o.self = o;
    const out = redactValue(o);
    assert.equal(out.name, 'ok');
    assert.equal(out.self, '[circular]');
  });
});

describe('redactString — positional secrets (no key)', () => {
  it('redacts a bearer token in a free string', () => {
    const out = redactString('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payloadpart.sigsigsig');
    assertNoSecret(out, ['eyJhbGciOiJIUzI1NiJ9', 'payloadpart', 'sigsigsig']);
  });

  it('redacts known token prefixes', () => {
    assert.equal(redactString('ghp_0123456789abcdefghijABCDEF'), '[redacted]');
    assert.equal(redactString('xoxb-1111111111-abcdefabcdef'), '[redacted]');
    assert.equal(redactString('sk-abcdefghijklmnopqrstuvwx'), '[redacted]');
  });

  it('redacts a bare high-entropy interpolated token', () => {
    // What registry.ts ${VAR} interpolation lands as a positional arg.
    assert.equal(redactString('AKIAIOSFODNN7EXAMPLE1234abcd'), '[redacted]');
  });

  it('preserves ordinary positional args', () => {
    assert.equal(redactString('--port'), '--port');
    assert.equal(redactString('3000'), '3000');
    assert.equal(redactString('/usr/local/bin/server'), '/usr/local/bin/server');
    assert.equal(redactString('SELECT * FROM users'), 'SELECT * FROM users');
  });
});

describe('redactArgs — pool.ts leak', () => {
  it('redacts secret-bearing tool arguments, keeps the rest', () => {
    const out = redactArgs({ apiToken: 'ghp_0123456789abcdefghijABCDEF', limit: 5, q: 'weather' });
    assertNoSecret(out, ['ghp_0123456789abcdefghijABCDEF']);
    assert.equal(out.limit, 5);
    assert.equal(out.q, 'weather');
  });
});

describe('redactCommand — stdio.ts leak', () => {
  it('redacts an interpolated token positioned in args', () => {
    const out = redactCommand('npx', ['-y', 'some-server', '--token', 'ghp_0123456789abcdefghijABCDEF']);
    assert.equal(out.command, 'npx');
    assert.deepEqual(out.args.slice(0, 4), ['-y', 'some-server', '--token', '[redacted]']);
    assertNoSecret(out, ['ghp_0123456789abcdefghijABCDEF']);
  });

  it('leaves a benign command line intact', () => {
    const out = redactCommand('node', ['server.js', '--port', '8080']);
    assert.equal(out.command, 'node');
    assert.deepEqual(out.args, ['server.js', '--port', '8080']);
  });
});
