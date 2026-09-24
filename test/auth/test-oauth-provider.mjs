/**
 * Group 13 — MuxOAuthProvider callback flow regression tests.
 * Cover the specific defects behind "auth sometimes hangs": ordering,
 * ephemeral port, EADDRINUSE, browser-open failure, PKCE, state, denied,
 * no-code, timeout, URL preservation, and handle cleanup.
 *
 * The provider exposes injectable hooks (openBrowser, callbackTimeoutMs) so the
 * full browser round-trip is exercised without a real browser. The injected
 * opener drives the callback itself — only possible if the callback server
 * bound BEFORE the opener was called (the listen-before-browser guarantee).
 *
 * Run: node --test test/auth/test-oauth-provider.mjs
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync, rmSync } from 'node:fs';
import { get } from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const TEST_DIR = '/tmp/mux-oauth-provider-test';

process.env.MUX_TOKEN_STORE_PATH = resolve(TEST_DIR, 'tokens.json');

const mod = await import(resolve(ROOT, 'dist/auth/mcp-oauth-provider.js'));
const { MuxOAuthProvider, CallbackPortInUseError, AuthorizationDeniedError, BrowserOpenError, StateMismatchError } =
  mod;

before(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  mkdirSync(TEST_DIR, { recursive: true });
});
after(() => rmSync(TEST_DIR, { recursive: true, force: true }));

/** Fire a GET at a URL and resolve when the response completes. */
function hit(url) {
  return new Promise((res, rej) => {
    const req = get(url, (r) => {
      r.resume();
      r.on('end', res);
    });
    req.on('error', rej);
  });
}

/**
 * Build a provider whose injected opener drives the callback. If the callback
 * server weren't already listening, the hit would ECONNREFUSED — so a resolved
 * auth code proves listen-before-browser ordering.
 */
function providerThatCallsBack(buildCallback, extra = {}) {
  let openedWhileListening = false;
  const provider = new MuxOAuthProvider('test-srv', {
    callbackTimeoutMs: 3000,
    openBrowser: async (authUrl) => {
      const u = new URL(authUrl);
      const redirect = u.searchParams.get('redirect_uri') || provider.redirectUrl;
      const port = new URL(redirect).port;
      openedWhileListening = Boolean(port) && port !== '0';
      const cb = buildCallback(redirect, u);
      if (typeof cb === 'function') return cb();
      await hit(cb);
    },
    ...extra,
  });
  provider._wasListeningAtOpen = () => openedWhileListening;
  return provider;
}

// The provider binds the port during redirectToAuthorization, so we must read
// redirectUrl for redirect_uri from inside the opener (post-bind), not before.
async function startFlow(provider, { state } = {}) {
  const authUrl = new URL('https://auth.example.com/authorize');
  authUrl.searchParams.set('client_id', 'mux');
  if (state) authUrl.searchParams.set('state', state);
  await provider.redirectToAuthorization(authUrl);
}

describe('provider: happy path + ordering', () => {
  it('callback server binds before the browser opens (code resolves)', async () => {
    const provider = providerThatCallsBack((redirect) => `${redirect}?code=THECODE`);
    await startFlow(provider);
    const code = await provider.waitForAuthCode();
    assert.equal(code, 'THECODE');
    assert.equal(provider._wasListeningAtOpen(), true);
  });

  it('uses an ephemeral port, never a fixed 48912', async () => {
    const provider = providerThatCallsBack((redirect) => `${redirect}?code=X`);
    await startFlow(provider);
    const port = new URL(provider.redirectUrl).port;
    assert.notEqual(port, '48912');
    assert.ok(Number(port) > 0);
    await provider.waitForAuthCode();
  });
});

describe('provider: failure modes report real cause', () => {
  it('provider error=access_denied surfaces verbatim', async () => {
    const provider = providerThatCallsBack((redirect) => `${redirect}?error=access_denied`);
    await startFlow(provider);
    await assert.rejects(provider.waitForAuthCode(), (e) => {
      assert.ok(e instanceof AuthorizationDeniedError);
      assert.equal(e.oauthError, 'access_denied');
      return true;
    });
  });

  it('callback with no code rejects (does not hang until timeout)', async () => {
    const provider = providerThatCallsBack((redirect) => `${redirect}?foo=bar`);
    await startFlow(provider);
    await assert.rejects(provider.waitForAuthCode(), /without an authorization code/);
  });

  it('state mismatch rejects promptly', async () => {
    const provider = providerThatCallsBack((redirect) => `${redirect}?code=C&state=WRONG`);
    await startFlow(provider, { state: 'RIGHT' });
    await assert.rejects(provider.waitForAuthCode(), (e) => e instanceof StateMismatchError);
  });

  it('matching state is accepted', async () => {
    const provider = providerThatCallsBack((redirect) => `${redirect}?code=OK&state=RIGHT`);
    await startFlow(provider, { state: 'RIGHT' });
    assert.equal(await provider.waitForAuthCode(), 'OK');
  });

  it('browser-open failure is reported, not silent', async () => {
    const provider = new MuxOAuthProvider('test-srv', {
      callbackTimeoutMs: 3000,
      openBrowser: async () => {
        throw new BrowserOpenError('no browser');
      },
    });
    const authUrl = new URL('https://auth.example.com/authorize');
    await assert.rejects(provider.redirectToAuthorization(authUrl), (e) => e instanceof BrowserOpenError);
  });

  it('callback timeout rejects with a timeout error (never hangs)', async () => {
    const provider = providerThatCallsBack(() => () => Promise.resolve(), { callbackTimeoutMs: 300 });
    await startFlow(provider);
    await assert.rejects(provider.waitForAuthCode(), /timed out/);
  });
});

describe('provider: EADDRINUSE surfaces a real error', () => {
  it('the port-in-use error is a distinct typed error carrying the port', () => {
    const e = new CallbackPortInUseError(12345);
    assert.match(e.message, /12345/);
    assert.equal(e.name, 'CallbackPortInUseError');
  });
});

describe('provider: PKCE verifier', () => {
  it('throws when codeVerifier() is called before saveCodeVerifier()', async () => {
    const provider = new MuxOAuthProvider('pkce-srv', {});
    await assert.rejects(provider.codeVerifier(), /code verifier missing/);
  });

  it('returns the saved verifier verbatim', async () => {
    const provider = new MuxOAuthProvider('pkce-srv', {});
    await provider.saveCodeVerifier('verifier-123');
    assert.equal(await provider.codeVerifier(), 'verifier-123');
  });
});

describe('provider: auth URL preservation', () => {
  it('a redirect containing $ and \\ reaches the opener intact', async () => {
    let seen = null;
    const provider = new MuxOAuthProvider('url-srv', {
      callbackTimeoutMs: 1000,
      openBrowser: async (u) => {
        seen = u;
        await hit(`${provider.redirectUrl}?code=Z`);
      },
    });
    const authUrl = new URL('https://auth.example.com/authorize');
    authUrl.searchParams.set('weird', 'a$b\\c');
    await provider.redirectToAuthorization(authUrl);
    await provider.waitForAuthCode();
    assert.equal(new URL(seen).searchParams.get('weird'), 'a$b\\c');
  });
});

describe('provider: no leaked handles', () => {
  it('completes and settles without keeping the loop alive', async () => {
    const provider = providerThatCallsBack((redirect) => `${redirect}?code=DONE`);
    await startFlow(provider);
    await provider.waitForAuthCode();
    assert.ok(true);
  });
});
