"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export default function Problem() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="problem" className="relative py-40 px-6" ref={ref}>
      <div className="max-w-5xl mx-auto">
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          className="text-sm font-mono uppercase tracking-[0.3em] mb-6"
          style={{ color: '#6b7394' }}
        >
          The Problem
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-5xl md:text-6xl font-extrabold leading-[1.15] mb-16"
          style={{ color: '#f0f4ff' }}
        >
          Your AI drowns in 50+ tools<br />
          <span style={{ color: '#6b7394' }}>it doesn&apos;t need right now.</span>
        </motion.h2>

        <div className="grid md:grid-cols-3 gap-5">
          {[
            { n: "50+", label: "Tools in context", sub: "Every MCP server dumps its full schema into your AI's working memory." },
            { n: "800MB", label: "RAM wasted", sub: "15 idle processes consuming resources for tools you call once a day." },
            { n: "∞", label: "Re-auth loops", sub: "OAuth sessions die on disable. Browser popup every time you re-enable." },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.2 + i * 0.12, duration: 0.7 }}
              className="p-7 rounded-xl border transition-all duration-300"
              style={{ borderColor: '#ffffff06', background: '#0a0e1a' }}
            >
              <div className="text-3xl font-bold font-mono mb-3" style={{ color: '#f0f4ff' }}>{item.n}</div>
              <div className="text-base font-semibold mb-2" style={{ color: '#f0f4ff' }}>{item.label}</div>
              <p className="text-sm leading-relaxed" style={{ color: '#6b7394' }}>{item.sub}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
