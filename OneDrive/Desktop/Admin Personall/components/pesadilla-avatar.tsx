"use client";

import { motion } from "motion/react";

export type PesadillaMood = "idle" | "thinking" | "listening" | "ready" | "success" | "cancelled";

type PesadillaAvatarProps = {
  size?: number;
  active?: boolean;
  mood?: PesadillaMood;
  lookX?: number;
  lookY?: number;
  blink?: boolean;
};

const flamePath = "M102 11C127 14 143 34 137 55c-4 14-17 22-14 37 1 9 9 15 16 13 9-3 9-15 5-23 20 15 28 39 18 61-4 9-11 15-20 19 10 7 13 19 7 29-7 13-20 19-35 18-13 18-31 26-51 21-17-4-31-16-37-32-16-3-28-15-31-30-3-16 6-28 18-36-11-9-14-24-6-37 6-10 17-16 28-17-8-12-5-28 6-37-1 13 4 20 13 21 8 1 13-7 12-15-2-15 8-30 27-41-7 17-1 28 10 30 13 2 18-12 10-27 15 7 25 20 27 35 1-17 12-30 29-37-6 18 1 31 14 32 11 1 19-9 17-22 16 10 22 27 16 43-4 12-13 18-11 30 1 8 7 13 14 11 9-2 11-13 8-21 20 14 29 38 21 60-5 13-15 22-28 27 11 9 12 24 5 35-8 12-22 17-35 14-13 17-30 24-49 21-18-3-32-14-39-29-17 0-31-11-36-27-4-15 2-29 14-38-13-9-17-25-9-39 6-11 17-17 30-18-9-14-4-31 10-39-2 14 5 24 16 23 10-1 14-11 10-23-3-14 5-30 23-40-6 16 0 29 12 30 13 1 20-12 11-29 17 8 28 24 26 42-1 10 3 17 10 18 10 1 17-9 15-22Z";

const bodyPath = "M101 30c17 4 27 18 23 37-3 14 4 24 16 26 9 2 17-4 19-14 14 14 18 35 9 51-7 13-20 19-35 20 9 9 8 23-2 31-10 8-25 8-37 1-11 16-29 23-46 17-15-5-26-17-29-31-17-2-28-13-30-28-2-14 5-25 18-32-12-9-14-25-5-37 7-9 18-14 30-12-8-15-2-30 12-36-2 13 5 22 15 21 10-1 14-11 11-23-2-13 6-27 21-36-4 17 2 28 13 28 12 0 17-12 9-28 16 8 25 24 21 42-2 10 2 17 10 18 9 1 16-9 14-22Z";

function expressionFor(mood: PesadillaMood) {
  if (mood === "thinking") return { browY: -2, browRotate: -5, eyeScale: 1.06, mouth: "thinking" as const };
  if (mood === "listening") return { browY: -1, browRotate: -2, eyeScale: 1.16, mouth: "smile" as const };
  if (mood === "ready") return { browY: 1, browRotate: 4, eyeScale: 1.1, mouth: "smirk" as const };
  if (mood === "success") return { browY: -3, browRotate: -8, eyeScale: 0.7, mouth: "happy" as const };
  if (mood === "cancelled") return { browY: 3, browRotate: 7, eyeScale: 0.78, mouth: "frown" as const };
  return { browY: 0, browRotate: 0, eyeScale: 1, mouth: "smirk" as const };
}

/** Semantic inline reconstruction of Pesadilla: flame, body, face and particles stay independently animatable. */
export function PesadillaAvatar({ size = 42, active = false, mood = "idle", lookX = 0, lookY = 0, blink = false }: PesadillaAvatarProps) {
  const expression = expressionFor(mood);
  const eyeScale = blink ? 0.08 : expression.eyeScale;
  const pupilX = Math.max(-2.8, Math.min(2.8, lookX * 1.7));
  const pupilY = Math.max(-1.9, Math.min(1.9, lookY * 1.3));

  return (
    <span className={`pesadilla-avatar pesadilla-avatar-${mood} ${active ? "pesadilla-avatar-active" : ""}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 200 220" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="pesadilla-outer" x1="30" y1="30" x2="166" y2="194" gradientUnits="userSpaceOnUse"><stop stopColor="#D35CFF" /><stop offset=".45" stopColor="#8B22EE" /><stop offset="1" stopColor="#491184" /></linearGradient>
          <radialGradient id="pesadilla-body" cx="0" cy="0" r="1" gradientTransform="translate(94 95) rotate(91) scale(111 103)" gradientUnits="userSpaceOnUse"><stop stopColor="#251447" /><stop offset=".55" stopColor="#100B25" /><stop offset="1" stopColor="#05030F" /></radialGradient>
          <linearGradient id="pesadilla-eye" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#E7BAFF" /><stop offset=".55" stopColor="#B045FF" /><stop offset="1" stopColor="#6C19C9" /></linearGradient>
          <linearGradient id="pesadilla-mouth" x1="100" y1="142" x2="100" y2="169" gradientUnits="userSpaceOnUse"><stop stopColor="#E0A5FF" /><stop offset="1" stopColor="#8525E8" /></linearGradient>
          <filter id="pesadilla-glow" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>

        <motion.g data-part="particles" animate={active ? { opacity: [0.55, 1, 0.65], y: [0, -3, 0] } : { opacity: 0.72 }} transition={{ duration: 2.8, repeat: active ? Infinity : 0, ease: "easeInOut" }}>
          <path d="m31 65 5 9-5 9-5-9 5-9ZM167 58l5 9-5 9-5-9 5-9ZM177 118l4 7-4 7-4-7 4-7Z" fill="#BC4DFF" filter="url(#pesadilla-glow)" />
        </motion.g>
        <motion.g data-part="outer-flame" animate={active ? { scaleY: [1, 1.035, .99, 1], rotate: [0, -1.4, 1, 0] } : { scaleY: 1 }} transition={{ duration: mood === "thinking" ? 1.35 : 3.4, repeat: active ? Infinity : 0, ease: "easeInOut" }} style={{ transformOrigin: "100px 118px" }}>
          <path d={flamePath} fill="url(#pesadilla-outer)" filter="url(#pesadilla-glow)" />
          <path d={bodyPath} fill="url(#pesadilla-body)" stroke="#5B1AA5" strokeWidth="2.5" />
        </motion.g>
        <motion.path data-part="inner-flame" d="M108 23c14 13 17 29 8 43-8 12-3 25 7 29-12 1-22-7-24-19-2-11 3-22 9-31 6-10 6-16 0-22Z" fill="#6D22C6" opacity=".42" animate={active ? { opacity: [.3, .62, .36], scaleY: [1, 1.08, 1] } : { opacity: .42 }} transition={{ duration: 2.1, repeat: active ? Infinity : 0, ease: "easeInOut" }} style={{ transformOrigin: "108px 62px" }} />
        <path d="M47 119c9-32 27-51 53-60-24 18-32 43-22 61-16-8-26-8-31-1Z" fill="#30205B" opacity=".42" />

        <motion.g data-part="left-eyebrow" animate={{ y: expression.browY, rotate: expression.browRotate }} transition={{ type: "spring", stiffness: 240, damping: 18 }} style={{ transformOrigin: "69px 104px" }}>
          <path d="M42 101c13-19 37-22 54-5l-8 13c-11-10-24-9-38 4l-8-12Z" fill="#090513" />
        </motion.g>
        <motion.g data-part="right-eyebrow" animate={{ y: expression.browY, rotate: -expression.browRotate }} transition={{ type: "spring", stiffness: 240, damping: 18 }} style={{ transformOrigin: "131px 104px" }}>
          <path d="M158 101c-13-19-37-22-54-5l8 13c11-10 24-9 38 4l8-12Z" fill="#090513" />
        </motion.g>

        <motion.g data-part="left-eye" animate={{ scaleY: eyeScale }} transition={{ type: "spring", stiffness: 320, damping: 20 }} style={{ transformOrigin: "68px 124px" }}>
          <path d="M44 119c13-13 34-15 48 2-4 22-33 29-48-2Z" fill="url(#pesadilla-eye)" stroke="#7D20DB" strokeWidth="2" />
          <motion.g data-part="left-pupil" animate={{ x: pupilX, y: pupilY }} transition={{ type: "spring", stiffness: 130, damping: 14 }}><ellipse cx="69" cy="129" rx="9" ry="13" fill="#0B061A" /><circle cx="65" cy="123" r="3.4" fill="white" /></motion.g>
        </motion.g>
        <motion.g data-part="right-eye" animate={{ scaleY: eyeScale }} transition={{ type: "spring", stiffness: 320, damping: 20 }} style={{ transformOrigin: "132px 124px" }}>
          <path d="M156 119c-13-13-34-15-48 2 4 22 33 29 48-2Z" fill="url(#pesadilla-eye)" stroke="#7D20DB" strokeWidth="2" />
          <motion.g data-part="right-pupil" animate={{ x: pupilX, y: pupilY }} transition={{ type: "spring", stiffness: 130, damping: 14 }}><ellipse cx="131" cy="129" rx="9" ry="13" fill="#0B061A" /><circle cx="127" cy="123" r="3.4" fill="white" /></motion.g>
        </motion.g>

        <motion.g data-part="mouth" animate={{ y: mood === "success" ? -2 : 0, scaleX: mood === "success" ? 1.12 : 1 }} transition={{ type: "spring", stiffness: 180, damping: 16 }} style={{ transformOrigin: "100px 158px" }}>
          {expression.mouth === "frown" ? <path d="M76 169c14-12 34-12 48 0-14-4-34-4-48 0Z" fill="url(#pesadilla-mouth)" /> : expression.mouth === "thinking" ? <path d="M75 157c15 10 35 11 51-1-9 17-39 22-51 1Z" fill="url(#pesadilla-mouth)" /> : <path d="M70 151c18 13 43 13 60-3-8 27-45 34-60 3Z" fill="url(#pesadilla-mouth)" />}
          <path data-part="tooth" d="m112 160 9-2-6 10-3-8Z" fill="#F7EFFF" />
        </motion.g>
      </svg>
    </span>
  );
}
