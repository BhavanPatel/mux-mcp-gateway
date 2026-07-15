"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const steps = [
  { n: "1", text: "Tool call arrives for HTTP server" },
  { n: "2", text: "Try connecting without auth — works for API-key servers instantly" },
  { n: "3", text: "If 401 → probe OAuth discovery endpoint on server" },
  { n: "4", text: "OAuth found → browser auth with live countdown timer" },
  { n: "5", text: "Token cached. Resolves immediately when auth completes." },
];

const authTypes = [
  { type: "Env tokens", config: 'env: { "TOKEN": "${VAR}" }', behavior: "From shell environment" },
  { type: "Static headers", config: 'headers: { "X-Key": "${KEY}" }', behavior: "Injected into HTTP" },
  { type: "OAuth (browser)", config: "Server has OAuth discovery", behavior: "Browser → authorize → cached" },
  { type: "No OAuth", config: "Server returns 401, no discovery", behavior: "Fail fast with clear error" },
];

export default function Auth() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="auth" className="relative py-40 px-6" ref={ref}>
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          className="mb-14"
        >
          <p className="text-sm font-mono uppercase tracking-[0.3em] mb-4" style={{ color: '#6b7394' }}>Authentication</p>
          <h2 className="text-5xl md:text-6xl font-extrabold" style={{ color: '#f0f4ff' }}>
            Auth once. Cached forever.
          </h2>
          <p className="mt-3 text-sm" style={{ color: '#6b7394' }}>
            Smart detection — only triggers OAuth when the server actually supports it. Live countdown timer. Instant resolution.
          </p>
        </motion.div>

        {/* Flow */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.3 }}
          className="flex flex-col gap-3 mb-14"
        >
          {steps.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -15 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.4 + i * 0.1 }}
              className="flex items-start gap-4 p-4 rounded-lg"
              style={{ background: '#0a0e1a' }}
            >
              <div className="w-6 h-6 rounded-full border flex items-center justify-center shrink-0 text-xs font-mono" style={{ borderColor: '#a78bfa30', color: '#a78bfa' }}>{s.n}</div>
              <p className="text-sm" style={{ color: '#f0f4ff' }}>{s.text}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Auth types table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.8 }}
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: '#ffffff06', background: '#080c18' }}
        >
          <div className="grid grid-cols-3 px-3 md:px-5 py-3" style={{ borderBottom: '1px solid #ffffff06' }}>
            <span className="text-xs font-mono uppercase" style={{ color: '#6b7394' }}>Type</span>
            <span className="text-xs font-mono uppercase" style={{ color: '#6b7394' }}>Config</span>
            <span className="text-xs font-mono uppercase" style={{ color: '#6b7394' }}>Behavior</span>
          </div>
          {authTypes.map((a, i) => (
            <div key={i} className="grid grid-cols-3 px-3 md:px-5 py-3" style={{ borderBottom: i < authTypes.length - 1 ? '1px solid #ffffff04' : 'none' }}>
              <span className="text-sm font-medium" style={{ color: '#f0f4ff' }}>{a.type}</span>
              <code className="text-xs font-mono" style={{ color: '#6b7394' }}>{a.config}</code>
              <span className="text-xs" style={{ color: '#6b7394' }}>{a.behavior}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
