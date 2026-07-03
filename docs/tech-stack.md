## Tech Stack

| Layer | Technology | Version |
|:------|:-----------|:--------|
| Runtime | Node.js | 20+ |
| Language | TypeScript | 5.7 |
| MCP Protocol | @modelcontextprotocol/sdk | 1.12.1 |
| Build | tsup | 8.3.5 |
| Transport (up) | stdio (to AI client) | — |
| Transport (down) | stdio + StreamableHTTP | — |
| Token Storage | JSON file (chmod 600) | — |
| OAuth | Authorization Code + PKCE-ready | — |

---


## Supported Clients

| Client | Config Path | Tested |
|:-------|:------------|:-------|
| Kiro CLI | `~/.kiro/settings/mcp.json` | ✅ |
| Kiro IDE | `~/.kiro/settings/mcp.json` | ✅ |
| Cursor | `~/.cursor/mcp.json` | ✅ |
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` | ✅ |
| Any stdio MCP client | Custom | ✅ |

---
