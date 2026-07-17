## CLI Reference

All management happens through `mux-cli`:

| Command | Description | Example |
|:--------|:------------|:--------|
| `mux-cli` | Interactive menu (auto: setup if fresh, menu if configured) | `mux-cli` |
| `mux-cli --help` | Show branded help with all commands | `mux-cli --help` |
| `mux-cli setup` | Fresh import from existing mcp.json | `mux-cli setup --from ~/.kiro/settings/mcp.json --yes` |
| `mux-cli add <name> [json]` | Add a server (interactive or one-liner) | `mux-cli add gitlab '{"type":"https","url":"..."}'` |
| `mux-cli remove <name>` | Remove a server | `mux-cli remove gitlab` |
| `mux-cli auth [name\|--all]` | Trigger OAuth for HTTP server(s) | `mux-cli auth --all` |
| `mux-cli health` | Health check all servers | `mux-cli health` |
| `mux-cli list` | Show registered servers + auth status | `mux-cli list` |
| `mux-cli status` | Show Mux process info | `mux-cli status` |
| `mux-cli metrics` | Usage stats, charts, credit savings (%), token savings | `mux-cli metrics` |
| `mux-cli keywords [name]` | View all keywords, or add/replace for a server | `mux-cli keywords gitlab` |
| `mux-cli uninstall` | Remove Mux completely (hooks, config, registry) | `mux-cli uninstall` |
| `mux-cli update` | Pull latest code + rebuild | `mux-cli update` |

### Add Examples

<details>
<summary>See all add examples</summary>

```bash
# One-liner with raw MCP JSON (paste from your mcp.json)
mux-cli add my-gitlab '{"type":"https","url":"https://gitlab.example.com/api/v4/mcp"}'

# Stdio server with env vars
mux-cli add my-elastic '{"command":"uvx","args":["--python","3.12","elasticsearch-mcp-server"],"env":{"ELASTICSEARCH_HOSTS":"https://es.prod:9200"}}'

# Interactive (prompts for transport, URL/command, etc.)
mux-cli add my-server

# Interactive with JSON paste option
mux-cli add my-server
# → Choose "2) Paste JSON" → paste the server config object
```

</details>

### Remove Examples

<details>
<summary>See remove examples</summary>

```bash
mux-cli remove my-gitlab            # By name directly
mux-cli remove                       # Interactive (shows list, asks for name)
```

</details>

### Auth Examples

<details>
<summary>See auth examples</summary>

```bash
mux-cli auth --all                  # Auth ALL unauthorized HTTP servers one-by-one
mux-cli auth my-gitlab              # Auth a specific server (opens browser)
mux-cli auth                         # Interactive (shows HTTP servers + auth status, type 'all' or a name)
```

</details>

---
