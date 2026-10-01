/* THE PALETTES (owner, 2026-09-30: the brand is white, black and red now,
 * and he wants to try colours live). One preset is the site: it sets the
 * landing's ground and the accent every /row100k page wears through
 * --water (theme.ts). Which one is the "palette" site setting
 * (rowSettings.ts); PALETTE_COOKIE previews one on a single browser, set
 * from ?palette=<id> on any /row100k URL (middleware.ts) and read by the
 * segment layout the way the look preview is.
 *
 * Every accent is given twice — on paper and on ink — because a colour that
 * reads on cream is mud on black and the other way round. The hover is the
 * lighter cut of the same hue; the pale is the wash a slab lifts with
 * (--water-pale: the finished row, a pressed card). Each accent is checked
 * at 4.5:1 against its ground so a mono label in it still reads:
 *   orange  #B04506 on paper 5.1   #FF7A1A on ink 6.9
 *   red     #C8321F on paper 4.8   #EC4530 on ink 4.7
 *   water   #0077B6 on paper 4.4   #1A90D4 on ink 5.1
 *   mustard #85661A on paper 4.8   #E0B32B on ink 9.1
 *   forest  #256E45 on paper 5.6   #3F9E5A on ink 5.3
 * (the water on paper is the site's own blue of 2026-09-05, kept as it is).
 *
 * OCTOBER ORANGE IS THE DEFAULT (owner, 2026-10-01: "instead of red, let's
 * pick like October orange. Let's pick a month theme color. Like Halloween
 * orange"). A pumpkin on ink; on paper the same hue burnt down until a mono
 * label in it reads — and still reads on the dimmed paper a dark-mode
 * phone gets (theme.ts, #E9E7DF: 4.6:1). White caps do not hold on the
 * pumpkin (2.6:1), so a slab of it carries ink caps (capsOn below); the
 * burnt cut holds white.
 *
 * THE ACCENT FOLLOWS THE LOOK (same day: "now that the page is white on
 * black we need the other pages to follow"). The ink look is the site now
 * and it is no longer monochrome: paletteCss hands every page the cut for
 * the ground it sits on, and the type a slab of it carries as --on-water.
 *
 * PURE: no imports, no database. The middleware (edge) and the client
 * components read this file too, so it must stay free of anything that
 * needs a server. */

export type PaletteGround = "ink" | "paper";

export type PaletteId = "ink-orange" | "ink-red" |"ink-water" | "paper-red" | "paper-water" | "ink-yellow" | "ink-green";

export type Palette = {
  id: PaletteId;
  /* The word on the admin control. */
  name: string;
  /* The landing's ground. The rest of the site keeps the ground the look
   * setting gives it. */
  ground: PaletteGround;
  accentOnPaper: string;
  accentOnPaperHover: string;
  accentOnPaperPale: string;
  accentOnInk: string;
  accentOnInkHover: string;
  accentOnInkPale: string;
};

export const PALETTE_COOKIE = "row100k_palette";

/* The ground colours the landing paints, the theme's own (theme.ts
 * --paper and --ink). */
export const PAPER = "#F4F3EE";
export const INK = "#15171a";

const ORANGE = { accentOnPaper: "#B04506", accentOnPaperHover: "#D2580F", accentOnPaperPale: "#FBE7D6", accentOnInk: "#FF7A1A", accentOnInkHover: "#FF9A4D", accentOnInkPale: "#2E1C0E" };
const RED = { accentOnPaper: "#C8321F", accentOnPaperHover: "#E04A36", accentOnPaperPale: "#F7E1DC", accentOnInk: "#EC4530", accentOnInkHover: "#F26A5C", accentOnInkPale: "#2A1613" };
const WATER = { accentOnPaper: "#0077B6", accentOnPaperHover: "#1a90d4", accentOnPaperPale: "#e3eef5", accentOnInk: "#1A90D4", accentOnInkHover: "#4FB3EA", accentOnInkPale: "#1c2b33" };
const MUSTARD = { accentOnPaper: "#85661A", accentOnPaperHover: "#A07C1F", accentOnPaperPale: "#F3EAD0", accentOnInk: "#E0B32B", accentOnInkHover: "#EAC455", accentOnInkPale: "#2A2410" };
const FOREST = { accentOnPaper: "#256E45", accentOnPaperHover: "#2F8A56", accentOnPaperPale: "#E0EFE5", accentOnInk: "#3F9E5A", accentOnInkHover: "#5BB876", accentOnInkPale: "#142A1B" };

/* In the order the control lists them. The first is the default. */
export const PALETTES: readonly Palette[] = [
  { id: "ink-orange", name: "Ink orange", ground: "ink", ...ORANGE },
  { id: "ink-red", name: "Ink red", ground: "ink", ...RED },
  { id: "ink-water", name: "Ink water", ground: "ink", ...WATER },
  { id: "paper-red", name: "Paper red", ground: "paper", ...RED },
  { id: "paper-water", name: "Paper water", ground: "paper", ...WATER },
  { id: "ink-yellow", name: "Ink yellow", ground: "ink", ...MUSTARD },
  { id: "ink-green", name: "Ink green", ground: "ink", ...FOREST },
];

export const DEFAULT_PALETTE: PaletteId = "ink-orange";

export function isPaletteId(v: unknown): v is PaletteId {
  return typeof v === "string" && PALETTES.some((p) => p.id === v);
}

export function paletteOf(id: PaletteId): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

/* The accent a palette puts on a given ground. */
export function accentOn(p: Palette, ground: PaletteGround): { accent: string; hover: string; pale: string } {
  return ground === "ink"
    ? { accent: p.accentOnInk, hover: p.accentOnInkHover, pale: p.accentOnInkPale }
    : { accent: p.accentOnPaper, hover: p.accentOnPaperHover, pale: p.accentOnPaperPale };
}

/* ------------------------------------------------------------ contrast */

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* The type a filled accent slab carries: white when white clears 3:1 on it
 * (the large-text floor; the slab's word is set large), ink otherwise — a
 * mustard or a pale green slab cannot hold white caps. */
export function capsOn(accent: string): string {
  return contrast("#ffffff", accent) >= 3 ? "#ffffff" : INK;
}

/* THE SITE-WIDE OVERRIDE, one style tag on the /row100k root (RowSite.tsx):
 * the accent into the three water variables of theme.ts, cut for the
 * ground the look puts under the page, and --on-water, the type a filled
 * slab of it carries (capsOn). Until 2026-10-01 this was the paper cut only
 * and the ink look kept a monochrome white of its own; the ink look wears
 * the accent now, so the rule takes the look.
 *
 * A page that is ink on its own (.chrome-ink: the landing on an ink preset,
 * race day, the results board, the dev board) takes the ink cut whatever
 * the look, since what it draws in the accent sits on black.
 *
 * Two attributes on the wrapper, so the rule outranks the theme root, the
 * fallbacks theme.ts keeps for a page outside the layout, and the order the
 * style tags land in. Rendered as the text child of a style tag: no quotes,
 * no angle brackets, no ampersands. */
function waterVars(a: { accent: string; hover: string; pale: string }): string {
  return `--water:${a.accent};--water-hover:${a.hover};--water-pale:${a.pale};--on-water:${capsOn(a.accent)}`;
}

export function paletteCss(p: Palette, ground: PaletteGround = "paper"): string {
  const root = "[data-look][data-palette] .row100k";
  return `${root}{${waterVars(accentOn(p, ground))}}${root}.chrome-ink{${waterVars(accentOn(p, "ink"))}}`;
}
