/* THE ACCENT THE CREAM POSTER SHEET PAINTS IN (owner, 2026-10-30, of a blue
 * poster on the brown site: "Make sure to fix the poster colors!! Make
 * them fall colors."). RowSite sets it as it renders — the palette's cut
 * for paper, since the sheet is paper whatever the look — and paint.ts
 * builds the cream palette off it at draw time (creamWith). Kept in a
 * module of its own, with no imports, so RowSite (in every page's bundle)
 * never pulls the drawing modules in; share/accent.ts does the same for
 * the cards. Null until set: the September blue the sheet shipped in. */
let accent: string | null = null;

export function setPosterAccent(hex: string): void {
  accent = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : null;
}

export function posterAccent(): string | null {
  return accent;
}
