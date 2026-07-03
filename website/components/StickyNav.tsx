"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const sectionGroups = [
  {
    items: [
      { id: "problem", label: "Problem" },
      { id: "solution", label: "Solution" },
    ],
  },
  {
    items: [
      { id: "architecture", label: "Architecture" },
      { id: "features", label: "Features" },
      { id: "tools", label: "Tools" },
    ],
  },
  {
    items: [
      { id: "cli", label: "CLI" },
      { id: "auth", label: "Auth" },
      { id: "config", label: "Config" },
      { id: "lifecycle", label: "Lifecycle" },
    ],
  },
  {
    items: [
      { id: "install", label: "Install" },
      { id: "comparison", label: "Comparison" },
      { id: "tech-stack", label: "Tech Stack" },
      { id: "clients", label: "Clients" },
    ],
  },
];

const allSections = sectionGroups.flatMap((g) => g.items);

export default function StickyNav() {
  const [visible, setVisible] = useState(false);
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > window.innerHeight * 0.8);

      // Find active section using getBoundingClientRect for accuracy
      let current = "";
      for (const section of allSections) {
        const el = document.getElementById(section.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 150) {
            current = section.id;
          }
        }
      }
      setActiveSection(current);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.nav
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed top-0 left-0 right-0 z-50 flex items-center px-6 py-3"
          style={{
            background: "rgba(5, 5, 16, 0.85)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          {/* Logo — left, bigger */}
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            className="text-xl font-bold tracking-tight shrink-0 animated-gradient-text"
            style={{
              backgroundImage: "linear-gradient(135deg, #f0f4ff, #a78bfa, #6366f1, #a78bfa, #f0f4ff)",
              backgroundSize: "300% 300%",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            mux
          </a>

          {/* Section links — centered, grouped with separators */}
          <div className="flex-1 flex items-center justify-center gap-0.5 overflow-x-auto scrollbar-hide">
            {sectionGroups.map((group, gi) => (
              <div key={gi} className="flex items-center">
                {gi > 0 && (
                  <div className="w-px h-3.5 mx-2 bg-white/10 shrink-0" />
                )}
                {group.items.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all shrink-0 ${
                      activeSection === section.id
                        ? "bg-[#a78bfa]/15 text-[#a78bfa]"
                        : "text-white/40 hover:text-white/70 hover:bg-white/5"
                    }`}
                  >
                    {section.label}
                  </a>
                ))}
              </div>
            ))}
          </div>

          {/* Docs — right, highlighted */}
          <a
            href="/docs"
            className="px-4 py-1.5 rounded-md text-xs font-semibold shrink-0 text-[#050510] hover:shadow-[0_0_20px_rgba(167,139,250,0.3)] transition-all"
            style={{ background: "linear-gradient(135deg, #a78bfa, #6366f1)" }}
          >
            Docs
          </a>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
