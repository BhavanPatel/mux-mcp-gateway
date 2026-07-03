"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export default function Footer() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <footer className="relative py-32 px-6" style={{ borderTop: '1px solid #ffffff04' }} ref={ref}>
      <div className="max-w-3xl mx-auto">
        {/* Signature section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="flex flex-col items-center text-center"
        >
          {/* Avatar with glow ring */}
          <div className="relative mb-6">
            <div className="absolute -inset-1 rounded-full opacity-40 animate-pulse" style={{ background: 'linear-gradient(135deg, #a78bfa, #6366f1)', filter: 'blur(8px)' }} />
            <img
              src="/avatar.png"
              alt="Bhavan Patel"
              className="relative w-20 h-20 rounded-full border-2 object-cover"
              style={{ borderColor: '#a78bfa40' }}
            />
          </div>

          {/* Name as signature */}
          <p className="text-lg font-semibold" style={{ color: '#f0f4ff' }}>
            Bhavan Patel
          </p>

          {/* Links */}
          <div className="flex gap-5 mt-6">
            <a href="https://github.com/BhavanPatel" className="text-xs hover:text-[#a78bfa] transition-colors" style={{ color: '#6b7394' }}>GitHub</a>
          </div>
        </motion.div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 flex flex-col md:flex-row items-center justify-between gap-4" style={{ borderTop: '1px solid #ffffff04' }}>
          <div className="text-xl font-bold tracking-tight animated-gradient-text" style={{
            backgroundImage: 'linear-gradient(135deg, #f0f4ff, #a78bfa, #6366f1, #a78bfa, #f0f4ff)',
            backgroundSize: '300% 300%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>mux</div>
          <div className="flex gap-5 text-xs" style={{ color: '#6b7394' }}>
            <a href="#install" className="hover:text-[#a78bfa] transition-colors">Install</a>
            <a href="#architecture" className="hover:text-[#a78bfa] transition-colors">Architecture</a>
            <a href="/docs" className="hover:text-[#a78bfa] transition-colors">Docs</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
