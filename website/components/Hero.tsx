"use client";

import { motion } from "framer-motion";

export default function Hero() {
  return (
    <div className="relative z-10 h-full flex flex-col items-center justify-center px-6 text-center">
      {/* Massive title with animated gradient + glow */}
      <motion.h1
        initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
        className="text-[7rem] md:text-[14rem] lg:text-[22rem] leading-none tracking-[-0.06em] select-none animated-gradient-text"
        style={{
          fontWeight: 900,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          backgroundSize: '300% 300%',
          backgroundImage: 'linear-gradient(135deg, #f0f4ff, #a78bfa, #6366f1, #a78bfa, #f0f4ff)',
          filter: 'drop-shadow(0 0 80px rgba(167,139,250,0.4)) drop-shadow(0 0 150px rgba(99,102,241,0.2))',
          WebkitTextStroke: '2px rgba(167,139,250,0.3)',
          paintOrder: 'stroke fill',
        }}
      >
        mux
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 1 }}
        className="mt-2 text-xl md:text-2xl font-light tracking-tight"
        style={{ color: '#6b7394' }}
      >
        One MCP to rule them all.
      </motion.p>

      {/* Description */}
      <motion.p
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.8 }}
        className="mt-5 text-sm md:text-base max-w-md leading-relaxed"
        style={{ color: '#4a5268' }}
      >
        A lightweight gateway that routes your AI to any MCP server on demand.
        4 tools. Zero re-auth. Everything else spawned when needed.
      </motion.p>

      {/* Scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ delay: 2.5, duration: 1 }}
        className="absolute bottom-10"
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="w-5 h-8 rounded-full flex justify-center pt-2"
          style={{ border: '1px solid #1e2130' }}
        >
          <div className="w-1 h-2 rounded-full" style={{ background: '#a78bfa', opacity: 0.7 }} />
        </motion.div>
      </motion.div>
    </div>
  );
}
