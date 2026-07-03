## Development

```bash
npm install             # Install dependencies
npm run build           # Build once (outputs to dist/)
npm run dev             # Build with file watcher
npm start               # Run the server directly (for testing)
npm test                # Run full E2E test suite (46 assertions)
```

### Testing

```bash
npm test
```

Runs the full E2E suite in one command — no external tools needed:

| Part | What It Tests | Assertions |
|:-----|:-------------|:-----------|
| **Unit Tests** | Keyword scoring, server resolution, typo tolerance, tool discovery, cross-server search, cache expiry | ~50 |
| **MCP Protocol** | Connection, 4 tools, list_servers, call_tool, find_tool, status, auto-routing, pool state, error handling, tool catalog | 34 |
| **CLI Commands** | help, add (HTTP/stdio), list, health, status, metrics, keywords, remove, error on nonexistent | 19 |
| **JSONC Parser** | Strips `//` comments, preserves `https://`, removes commented entries | 3 |

Tests use a real downstream MCP server (echo) spawned in a temp directory. Full cleanup on exit — no side effects.

### Testing Locally

Send MCP protocol messages directly:

```bash
# Initialize + list tools
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | node dist/index.js
```

### Debugging

Set `MUX_LOG_LEVEL=debug` to see all routing decisions, connection events, and auth flows on stderr.

---


## Project Structure

<details>
<summary>Click to expand full project structure</summary>

```
mux/
│
├── src/
│   ├── index.ts                 # Entry — env loading, metrics, bootstrap, shutdown
│   ├── server.ts                # MCP server (4 tools: list, call, find_tool, status)
│   ├── registry.ts              # Registry loader + hot-reload + scored keyword matching
│   ├── pool.ts                  # Connection pool + idle reaper + auto-retry on failure
│   ├── keyword-extractor.ts     # Extracts keywords from tool names/descriptions for auto-tagging
│   ├── tool-catalog.ts          # Persistent store of discovered tool schemas (~/.mux/tool-catalog.json, 1h TTL)
│   ├── tool-discovery.ts        # Search tools across servers, resolve server by tool name
│   ├── metrics.ts               # Event tracking, time aggregation, insights
│   ├── logger.ts                # Structured stderr logger
│   ├── env.ts                   # Shell env extraction (zsh -ilc env)
│   │
│   ├── transport/
│   │   ├── stdio.ts             # Spawn child process, MCP client over stdio
│   │   └── http.ts              # HTTP/SSE client + OAuth retry flow
│   │
│   └── auth/
│       ├── mcp-oauth-provider.ts # OAuthClientProvider — browser flow + token cache
│       ├── token-store.ts       # Read/write ~/.mux/tokens.json (chmod 600)
│       └── oauth.ts             # Legacy manual OAuth (fallback)
│
├── scripts/
│   ├── parse_jsonc.py           # JSONC parser (strips // comments safely)
│   ├── lib/
│   │   ├── theme.sh            # ANSI colors, box drawing, header with commands
│   │   └── registry.sh         # Path constants, has/ensure/require helpers
│   └── commands/
│       ├── setup.sh            # Fresh import (5-step wizard, auto-keywords)
│       ├── add.sh              # Add server (JSON one-liner, paste, interactive)
│       ├── remove.sh           # Remove by name
│       ├── auth.sh             # OAuth flow (single + --all with polling)
│       ├── health.sh           # Readiness table (pass/warn/fail)
│       ├── list.sh             # Server table + status + keywords
│       ├── status.sh           # Process info (PIDs, counts)
│       ├── metrics.sh          # Insights dashboard (charts, context reduction)
│       ├── keywords.sh         # View/edit server keywords (add/replace)
│       └── update.sh           # git pull + npm build
│
├── test/
│   ├── test.sh                  # E2E runner (orchestrates all parts)
│   ├── test-mcp.mjs            # MCP protocol tests (Node.js SDK client)
│   ├── test-keyword-matching.mjs # Unit tests for keyword scoring and server resolution
│   └── test-tool-discovery.mjs  # Unit tests for cross-server tool search and cache
│
├── docs/                        # Detailed documentation (split from README)
│   ├── architecture.md
│   ├── tools.md
│   ├── cli.md
│   ├── auth.md
│   ├── config.md
│   ├── clients.md
│   ├── comparison.md
│   ├── tech-stack.md
│   ├── development.md
│   └── lifecycle.md
│
├── website/                     # Next.js product showcase (deployed to Vercel)
│   ├── app/
│   └── components/
│
├── mux.sh                       # CLI entry point (symlinked as mux-cli)
├── .github/workflows/           # GitHub Actions CI (build, test, publish)
├── .hooks/post-commit           # Auto version bump + changelog
├── CHANGELOG.md                 # Auto-generated changelog
├── servers.example.json         # Example registry file
├── package.json                 # mux-mcp-gateway
├── tsconfig.json
└── tsup.config.ts
```

</details>

---

### One-Command Install (Development)

```bash
git clone https://github.com/BhavanPatel/mux.git && cd mux
npm run install-cli    # npm install + build + npm link → mux-cli available globally
```

### Updating

```bash
npm update -g mux-mcp-gateway
```

### npm Registry

Published to npmjs.org:
```
mux-mcp-gateway
https://www.npmjs.com/package/mux-mcp-gateway
```
