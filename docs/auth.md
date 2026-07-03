## Authentication

### How Auth Works

```mermaid
flowchart TD
    A[Tool call for HTTP server] --> B{Check ~/.mux/tokens.json}
    B -->|Token valid| F[Inject Bearer token]
    B -->|Token expired| C{Has refresh_token?}
    B -->|No token| E[Open browser for OAuth]
    C -->|Yes| D[Refresh token automatically]
    C -->|No| E
    D --> F
    E --> G[User authorizes in browser]
    G --> H[Callback to localhost:48912]
    H --> I[Exchange code for tokens]
    I --> J[Save to ~/.mux/tokens.json]
    J --> F
    F --> K[Connect to downstream server]

    style A fill:#1a1a2e,stroke:#00d4ff,color:#fff
    style F fill:#1a1a2e,stroke:#10b981,color:#fff
    style K fill:#1a1a2e,stroke:#10b981,color:#fff
    style E fill:#1a1a2e,stroke:#f59e0b,color:#fff
```

### Auth Types Supported

| Type | Config | Behavior |
|:-----|:-------|:---------|
| **None** | No `env`/`headers`/`auth` | Direct connection, no credentials |
| **Env tokens** | `env: { "TOKEN": "${VAR}" }` | Injected from shell environment at startup |
| **Static headers** | `headers: { "X-API-Key": "${KEY}" }` | Injected into every HTTP request |
| **OAuth (browser)** | Server returns 401 | Mux opens browser → you authorize → token cached |

### Browser-Based OAuth (HTTP Servers)

Most HTTP MCP servers (GitLab, Jira, Slack, ServiceNow, Datadog, Sitecore) use the **MCP protocol's built-in OAuth**. When Mux connects and gets a 401:

1. The MCP SDK discovers the server's OAuth metadata automatically
2. Mux opens your browser with the authorization URL
3. You click "Authorize" in the browser
4. Browser redirects back to `localhost:48912/callback`
5. Mux exchanges the auth code for tokens and caches them

**This is the same flow as Kiro IDE/CLI** — no extra configuration needed. First call triggers auth, subsequent calls use the cached token. If the token expires, it auto-refreshes using the refresh token.

> [!TIP]
> Pre-authorize all HTTP servers after setup: `mux-cli auth --all`

### Token Persistence

Tokens are stored in `~/.mux/tokens.json` with file permissions `0600` (owner read/write only).

```json
{
  "sitecore": {
    "accessToken": "eyJ...",
    "refreshToken": "dGhp...",
    "expiresAt": 1719320400000,
    "scopes": ["openid", "sitecore.profile"]
  }
}
```

**Token lifecycle:**
- Cached token valid → used immediately (no browser popup)
- Token expiring within 60s → refreshed automatically via refresh_token
- Refresh token expired → one-time browser OAuth flow, new tokens cached
- Server disabled/re-enabled → tokens survive (that's the whole point)

---
