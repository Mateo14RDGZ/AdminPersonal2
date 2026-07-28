export type PesadillaMood = "idle" | "thinking" | "listening" | "ready" | "success" | "cancelled";

type PesadillaAvatarProps = {
  size?: number;
  active?: boolean;
  mood?: PesadillaMood;
};

/** Lightweight SVG mascot for Pesadilla, kept entirely inside the app bundle. */
export function PesadillaAvatar({ size = 42, active = false, mood = "idle" }: PesadillaAvatarProps) {
  return (
    <span className={`pesadilla-avatar pesadilla-avatar-${mood} ${active ? "pesadilla-avatar-active" : ""}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g className="pesadilla-body">
          <path d="M17 24.5C17 14.5 23.7 8 32 8s15 6.5 15 16.5v13C47 48.3 40.4 55 32 55s-15-6.7-15-17.5v-13Z" fill="currentColor" />
          <path d="M21 20.5 15 14l11 2.8M43 20.5 49 14l-11 2.8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        {mood === "thinking" ? <>
          <path d="M23 33c1.6-2.1 4-3 6.5-2.5M35 30.5c2.5-.5 4.9.4 6.5 2.5" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
          <circle cx="26" cy="36" r="2.25" fill="white" /><circle cx="38" cy="36" r="2.25" fill="white" />
          <path d="M28 44c2.5-1.4 5.5-1.4 8 0" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="52" cy="17" r="2" fill="#FFD9A5" /><circle cx="57" cy="12" r="1.4" fill="#FFD9A5" /><circle cx="57" cy="22" r="1.2" fill="#FFD9A5" />
        </> : mood === "listening" ? <>
          <circle cx="25.5" cy="35" r="3" fill="white" /><circle cx="38.5" cy="35" r="3" fill="white" />
          <path d="M27 43c3 2.2 7 2.2 10 0" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M51 31c3-2.8 3-6.2 0-9M55 34c5-4.7 5-10.3 0-15" stroke="#FFD9A5" strokeWidth="2.5" strokeLinecap="round" />
        </> : mood === "success" ? <>
          <path d="M21.5 35c2.2 2.8 4.5 2.8 6.7 0M35.8 35c2.2 2.8 4.5 2.8 6.7 0" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M25 42c4.2 4.5 9.8 4.5 14 0" stroke="white" strokeWidth="3" strokeLinecap="round" />
          <path d="M49 25.5l3 3 6-7" stroke="#E5FFD6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </> : mood === "cancelled" ? <>
          <path d="M22 32.5c2-1.8 4.3-2.4 6.5-1.8M35.5 30.7c2.2-.6 4.5 0 6.5 1.8" stroke="white" strokeWidth="2.7" strokeLinecap="round" />
          <circle cx="25.5" cy="35" r="2.5" fill="white" /><circle cx="38.5" cy="35" r="2.5" fill="white" />
          <path d="M27 45c3-1.8 7-1.8 10 0" stroke="white" strokeWidth="2.7" strokeLinecap="round" />
          <path d="M50 22l7 7M57 22l-7 7" stroke="#FFD9A5" strokeWidth="2.6" strokeLinecap="round" />
        </> : <>
          <path d="M22 32c2.1-2.7 5-4 10-4s7.9 1.3 10 4" stroke="white" strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="25.5" cy="35" r="3" fill="white" /><circle cx="38.5" cy="35" r="3" fill="white" />
          <path d="M26 43c3.5 2.8 8.5 2.8 12 0" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
          {mood === "ready" ? <path d="M49 26.5l3 3 6-7" stroke="#E5FFD6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : <path d="M52 22v8M56 26h-8" stroke="#FFD9A5" strokeWidth="2.5" strokeLinecap="round" />}
        </>}
      </svg>
    </span>
  );
}
