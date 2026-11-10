/* The two marks, drawn here so neither page borrows anybody's logo: a
 * glizzy for the Costco relay, a bell for the Taco Bell one. Sticker
 * style: flat fills, one ink outline. */

const INK = "#1c1a17";

export function GlizzyMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={(size * 132) / 248}
      viewBox="0 0 248 132"
      role="img"
      aria-label="A hot dog"
    >
      <rect x="22" y="38" width="204" height="60" rx="30" fill="#d99a4e" stroke={INK} strokeWidth="6" />
      <rect x="6" y="26" width="236" height="46" rx="23" fill="#c8432b" stroke={INK} strokeWidth="6" />
      <path
        d="M34 49 q12 -15 24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t12 -6"
        fill="none"
        stroke="#f4b400"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="22" y="66" width="204" height="52" rx="26" fill="#f0c27a" stroke={INK} strokeWidth="6" />
    </svg>
  );
}

export function BellMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 128 128" role="img" aria-label="A bell">
      <circle cx="64" cy="106" r="12" fill="#f6b91a" stroke={INK} strokeWidth="6" />
      <path
        d="M64 16 C40 16 28 36 28 60 V78 L14 98 H114 L100 78 V60 C100 36 88 16 64 16 Z"
        fill="#5c2d91"
        stroke={INK}
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <path d="M44 58 C44 44 50 34 60 30" fill="none" stroke="#d6247f" strokeWidth="7" strokeLinecap="round" />
      <rect x="55" y="6" width="18" height="14" rx="6" fill="#5c2d91" stroke={INK} strokeWidth="6" />
    </svg>
  );
}
