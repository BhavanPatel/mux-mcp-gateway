## Architecture

### System Design

```mermaid
graph TB
    subgraph MUX["MUX Gateway"]
        Server["Server<br/>(4 tools)"]
        Pool["Pool<br/>(lazy conn)"]
        Registry["Registry<br/>(hot-reload)"]
        Reaper["Reaper<br/>(idle kill)"]
        Cache["Tool Catalog<br/>(schemas)"]
        Auth["Auth<br/>(OAuth + tokens)"]
        Env["Env Loader<br/>(shell vars)"]
        Transport["Transport Layer"]
    end

    Client["AI Client<br/>(Kiro/Cursor)"] -->|stdio| Server
    Server --> Pool
    Pool --> Transport
    Pool --> Reaper
    Pool --> Cache
    Transport -->|stdio| DownA["Downstream A"]
    Transport -->|http| DownB["Downstream B"]
    Transport -->|stdio| DownC["Downstream C"]
    Transport --> Auth
    Registry --> Pool
    Env --> Registry

    style MUX fill:#0d1117,stroke:#00d4ff,color:#fff
    style Client fill:#1a1a2e,stroke:#00d4ff,color:#fff
    style Server fill:#1e3a5f,stroke:#00d4ff,color:#fff
    style Pool fill:#1e3a5f,stroke:#00d4ff,color:#fff
    style Transport fill:#1e3a5f,stroke:#00d4ff,color:#fff
    style Registry fill:#1e3a5f,stroke:#10b981,color:#fff
    style Reaper fill:#1e3a5f,stroke:#f59e0b,color:#fff
    style Cache fill:#1e3a5f,stroke:#10b981,color:#fff
    style Auth fill:#1e3a5f,stroke:#f59e0b,color:#fff
    style Env fill:#1e3a5f,stroke:#10b981,color:#fff
    style DownA fill:#2d2d44,stroke:#7c3aed,color:#fff
    style DownB fill:#2d2d44,stroke:#7c3aed,color:#fff
    style DownC fill:#2d2d44,stroke:#7c3aed,color:#fff
```

### Component Breakdown

| Component | File | Responsibility |
|:----------|:-----|:---------------|
| **Server** | `src/server.ts` | MCP server exposing 4 tools to the AI client |
| **Registry** | `src/registry.ts` | Loads `servers.json`, interpolates env vars, watches for changes, scored keyword matching |
| **Pool** | `src/pool.ts` | Connection lifecycle — lazy connect, reuse, disconnect, auto-retry on failure |
| **Keyword Extractor** | `src/keyword-extractor.ts` | Extracts keywords from tool names/descriptions for auto-tagging servers |
| **Reaper** | (inside pool) | Per-connection idle timer — kills unused connections |
| **Tool Catalog** | `src/tool-catalog.ts` | Persists discovered tool schemas in `~/.mux/tool-catalog.json` (1h TTL) |
| **Tool Discovery** | `src/tool-discovery.ts` | Searches tool catalog across servers, resolves server by tool name |
| **Env Loader** | `src/env.ts` | Extracts env vars from shell profiles (.zshrc/.bashrc) on startup |
| **Stdio Transport** | `src/transport/stdio.ts` | Spawns downstream processes, communicates via stdin/stdout |
| **HTTP Transport** | `src/transport/http.ts` | Connects to HTTP/SSE endpoints with MCP OAuth provider |
| **OAuth Provider** | `src/auth/mcp-oauth-provider.ts` | Browser-based OAuth (same flow as Kiro IDE/CLI) |
| **Token Store** | `src/auth/token-store.ts` | Reads/writes encrypted `~/.mux/tokens.json`, checks expiry |
| **Logger** | `src/logger.ts` | Structured stderr logging with levels |

### Data Flow

```mermaid
sequenceDiagram
    participant AI as AI Client
    participant Mux as Mux Gateway
    participant Pool as Connection Pool
    participant Down as Downstream MCP

    AI->>Mux: mux_call_tool("gitlab", "list_mrs", {...})
    Mux->>Pool: Is "gitlab" connected?

    alt Already connected
        Pool-->>Mux: Reuse existing
    else Not connected
        Pool->>Down: Spawn (npx @zereight/mcp-gitlab)
        Down-->>Pool: Connected + tool list
        Pool->>Pool: Store tools in ~/.mux/tool-catalog.json
    end

    Mux->>Down: client.callTool("list_mrs", {...})
    Down-->>Mux: Result
    Mux-->>AI: Return result
    Mux->>Pool: Reset idle timer (5 min)

    Note over Pool,Down: After 5 min idle...
    Pool->>Down: Kill connection
    Note over Pool: Tool catalog remains for discovery

    AI->>Mux: mux_call_tool("gitlab", ...) [next call]
    Mux->>Pool: Respawn (uses cached auth token)
```

### Lifecycle States

```mermaid
stateDiagram-v2
    [*] --> IDLE: Registered in servers.json
    IDLE --> ACTIVE: First mux_call_tool
    ACTIVE --> ACTIVE: Each tool call resets timer
    ACTIVE --> KILLED: Idle timeout (5 min)
    KILLED --> ACTIVE: Next mux_call_tool (respawn)

    note right of IDLE: In registry, not running
    note right of ACTIVE: In pool, connection alive
    note right of KILLED: Removed from pool\nTool catalog remains
```

---
