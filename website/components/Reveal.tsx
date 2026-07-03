"use client";

import { motion, useInView, type Variants } from "framer-motion";
import { useRef } from "react";

interface RevealProps {
  children: React.ReactNode;
  direction?: "up" | "down" | "left" | "right";
  blur?: boolean;
  delay?: number;
  duration?: number;
  className?: string;
}

export default function Reveal({
  children,
  direction = "up",
  blur = true,
  delay = 0,
  duration = 0.8,
  className = "",
}: RevealProps) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  const offsets = { up: [40, 0], down: [-40, 0], left: [0, 40], right: [0, -40] };
  const [y, x] = offsets[direction];

  const variants: Variants = {
    hidden: {
      opacity: 0,
      y: y || 0,
      x: x || 0,
      filter: blur ? "blur(8px)" : "blur(0px)",
    },
    visible: {
      opacity: 1,
      y: 0,
      x: 0,
      filter: "blur(0px)",
      transition: { duration, delay, ease: [0.25, 0.4, 0.25, 1] },
    },
  };

  return (
    <motion.div
      ref={ref}
      variants={variants}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      className={className}
    >
      {children}
    </motion.div>
  );
}
