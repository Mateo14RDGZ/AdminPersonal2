export type PesadillaMood = "idle" | "thinking" | "listening" | "ready" | "success" | "cancelled";

type PesadillaAvatarProps = {
  size?: number;
  active?: boolean;
  mood?: PesadillaMood;
};

/** Lightweight, expressive ghost mascot for Pesadilla. */
export function PesadillaAvatar({ size = 42, active = false, mood = "idle" }: PesadillaAvatarProps) {
  const face = "#433057";

  return (
    <span className={`pesadilla-avatar pesadilla-avatar-${mood} ${active ? "pesadilla-avatar-active" : ""}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g className="pesadilla-body">
          <path d="M14 48V30C14 18.5 21.8 10 32 10s18 8.5 18 20v18c0 3-3.4 4.7-5.8 2.8L40 47.6l-5.3 4-5.2-4-5.2 4-4.5-2.8C17.4 52.5 14 51 14 48Z" fill="#FBF8FF" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
          <path d="M19 53c3.6 3 7.9 4.5 13 4.5s9.4-1.5 13-4.5" stroke="#D6C8EA" strokeWidth="2.2" strokeLinecap="round" />
        </g>

        {mood === "thinking" ? <>
          <path d="M21.5 28.5c2.1-2.5 5.1-3.5 8-2.7M35.3 25.8c2.9-.8 5.9.2 8 2.7" stroke={face} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="26" cy="33" r="2.6" fill={face} /><circle cx="38" cy="33" r="2.6" fill={face} />
          <path d="M28.4 41.5c2.3-1.2 4.9-1.2 7.2 0" stroke={face} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="52" cy="16" r="2.5" fill="#FFD38D" /><circle cx="57" cy="10.5" r="1.65" fill="#FFD38D" /><circle cx="57" cy="22" r="1.45" fill="#FFD38D" />
        </> : mood === "listening" ? <>
          <ellipse cx="26" cy="32.5" rx="2.5" ry="3.2" fill={face} /><ellipse cx="38" cy="32.5" rx="2.5" ry="3.2" fill={face} />
          <path d="M27.5 40.5c2.8 2.4 6.2 2.4 9 0" stroke={face} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M51 31c3-2.8 3-6.3 0-9M55.5 34c5.1-4.8 5.1-10.5 0-15.2" stroke="#E5A855" strokeWidth="2.3" strokeLinecap="round" />
        </> : mood === "success" ? <>
          <path d="M21.5 33c2.1 2.8 4.4 2.8 6.6 0M35.9 33c2.1 2.8 4.4 2.8 6.6 0" stroke={face} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M25.5 40c4 4.9 9 4.9 13 0" stroke={face} strokeWidth="2.8" strokeLinecap="round" />
          <path d="M49 25.5l3 3 6-7" stroke="#4B9A68" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </> : mood === "cancelled" ? <>
          <path d="M21.5 29.5c2-1.6 4.2-2.1 6.3-1.5M36.2 28c2.1-.6 4.3-.1 6.3 1.5" stroke={face} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="26" cy="33" r="2.5" fill={face} /><circle cx="38" cy="33" r="2.5" fill={face} />
          <path d="M27.5 42.2c2.8-1.8 6.2-1.8 9 0" stroke={face} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M50 21.5l7 7M57 21.5l-7 7" stroke="#B27586" strokeWidth="2.5" strokeLinecap="round" />
        </> : <>
          <ellipse cx="26" cy="32.5" rx="2.6" ry="3.1" fill={face} /><ellipse cx="38" cy="32.5" rx="2.6" ry="3.1" fill={face} />
          <path d="M26.5 40.5c3.4 3.1 7.6 3.1 11 0" stroke={face} strokeWidth="2.7" strokeLinecap="round" />
          {mood === "ready" ? <path d="M49 26.5l3 3 6-7" stroke="#4B9A68" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : <path d="M52 21v8M56 25h-8" stroke="#E5A855" strokeWidth="2.4" strokeLinecap="round" />}
        </>}
      </svg>
    </span>
  );
}
