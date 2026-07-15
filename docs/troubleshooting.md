## Troubleshooting

### 1. Enable Debug Logs

If something isn't working, start by enabling verbose logging:

```bash
# Set log level to debug (default is 'info')
export MUX_LOG_LEVEL=debug

# Run mux — all internal decisions are logged to stderr
mux
```

Log levels: `error` → `warn` → `info` → `debug`

Logs are written to **stderr** so they don't interfere with MCP protocol messages on stdout. Look for lines like:

```
[MUX] [debug] [2026-07-15T04:30:07.016Z] Routing call: gitlab.list_merge_requests (attempt 1)
[MUX] [info]  [2026-07-15T04:30:07.200Z] Server "datadog" returned 401. Probing OAuth discovery...
```

---

### 2. Client Registration Issues

**Symptoms:** OAuth flow starts but fails with "invalid_client", or the server rejects your authorization request.

**Fix:** Delete the cached client registrations and let Mux re-register:

```bash
rm ~/.mux/clients.json
```

Then retry connecting to the server — Mux will perform fresh dynamic client registration.

---

### 3. Token / Auth Issues

**Symptoms:** Server was previously authorized but now returns 401, token refresh fails, or auth flow hangs despite having tokens.

**Fix:** Delete the cached tokens and re-authorize:

```bash
rm ~/.mux/tokens.json
```

Then trigger re-auth:

```bash
mux-cli auth --all
# or for a specific server:
mux-cli auth <server-name>
```

---

### 4. Full Reset (Nuclear Option)

If nothing else works, remove the entire `.mux` directory and start fresh:

```bash
rm -rf ~/.mux
```

Then re-run setup:

```bash
mux-cli setup
```

This removes all cached tokens, client registrations, metrics, and the tool catalog. Servers will need to be re-authorized on next use.

---

### 5. Server Won't Connect

**Symptoms:** Server times out or returns unexpected errors.

**Checklist:**
- Is the server URL reachable? `curl -I <url>`
- For stdio servers: is the command installed? Run it manually to check.
- For HTTP servers with API keys: are the env vars set? Check with `echo $VAR_NAME`
- Is the server disabled in your registry? Check `~/.mux/servers.json`

---

### 6. Port Conflict (OAuth Callback)

**Symptoms:** `EADDRINUSE: address already in use :::48912` during auth.

**Fix:** Something else is using port 48912. Kill it:

```bash
lsof -ti:48912 | xargs kill -9
```

Then retry the auth flow.

---

### 7. Still Not Working?

If none of the above solves your issue:

1. Run with `MUX_LOG_LEVEL=debug` and capture the full output
2. Open an issue at [github.com/BhavanPatel/mux/issues](https://github.com/BhavanPatel/mux/issues) with:
   - Debug log output (redact any tokens/secrets)
   - Your `~/.mux/servers.json` (redact sensitive values)
   - Node version (`node -v`)
   - OS and shell
