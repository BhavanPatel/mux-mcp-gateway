"use client";

import { useState } from "react";

const installCmd = `npm install -g mux-mcp-gateway`;

export default function Install() {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(installCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="install" className="relative py-40 px-6">
      <div className="max-w-3xl mx-auto">
        <p className="text-sm font-mono uppercase tracking-[0.3em] mb-4" style={{ color: '#6b7394' }}>Install</p>
        <h2 className="text-5xl md:text-6xl font-extrabold mb-4" style={{ color: '#f0f4ff' }}>
          Get started in seconds.
        </h2>
        <p className="text-base mb-10" style={{ color: '#6b7394' }}>
          One command installs globally. Then run <code className="font-mono" style={{ color: '#a78bfa' }}>mux-cli</code> from anywhere.
        </p>

        {/* Step 1 — Install */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-6 h-6 rounded-full border flex items-center justify-center text-xs font-mono" style={{ borderColor: '#a78bfa30', color: '#a78bfa' }}>1</span>
            <span className="text-sm font-medium" style={{ color: '#f0f4ff' }}>Install</span>
          </div>
          <div className="relative rounded-lg border overflow-hidden" style={{ borderColor: '#ffffff08', background: '#080c18' }}>
            <div className="flex items-center justify-between px-4 py-3">
              <code className="text-[13px] font-mono break-all leading-6" style={{ color: '#e2e8f0' }}>
                {installCmd}
              </code>
              <button
                onClick={copy}
                className="shrink-0 ml-4 px-3 py-1.5 rounded text-xs font-mono transition-all duration-200"
                style={{
                  background: copied ? '#a78bfa20' : '#ffffff06',
                  color: copied ? '#a78bfa' : '#6b7394',
                  border: `1px solid ${copied ? '#a78bfa30' : '#ffffff08'}`,
                }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </div>

        {/* Step 2 — Run */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-6 h-6 rounded-full border flex items-center justify-center text-xs font-mono" style={{ borderColor: '#a78bfa30', color: '#a78bfa' }}>2</span>
            <span className="text-sm font-medium" style={{ color: '#f0f4ff' }}>Run</span>
          </div>
          <div className="rounded-lg border px-4 py-3" style={{ borderColor: '#ffffff08', background: '#080c18' }}>
            <code className="text-[13px] font-mono" style={{ color: '#e2e8f0' }}>mux-cli</code>
          </div>
        </div>

        {/* Step 3 — Done */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="w-6 h-6 rounded-full border flex items-center justify-center text-xs font-mono" style={{ borderColor: '#a78bfa30', color: '#a78bfa' }}>3</span>
            <span className="text-sm font-medium" style={{ color: '#f0f4ff' }}>Done</span>
          </div>
          <p className="text-sm pl-9" style={{ color: '#6b7394' }}>
            Mux imports your existing servers, patches your AI client config, and runs a health check. Your AI now sees 4 tools instead of 50+.
          </p>
        </div>

      </div>
    </section>
  );
}
