import React, { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";

const BG = "#0d1b1e";     // deep teal/black
const ACCENT = "#4a9b8e"; // project primary

export default function NivraSplash({ onDone }) {
  const reduce = useReducedMotion();

  useEffect(() => {
    // only call onDone after the visual completes
    const t = setTimeout(() => onDone?.(), 2400);
    return () => clearTimeout(t);
  }, [onDone]);

  const letters = "NIVRA".split("");

  const letterVariants = {
    hidden: { opacity: 0, scale: 0.8, filter: "blur(6px)" },
    show: (i) => ({
      opacity: 1,
      scale: reduce ? 1 : [1.08, 1],
      filter: "blur(0px)",
      transition: {
        delay: 0.2 + i * 0.08,
        duration: reduce ? 0.01 : 0.45,
        ease: [0.22, 1, 0.36, 1],
      },
    }),
  };

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: reduce ? 0.1 : 0.35 } }}
      className="fixed inset-0 z-[100] grid place-items-center"
      style={{ background: BG }}
      aria-label="NIVRA intro"
      role="dialog"
      aria-modal="true"
    >
      {/* subtle radial glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(800px 400px at 50% 60%, rgba(74,155,142,0.25), transparent 60%)",
        }}
        aria-hidden
      />

      {/* word */}
      <div className="relative">
        <motion.div
          initial={{ scale: reduce ? 1 : 0.98 }}
          animate={{ scale: 1, transition: { duration: reduce ? 0.01 : 0.6, ease: [0.22, 1, 0.36, 1] } }}
          className="flex items-center gap-2"
        >
          {letters.map((ch, i) => (
            <motion.span
              key={i}
              custom={i}
              variants={letterVariants}
              initial="hidden"
              animate="show"
              className="font-black select-none"
              style={{
                color: "white",
                // responsive: ~44px on small → 88px on large
                fontSize: "clamp(2.75rem, 8vw, 5.5rem)",
                letterSpacing: "0.08em",
                textShadow: "0 10px 40px rgba(0,0,0,0.35)",
              }}
            >
              {ch}
            </motion.span>
          ))}
        </motion.div>

        {/* accent underline sweep */}
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: "100%", opacity: 1 }}
          transition={{ delay: reduce ? 0.05 : 0.8, duration: reduce ? 0.05 : 0.5, ease: "easeOut" }}
          className="h-[3px] mt-2 mx-auto"
          style={{ background: ACCENT }}
          aria-hidden
        />

        {/* flash */}
        {!reduce && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.9, 0] }}
            transition={{ delay: 1.1, duration: 0.25 }}
            className="absolute inset-0 rounded-2xl"
            style={{
              boxShadow: `0 0 120px ${ACCENT}`,
              filter: "blur(12px)",
              pointerEvents: "none",
            }}
            aria-hidden
          />
        )}
      </div>
    </motion.div>
  );
}
