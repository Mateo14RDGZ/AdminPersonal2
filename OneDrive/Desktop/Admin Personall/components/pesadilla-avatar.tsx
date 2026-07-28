type PesadillaAvatarProps = {
  size?: number;
  active?: boolean;
};

/** Lightweight SVG mascot for Pesadilla, kept entirely inside the app bundle. */
export function PesadillaAvatar({ size = 42, active = false }: PesadillaAvatarProps) {
  return (
    <span className={`pesadilla-avatar ${active ? "pesadilla-avatar-active" : ""}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M17 24.5C17 14.5 23.7 8 32 8s15 6.5 15 16.5v13C47 48.3 40.4 55 32 55s-15-6.7-15-17.5v-13Z" fill="currentColor" />
        <path d="M21 20.5 15 14l11 2.8M43 20.5 49 14l-11 2.8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M22 32c2.1-2.7 5-4 10-4s7.9 1.3 10 4" stroke="white" strokeWidth="3.2" strokeLinecap="round" />
        <circle cx="25.5" cy="35" r="3" fill="white" />
        <circle cx="38.5" cy="35" r="3" fill="white" />
        <path d="M26 43c3.5 2.8 8.5 2.8 12 0" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M52 22v8M56 26h-8" stroke="#FFD9A5" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}
