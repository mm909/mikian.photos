/* The marks, drawn here so no page borrows anybody's logo: a glizzy for
 * the Costco relay, a bell for the Taco Bell one, a double cheeseburger
 * for the In-N-Out one. Sticker style: flat fills, one ink outline. */

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

export function BurgerMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={(size * 184) / 200}
      viewBox="0 0 200 184"
      role="img"
      aria-label="A double cheeseburger"
    >
      <g stroke={INK} strokeWidth="6" strokeLinejoin="round">
        <path d="M24 154 H176 V160 C176 171 168 178 157 178 H43 C32 178 24 171 24 160 Z" fill="#e2a04f" />
        <rect x="16" y="130" width="168" height="24" rx="12" fill="#6b3a22" />
        <path d="M14 118 H186 V130 H152 L138 145 L124 130 H14 Z" fill="#ffc61a" />
        <rect x="16" y="94" width="168" height="24" rx="12" fill="#6b3a22" />
        <path d="M14 82 H186 V94 H90 L76 109 L62 94 H14 Z" fill="#ffc61a" />
        <path
          d="M10 66 H190 V76 q-11.25 13 -22.5 0 t-22.5 0 t-22.5 0 t-22.5 0 t-22.5 0 t-22.5 0 t-22.5 0 t-22.5 0 Z"
          fill="#3f9c4b"
        />
        <path d="M20 68 C20 30 58 8 100 8 C142 8 180 30 180 68 Z" fill="#e2a04f" />
      </g>
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
