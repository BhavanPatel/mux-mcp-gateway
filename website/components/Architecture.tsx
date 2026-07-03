"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";

const servers = [
  { id: "gitlab", label: "GitLab", tools: 8 },
  { id: "jira", label: "Jira", tools: 12 },
  { id: "elastic", label: "Elastic", tools: 10 },
  { id: "datadog", label: "Datadog", tools: 9 },
  { id: "slack", label: "Slack", tools: 5 },
  { id: "sitecore", label: "Sitecore", tools: 15 },
];

export default function Architecture() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [active, setActive] = useState(0);
  const [step, setStep] = useState(0);

  // Auto-animate: cycle through servers continuously
  useEffect(() => {
    if (!inView) return;
    let idx = 0;

    const cycle = () => {
      idx = idx % servers.length;
      setActive(idx);
      setStep(1);
      setTimeout(() => setStep(2), 400);
      setTimeout(() => setStep(3), 800);
      setTimeout(() => setStep(4), 1200);
      setTimeout(() => {
        setStep(0);
        idx++;
        cycle();
      }, 2200);
    };

    const start = setTimeout(cycle, 800);
    return () => clearTimeout(start);
  }, [inView]);

  const serverY = (i: number) => 40 + i * 50;
  const currentServer = servers[active];

  return (
    <section id="architecture" className="relative py-40 px-6" ref={ref}>
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          className="mb-14"
        >
          <p className="text-sm font-mono uppercase tracking-[0.3em] mb-4" style={{ color: '#6b7394' }}>Architecture</p>
          <h2 className="text-5xl md:text-6xl font-extrabold" style={{ color: '#f0f4ff' }}>
            One gateway. Every server.
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="rounded-xl border p-6 md:p-10"
          style={{ borderColor: '#ffffff06', background: '#080c18' }}
        >
          <svg viewBox="0 0 700 340" className="w-full h-auto" style={{ maxHeight: '360px' }}>
            <defs>
              <marker id="arr" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                <path d="M0,0 L5,2.5 L0,5" fill="none" stroke="#a78bfa" strokeWidth="1" opacity="0.6" />
              </marker>
            </defs>

            {/* AI Client */}
            <circle cx="80" cy="170" r="34" fill="none" stroke={step >= 1 ? '#a78bfa60' : '#ffffff12'} strokeWidth="1" />
            {step >= 1 && <circle cx="80" cy="170" r="34" fill="#a78bfa" opacity="0.03" />}
            <text x="80" y="167" textAnchor="middle" fill="#f0f4ff" fontSize="11" fontWeight="500">AI</text>
            <text x="80" y="181" textAnchor="middle" fill="#6b7394" fontSize="8">Client</text>

            {/* Line: Client → Mux */}
            <line x1="114" y1="170" x2="264" y2="170" stroke="#ffffff10" strokeWidth="1" markerEnd="url(#arr)" />
            {step === 1 && (
              <motion.circle
                r="3" fill="#a78bfa"
                initial={{ cx: 114, opacity: 0 }}
                animate={{ cx: 264, opacity: [0, 1, 1, 0] }}
                transition={{ duration: 0.35 }}
                key={`c2m-${active}-${step}`}
                style={{ filter: 'drop-shadow(0 0 3px #a78bfa)' }}
                cy={170}
              />
            )}

            {/* MUX */}
            <circle cx="310" cy="170" r="42" fill="none" stroke={step >= 2 ? '#a78bfa' : '#a78bfa30'} strokeWidth={step >= 2 ? 1.5 : 1} />
            <circle cx="310" cy="170" r="42" fill="#a78bfa" opacity={step >= 2 ? 0.05 : 0.015} />
            <text x="310" y="167" textAnchor="middle" fill="#f0f4ff" fontSize="13" fontWeight="700">mux</text>
            <text x="310" y="183" textAnchor="middle" fill="#a78bfa" fontSize="8" fontFamily="monospace" opacity="0.7">4 tools</text>

            {/* Lines: Mux → Servers */}
            {servers.map((s, i) => {
              const sy = serverY(i);
              const isActive = i === active;
              return (
                <g key={s.id}>
                  <line
                    x1="352" y1="170" x2="528" y2={sy}
                    stroke={isActive && step >= 3 ? '#a78bfa30' : '#ffffff06'}
                    strokeWidth="1"
                    strokeDasharray={isActive && step >= 3 ? 'none' : '2 4'}
                    markerEnd={isActive && step >= 3 ? 'url(#arr)' : ''}
                  />

                  {/* Pulse out */}
                  {isActive && step === 3 && (
                    <motion.circle
                      r="3" fill="#a78bfa"
                      initial={{ cx: 352, cy: 170, opacity: 0 }}
                      animate={{ cx: 528, cy: sy, opacity: [0, 1, 1, 0] }}
                      transition={{ duration: 0.35 }}
                      key={`m2s-${i}-${step}`}
                      style={{ filter: 'drop-shadow(0 0 3px #a78bfa)' }}
                    />
                  )}

                  {/* Return pulse */}
                  {isActive && step === 4 && (
                    <motion.circle
                      r="3" fill="#a78bfa"
                      initial={{ cx: 528, cy: sy, opacity: 0 }}
                      animate={{ cx: 352, cy: 170, opacity: [0, 1, 0.8, 0] }}
                      transition={{ duration: 0.35 }}
                      key={`s2m-${i}-${step}`}
                      style={{ filter: 'drop-shadow(0 0 3px #a78bfa)' }}
                    />
                  )}

                  {/* Server node */}
                  <rect x="530" y={sy - 15} width="88" height="30" rx="5"
                    fill={isActive && step >= 3 ? '#a78bfa06' : '#0a0e1a'}
                    stroke={isActive && step >= 3 ? '#a78bfa30' : '#ffffff06'}
                    strokeWidth="1"
                  />
                  <text x="574" y={sy - 1} textAnchor="middle" fill={isActive ? '#f0f4ff' : '#6b7394'} fontSize="10" fontWeight="500">{s.label}</text>
                  <text x="574" y={sy + 11} textAnchor="middle" fill="#6b739450" fontSize="7" fontFamily="monospace">{s.tools} tools</text>
                </g>
              );
            })}

            {/* Labels */}
            <text x="185" y="160" fill="#6b739440" fontSize="8" fontFamily="monospace">stdio</text>
            <text x="440" y="26" fill="#6b739440" fontSize="8" fontFamily="monospace">on demand</text>
          </svg>

          {/* Status line */}
          <div className="mt-4 text-center h-4">
            <p className="text-xs font-mono transition-opacity duration-300" style={{ color: '#6b7394', opacity: step > 0 ? 1 : 0 }}>
              {step === 1 && `→ mux_call_tool("${currentServer?.label}", ...)`}
              {step === 2 && `→ spawning ${currentServer?.label}...`}
              {step === 3 && `→ routing`}
              {step === 4 && `✓ done — idle timeout in 5 min`}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
