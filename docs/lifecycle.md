## Connection Lifecycle

### Idle Timeout

Every active connection has a per-server idle timer. When no `mux_call_tool` targets that server for the configured duration, the connection is terminated.

```
mux_call_tool("gitlab", ...)  →  timer reset (5 min)
                                        │
                                   ... 3 min pass ...
                                        │
mux_call_tool("gitlab", ...)  →  timer reset (5 min)
                                        │
                                   ... 5 min pass (no calls) ...
                                        │
                                   gitlab KILLED ✂️
                                        │
mux_call_tool("gitlab", ...)  →  respawned fresh (with cached auth)
```

### Graceful Shutdown

On `SIGTERM` or `SIGINT`, Mux:
1. Stops accepting new connections
2. Sends disconnect to all active downstream clients
3. Kills all spawned child processes
4. Exits cleanly

### Hot-Reload

The registry file is watched with a 2-second poll interval:
- **Add a server** → available immediately on next `mux_list_servers`
- **Remove a server** → active connection stays until idle timeout, then not reconnectable
- **Modify a server** → next connection uses updated config

---
