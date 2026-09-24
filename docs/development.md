## Development

```bash
npm install             # Install dependencies
npm run build           # Build once (outputs to dist/)
npm run dev             # Build with file watcher
npm start               # Run the server directly (for testing)
npm test                # Run the full test suite (unit + e2e) via test:ci
```

### Testing

```bash
npm run test:ci         # unit + e2e — the single verification path
npm run test:unit       # node:test unit + auth suites
npm run test:e2e        # end-to-end: spawn the built gateway
```

No external tools needed — the e2e suites spawn a real downstream MCP server
(echo) in a temp directory and clean up on exit.

| Suite | What it tests | Location |
|:------|:-------------|:---------|
| **Unit** | keyword scoring & server resolution, tool discovery, redaction, metrics, doctor checks, errors/crash mapping, logger, config schema/writer, pool policy, version | `test/unit/` |
| **Auth** | OAuth provider flow, token encryption/read | `test/auth/` |
| **E2E — MCP** (34) | connection, the 4 tools, list_servers/call_tool/find_tool/status, auto-routing, pool state, error handling, tool catalog | `test/e2e/test-mcp.mjs` |
| **E2E — Pool** (14) | connection pool, idle reaping, retry/circuit-breaker on failure | `test/e2e/test-pool.mjs` |
| **E2E — CLI** (33) | subcommands, `--json`/`--plain`, headless (non-TTY) fallback, version, error on unknown command | `test/e2e/test-cli.mjs` |

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
│   ├── index.ts                 # Entry — installs crash handlers, boots gateway or CLI/TUI
│   ├── cli.ts                   # yargs command surface (serve/add/remove/auth/doctor/logs/…)
│   ├── cli-output.ts            # Shared CLI rendering (JSON vs human, --plain/--no-color)
│   ├── server.ts                # MCP server (4 tools: list, call, find_tool, status)
│   ├── registry.ts              # Registry loader + hot-reload + scored keyword matching
│   ├── config-schema.ts         # Registry/config schema (forward-compatible)
│   ├── config-writer.ts         # Atomic, fail-closed config writes + backup/restore
│   ├── pool.ts                  # Connection pool + idle reaper + auto-retry on failure
│   ├── pool-policy.ts           # Retry/circuit-breaker classification for pool calls
│   ├── keyword-extractor.ts     # Extracts keywords from tool names/descriptions
│   ├── tool-catalog.ts          # Persistent store of discovered tool schemas (~/.mux, TTL)
│   ├── tool-discovery.ts        # Search tools across servers, resolve server by tool name
│   ├── metrics.ts               # Local-only event tracking + aggregation (opt-out)
│   ├── logger.ts                # Dual-sink logger: human→stderr, NDJSON→~/.mux/mux.log
│   ├── redact.ts                # Secret redaction by key name and value shape
│   ├── errors.ts                # MuxError + exit-code mapping + redacted crash reports
│   ├── doctor-checks.ts         # `mux doctor` checks (loopback bind, client configs, log size)
│   ├── env.ts                   # Shell env extraction (zsh -ilc env)
│   ├── setup.ts                 # First-run scaffolding helpers
│   ├── version.ts               # Single source of version (reads package.json)
│   │
│   ├── transport/
│   │   ├── stdio.ts             # Spawn child process, MCP client over stdio
│   │   └── http.ts              # HTTP/SSE client + OAuth retry flow
│   │
│   ├── auth/
│   │   ├── index.ts             # Auth entry / token read helpers
│   │   ├── crypto.ts            # AES-256-GCM encrypt/decrypt for the token store
│   │   └── mcp-oauth-provider.ts # OAuthClientProvider — browser flow + token cache
│   │
│   └── tui/                     # Ink (React) terminal UI, shown when `mux` runs in a TTY
│       ├── App.tsx              # Root component + view routing
│       ├── env-flags.ts         # TTY / NO_COLOR / --plain detection
│       ├── styles.ts            # Colours + box-drawing helpers
│       ├── actions/             # auth, health-check, import-servers
│       ├── components/          # Banner, ServerList, ActionMenu, charts, Spinner, …
│       ├── hooks/               # useRegistry, usePool, useMetrics, useLayout, useAnimations
│       └── views/               # Dashboard, AddServer, EditServer, AuthFlow, HealthCheck,
│                                #   Metrics, Onboarding, RemoveServer, EditPicker, Help
│
├── test/
│   ├── unit/                    # node:test unit suites (*.mjs)
│   ├── e2e/                     # test-mcp, test-pool, test-cli (spawn the built gateway)
│   └── auth/                    # auth-provider / token-store tests
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
│   ├── lifecycle.md
│   └── troubleshooting.md
│
├── website/                     # Next.js product showcase (deployed to Vercel)
│   ├── app/
│   └── components/
│
├── dist/index.js                # Built CLI + gateway entry point (bin: `mux`)
├── .github/workflows/           # GitHub Actions CI (ci.yml, publish.yml)
├── .github/dependabot.yml       # Weekly npm + github-actions updates
├── .hooks/                      # git hooks (post-commit is a no-op; versioning is manual)
├── .c8rc.json                   # Coverage config (report-only)
├── eslint.config.js             # Lints src/ (typed) and test/ (untyped)
├── CHANGELOG.md                 # Hand-written changelog
├── LICENSE · SECURITY.md · CONTRIBUTING.md · CODEOWNERS · TELEMETRY.md
├── servers.example.json         # Example registry file
├── package.json                 # mux-mcp-gateway
├── tsconfig.json
└── tsup.config.ts
```
```

</details>

---

### One-Command Install (Development)

```bash
git clone https://github.com/BhavanPatel/mux.git && cd mux
npm run install-cli    # npm install + build + npm link → `mux` available globally
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
