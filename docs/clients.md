## Client Integration

> [!NOTE]
> **No manual process management needed.** Once setup completes, your AI client automatically starts Mux when a session opens and stops it when the session closes. Mux runs as a managed child process — just like any other MCP server in your config. You never need to run `node dist/index.js` yourself.

### Kiro CLI / Kiro IDE

<details>
<summary><code>~/.kiro/settings/mcp.json</code></summary>

```json
{
  "mcpServers": {
    "mux": {
      "command": "node",
      "args": ["/absolute/path/to/mux/dist/index.js"],
      "env": {
        "MUX_LOG_LEVEL": "info"
      },
      "disabled": false,
      "autoApprove": ["mux_list_servers"]
    }
  }
}
```

</details>

### Cursor

<details>
<summary><code>~/.cursor/mcp.json</code></summary>

```json
{
  "mcpServers": {
    "mux": {
      "command": "node",
      "args": ["/absolute/path/to/mux/dist/index.js"],
      "disabled": false
    }
  }
}
```

</details>

### Claude Desktop

<details>
<summary><code>~/Library/Application Support/Claude/claude_desktop_config.json</code></summary>

```json
{
  "mcpServers": {
    "mux": {
      "command": "node",
      "args": ["/absolute/path/to/mux/dist/index.js"]
    }
  }
}
```

</details>

---

### Auto-Approve Hooks

`mux-cli setup` automatically installs client-specific auto-approve mechanisms:

| Client | Mechanism | Location |
|--------|-----------|----------|
| Kiro | PreToolUse hook | `~/.kiro/hooks/mux-auto-approve.json` |
| Cursor | Rules file + `autoApprove` in config | `~/.cursor/rules/mux-auto-approve.mdc` |
| Claude Desktop | No action needed (trusts configured servers) | — |

> [!TIP]
> These are non-destructive — setup won't overwrite existing hook/rule files. Run `mux-cli uninstall` to remove them.
