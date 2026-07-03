## Comparison: Before vs After

| Metric | Without Mux | With Mux |
|:-------|:------------|:---------|
| Tools in AI context | 50+ (all servers) | 4 (fixed) |
| Credit cost per request (Kiro) | 100% | ~5% (95% reduction) |
| Token cost per request (API) | ~10K tokens | ~600 tokens |
| Running processes | 15+ | 1 + on-demand |
| RAM usage (idle) | ~800MB+ | ~50MB |
| OAuth re-auth frequency | Every enable/disable | Once (then cached) |
| Add new server | Edit client config + restart | Edit `servers.json` (hot-reload) |
| Cold start to first tool call | N/A (always running) | 1-3s (server spawn) |
| Subsequent calls (warm) | Instant | <100ms overhead |

---
