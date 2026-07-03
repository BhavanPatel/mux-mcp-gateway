"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const stack = [
  { layer: "Runtime", tech: "Node.js 20+" },
  { layer: "Language", tech: "TypeScript 5.7" },
  { layer: "MCP Protocol", tech: "@modelcontextprotocol/sdk 1.12.1" },
  { layer: "Build", tech: "tsup (ESM)" },
  { layer: "Transport ↑", tech: "stdio (to AI client)" },
  { layer: "Transport ↓", tech: "stdio + StreamableHTTP" },
  { layer: "Token Storage", tech: "JSON file (chmod 600)" },
  { layer: "OAuth", tech: "Authorization Code + PKCE" },
];

export default function TechStack() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="tech-stack" className="relative py-40 px-6" ref={ref}>
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          className="mb-14"
        >
          <p className="text-sm font-mono uppercase tracking-[0.3em] mb-4" style={{ color: '#6b7394' }}>Tech Stack</p>
          <h2 className="text-4xl md:text-5xl font-bold" style={{ color: '#f0f4ff' }}>
            Under the hood.
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.3 }}
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: '#ffffff06', background: '#080c18' }}
        >
          {stack.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.4 + i * 0.05 }}
              className="flex items-center justify-between px-6 py-3.5"
              style={{ borderBottom: i < stack.length - 1 ? '1px solid #ffffff04' : 'none' }}
            >
              <span className="text-sm" style={{ color: '#6b7394' }}>{s.layer}</span>
              <code className="text-sm font-mono" style={{ color: '#f0f4ff' }}>{s.tech}</code>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
