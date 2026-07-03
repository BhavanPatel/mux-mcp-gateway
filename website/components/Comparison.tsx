"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const rows = [
  { metric: "Tools in context", before: "50+", after: "4" },
  { metric: "Running processes", before: "15+", after: "1 + on-demand" },
  { metric: "RAM (idle)", before: "~800MB", after: "~50MB" },
  { metric: "OAuth re-auth", before: "Every enable/disable", after: "Never (cached)" },
  { metric: "Add new server", before: "Edit config + restart", after: "Edit JSON (hot-reload)" },
  { metric: "Cold start", before: "N/A (always on)", after: "1-3s (spawn)" },
  { metric: "Warm call overhead", before: "0ms", after: "<100ms" },
];

export default function Comparison() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="comparison" className="relative py-40 px-6" ref={ref}>
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          className="mb-14"
        >
          <p className="text-sm font-mono uppercase tracking-[0.3em] mb-4" style={{ color: '#6b7394' }}>Comparison</p>
          <h2 className="text-5xl md:text-6xl font-extrabold" style={{ color: '#f0f4ff' }}>
            Before vs After.
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.3 }}
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: '#ffffff06', background: '#080c18' }}
        >
          {/* Header */}
          <div className="grid grid-cols-3 px-4 md:px-6 py-3" style={{ borderBottom: '1px solid #ffffff08' }}>
            <span className="text-xs font-mono uppercase" style={{ color: '#6b7394' }}>Metric</span>
            <span className="text-xs font-mono uppercase" style={{ color: '#6b7394' }}>Without Mux</span>
            <span className="text-xs font-mono uppercase" style={{ color: '#a78bfa' }}>With Mux</span>
          </div>
          {rows.map((r, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.4 + i * 0.05 }}
              className="grid grid-cols-3 px-4 md:px-6 py-3"
              style={{ borderBottom: i < rows.length - 1 ? '1px solid #ffffff04' : 'none' }}
            >
              <span className="text-sm" style={{ color: '#f0f4ff' }}>{r.metric}</span>
              <span className="text-sm font-mono" style={{ color: '#6b7394' }}>{r.before}</span>
              <span className="text-sm font-mono" style={{ color: '#a78bfa' }}>{r.after}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
