"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";

const steps = [
  { label: "AI calls mux_call_tool", x: 60 },
  { label: "Mux routes to server", x: 230 },
  { label: "Server responds", x: 400 },
  { label: "Idle → killed after 5 min", x: 570 },
];

function HowItWorksFlow({ inView }: { inView: boolean }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const iv = setInterval(() => setActive(a => (a + 1) % 4), 1800);
    return () => clearInterval(iv);
  }, [inView]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: 0.6, duration: 0.8 }}
      className="rounded-xl border p-8"
      style={{ borderColor: '#ffffff06', background: '#080c18' }}
    >
      <div className="text-sm font-mono mb-6" style={{ color: '#a78bfa' }}>How it works</div>
      <svg viewBox="0 0 700 60" className="w-full h-auto">
        {/* Connection line */}
        <line x1="80" y1="30" x2="620" y2="30" stroke="#ffffff08" strokeWidth="1" />

        {/* Animated pulse traveling along the line */}
        <motion.circle
          r="4"
          cy="30"
          fill="#a78bfa"
          animate={{ cx: [80, 230, 400, 570][active] }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          style={{ filter: 'drop-shadow(0 0 6px #a78bfa)' }}
        />

        {/* Step nodes */}
        {steps.map((s, i) => (
          <g key={i}>
            <circle
              cx={s.x} cy="30" r="12"
              fill={active === i ? '#a78bfa10' : 'transparent'}
              stroke={active === i ? '#a78bfa' : '#ffffff15'}
              strokeWidth={active === i ? 1.5 : 1}
            />
            <text
              x={s.x} y="32"
              textAnchor="middle"
              fill={active === i ? '#a78bfa' : '#6b7394'}
              fontSize="9"
              fontFamily="monospace"
              fontWeight={active === i ? 700 : 400}
            >
              {i + 1}
            </text>
            <text
              x={s.x} y="56"
              textAnchor="middle"
              fill={active === i ? '#f0f4ff' : '#6b7394'}
              fontSize="9"
            >
              {s.label}
            </text>
          </g>
        ))}
      </svg>
    </motion.div>
  );
}

function Num({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [n, setN] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    const dur = 1200, start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - start) / dur, 1);
      setN(Math.round(p * p * (3 - 2 * p) * value));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, value]);
  return <span ref={ref}>{n}{suffix}</span>;
}

export default function Solution() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="solution" className="relative py-40 px-6" ref={ref}>
      <div className="max-w-5xl mx-auto">
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          className="text-sm font-mono uppercase tracking-[0.3em] mb-6"
          style={{ color: '#6b7394' }}
        >
          The Solution
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-5xl md:text-6xl font-extrabold leading-[1.15] mb-20"
          style={{ color: '#f0f4ff' }}
        >
          4 tools. Always.<br />
          <span style={{ color: '#6b7394' }}>Everything else, on demand.</span>
        </motion.h2>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {[
            { value: 97, suffix: "%", label: "Less context" },
            { value: 50, suffix: "MB", label: "Idle memory" },
            { value: 0, suffix: "", label: "Re-auth prompts" },
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.3 + i * 0.12, duration: 0.7 }}
              className="text-center"
            >
              <div className="text-5xl md:text-6xl font-bold" style={{ color: '#a78bfa' }}>
                <Num value={s.value} suffix={s.suffix} />
              </div>
              <div className="text-xs mt-3" style={{ color: '#6b7394' }}>{s.label}</div>
            </motion.div>
          ))}
        </div>

        {/* How it works — animated flow */}
        <HowItWorksFlow inView={inView} />
      </div>
    </section>
  );
}
