/* The Rowtember ground, the same as the website: cream paper, ink, and the
 * water blue (owner, 2026-11-14: "good text size and font and blue color ...
 * we should keep it the same"). */
const LIGHT = {
  paper: "#F4F3EE",
  card: "#FFFFFF",
  ink: "#15171a",
  soft: "#3b3e42",
  gray: "#8a8a85",
  line: "#c9c8c0",
  accent: "#0077B6",
  accentLight: "#4FB3EA",
  pale: "#e3eef5",
  good: "#2f7d4f",
  /* The warm tint the site lays behind its tables: rgba(236,220,170,.22) on the paper. */
  tint: "#F2EEDF",
  /* The board's wash behind a row: the field's, and the viewer's own. */
  wash: "rgba(21,23,26,0.09)",
  washMe: "rgba(0,119,182,0.3)",
};

/* THE DARK LOOK (owner, 2026-11-21: "does the app look terrible if it's
 * dark mode? Let's see what it looks like"; "I would like a dark mode
 * version ... it's that matte blue is what we currently have"). The site's
 * ink look turned over: ink for the ground, cream for the type, and the
 * blue the site uses where the accent sits on ink (#1A90D4, CLAUDE.md).
 * Never the default: cream is (CLAUDE.md, "never dark by default"). A rower
 * turns it on in SETTINGS, on that phone only. */
const DARK: typeof LIGHT = {
  paper: "#15171a",
  card: "#1d2024",
  ink: "#F4F3EE",
  soft: "#cfcec6",
  gray: "#8f8f8a",
  line: "#3a3d42",
  accent: "#1A90D4",
  accentLight: "#4FB3EA",
  pale: "#17303f",
  good: "#58b07c",
  tint: "#1c1f23",
  wash: "rgba(244,243,238,0.08)",
  washMe: "rgba(26,144,212,0.34)",
};

/* The colours in use. ONE object, changed in place by setLook, so every
 * style that reads it while drawing follows the look; the few styles built
 * once when a file loads register with onLook and are built again. The
 * app's root is mounted afresh after a change (App.tsx). */
export const C = { ...LIGHT };
let dark = false;
const hooks: (() => void)[] = [];
export const isDark = () => dark;
export function onLook(f: () => void): void {
  hooks.push(f);
}
export function setLook(toDark: boolean): void {
  dark = toDark;
  Object.assign(C, toDark ? DARK : LIGHT);
  for (const f of hooks) f();
}

/* The site's three faces: Archivo Black for figures and heads, Archivo for
 * reading, Space Mono for the small capitals. Loaded in App.tsx. A custom
 * face carries its own weight, so styles name a face and never a weight. */
export const F = {
  black: "ArchivoBlack_400Regular",
  bold: "Archivo_700Bold",
  semi: "Archivo_600SemiBold",
  sans: "Archivo_400Regular",
  mono: "SpaceMono_400Regular",
  monoBold: "SpaceMono_700Bold",
};

export const fmtInt = (v: number): string => Math.round(v).toLocaleString("en-US");

/* 1247.3 s -> "20:47.3" */
export function fmtClock(seconds: number, tenths = true): string {
  const t = Math.max(0, Math.floor(seconds * 10 + 1e-6));
  const h = Math.floor(t / 36000);
  const m = Math.floor((t % 36000) / 600);
  const s = Math.floor((t % 600) / 10);
  const body = `${h ? String(m).padStart(2, "0") : m}:${String(s).padStart(2, "0")}${tenths ? `.${t % 10}` : ""}`;
  return h ? `${h}:${body}` : body;
}

export const fmtPace = (pace: number): string => (pace > 0 && pace < 600 ? fmtClock(pace) : "-:--.-");

/* Local calendar day, "YYYY-MM-DD". */
export function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* 5398 s -> "1 h 29 m"; under an hour, "29 m". */
export function fmtHours(seconds: number): string {
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} m` : `${m} m`;
}

/* THE LIFETIME TAG (owner, 2026-11-20: "showing their meters tag (10k, 50,
 * 100, 250, 500 etc)"; "I like the ladder of lifetime meter stamps"): the
 * highest rung a rower's all-time meters have reached, or null under the
 * first. */
export const LADDER: { meters: number; tag: string }[] = [
  { meters: 10_000, tag: "10K" },
  { meters: 50_000, tag: "50K" },
  { meters: 100_000, tag: "100K" },
  { meters: 250_000, tag: "250K" },
  { meters: 500_000, tag: "500K" },
  { meters: 1_000_000, tag: "1M" },
  { meters: 2_000_000, tag: "2M" },
  { meters: 5_000_000, tag: "5M" },
];
export function lifetimeTag(meters: number): { tag: string; next: { meters: number; tag: string } | null } | null {
  let at = -1;
  for (let i = 0; i < LADDER.length; i++) if (meters >= LADDER[i].meters) at = i;
  const next = LADDER[at + 1] ?? null;
  return at < 0 ? (next ? { tag: "", next } : null) : { tag: LADDER[at].tag, next };
}

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
