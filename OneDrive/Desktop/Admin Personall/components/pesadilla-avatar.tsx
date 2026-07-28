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

type FacePose = {
  eyeY: number;
  eyeScaleY: number;
  browY: number;
  browRotate: number;
  mouth: "smile" | "open" | "small" | "frown" | "o";
  lid: number;
  glow: string;
};

function poseFor(mood: PesadillaMood, blink: boolean): FacePose {
  if (blink) return { eyeY: 4, eyeScaleY: .08, browY: 0, browRotate: 0, mouth: "smile", lid: .92, glow: "#a855f7" };
  if (mood === "listening") return { eyeY: -2, eyeScaleY: 1.16, browY: -5, browRotate: 0, mouth: "small", lid: 0, glow: "#d8b4fe" };
  if (mood === "thinking") return { eyeY: 1, eyeScaleY: .82, browY: -2, browRotate: -4, mouth: "small", lid: .3, glow: "#c084fc" };
  if (mood === "speaking") return { eyeY: 0, eyeScaleY: 1, browY: 0, browRotate: 0, mouth: "open", lid: .08, glow: "#e9d5ff" };
  if (mood === "ready") return { eyeY: 0, eyeScaleY: 1.04, browY: -1, browRotate: 0, mouth: "smile", lid: 0, glow: "#f3e8ff" };
  if (mood === "surprised") return { eyeY: -3, eyeScaleY: 1.32, browY: -9, browRotate: 0, mouth: "o", lid: 0, glow: "#f5d0fe" };
  if (mood === "success") return { eyeY: 4, eyeScaleY: .46, browY: 2, browRotate: 0, mouth: "smile", lid: .48, glow: "#fef3c7" };
  if (mood === "error" || mood === "cancelled") return { eyeY: 2, eyeScaleY: .64, browY: 5, browRotate: 5, mouth: "frown", lid: .54, glow: "#e9d5ff" };
  return { eyeY: 0, eyeScaleY: 1, browY: 0, browRotate: 0, mouth: "smile", lid: .16, glow: "#e9d5ff" };
}

/**
 * Pesadilla is intentionally a vector character, not a static logo. Every
 * facial part is an independent SVG group so chat states can express a real
 * reaction without stretching or painting over a raster image.
 */
export function PesadillaAvatar({ size = 42, active = false, mood = "idle", lookX, lookY, blink = false }: PesadillaAvatarProps) {
  const pose = poseFor(mood, blink);
  const fallbackLookX = useMotionValue(0);
  const fallbackLookY = useMotionValue(0);
  const pupilX = useTransform(lookX ?? fallbackLookX, (value) => Math.max(-3.7, Math.min(3.7, value * 3.7)));
  const pupilY = useTransform(lookY ?? fallbackLookY, (value) => Math.max(-2.5, Math.min(2.5, value * 2.5)));
  const isSuccess = mood === "success";
  const isError = mood === "error" || mood === "cancelled";

  return (
    <span className={`pesadilla-avatar pesadilla-avatar-${mood} ${active ? "pesadilla-avatar-active" : ""}`} style={{ width: size, height: size }} aria-hidden="true">
      <motion.svg viewBox="0 0 160 180" className="pesadilla-avatar-svg" role="presentation">
        <defs>
          <linearGradient id="pesadilla-body" x1="24" y1="20" x2="132" y2="166" gradientUnits="userSpaceOnUse"><stop stopColor="#26203d" /><stop offset=".55" stopColor="#121020" /><stop offset="1" stopColor="#080713" /></linearGradient>
          <linearGradient id="pesadilla-eye" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#f2d7ff" /><stop offset=".38" stopColor="#ca63ff" /><stop offset="1" stopColor="#7c24d4" /></linearGradient>
          <linearGradient id="pesadilla-mouth" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#e8bdff" /><stop offset="1" stopColor="#9130e4" /></linearGradient>
          <filter id="pesadilla-glow" x="-45%" y="-45%" width="190%" height="190%"><feGaussianBlur stdDeviation="3.1" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>

        <motion.g animate={active ? mood === "thinking" ? { rotate: [-1.5, 1.8, -1.5] } : mood === "listening" ? { rotate: [-2, 2.5, -2] } : isSuccess ? { y: [0, -5, 0], rotate: [0, -5, 4, 0] } : isError ? { x: [0, -3, 4, -2, 0] } : { y: [0, -2.3, 0], rotate: [0, .8, 0] } : {}} transition={{ duration: mood === "speaking" ? .8 : mood === "thinking" ? 1.4 : 2.5, ease: "easeInOut", repeat: active && !isSuccess && !isError ? Infinity : 0 }} style={{ transformOrigin: "80px 92px" }}>
          <motion.ellipse cx="80" cy="143" rx="56" ry="13" fill="#9c35ee" opacity=".18" animate={active ? { scale: [1, 1.16, 1], opacity: [.13, .25, .13] } : {}} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }} />
          <motion.path d="M80 8C100 13 109 27 103 43C122 39 137 55 129 70C150 72 153 92 137 104C149 122 135 142 115 142C106 158 90 170 80 175C68 170 51 161 44 145C22 147 12 126 24 109C7 98 11 76 31 71C22 55 36 39 53 43C50 28 62 13 80 8Z" fill="url(#pesadilla-body)" stroke="#a943ff" strokeWidth="4.2" filter="url(#pesadilla-glow)" animate={active ? { scale: [1, 1.012, .996, 1] } : {}} transition={{ duration: 2.25, repeat: Infinity, ease: "easeInOut" }} style={{ transformOrigin: "80px 96px" }} />
          <motion.path d="M80 11C91 27 87 40 71 54C62 62 65 74 56 80C58 61 47 57 55 42C64 27 70 21 80 11Z" fill="#3d1770" opacity=".72" animate={active ? { rotate: [-2, 3, -2], scaleY: [1, 1.08, 1] } : {}} transition={{ duration: 1.85, repeat: Infinity, ease: "easeInOut" }} style={{ transformOrigin: "72px 54px" }} />
          <motion.path d="M117 52C123 61 119 71 110 77C118 70 124 78 124 87" fill="none" stroke="#d078ff" strokeWidth="3.5" strokeLinecap="round" opacity=".82" animate={active ? { pathLength: [1, .72, 1], opacity: [.56, 1, .56] } : {}} transition={{ duration: 1.55, repeat: Infinity, ease: "easeInOut" }} />

          <motion.g animate={{ y: pose.eyeY, scaleY: pose.eyeScaleY }} transition={{ type: "spring", stiffness: 280, damping: 21 }} style={{ transformOrigin: "80px 88px" }}>
            <path d="M27 87Q45 66 67 84Q60 111 39 106Q27 101 27 87Z" fill="url(#pesadilla-eye)" stroke="#2b0a54" strokeWidth="2.2" />
            <path d="M93 84Q115 66 133 86Q132 101 121 106Q100 111 93 84Z" fill="url(#pesadilla-eye)" stroke="#2b0a54" strokeWidth="2.2" />
            <motion.g style={{ x: pupilX, y: pupilY }} transition={{ type: "spring", stiffness: 360, damping: 23 }}>
              <ellipse cx="49" cy="91" rx="8" ry="12" fill="#10051e" /><ellipse cx="111" cy="91" rx="8" ry="12" fill="#10051e" />
              <circle cx="45" cy="86" r="3.1" fill="#fff" /><circle cx="107" cy="86" r="3.1" fill="#fff" />
              <circle cx="52" cy="98" r="1.25" fill="#dba5ff" /><circle cx="114" cy="98" r="1.25" fill="#dba5ff" />
            </motion.g>
          </motion.g>

          <motion.g animate={{ y: pose.browY, rotate: pose.browRotate }} transition={{ type: "spring", stiffness: 260, damping: 21 }} style={{ transformOrigin: "80px 74px" }}>
            <path d="M27 75Q47 54 67 76" fill="none" stroke="#120d20" strokeWidth="9" strokeLinecap="round" />
            <path d="M93 76Q114 54 133 75" fill="none" stroke="#120d20" strokeWidth="9" strokeLinecap="round" />
            <path d="M28 73Q48 57 65 74M95 74Q113 57 132 73" fill="none" stroke="#4b365d" strokeWidth="1.4" strokeLinecap="round" opacity=".55" />
          </motion.g>
          {pose.lid > 0 ? <motion.g initial={false} animate={{ opacity: pose.lid }} transition={{ duration: .16 }}><path d="M27 84Q47 68 67 84Q48 80 27 87Z" fill="#171225" /><path d="M93 84Q114 68 133 84Q113 80 93 87Z" fill="#171225" /></motion.g> : null}

          <motion.g key={pose.mouth} initial={{ opacity: .2, scale: .86 }} animate={mood === "speaking" ? { opacity: 1, scale: [1, 1.07, .94, 1.04, 1] } : { opacity: 1, scale: 1 }} transition={{ duration: mood === "speaking" ? .75 : .25, repeat: mood === "speaking" ? Infinity : 0, ease: "easeInOut" }} style={{ transformOrigin: "80px 123px" }}>
            {pose.mouth === "smile" ? <><path d="M47 119Q80 145 113 119Q80 155 47 119Z" fill="url(#pesadilla-mouth)" stroke="#12091d" strokeWidth="3" /><path d="M88 130l7 8-9 2" fill="#fff" /></> : null}
            {pose.mouth === "open" ? <path d="M51 119Q80 145 109 119Q80 154 51 119Z" fill="#14091f" stroke="#cd72ff" strokeWidth="2.5" /> : null}
            {pose.mouth === "small" ? <path d="M64 125Q80 130 96 125" fill="none" stroke="#d287ff" strokeWidth="3.6" strokeLinecap="round" /> : null}
            {pose.mouth === "frown" ? <path d="M64 137Q80 122 96 137" fill="none" stroke="#d8a2ff" strokeWidth="4" strokeLinecap="round" /> : null}
            {pose.mouth === "o" ? <ellipse cx="80" cy="128" rx="9" ry="11" fill="#160a20" stroke="#dc94ff" strokeWidth="2.5" /> : null}
          </motion.g>
          {isSuccess ? <motion.g animate={{ opacity: [.3, 1, .3], scale: [.75, 1.15, .75] }} transition={{ duration: 1.05, repeat: Infinity, ease: "easeInOut" }} style={{ transformOrigin: "80px 90px" }}><path d="M19 58l3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6ZM143 53l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" fill="#f7d68b" /></motion.g> : null}
          {mood === "thinking" ? <motion.g animate={{ y: [-2, -7, -2], opacity: [.4, 1, .4] }} transition={{ duration: 1.35, repeat: Infinity, ease: "easeInOut" }}><circle cx="118" cy="43" r="3" fill="#d8a2ff" /><circle cx="128" cy="32" r="5" fill="#d8a2ff" /><circle cx="142" cy="18" r="7" fill="#d8a2ff" /></motion.g> : null}
          {mood === "listening" ? <motion.g animate={{ scale: [.78, 1.12, .78], opacity: [.3, 1, .3] }} transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }} style={{ transformOrigin: "141px 104px" }}><path d="M138 92Q156 104 138 116M145 87Q166 104 145 121" fill="none" stroke="#d8a2ff" strokeWidth="2.5" strokeLinecap="round" /></motion.g> : null}
        </motion.g>
      </motion.svg>
    </span>
  );
}
