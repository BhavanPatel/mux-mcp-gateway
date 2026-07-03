## Configuration

### Registry: `~/.mux/servers.json`

The registry declares all downstream MCP servers. It's hot-reloaded — edit and changes apply within 2 seconds.

```json
{
  "servers": {
    "server-name": {
      "transport": "stdio | http",

      "command": "npx",
      "args": ["-y", "package-name"],
      "env": { "KEY": "${ENV_VAR}" },

      "url": "https://...",
      "headers": { "Authorization": "Bearer ${TOKEN}" },
      "auth": {
        "type": "oauth",
        "tokenEndpoint": "https://auth.example.com/oauth/token",
        "clientId": "client-id",
        "scopes": ["scope1", "scope2"]
      },

      "keywords": ["search", "terms"],
      "idleTimeoutMs": 300000
    }
  }
}
```

#### Field Reference

| Field | Transport | Required | Description |
|:------|:----------|:---------|:------------|
| `transport` | both | yes | `"stdio"` or `"http"` |
| `command` | stdio | yes | Command to spawn (e.g., `npx`, `uvx`, `node`) |
| `args` | stdio | no | Command arguments array |
| `env` | stdio | no | Environment variables (supports `${VAR}` interpolation) |
| `url` | http | yes | MCP endpoint URL |
| `headers` | http | no | Static headers (supports `${VAR}` interpolation) |
| `auth` | http | no | OAuth config for browser-based authentication |
| `keywords` | both | no | Search keywords (for discoverability) |
| `idleTimeoutMs` | both | no | Idle timeout before kill (default: 5 min) |

#### Environment Variable Interpolation

Use `${VAR_NAME}` syntax in `command`, `args`, `env`, `headers`, and `url` fields. Mux reads from `process.env` at startup (including vars loaded from your shell profile).

```json
{
  "command": "${GIT_COMMAND_PATH}",
  "env": {
    "GITLAB_TOKEN": "${GITLAB_TOKEN}",
    "API_URL": "${GITLAB_API_URL}"
  }
}
```

> [!WARNING]
> If an env var is not set, it resolves to an empty string. Use `mux-cli health` to check for missing variables.

### Environment Variables

| Variable | Default | Description |
|:---------|:--------|:------------|
| `MUX_LOG_LEVEL` | `info` | `error` \| `warn` \| `info` \| `debug` |
| `MUX_REGISTRY_PATH` | `~/.mux/servers.json` | Path to server registry |
| `MUX_TOKEN_STORE_PATH` | `~/.mux/tokens.json` | Path to OAuth token cache |
| `MUX_DEFAULT_IDLE_TIMEOUT` | `300000` | Default idle timeout in ms (5 min) |

---
