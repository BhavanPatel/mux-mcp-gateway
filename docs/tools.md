## Tools Exposed

Mux exposes exactly **4 tools** to the AI client. This is the entire context footprint regardless of how many downstream servers are registered.

### `mux_list_servers`

Lists all registered downstream servers with their current status. For idle servers with cached tools, shows tool names without connecting.

**Parameters:** None

**Response:**
```json
[
  {
    "name": "gitlab",
    "transport": "stdio",
    "keywords": ["gitlab", "merge request", "MR", "pipeline"],
    "status": "idle",
    "tools": ["list_projects", "list_merge_requests", "create_branch"]
  },
  {
    "name": "elasticsearch-prod",
    "transport": "stdio",
    "keywords": ["elasticsearch", "kibana", "logs"],
    "status": "active",
    "tools": 6,
    "idleMs": 45000
  }
]
```

### `mux_call_tool`

Routes a tool call to a downstream server. If the server isn't running, it's started automatically. If `server` is omitted, Mux auto-resolves which server owns the tool from cached tool metadata.

**Parameters:**

| Param | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `server` | string | no | Server name from registry. If omitted, Mux auto-resolves from cached tool names. |
| `tool` | string | yes | Tool name on that server |
| `arguments` | object | no | Arguments to pass through |

**Example (explicit server):**
```json
{
  "server": "gitlab",
  "tool": "list_merge_requests",
  "arguments": { "project_id": "502", "state": "opened" }
}
```

**Example (auto-routing — server omitted):**
```json
{
  "tool": "list_merge_requests",
  "arguments": { "project_id": "502", "state": "opened" }
}
```

When auto-routing, Mux looks up the tool name in its cached tool catalog. If found, it routes to the owning server automatically. If the tool isn't in cache, it returns an error suggesting `mux_find_tool`.

### `mux_find_tool`

Search for a tool across all registered downstream servers by name or description. Uses cached tool metadata — does not require connecting to servers. Returns matching tools with their server name and description.

**Parameters:**

| Param | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `query` | string | yes | Search query — tool name, partial name, or keyword to find relevant tools |

**Example:**
```json
{
  "query": "merge"
}
```

**Response:**
```json
[
  { "server": "gitlab", "tool": "list_merge_requests", "description": "List merge requests for a project" },
  { "server": "gitlab", "tool": "create_merge_request", "description": "Create a new merge request" }
]
```

If no results are found:
```
No tools found matching "xyz". Note: only previously-connected servers have cached tools.
Use mux_list_servers to see all servers, then call any tool on a server to populate its cache.
```

### `mux_status`

Shows Mux gateway diagnostics — useful for debugging connection issues or checking resource usage.

**Parameters:** None

**Response:**
```json
{
  "uptime": "3600s",
  "registeredServers": 16,
  "activeConnections": 2,
  "activeServers": [
    { "name": "gitlab", "tools": 8, "idleFor": "45s" },
    { "name": "elasticsearch-prod", "tools": 10, "idleFor": "120s" }
  ],
  "cache": {
    "cachedServers": 5,
    "cachedTools": 42
  },
  "memory": {
    "rss": "62MB",
    "heap": "28MB"
  },
  "metrics": {
    "trackingSince": "2025-01-15",
    "totalCalls": 342,
    "contextReductionPct": "95%",
    "estimatedTokensSaved": 3283200,
    "topServer": "gitlab"
  }
}
```

---
