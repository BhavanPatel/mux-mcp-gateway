"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";

const tools = [
  {
    name: "mux_list_servers",
    desc: "Discover all registered servers, their status, keywords, and cached tools.",
    example: `[
  { "name": "gitlab", "status": "active", "tools": 8 },
  { "name": "jira", "status": "idle", "keywords": ["ticket","sprint"] },
  { "name": "elastic", "status": "idle", "tools": ["search_documents","get_index"] }
]`,
  },
  {
    name: "mux_call_tool",
    desc: "Route a tool call to any downstream server. Auto-starts if idle. Server param optional — auto-resolves from cached tools.",
    example: `{
  "server": "gitlab",
  "tool": "list_merge_requests",
  "arguments": { "project_id": "502", "state": "opened" }
}`,
  },
  {
    name: "mux_find_tool",
    desc: "Search for tools across all servers by name or description. Uses cached metadata — no connection needed.",
    example: `[
  { "server": "gitlab", "tool": "list_merge_requests", "description": "List merge requests for a project" },
  { "server": "gitlab", "tool": "create_merge_request", "description": "Create a new merge request" }
]`,
  },
  {
    name: "mux_status",
    desc: "Diagnostics: uptime, active connections, memory, cache, metrics.",
    example: `{
  "uptime": "7200s",
  "activeConnections": 2,
  "memory": { "rss": "58MB" },
  "metrics": { "totalCalls": 600, "estimatedTokensSaved": "~4.8M" }
}`,
  },
];

export default function Tools() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [active, setActive] = useState(0);

  return (
    <section id="tools" className="relative py-40 px-6" ref={ref}>
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          className="mb-16"
        >
          <p className="text-mux-amber/80 text-sm font-mono uppercase tracking-[0.3em] mb-4">MCP Tools</p>
          <h2 className="text-5xl md:text-6xl font-extrabold">
            4 tools. That&apos;s the entire surface.
          </h2>
          <p className="text-text-secondary mt-4 max-w-xl">
            Regardless of how many downstream servers exist, your AI only sees these 4 tools in its context.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-[1fr_1.5fr] gap-8">
          {/* Tool selector */}
          <div className="space-y-3">
            {tools.map((t, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.3 + i * 0.1 }}
                onClick={() => setActive(i)}
                className={`w-full text-left p-5 rounded-xl border transition-all duration-300 ${
                  active === i
                    ? "border-mux-cyan/40 bg-mux-cyan/[0.04] shadow-[0_0_20px_rgba(0,212,255,0.05)]"
                    : "border-white/[0.04] bg-space-surface/30 hover:border-white/[0.08]"
                }`}
              >
                <div className={`font-mono text-sm font-semibold mb-1 ${active === i ? "text-mux-cyan" : "text-text-primary"}`}>
                  {t.name}
                </div>
                <div className="text-xs text-text-muted">{t.desc}</div>
              </motion.button>
            ))}
          </div>

          {/* Code preview */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.5 }}
            className="relative"
          >
            <div className="absolute -inset-px rounded-xl bg-gradient-to-b from-mux-cyan/10 to-transparent opacity-50" />
            <div className="relative rounded-xl border border-white/[0.06] bg-[#0b0f1a] p-6 overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-mux-cyan/60" />
                <span className="text-xs font-mono text-text-muted">Response</span>
              </div>
              <pre className="font-mono text-sm leading-6 text-text-secondary overflow-x-auto">
                <code>{tools[active].example}</code>
              </pre>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
