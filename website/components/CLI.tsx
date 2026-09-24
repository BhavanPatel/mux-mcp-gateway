"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const commands = [
  { cmd: "mux", desc: "Launch interactive TUI dashboard" },
  { cmd: "mux serve", desc: "Run MCP gateway on stdio" },
  { cmd: "mux add <name> --transport <http|stdio>", desc: "Add a new MCP server" },
  { cmd: "mux remove <name>", desc: "Remove a server" },
  { cmd: "mux edit <name>", desc: "Edit a server's keywords" },
  { cmd: "mux auth <name>", desc: "Authorize an HTTP server (browser)" },
  { cmd: "mux health [name]", desc: "Run health check on servers" },
  { cmd: "mux metrics", desc: "Usage stats + insights dashboard" },
  { cmd: "mux doctor", desc: "Diagnose common issues" },
  { cmd: "mux logs", desc: "View gateway logs" },
  { cmd: "mux update", desc: "Pull latest + rebuild" },
  { cmd: "mux uninstall", desc: "Remove Mux completely" },
];

export default function CLI() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <section id="cli" className="relative py-40 px-6" ref={ref}>
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          className="mb-14"
        >
          <p className="text-sm font-mono uppercase tracking-[0.3em] mb-4" style={{ color: '#6b7394' }}>CLI Reference</p>
          <h2 className="text-5xl md:text-6xl font-extrabold" style={{ color: '#f0f4ff' }}>
            Full control from your terminal.
          </h2>
        </motion.div>

        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#ffffff06', background: '#080c18' }}>
          {commands.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: i * 0.04, duration: 0.5 }}
              className="flex items-center justify-between px-6 py-3.5"
              style={{ borderBottom: i < commands.length - 1 ? '1px solid #ffffff04' : 'none' }}
            >
              <code className="text-sm font-mono" style={{ color: '#f0f4ff' }}>{c.cmd}</code>
              <span className="text-sm hidden md:block" style={{ color: '#6b7394' }}>{c.desc}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
