import { cookies } from "next/headers";
import { cache } from "react";
import { paletteOf, type Palette, type PaletteGround } from "@/lib/rowPalette";
import { LOOK_COOKIE, PALETTE_COOKIE, parseLook, parsePalette, siteSettings, type Look } from "@/lib/rowSettings";

/* THE TWO COSMETIC SWITCHES THIS REQUEST WEARS, each the site setting
 * unless this browser carries the preview cookie: the LOOK (LOOK_COOKIE,
 * set by the settings route for an admin) and the PALETTE (PALETTE_COOKIE,
 * set by the middleware from ?palette=<id>). Read by the segment layout
 * for the whole site and by the front page for the landing's ground. The
 * cookies are honoured for anyone who carries them: a look or a palette is
 * cosmetic and not a permission. Neither throws. */

/* The settings once per request: the layout and the front page both ask,
 * and in the demo namespace siteSettings() is a query every time. */
export const siteSettingsOnce = cache(siteSettings);

export async function siteLook(): Promise<Look> {
  const settings = await siteSettingsOnce();
  let look = settings.look;
  try {
    const preview = parseLook(cookies().get(LOOK_COOKIE)?.value);
    if (preview) look = preview;
  } catch {
    /* cookies() outside a request scope — the site-wide look stands */
  }
  return look;
}

export async function sitePalette(): Promise<Palette> {
  const settings = await siteSettingsOnce();
  let id = settings.palette;
  try {
    const preview = parsePalette(cookies().get(PALETTE_COOKIE)?.value);
    if (preview) id = preview;
  } catch {
    /* cookies() outside a request scope — the site-wide palette stands */
  }
  return paletteOf(id);
}

/* THE GROUND THE LANDING PAINTS: the preset's, except under the ink look,
 * which is the whole site white on black (owner, 2026-09-16) — a paper
 * landing between an ink bar and an ink footer would be the one paper
 * page left, and its paper-cut type would sit on the look's flipped
 * variables. The accent still comes from the preset, cut for ink. */
export async function landingGround(): Promise<PaletteGround> {
  const [look, palette] = await Promise.all([siteLook(), sitePalette()]);
  return look === "ink" ? "ink" : palette.ground;
}
