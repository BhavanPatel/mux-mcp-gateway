"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";

const states = [
  { label: "IDLE", desc: "Registered, not running", color: '#6b7394' },
  { label: "ACTIVE", desc: "Connected, handling calls", color: '#a78bfa' },
  { label: "KILLED", desc: "Idle timeout, disconnected", color: '#6b7394' },
];

export default function Lifecycle() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const timings = [2000, 2500, 1500];
    let idx = 0;
    const step = () => {
      idx = (idx + 1) % 3;
      setCurrent(idx);
    };
    const iv = setInterval(() => step(), timings[idx % 3]);
    return () => clearInterval(iv);
  }, [inView]);

  return (
    <section id="lifecycle" className="relative py-40 px-6" ref={ref}>
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          className="mb-14"
        >
          <p className="text-sm font-mono uppercase tracking-[0.3em] mb-4" style={{ color: '#6b7394' }}>Connection Lifecycle</p>
          <h2 className="text-5xl md:text-6xl font-extrabold" style={{ color: '#f0f4ff' }}>
            Spawn. Use. Kill. Repeat.
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center gap-4 md:gap-8"
        >
          {states.map((s, i) => (
            <div key={i} className="flex items-center gap-4 md:gap-8">
              <div className="text-center">
                <div
                  className="w-20 h-20 md:w-24 md:h-24 rounded-full border-2 flex items-center justify-center mx-auto transition-all duration-500"
                  style={{
                    borderColor: current === i ? '#a78bfa' : '#ffffff10',
                    background: current === i ? '#a78bfa08' : 'transparent',
                    boxShadow: current === i ? '0 0 20px #a78bfa20' : 'none',
                  }}
                >
                  <div>
                    <div className="text-sm font-mono font-semibold" style={{ color: current === i ? '#f0f4ff' : '#6b7394' }}>{s.label}</div>
                  </div>
                </div>
                <p className="text-xs mt-3" style={{ color: '#6b7394' }}>{s.desc}</p>
              </div>
              {i < states.length - 1 && (
                <div className="flex items-center">
                  <div className="w-8 md:w-14 h-[1px]" style={{ background: '#ffffff10' }} />
                  <div className="text-xs" style={{ color: '#6b739460' }}>→</div>
                </div>
              )}
            </div>
          ))}
        </motion.div>

        <div className="mt-12 grid md:grid-cols-3 gap-4">
          {[
            { title: "Idle Timeout", desc: "Connections killed after 5 min of inactivity. Configurable per server." },
            { title: "Hot Reload", desc: "Edit ~/.mux/servers.json — changes apply in 2 seconds, no restart." },
            { title: "Graceful Shutdown", desc: "On SIGTERM: disconnect all, kill children, exit clean." },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="p-5 rounded-xl border"
              style={{ borderColor: '#ffffff06', background: '#0a0e1a' }}
            >
              <div className="text-xs font-medium mb-1" style={{ color: '#f0f4ff' }}>{item.title}</div>
              <p className="text-sm leading-relaxed" style={{ color: '#6b7394' }}>{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
