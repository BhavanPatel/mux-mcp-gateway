## CLI Reference

All management happens through the `mux` binary.

### Invocation model

`mux` behaves differently depending on how it's invoked:

- **Interactive TUI dashboard** — running `mux` with **no subcommand in a TTY** launches the interactive dashboard.
- **Headless MCP gateway** — `mux serve`, **or any non-TTY / piped invocation**, runs the headless MCP gateway on stdio. This is what AI clients call.

The gateway exposes exactly **4 MCP tools** regardless of how many servers are registered: `mux_list_servers`, `mux_call_tool`, `mux_find_tool`, `mux_status`.

### Global flags

These flags apply across commands:

| Flag | Description |
|:-----|:------------|
| `--json` | Emit machine-readable JSON output |
| `--yes`, `-y` | Skip confirmation prompts |
| `--dry-run` | Show what would happen without making changes |
| `--plain` | Plain output (no decorative formatting) |
| `--no-color` | Disable colored output |
| `--version` | Print the version and exit |
| `--help` | Show help and exit |

### Commands

| Command | Description | Example |
|:--------|:------------|:--------|
| `mux` | Launch the interactive TUI dashboard (TTY only) | `mux` |
| `mux serve` | Run the MCP gateway on stdio (default when non-TTY) | `mux serve` |
| `mux add <name> --transport <http\|stdio> [flags]` | Add a server using flags | `mux add gitlab --transport http --url https://...` |
| `mux remove <name>` | Remove a server | `mux remove gitlab` |
| `mux edit <name> [--keyword <kw> ...]` | Edit a server's keywords | `mux edit gitlab --keyword ci --keyword mr` |
| `mux auth <name>` | Trigger OAuth for a single HTTP server | `mux auth gitlab` |
| `mux health [name]` | Health check all servers, or one by name | `mux health gitlab` |
| `mux metrics` | Usage stats, charts, credit savings (%) | `mux metrics` |
| `mux doctor` | Diagnose common configuration issues | `mux doctor` |
| `mux logs [flags]` | View gateway logs | `mux logs --lines 100 --follow` |
| `mux report-bug` | Open a pre-filled bug report | `mux report-bug` |
| `mux update` | Pull latest code + rebuild | `mux update` |
| `mux uninstall` | Remove Mux completely (hooks, config, registry) | `mux uninstall` |
| `mux config restore` | Restore configuration | `mux config restore` |
| `mux completion` | Generate shell completion script | `mux completion` |

### `mux add` flags

| Flag | Description |
|:-----|:------------|
| `--transport <http\|stdio>` | **Required.** Server transport type |
| `--url <url>` | Endpoint URL (for `http` transport) |
| `--command <cmd>` | Command to spawn (for `stdio` transport) |
| `--args ...` | Arguments passed to the command |
| `--env KEY=VALUE ...` | Environment variables |
| `--header KEY=VALUE ...` | HTTP headers |
| `--keyword <kw> ...` | Routing keywords for the server |

<details>
<summary>See add examples</summary>

```bash
# HTTP server
mux add gitlab --transport http --url https://gitlab.example.com/api/v4/mcp

# HTTP server with headers and keywords
mux add gitlab --transport http --url https://gitlab.example.com/api/v4/mcp \
  --header Authorization="Bearer $TOKEN" --keyword ci --keyword mr

# Stdio server with args and env vars
mux add elastic --transport stdio --command uvx \
  --args --python 3.12 elasticsearch-mcp-server \
  --env ELASTICSEARCH_HOSTS=https://es.prod:9200
```

</details>

### `mux logs` flags

| Flag | Description |
|:-----|:------------|
| `--lines <n>` | Number of lines to show |
| `--since <30s\|15m\|2h\|3d\|1w\|ISO>` | Only show logs since a duration or ISO timestamp |
| `--follow`, `-f` | Stream new log lines as they arrive |

<details>
<summary>See logs examples</summary>

```bash
mux logs --lines 100                # Last 100 lines
mux logs --since 15m                # Logs from the last 15 minutes
mux logs --follow                   # Stream live logs
```

</details>

### `mux auth` example

```bash
mux auth gitlab                     # Authorize a single HTTP server (opens browser)
```

---
