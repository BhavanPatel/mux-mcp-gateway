## Troubleshooting

### 1. Enable Debug Logs

If something isn't working, start by enabling verbose logging:

```bash
# Add these env vars to your mux config in mcp.json:
"env": {
  "MUX_LOG_LEVEL": "debug",
  "MUX_LOG_TO_FILE": "true"
}

# Then tail the log in a separate terminal:
tail -f ~/.mux/mux.log
```

```bash
# Or when running mux manually (stderr only):
export MUX_LOG_LEVEL=debug
mux
```

Log levels: `error` → `warn` → `info` → `debug`

Logs include timestamps and context:

```
[MUX] [info]  [2026-07-15T04:30:07.200Z] Server "datadog" returned 401. Probing OAuth discovery...
[MUX] [debug] [2026-07-15T04:30:07.500Z] OAuth discovery confirmed for "datadog"
[MUX] [debug] [2026-07-15T04:30:08.016Z] Routing call: gitlab.list_merge_requests (attempt 1)
```

> [!TIP]
> When using Kiro or Cursor, stderr goes to the client's internal logs which are hard to access. Always use `MUX_LOG_TO_FILE=true` for debugging.

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

### 7. Auto-Approve Not Working

**Symptoms:** AI client asks for approval on every mux tool call.

**Fix:** Add `autoApprove` to your mux entry in your client's MCP config:

```json
{
  "mcpServers": {
    "mux": {
      "command": "node",
      "args": ["/path/to/mux/dist/index.js"],
      "env": {
        "MUX_LOG_LEVEL": "info",
        "MUX_REGISTRY_PATH": "~/.mux/servers.json"
      },
      "autoApprove": [
        "mux_list_servers",
        "mux_call_tool",
        "mux_find_tool",
        "mux_status"
      ]
    }
  }
}
```

> [!TIP]
> `mux-cli setup` adds all 4 tools to autoApprove automatically.

**Kiro users:** `mux-cli setup` also installs a PreToolUse hook at `~/.kiro/hooks/mux-auto-approve.json` that auto-approves Mux tool calls without prompting. If you need to remove it, run `mux-cli uninstall` or delete the file manually.

**Cursor users:** Setup installs a rules file at `~/.cursor/rules/mux-auto-approve.mdc` as an additional signal.

---

### 8. Still Not Working?

If none of the above solves your issue:

1. Run with `MUX_LOG_LEVEL=debug` and capture the full output
2. Open an issue at [github.com/BhavanPatel/mux/issues](https://github.com/BhavanPatel/mux/issues) with:
   - Debug log output (redact any tokens/secrets)
   - Your `~/.mux/servers.json` (redact sensitive values)
   - Node version (`node -v`)
   - OS and shell
