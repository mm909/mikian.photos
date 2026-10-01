import { cookies } from "next/headers";
import { paletteOf, type Palette } from "@/lib/rowPalette";
import { PALETTE_COOKIE, parsePalette, siteSettings } from "@/lib/rowSettings";

/* THE PALETTE THIS REQUEST WEARS: the site setting, unless this browser
 * carries the preview cookie (middleware.ts sets it from ?palette=<id>).
 * Read by the segment layout for the site-wide accent and by the front page
 * for the landing's ground, the same way the look preview is read. The
 * cookie is honoured for anyone who carries it: a palette is cosmetic and
 * not a permission. Never throws. */
export async function sitePalette(): Promise<Palette> {
  const settings = await siteSettings();
  let id = settings.palette;
  try {
    const preview = parsePalette(cookies().get(PALETTE_COOKIE)?.value);
    if (preview) id = preview;
  } catch {
    /* cookies() outside a request scope — the site-wide palette stands */
  }
  return paletteOf(id);
}
