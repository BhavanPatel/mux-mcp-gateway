"use client";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const clients = [
  { name: "Kiro CLI", path: "~/.kiro/settings/mcp.json" },
  { name: "Kiro IDE", path: "~/.kiro/settings/mcp.json" },
  { name: "Cursor", path: "~/.cursor/mcp.json" },
  { name: "Claude Desktop", path: "~/Library/.../config.json" },
  { name: "Any stdio client", path: "Custom" },
];

export default function Clients() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <section id="clients" className="relative py-32 px-6" ref={ref}>
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} className="mb-10">
          <p className="text-sm font-mono uppercase tracking-[0.3em] mb-4" style={{ color: '#6b7394' }}>Supported Clients</p>
          <h2 className="text-3xl font-bold" style={{ color: '#f0f4ff' }}>Works with everything.</h2>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ delay: 0.2 }} className="rounded-xl border overflow-hidden" style={{ borderColor: '#ffffff06', background: '#080c18' }}>
          {clients.map((c, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3" style={{ borderBottom: i < 4 ? '1px solid #ffffff04' : 'none' }}>
              <span className="text-sm" style={{ color: '#f0f4ff' }}>{c.name}</span>
              <code className="text-xs font-mono" style={{ color: '#6b7394' }}>{c.path}</code>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
