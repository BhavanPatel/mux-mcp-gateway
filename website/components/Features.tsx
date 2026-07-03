"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const features = [
  { title: "Lazy Spawn", desc: "Servers start on first call. Zero overhead until needed." },
  { title: "Idle Reaper", desc: "Kills unused connections after 5 min. RAM reclaimed." },
  { title: "OAuth Cached", desc: "Tokens persist. Auth once, use forever." },
  { title: "Schema Cache", desc: "Tools remembered after disconnect. Instant reconnect." },
  { title: "Auto Keywords", desc: "Intent routing from real tool discovery." },
  { title: "Hot Reload", desc: "Edit registry, no restart. Live in 2 seconds." },
  { title: "Metrics", desc: "Context savings, response times, auth efficiency." },
  { title: "Any Client", desc: "Kiro, Cursor, Claude Desktop. Any stdio MCP." },
];

export default function Features() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <section id="features" className="relative py-40 px-6" ref={ref}>
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-20"
        >
          <p className="text-sm font-mono uppercase tracking-[0.3em] mb-4" style={{ color: '#6b7394' }}>Features</p>
          <h2 className="text-5xl md:text-6xl font-extrabold" style={{ color: '#f0f4ff' }}>
            Built for the real world.
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.05, duration: 0.6 }}
              className="p-5 rounded-xl border transition-all duration-300 hover:border-[#a78bfa20]"
              style={{ borderColor: '#ffffff06', background: '#0a0e1a' }}
            >
              <h3 className="text-base font-semibold mb-2" style={{ color: '#f0f4ff' }}>{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#6b7394' }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
