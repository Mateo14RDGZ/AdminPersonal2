"use client";

import { AnimatePresence, motion, type MotionValue } from "motion/react";

export type PesadillaMood = "idle" | "thinking" | "listening" | "ready" | "speaking" | "surprised" | "success" | "cancelled" | "error";

type PesadillaAvatarProps = {
  size?: number;
  active?: boolean;
  mood?: PesadillaMood;
  lookX?: MotionValue<number>;
  lookY?: MotionValue<number>;
  blink?: boolean;
};

/**
 * This is the approved Pesadilla artwork. It is intentionally shown as the
 * original image with no face overlays, re-drawn eyes or geometry changes.
 * Motion only affects its outer transform, preserving every facial feature.
 */
export function PesadillaAvatar({ size = 42, active = false, mood = "idle" }: PesadillaAvatarProps) {
  const isError = mood === "error" || mood === "cancelled";
  const frame = mood === "idle" ? "canonical" : mood === "cancelled" ? "error" : mood;
  const source = frame === "canonical" ? "/mascots/pesadilla-canonical.png" : `/mascots/pesadilla-${frame}.png`;
  const animation = !active
    ? { x: 0, y: 0, rotate: 0, scale: 1 }
    : mood === "success"
      ? { y: [0, -13, 0, -7, 0], rotate: [0, -7, 6, 0], scale: [1, 1.075, .985, 1.035, 1] }
      : isError
        ? { x: [0, -4, 5, -3, 0], y: [0, 2, 0], rotate: [0, -3.5, 3, -1, 0], scale: [1, .985, 1.01, 1] }
        : mood === "thinking"
          ? { y: [0, -3, -6, -2, 0], rotate: [-2, 2.5, -1.5, -2], scale: [1, 1.008, .998, 1] }
          : mood === "listening"
            ? { y: [0, -4, 0], rotate: [0, 3, 0], scale: [1, 1.022, 1] }
            : mood === "speaking"
              ? { y: [0, -3.2, 0, -1.5, 0], rotate: [0, 1.3, -1, 0], scale: [1, 1.012, .997, 1] }
              : mood === "ready"
                ? { y: [0, -4, 0], rotate: [0, -1.5, 1.5, 0], scale: [1, 1.035, 1] }
                : mood === "surprised"
                  ? { y: [0, -7, 0], rotate: [0, 4, -2, 0], scale: [1, 1.06, 1] }
                  : { y: [0, -4.5, 0, -2, 0], rotate: [0, .8, -.7, 0], scale: [1, 1.014, .996, 1] };
  const duration = mood === "success" ? .92 : isError ? .65 : mood === "thinking" ? 1.42 : mood === "speaking" ? .82 : 2.35;

  return (
    <span className={`pesadilla-avatar pesadilla-avatar-${mood} ${active ? "pesadilla-avatar-active" : ""}`} style={{ width: size, height: size }} aria-hidden="true">
      <AnimatePresence mode="wait" initial={false}>
        <motion.img
          key={frame}
          src={source}
          alt=""
          draggable={false}
          className="pesadilla-avatar-original"
          initial={{ opacity: 0, scale: .9, filter: "blur(1px)" }}
          animate={{ ...animation, opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: .92, filter: "blur(.7px)" }}
          transition={{ duration, repeat: active && !["success", "cancelled", "error"].includes(mood) ? Infinity : 0, ease: "easeInOut" }}
        />
      </AnimatePresence>
    </span>
  );
}
