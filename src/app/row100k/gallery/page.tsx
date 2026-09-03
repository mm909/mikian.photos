import type { Metadata } from "next";
import { notFound } from "next/navigation";
import path from "path";
import { readdir } from "fs/promises";
import { getEffectiveActor } from "@/lib/permissions";
import { isRow100kAdmin } from "@/lib/row100k";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { Gallery } from "./Gallery";
import manifest from "./manifest.json";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The gallery — 100K September",
  description: "The month in photos — Rowtember, shot by Mikian.",
  robots: { index: false, follow: false },
};

/* Where the camera JPGs land (batch-copied off the card). Filenames are the
 * camera's shot sequence — the only ordering signal we have, so higher
 * number = shot later = shown first.
 *
 * Serving note: everything under public/ is world-readable at its URL once
 * deployed — the admin gate below hides only this listing page, not the
 * photos themselves. Fine for community shots headed for publication; don't
 * drop anything private in this folder. */
const GALLERY_DIR = path.join(process.cwd(), "public", "row100k", "rowtember-profiles");

/* Gallery-only styles — scoped with a .gal- prefix; theme.ts stays untouched.
 * Rendered as the text child of a style tag, so no double quotes and no
 * angle brackets anywhere in the string (see the note in theme.ts).
 *
 * Owner-approved exception to the paper palette: the grid band is pure black,
 * Google-Photos style, full-bleed outside the 760px wrap. Tiles are equal
 * portrait cells with a thin white border and nothing else — no mat, no
 * shadow, no radius, no hover motion. Portrait and square frames crop to the
 * cell; a strongly landscape frame letterboxes on white instead (the
 * gal-letterbox mode the client component flips on per image). */
const galleryCss = `
.row100k .gal-band{background:#000;padding:28px 20px 56px}
.row100k .gal-count{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8a8a85;text-align:center;margin:0 0 24px}
.row100k .gal-empty{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8a8a85;text-align:center;margin:48px 0;padding:0}
.row100k .gal-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:20px;max-width:1800px;margin:0 auto}
.row100k .gal-tile{display:block;appearance:none;-webkit-appearance:none;margin:0;padding:0;width:100%;aspect-ratio:6/7;border:2px solid #fff;border-radius:0;background:#000;overflow:hidden;cursor:pointer}
.row100k .gal-tile.gal-letterbox{background:#fff}
.row100k .gal-tile img{display:block;width:100%;height:100%;object-fit:cover}
.row100k .gal-tile.gal-letterbox img{object-fit:contain}
@media (max-width:1279px){.row100k .gal-grid{grid-template-columns:repeat(4,1fr)}}
@media (max-width:899px){.row100k .gal-grid{grid-template-columns:repeat(3,1fr)}}
@media (max-width:599px){.row100k .gal-grid{grid-template-columns:repeat(2,1fr);gap:12px}.row100k .gal-band{padding:20px 12px 40px}}
.row100k .gal-lb{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.96);display:flex;align-items:center;justify-content:center;touch-action:pan-y}
.row100k .gal-lb img{max-width:92vw;max-height:88vh;width:auto;height:auto;object-fit:contain;display:block;user-select:none}
.row100k .gal-lb-arrow{position:absolute;top:50%;transform:translateY(-50%);appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0;padding:24px 18px;margin:0;color:#fff;font-family:var(--row-archivo),sans-serif;font-size:44px;line-height:1;cursor:pointer;opacity:.85}
.row100k .gal-lb-arrow:hover{opacity:1}
.row100k .gal-lb-prev{left:8px}
.row100k .gal-lb-next{right:8px}
.row100k .gal-lb-close{position:absolute;top:12px;right:16px;appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0;padding:12px;margin:0;color:#fff;font-family:var(--row-archivo),sans-serif;font-size:26px;line-height:1;cursor:pointer;opacity:.85}
.row100k .gal-lb-close:hover{opacity:1}
.row100k .gal-lb-counter{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.14em;color:#8a8a85}
.row100k .gal-tile:focus,.row100k .gal-lb-arrow:focus,.row100k .gal-lb-close:focus{outline:none}
.row100k .gal-tile:focus-visible,.row100k .gal-lb-arrow:focus-visible,.row100k .gal-lb-close:focus-visible{outline:2px solid #fff;outline-offset:2px}
@media (max-width:599px){.row100k .gal-lb-arrow{font-size:32px;padding:20px 10px}}
`;

/* The month in photos, newest first. Owner-only in production for now —
 * opening it to everyone later is just deleting the two gate lines below
 * (the actor lookup + notFound). Left open in local dev so it can be
 * verified without a session. */
export default async function GalleryPage() {
  let admin = false;
  try {
    const actor = await getEffectiveActor();
    admin = !!actor && isRow100kAdmin(actor.email, actor.roles);
  } catch {
    /* no session backend in some local setups — the dev branch below still opens */
  }
  if (process.env.NODE_ENV === "production" && !admin) notFound();

  // Local dev: read the folder live, so a fresh batch shows on the next load.
  // Production (Vercel): public/ is CDN-only — it does not exist on the
  // serverless filesystem, so the readdir throws and we fall back to the
  // manifest that `prebuild` snapshotted at deploy time (scripts/
  // gallery-manifest.mjs). New batches therefore ship with a deploy.
  let files: string[];
  try {
    files = (await readdir(GALLERY_DIR)).filter((f) => /\.jpe?g$/i.test(f));
  } catch {
    files = [...manifest];
  }

  // Newest first: descending by camera sequence. Numeric-aware so a future
  // 5-digit sequence (IMG_10234) never sorts under a 4-digit one.
  files.sort((a, b) => b.localeCompare(a, "en", { numeric: true }));

  const photos = files.map((f, i) => ({
    src: `/row100k/rowtember-profiles/${encodeURIComponent(f)}`,
    alt: `Rowtember — photo ${i + 1}`,
  }));

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{galleryCss}</style>

      <RowBar />

      <div className="gal-band">
        {photos.length === 0 ? (
          <p className="gal-empty">NOTHING HERE YET — THE CAMERA IS COMING.</p>
        ) : (
          <Gallery photos={photos} />
        )}
      </div>

      <RowFooter />
    </div>
  );
}
