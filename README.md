<div align="center">
  <br/>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/MUX-MCP_Gateway_Router-a78bfa?style=for-the-badge&labelColor=0d1117">
    <img alt="Mux" src="https://img.shields.io/badge/MUX-MCP_Gateway_Router-a78bfa?style=for-the-badge&labelColor=0d1117">
  </picture>
  <br/><br/>
  <strong>One MCP to rule them all.</strong>
  <br/>
  <sub>A lightweight gateway that multiplexes multiple MCP servers behind a single always-on endpoint.</sub>
  <br/><br/>
  <a href="https://mux-gateway.vercel.app"><img src="https://img.shields.io/badge/Website-Live-a78bfa?style=flat-square&logo=vercel&logoColor=white" alt="Website"></a>
  <a href="docs/architecture.md"><img src="https://img.shields.io/badge/Architecture-docs-7c3aed?style=flat-square&logo=buffer&logoColor=white" alt="Architecture"></a>
  <a href="docs/cli.md"><img src="https://img.shields.io/badge/CLI_Reference-docs-f59e0b?style=flat-square&logo=gnubash&logoColor=white" alt="CLI"></a>
  <a href="docs/auth.md"><img src="https://img.shields.io/badge/Auth-docs-10b981?style=flat-square&logo=letsencrypt&logoColor=white" alt="Auth"></a>
  <br/>
  <img src="https://img.shields.io/badge/version-1.0.0-a78bfa?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node">
  <img src="https://img.shields.io/badge/MCP_SDK-1.12.1-a78bfa?style=flat-square" alt="MCP SDK">
  <img src="https://img.shields.io/badge/tests-46_passing-10b981?style=flat-square" alt="Tests">
  <img src="https://img.shields.io/badge/license-MIT-yellow?style=flat-square" alt="License">
  <br/><br/>
  <a href="https://mux-gateway.vercel.app"><strong>Visit the Website</strong></a>
  <br/><br/>
</div>

---

## Why Mux?

> [!IMPORTANT]
> Running 15+ MCP servers = **50+ tools** in your AI's context window, wasted RAM, and constant OAuth re-auth. Mux reduces this to **4 tools, 1 process, zero re-auth**.

Modern AI editors (Kiro, Cursor, Claude Desktop) connect to MCP servers for tool access. In real-world setups, you accumulate **10-20+ servers** — GitLab, Jira, Elasticsearch, Datadog, Sitecore, Slack, and more. Running them all simultaneously creates three critical issues:

| Issue | Impact |
|:------|:-------|
| **Context bloat** | Every server's tool schemas consume AI context tokens. 15 servers = 50+ tools competing for attention. |
| **Resource waste** | Each server runs as a separate process consuming RAM, even if unused for hours. |
| **Re-authentication** | OAuth-based servers lose their session when disabled, requiring browser re-auth every single time. |

---

## The Solution

Mux sits between your AI client and all your MCP servers. It exposes **exactly 4 tools** — regardless of how many downstream servers exist. Servers are spawned on demand, killed when idle, and their auth tokens persist across sessions.

> ### Before Mux

```mermaid
graph LR
    Client[AI Client<br/>Kiro/Cursor] --> GitLab[GitLab MCP<br/>8 tools]
    Client --> Jira[Jira MCP<br/>12 tools]
    Client --> Elastic[Elasticsearch<br/>6 tools]
    Client --> Datadog[Datadog MCP<br/>9 tools]
    Client --> Sitecore[Sitecore MCP<br/>15 tools]
    Client --> Slack[Slack MCP<br/>5 tools]

    style Client fill:#1a1a2e,stroke:#a78bfa,color:#fff
    style GitLab fill:#2d2d44,stroke:#f59e0b,color:#fff
    style Jira fill:#2d2d44,stroke:#f59e0b,color:#fff
    style Elastic fill:#2d2d44,stroke:#f59e0b,color:#fff
    style Datadog fill:#2d2d44,stroke:#f59e0b,color:#fff
    style Sitecore fill:#2d2d44,stroke:#f59e0b,color:#fff
    style Slack fill:#2d2d44,stroke:#f59e0b,color:#fff
```

<img src="https://img.shields.io/badge/55+_tools_in_context-ef4444?style=flat-square" /> <img src="https://img.shields.io/badge/6_processes_always_running-ef4444?style=flat-square" /> <img src="https://img.shields.io/badge/OAuth_re--auth_every_toggle-ef4444?style=flat-square" />

> ### After Mux

```mermaid
graph LR
    Client[AI Client<br/>Kiro/Cursor] --> Mux[MUX<br/>4 tools]
    Mux -.->|on demand| GitLab[GitLab MCP]
    Mux -.->|on demand| Jira[Jira MCP]
    Mux -.->|on demand| Elastic[Elasticsearch]
    Mux -.->|on demand| Datadog[Datadog MCP]

    style Client fill:#1a1a2e,stroke:#a78bfa,color:#fff
    style Mux fill:#0d3b66,stroke:#a78bfa,color:#fff,stroke-width:3px
    style GitLab fill:#1a1a2e,stroke:#10b981,color:#fff
    style Jira fill:#1a1a2e,stroke:#10b981,color:#fff
    style Elastic fill:#1a1a2e,stroke:#10b981,color:#fff
    style Datadog fill:#1a1a2e,stroke:#10b981,color:#fff
```

<img src="https://img.shields.io/badge/4_tools_in_context-10b981?style=flat-square" /> <img src="https://img.shields.io/badge/1_process_running-10b981?style=flat-square" /> <img src="https://img.shields.io/badge/OAuth_cached--no_re--auth-10b981?style=flat-square" />

---

## Install

```bash
npm install -g mux-mcp-gateway
```

Or via the install script:

```bash
curl -sL https://mux-gateway.vercel.app/install.sh | bash
```

Then run:

```bash
mux-cli
```

That's it. Mux imports your existing MCP config, patches your AI client, and you're done.

---

## How It Works

| Step | What happens |
|------|-------------|
| 1 | AI calls `mux_call_tool("gitlab", "list_mrs", {...})` |
| 2 | Mux spawns GitLab MCP server (if not running) |
| 3 | Routes the call, returns the result |
| 4 | After 5 min idle → kills the connection |

Your AI only sees **4 tools** regardless of how many servers are registered.

---

## Documentation

| | |
|:--|:--|
| <a href="docs/cli.md"><img src="https://img.shields.io/badge/CLI_Reference-a78bfa?style=flat-square&logo=gnubash&logoColor=white" alt="CLI"></a> | [All `mux-cli` commands — setup, add, remove, auth, health, metrics, keywords](docs/cli.md) |
| <a href="docs/config.md"><img src="https://img.shields.io/badge/Configuration-a78bfa?style=flat-square&logo=json&logoColor=white" alt="Config"></a> | [`servers.json` schema, environment variables, hot-reload registry](docs/config.md) |
| <a href="docs/clients.md"><img src="https://img.shields.io/badge/Client_Integration-a78bfa?style=flat-square&logo=databricks&logoColor=white" alt="Clients"></a> | [Setup guides for Kiro, Cursor, and Claude Desktop](docs/clients.md) |
| <a href="docs/architecture.md"><img src="https://img.shields.io/badge/Architecture-7c3aed?style=flat-square&logo=buffer&logoColor=white" alt="Architecture"></a> | [System design, pool manager, transport layer, data flow](docs/architecture.md) |
| <a href="docs/tools.md"><img src="https://img.shields.io/badge/Tools_Exposed-7c3aed?style=flat-square&logo=hackthebox&logoColor=white" alt="Tools"></a> | [`mux_list_servers` · `mux_call_tool` · `mux_find_tool` · `mux_status`](docs/tools.md) |
| <a href="docs/auth.md"><img src="https://img.shields.io/badge/Authentication-7c3aed?style=flat-square&logo=letsencrypt&logoColor=white" alt="Auth"></a> | [OAuth flow, token caching, persistent sessions across restarts](docs/auth.md) |
| <a href="docs/lifecycle.md"><img src="https://img.shields.io/badge/Server_Lifecycle-10b981?style=flat-square&logo=circleci&logoColor=white" alt="Lifecycle"></a> | [Spawn → active → idle → reaped state machine](docs/lifecycle.md) |
| <a href="docs/comparison.md"><img src="https://img.shields.io/badge/Before_vs_After-10b981?style=flat-square&logo=lighthouse&logoColor=white" alt="Comparison"></a> | [Context reduction, resource savings, auth improvements](docs/comparison.md) |
| <a href="docs/tech-stack.md"><img src="https://img.shields.io/badge/Tech_Stack-10b981?style=flat-square&logo=stackblitz&logoColor=white" alt="Tech Stack"></a> | [Runtime, build tools, supported transports](docs/tech-stack.md) |
| <a href="docs/development.md"><img src="https://img.shields.io/badge/Development-f59e0b?style=flat-square&logo=githubactions&logoColor=white" alt="Development"></a> | [Project structure, test suite, local dev workflow](docs/development.md) |

---

## Why run locally?

Mux runs as a local stdio process by design. Your credentials (tokens, API keys) stay on your machine — they're injected via environment variables and never leave your shell session. Downstream servers enforce access based on **your** tokens, so Mux has no elevated privileges.

This means:
- No shared credential store to secure
- No multi-tenancy complexity
- No token management service needed
- OAuth tokens persist in `~/.mux/tokens.json` (AES-256-GCM encrypted, 0600 permissions)

---

## Quick CLI Reference

```bash
mux-cli setup              # Import from existing mcp.json
mux-cli add <name> '<json>'  # Add a server
mux-cli remove <name>      # Remove a server
mux-cli auth --all         # Authorize all HTTP servers
mux-cli health             # Health check
mux-cli list               # Show servers + status
mux-cli metrics            # Usage insights dashboard
mux-cli keywords [name]    # View/edit keywords
mux-cli update             # Update to latest version
mux-cli uninstall          # Remove Mux completely
```

---

## Author

<p>
  <a href="https://github.com/BhavanPatel"><img src="https://img.shields.io/badge/Bhavan_Patel-a78bfa?style=for-the-badge&logo=github&logoColor=white" alt="Author"></a>
  <br/>
  <a href="https://github.com/BhavanPatel"><img src="https://img.shields.io/badge/GitHub-BhavanPatel-0d1117?style=flat-square&logo=github&logoColor=white" alt="GitHub"></a>
  <a href="https://mux-gateway.vercel.app"><img src="https://img.shields.io/badge/Website-mux--gateway-a78bfa?style=flat-square&logo=vercel&logoColor=white" alt="Website"></a>
</p>

## License

MIT
