"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const schema = `{
  "servers": {
    "gitlab": {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@zereight/mcp-gitlab"],
      "env": { "GITLAB_TOKEN": "\${GITLAB_TOKEN}" },
      "keywords": ["merge request", "pipeline"],
      "idleTimeoutMs": 300000
    }
  }
}`;

const envVars = [
  { name: "MUX_LOG_LEVEL", default: "info", desc: "error | warn | info | debug" },
  { name: "MUX_REGISTRY_PATH", default: "~/.mux/servers.json", desc: "Path to registry" },
  { name: "MUX_TOKEN_STORE_PATH", default: "~/.mux/tokens.json", desc: "OAuth token cache" },
  { name: "MUX_DEFAULT_IDLE_TIMEOUT", default: "300000", desc: "Idle timeout (ms)" },
];

export default function Config() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="config" className="relative py-40 px-6" ref={ref}>
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          className="mb-14"
        >
          <p className="text-sm font-mono uppercase tracking-[0.3em] mb-4" style={{ color: '#6b7394' }}>Configuration</p>
          <h2 className="text-5xl md:text-6xl font-extrabold" style={{ color: '#f0f4ff' }}>
            One JSON file. Hot-reloaded.
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Schema */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2 }}
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: '#ffffff06', background: '#080c18' }}
          >
            <div className="px-5 py-2.5" style={{ borderBottom: '1px solid #ffffff06' }}>
              <span className="text-xs font-mono" style={{ color: '#6b7394' }}>~/.mux/servers.json</span>
            </div>
            <pre className="p-5 font-mono text-sm leading-6 overflow-x-auto" style={{ color: '#b4bcd0' }}>
              {schema}
            </pre>
          </motion.div>

          {/* Env vars */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.4 }}
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: '#ffffff06', background: '#080c18' }}
          >
            <div className="px-5 py-2.5" style={{ borderBottom: '1px solid #ffffff06' }}>
              <span className="text-xs font-mono" style={{ color: '#6b7394' }}>Environment Variables</span>
            </div>
            <div className="p-4">
              {envVars.map((v, i) => (
                <div key={i} className="py-2.5" style={{ borderBottom: i < 3 ? '1px solid #ffffff04' : 'none' }}>
                  <code className="text-sm font-mono block" style={{ color: '#f0f4ff' }}>{v.name}</code>
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[10px]" style={{ color: '#6b7394' }}>{v.desc}</span>
                    <span className="text-[10px] font-mono" style={{ color: '#6b739460' }}>{v.default}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
