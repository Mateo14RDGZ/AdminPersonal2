"use client";

import { AnimatePresence, motion, useMotionValue, useTransform, type MotionValue } from "motion/react";

export type PesadillaMood = "idle" | "thinking" | "listening" | "ready" | "speaking" | "surprised" | "success" | "cancelled" | "error";

type PesadillaAvatarProps = {
  size?: number;
  active?: boolean;
  mood?: PesadillaMood;
  lookX?: MotionValue<number>;
  lookY?: MotionValue<number>;
  blink?: boolean;
};

function faceMotion(mood: PesadillaMood, blink: boolean) {
  if (blink) return { scaleY: 0.94, scaleX: 1.015, filter: "brightness(.9) saturate(1.15)" };
  if (mood === "thinking") return { scaleY: 1.015, scaleX: 0.99, filter: "brightness(.94) saturate(1.18)" };
  if (mood === "listening") return { scaleY: 1.025, scaleX: 1.01, filter: "brightness(1.07) saturate(1.22)" };
  if (mood === "speaking") return { scaleY: 1.035, scaleX: 1.012, filter: "brightness(1.08) saturate(1.3)" };
  if (mood === "surprised") return { scaleY: 1.065, scaleX: 0.97, filter: "brightness(1.14) saturate(1.3)" };
  if (mood === "success") return { scaleY: 1.025, scaleX: 1.04, filter: "brightness(1.16) saturate(1.38)" };
  if (mood === "error" || mood === "cancelled") return { scaleY: 0.965, scaleX: 1.04, filter: "brightness(.82) saturate(.92)" };
  return { scaleY: 1, scaleX: 1, filter: "brightness(1) saturate(1.05)" };
}

function AnimatedFace({ mood, blink, lookX, lookY }: Pick<PesadillaAvatarProps, "mood" | "blink" | "lookX" | "lookY">) {
  const activeMood = mood ?? "idle";
  const fallbackLookX = useMotionValue(0);
  const fallbackLookY = useMotionValue(0);
  const eyesX = useTransform(lookX ?? fallbackLookX, (value) => Math.max(-1.8, Math.min(1.8, value * 1.8)));
  const eyesY = useTransform(lookY ?? fallbackLookY, (value) => Math.max(-1.1, Math.min(1.1, value * 1.1)));
  const mouthKey = blink ? "blink" : activeMood;
  const showAlternateMouth = ["thinking", "speaking", "surprised", "ready", "success", "cancelled", "error"].includes(activeMood);

  return (
    <motion.svg className="pesadilla-face-overlay" viewBox="0 0 100 138" aria-hidden="true" style={{ x: eyesX, y: eyesY }}>
      <motion.g
        animate={blink ? { scaleY: 0.08, y: 5 } : activeMood === "listening" ? { scaleY: 1.1, y: -1 } : { scaleY: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        style={{ transformOrigin: "50px 84px" }}
      >
        <motion.ellipse cx="26" cy="84" rx="3.5" ry="5.6" fill="#160724" opacity={activeMood === "idle" ? 0 : .78} />
        <motion.ellipse cx="67" cy="84" rx="3.5" ry="5.6" fill="#160724" opacity={activeMood === "idle" ? 0 : .78} />
        {activeMood !== "idle" ? <>
          <motion.circle cx="25" cy="82.5" r="1.15" fill="#fff" opacity=".92" />
          <motion.circle cx="66" cy="82.5" r="1.15" fill="#fff" opacity=".92" />
        </> : null}
      </motion.g>
      <AnimatePresence mode="wait">
        {activeMood === "thinking" ? <motion.g key="thinking" initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><path d="M15 72Q26 63 38 70" fill="none" stroke="#15091f" strokeWidth="4.2" strokeLinecap="round" /><path d="M61 70Q72 64 83 72" fill="none" stroke="#15091f" strokeWidth="3.6" strokeLinecap="round" /><path d="M43 101Q50 104 57 101" fill="none" stroke="#250a3c" strokeWidth="5" strokeLinecap="round" /></motion.g> : null}
        {activeMood === "listening" ? <motion.g key="listening" initial={{ opacity: 0, scale: .8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}><path d="M16 72Q27 65 38 72" fill="none" stroke="#1d0a2d" strokeWidth="3.5" strokeLinecap="round" /><path d="M61 72Q73 65 84 72" fill="none" stroke="#1d0a2d" strokeWidth="3.5" strokeLinecap="round" /></motion.g> : null}
        {activeMood === "ready" ? <motion.g key="ready" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><path d="M15 71Q27 62 39 70M61 70Q74 62 85 71" fill="none" stroke="#180827" strokeWidth="3.8" strokeLinecap="round" /><path d="M37 99Q50 108 63 99Q50 115 37 99Z" fill="#b94cff" stroke="#210936" strokeWidth="1.5" /><path d="M50 101l3 4-4 1" fill="#fff" opacity=".92" /></motion.g> : null}
        {activeMood === "surprised" ? <motion.g key="surprised" initial={{ opacity: 0, scale: .7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}><path d="M15 70Q27 61 39 69M61 69Q73 61 85 70" fill="none" stroke="#20112e" strokeWidth="3.5" strokeLinecap="round" /><ellipse cx="50" cy="102" rx="5.8" ry="7" fill="#170722" stroke="#bb4dff" strokeWidth="1.6" /></motion.g> : null}
        {activeMood === "success" ? <motion.g key="success" initial={{ opacity: 0, scale: .74 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}><path d="M18 76Q27 84 36 76M64 76Q73 84 82 76" fill="none" stroke="#1a0829" strokeWidth="4" strokeLinecap="round" /><path d="M35 98Q50 113 65 98Q50 119 35 98Z" fill="#bc4dff" stroke="#210936" strokeWidth="1.7" /></motion.g> : null}
        {activeMood === "error" || activeMood === "cancelled" ? <motion.g key="error" initial={{ opacity: 0, x: -3 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}><path d="M15 76Q27 68 38 75M62 75Q73 68 85 76" fill="none" stroke="#09040e" strokeWidth="4.5" strokeLinecap="round" /><path d="M39 107Q50 96 61 107" fill="none" stroke="#9b2eec" strokeWidth="3.8" strokeLinecap="round" /></motion.g> : null}
        {activeMood === "speaking" ? <motion.g key="speaking" initial={{ opacity: 0, scale: .8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}><motion.path d="M36 99Q50 110 64 99Q50 116 36 99Z" fill="#160720" stroke="#bf57ff" strokeWidth="1.5" animate={{ scaleY: [.76, 1.15, .9, 1.1, .8] }} transition={{ duration: .76, repeat: Infinity, ease: "easeInOut" }} style={{ transformOrigin: "50px 104px" }} /></motion.g> : null}
      </AnimatePresence>
      {showAlternateMouth ? <motion.path key={mouthKey} d="M40 99Q50 105 60 99" fill="none" stroke="#0c0414" strokeWidth="2" opacity=".55" /> : null}
    </motion.svg>
  );
}

/**
 * Canonical Pesadilla artwork. The visual source is the approved character
 * reference supplied for the app; it is kept intact and only its transform,
 * glow and flight posture are animated so its identity never drifts.
 */
export function PesadillaAvatar({ size = 42, active = false, mood = "idle", lookX, lookY, blink = false }: PesadillaAvatarProps) {
  const expression = faceMotion(mood, blink);
  const fallbackLookX = useMotionValue(0);
  const fallbackLookY = useMotionValue(0);
  const gazeTilt = useTransform(lookX ?? fallbackLookX, (value) => Math.max(-1.8, Math.min(1.8, value * 1.8)));
  const gazeLift = useTransform(lookY ?? fallbackLookY, (value) => Math.max(-1.5, Math.min(1.5, value * -1.2)));

  return (
    <span
      className={`pesadilla-avatar pesadilla-avatar-${mood} ${active ? "pesadilla-avatar-active" : ""}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <motion.span
        className="pesadilla-avatar-art"
        style={{
          rotate: gazeTilt,
          y: gazeLift,
        }}
        animate={expression}
        transition={{ type: "spring", stiffness: 190, damping: 18, mass: 0.52 }}
      >
        <motion.img
          src="/mascots/pesadilla-canonical.png"
          alt=""
          draggable={false}
          animate={!active ? { rotate: 0, y: 0, scaleX: 1, scaleY: 1 } : mood === "success" ? { rotate: [0, -8, 7, 0], y: [0, -10, 0, -5, 0], scaleX: [1, 1.08, .94, 1.04, 1], scaleY: [1, .92, 1.1, .97, 1] } : mood === "cancelled" || mood === "error" ? { rotate: [0, -5, 6, -3, 0], x: [0, -4, 5, -2, 0], scaleX: [1, 1.07, .94, 1] } : mood === "thinking" ? { rotate: [-2, 3, -1, -2], y: [0, -3, 1, 0], scaleX: [1, .97, 1.02, 1] } : mood === "listening" ? { rotate: [0, 4, 2, 0], y: [0, -2, 0], scaleY: [1, 1.045, 1] } : mood === "ready" ? { rotate: [0, -2, 2, 0], y: [0, -4, 0], scaleX: [1, 1.025, 1] } : { rotate: [0, -0.85, 0.65, 0], y: [0, -1.25, 0.8, 0] }}
          transition={{ duration: mood === "success" ? .9 : mood === "cancelled" || mood === "error" ? .58 : mood === "thinking" ? 1.45 : 2.65, repeat: active && !["success", "cancelled", "error"].includes(mood) ? Infinity : 0, ease: "easeInOut" }}
        />
        <AnimatedFace mood={mood} blink={blink} lookX={lookX} lookY={lookY} />
      </motion.span>
    </span>
  );
}
