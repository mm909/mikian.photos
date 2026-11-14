/* The Rowtember ground, the same as the website: cream paper, ink, and the
 * water blue (owner, 2026-11-14: "good text size and font and blue color ...
 * we should keep it the same"). */
export const C = {
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
};

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
