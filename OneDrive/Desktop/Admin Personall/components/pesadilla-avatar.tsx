"use client";

import { motion, useMotionValue, useTransform, type MotionValue } from "motion/react";

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
          animate={active ? { rotate: [0, -0.85, 0.65, 0], y: [0, -1.25, 0.8, 0] } : { rotate: 0, y: 0 }}
          transition={{ duration: mood === "thinking" ? 1.6 : 2.85, repeat: active ? Infinity : 0, ease: "easeInOut" }}
        />
      </motion.span>
    </span>
  );
}
