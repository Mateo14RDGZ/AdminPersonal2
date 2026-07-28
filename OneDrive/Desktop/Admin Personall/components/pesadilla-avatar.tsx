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
  if (blink) return { scale: .99, filter: "brightness(.9) saturate(1.15)" };
  if (mood === "thinking") return { scale: 1, filter: "brightness(.94) saturate(1.18)" };
  if (mood === "listening") return { scale: 1.015, filter: "brightness(1.07) saturate(1.22)" };
  if (mood === "speaking") return { scale: 1.012, filter: "brightness(1.08) saturate(1.3)" };
  if (mood === "surprised") return { scale: 1.03, filter: "brightness(1.14) saturate(1.3)" };
  if (mood === "success") return { scale: 1.025, filter: "brightness(1.16) saturate(1.38)" };
  if (mood === "error" || mood === "cancelled") return { scale: 1, filter: "brightness(.82) saturate(.92)" };
  return { scale: 1, filter: "brightness(1) saturate(1.05)" };
}

function AnimatedFace({ mood, blink, lookX, lookY }: Pick<PesadillaAvatarProps, "mood" | "blink" | "lookX" | "lookY">) {
  const activeMood = mood ?? "idle";
  const fallbackLookX = useMotionValue(0);
  const fallbackLookY = useMotionValue(0);
  const eyesX = useTransform(lookX ?? fallbackLookX, (value) => Math.max(-.8, Math.min(.8, value * .8)));
  const eyesY = useTransform(lookY ?? fallbackLookY, (value) => Math.max(-.55, Math.min(.55, value * .55)));
  const isError = activeMood === "error" || activeMood === "cancelled";
  const isBright = activeMood === "success" || activeMood === "ready";
  const eyeShape = activeMood === "listening"
    ? { left: "M15 79Q28 69 41 80Q38 98 24 97Q16 92 15 79Z", right: "M59 80Q72 69 85 79Q84 92 76 97Q62 98 59 80Z" }
    : activeMood === "thinking"
      ? { left: "M15 82Q27 76 41 82Q36 97 23 94Q17 90 15 82Z", right: "M59 81Q73 74 85 80Q83 94 70 95Q61 93 59 81Z" }
      : isError
        ? { left: "M16 84Q28 78 41 85Q36 93 24 91Q18 90 16 84Z", right: "M59 85Q73 78 84 84Q82 91 70 92Q62 92 59 85Z" }
        : { left: "M15 81Q28 72 42 82Q37 98 23 95Q16 91 15 81Z", right: "M58 82Q72 72 85 80Q84 91 76 96Q62 98 58 82Z" };
  const brow = activeMood === "thinking"
    ? { left: "M14 75Q27 62 43 73", right: "M58 73Q71 64 86 72" }
    : activeMood === "listening"
      ? { left: "M14 76Q28 66 42 75", right: "M58 75Q72 66 86 76" }
      : activeMood === "surprised"
        ? { left: "M15 73Q28 61 42 72", right: "M58 72Q72 61 86 73" }
        : isError
          ? { left: "M14 78Q28 68 43 79", right: "M57 79Q72 68 86 77" }
          : { left: "M14 76Q27 65 43 75", right: "M57 75Q72 65 86 76" };

  return (
    <motion.svg className="pesadilla-face-overlay" viewBox="0 0 100 138" aria-hidden="true" style={{ x: eyesX, y: eyesY }}>
      <AnimatePresence mode="wait">
        {blink ? (
          <motion.g key="blink" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <path d="M16 83Q28 91 41 82M59 82Q72 91 84 82" fill="none" stroke="#17091f" strokeWidth="4.1" strokeLinecap="round" />
          </motion.g>
        ) : activeMood !== "idle" ? (
          <motion.g key={activeMood} initial={{ opacity: 0, scale: .82, y: 2 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .92, y: -1 }} transition={{ type: "spring", stiffness: 260, damping: 22 }} style={{ transformOrigin: "50px 87px" }}>
            <path d={eyeShape.left} fill="#1a0829" opacity=".96" />
            <path d={eyeShape.right} fill="#1a0829" opacity=".96" />
            <path d={eyeShape.left} fill="none" stroke="#b94cff" strokeWidth="1.4" opacity={isError ? .35 : .82} />
            <path d={eyeShape.right} fill="none" stroke="#b94cff" strokeWidth="1.4" opacity={isError ? .35 : .82} />
            <motion.g animate={activeMood === "thinking" ? { x: [-1.5, 1.5, -.5], y: [1, -1.5, 1] } : activeMood === "speaking" ? { y: [0, -.7, 0] } : { x: 0, y: 0 }} transition={{ duration: activeMood === "thinking" ? 1.45 : .7, repeat: activeMood === "thinking" || activeMood === "speaking" ? Infinity : 0, ease: "easeInOut" }}>
              <ellipse cx={activeMood === "thinking" ? "25" : "27"} cy={activeMood === "listening" ? "85" : "86"} rx={activeMood === "listening" ? "4.6" : "4"} ry={activeMood === "surprised" ? "5.2" : "5"} fill="#13051d" />
              <ellipse cx={activeMood === "thinking" ? "72" : "72"} cy={activeMood === "thinking" ? "82" : activeMood === "listening" ? "85" : "86"} rx={activeMood === "listening" ? "4.6" : "4"} ry={activeMood === "surprised" ? "5.2" : "5"} fill="#13051d" />
              <circle cx={activeMood === "thinking" ? "23.5" : "25.5"} cy={activeMood === "thinking" ? "82.5" : "82.5"} r="1.55" fill="#fff" />
              <circle cx={activeMood === "thinking" ? "70.5" : "70.5"} cy={activeMood === "thinking" ? "78.5" : "82.5"} r="1.55" fill="#fff" />
            </motion.g>
            <path d={brow.left} fill="none" stroke="#17091f" strokeWidth="4.25" strokeLinecap="round" />
            <path d={brow.right} fill="none" stroke="#17091f" strokeWidth="4.25" strokeLinecap="round" />
            {activeMood === "thinking" ? <path d="M42 105Q50 108 58 103" fill="none" stroke="#bf57ff" strokeWidth="2.8" strokeLinecap="round" /> : null}
            {activeMood === "listening" ? <path d="M42 104Q50 107 58 104" fill="none" stroke="#ca70ff" strokeWidth="2.5" strokeLinecap="round" /> : null}
            {activeMood === "ready" ? <path d="M35 102Q50 116 65 102Q50 119 35 102Z" fill="#b844ff" stroke="#17091f" strokeWidth="2" /> : null}
            {activeMood === "success" ? <><path d="M18 85Q28 94 39 85M61 85Q72 94 82 85" fill="none" stroke="#f1cfff" strokeWidth="2.6" strokeLinecap="round" /><path d="M34 102Q50 120 66 102Q50 123 34 102Z" fill="#c45dff" stroke="#17091f" strokeWidth="2" /><path d="M55 105l4 5-5 1" fill="#fff" /></> : null}
            {activeMood === "surprised" ? <ellipse cx="50" cy="106" rx="6.3" ry="7.5" fill="#180723" stroke="#c961ff" strokeWidth="1.9" /> : null}
            {activeMood === "speaking" ? <motion.path d="M35 103Q50 115 65 103Q50 121 35 103Z" fill="#190722" stroke="#c55aff" strokeWidth="1.7" animate={{ scaleY: [.72, 1.18, .86, 1.1, .75] }} transition={{ duration: .82, repeat: Infinity, ease: "easeInOut" }} style={{ transformOrigin: "50px 108px" }} /> : null}
            {isError ? <path d="M40 113Q50 102 61 113" fill="none" stroke="#e3a3ff" strokeWidth="3.1" strokeLinecap="round" /> : null}
            {isBright ? <motion.g animate={{ opacity: [.25, 1, .25], scale: [.72, 1.12, .72] }} transition={{ duration: 1.15, repeat: Infinity, ease: "easeInOut" }} style={{ transformOrigin: "50px 84px" }}><circle cx="17" cy="72" r="1.55" fill="#e9b7ff" /><circle cx="84" cy="72" r="1.55" fill="#e9b7ff" /></motion.g> : null}
          </motion.g>
        ) : null}
      </AnimatePresence>
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
          animate={!active ? { rotate: 0, y: 0, scale: 1 } : mood === "success" ? { rotate: [0, -8, 7, 0], y: [0, -10, 0, -5, 0], scale: [1, 1.06, .98, 1.035, 1] } : mood === "cancelled" || mood === "error" ? { rotate: [0, -5, 6, -3, 0], x: [0, -4, 5, -2, 0], scale: [1, 1.025, .985, 1] } : mood === "thinking" ? { rotate: [-2, 3, -1, -2], y: [0, -3, 1, 0], scale: [1, .99, 1.01, 1] } : mood === "listening" ? { rotate: [0, 4, 2, 0], y: [0, -2, 0], scale: [1, 1.025, 1] } : mood === "ready" ? { rotate: [0, -2, 2, 0], y: [0, -4, 0], scale: [1, 1.02, 1] } : { rotate: [0, -0.85, 0.65, 0], y: [0, -1.25, 0.8, 0] }}
          transition={{ duration: mood === "success" ? .9 : mood === "cancelled" || mood === "error" ? .58 : mood === "thinking" ? 1.45 : 2.65, repeat: active && !["success", "cancelled", "error"].includes(mood) ? Infinity : 0, ease: "easeInOut" }}
        />
        <AnimatedFace mood={mood} blink={blink} lookX={lookX} lookY={lookY} />
      </motion.span>
    </span>
  );
}
