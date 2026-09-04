import type { Metadata } from "next";
import path from "path";
import { readdir } from "fs/promises";
import { getEffectiveActor } from "@/lib/permissions";
import { isRow100kAdmin } from "@/lib/row100k";
import { r2Configured, r2List, r2PresignGet } from "@/lib/r2";
import { thumbKey } from "../photoUrls";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { Gallery } from "./Gallery";
import manifest from "./manifest.json";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The gallery — 100K September",
  description: "The month in photos — Rowtember, shot by Mikian.",
};

/* Photos come from TWO places, merged into one grid:
 *
 * 1. R2, under row100k/gallery/ — the live batch. The admin upload control
 *    on this page presigns a PUT per file (see /api/row100k/gallery/sign),
 *    so new photos appear on the next page load with NO deploy. Newest
 *    upload first.
 * 2. public/row100k/rowtember-profiles — the legacy batch that ships with
 *    deploys (camera JPGs batch-copied off the card; filename is the shot
 *    sequence, so higher number = shot later = shown first). Appended after
 *    the R2 set.
 *
 * The page is PUBLIC, like the rest of /row100k — only the upload strip is
 * admin-gated (the Uploader render below plus the 403 on the sign route).
 * Everything under public/ is world-readable at its URL once deployed, and
 * the R2 photos are served through presigned GET URLs that expire hourly —
 * all of it is published work, nothing private lives here.
 *
 * Thumbnails: an R2 upload may carry a small companion object at
 * thumbKey(mainKey) — "uuid.thumb.jpg" next to "uuid.jpg" (see
 * ../photoUrls.ts). Grid tiles render the thumb when one exists (mapped out
 * of the SAME listing — no extra requests) and the lightbox always gets the
 * full image. Legacy public/ photos have no thumbs and render full-size. */
const GALLERY_DIR = path.join(process.cwd(), "public", "row100k", "rowtember-profiles");
const R2_PREFIX = "row100k/gallery/";

/* Gallery-only styles — scoped with a .gal- prefix; theme.ts stays untouched.
 * Rendered as the text child of a style tag, so no double quotes and no
 * angle brackets anywhere in the string (see the note in theme.ts).
 *
 * Owner-approved exception to the paper palette: the grid band is pure black,
 * Google-Photos style, full-bleed outside the 760px wrap. Tight 8px gutters
 * (6px on mobile), like the Google album reference. Every cell is a fixed
 * 4:5 frame — the owner exports at 1670x2088 — and every image renders
 * object-fit contain on a white tile, so nothing ever crops: a 4:5 photo
 * fills the cell exactly and any other shape letterboxes white. Thin white
 * border, no mat, no shadow, no radius, no hover motion. */
const galleryCss = `
.row100k .gal-band{background:#000;padding:12px 12px 48px}
.row100k .gal-admin{max-width:1800px;margin:0 auto 12px;display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:12px}
.row100k .gal-add{appearance:none;-webkit-appearance:none;background:none;border:2px solid #fff;border-radius:0;color:#fff;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;padding:8px 14px;margin:0;cursor:pointer}
.row100k .gal-add:disabled{opacity:.5;cursor:default}
.row100k .gal-progress{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8a8a85;margin:0}
.row100k .gal-errs{max-width:1800px;margin:-4px auto 12px;padding:0;list-style:none;text-align:right}
.row100k .gal-errs li{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#d9a0a0;margin:0 0 4px}
.row100k .gal-empty{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8a8a85;text-align:center;margin:48px 0;padding:0}
.row100k .gal-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;max-width:1800px;margin:0 auto}
.row100k .gal-tile{display:block;appearance:none;-webkit-appearance:none;margin:0;padding:0;width:100%;aspect-ratio:4/5;border:2px solid #fff;border-radius:0;background:#fff;overflow:hidden;cursor:pointer}
.row100k .gal-tile img{display:block;width:100%;height:100%;object-fit:contain}
@media (max-width:1279px){.row100k .gal-grid{grid-template-columns:repeat(4,1fr)}}
@media (max-width:899px){.row100k .gal-grid{grid-template-columns:repeat(3,1fr)}}
@media (max-width:599px){.row100k .gal-grid{grid-template-columns:repeat(2,1fr);gap:6px}.row100k .gal-band{padding:8px 6px 36px}}
.row100k .gal-tile:focus,.row100k .gal-add:focus{outline:none}
.row100k .gal-tile:focus-visible,.row100k .gal-add:focus-visible{outline:2px solid #fff;outline-offset:2px}
`;

/* The month in photos, newest first. Public, like the rest of /row100k —
 * the actor lookup below only decides whether the admin upload strip
 * renders. */
export default async function GalleryPage() {
  let admin = false;
  try {
    const actor = await getEffectiveActor();
    admin = !!actor && isRow100kAdmin(actor.email, actor.roles);
  } catch {
    /* no session backend in some local setups — the page is public anyway */
  }

  // Source (a): the live R2 batch, newest upload first, presigned an hour.
  // One listing covers both mains and their .thumb. companions: thumbs are
  // filtered OUT as grid entries and mapped back onto their main by the
  // thumbKey convention — no per-photo existence checks. Fails soft to just
  // the public batch — a listing or presign hiccup should never blank the
  // page.
  let r2Photos: { src: string; full: string }[] = [];
  try {
    if (r2Configured()) {
      const isThumb = (key: string) => /\.thumb\.[a-z0-9]+$/i.test(key);
      const objects = (await r2List(R2_PREFIX)).filter((o) =>
        /\.(jpe?g|png|webp)$/i.test(o.key)
      );
      const thumbKeys = new Set(objects.filter((o) => isThumb(o.key)).map((o) => o.key));
      const mains = objects.filter((o) => !isThumb(o.key));
      mains.sort(
        (a, b) => (b.lastModified?.getTime() ?? 0) - (a.lastModified?.getTime() ?? 0)
      );
      r2Photos = await Promise.all(
        mains.map(async (o) => {
          const tk = thumbKey(o.key);
          const [full, thumb] = await Promise.all([
            r2PresignGet(o.key, 3600),
            thumbKeys.has(tk) ? r2PresignGet(tk, 3600) : Promise.resolve(null),
          ]);
          return { src: thumb ?? full, full };
        })
      );
    }
  } catch (err) {
    console.error("row100k gallery: R2 listing failed", err);
    r2Photos = [];
  }

  // Source (b): the legacy public/ batch. Local dev reads the folder live;
  // production (Vercel) has no public/ on the serverless filesystem, so the
  // readdir throws and we fall back to the manifest that `prebuild`
  // snapshotted at deploy time (scripts/gallery-manifest.mjs). This batch
  // only changes with a deploy — new photos go through the R2 upload above.
  let files: string[];
  try {
    files = (await readdir(GALLERY_DIR)).filter((f) => /\.jpe?g$/i.test(f));
  } catch {
    files = [...manifest];
  }

  // Newest first: descending by camera sequence. Numeric-aware so a future
  // 5-digit sequence (IMG_10234) never sorts under a 4-digit one.
  files.sort((a, b) => b.localeCompare(a, "en", { numeric: true }));

  // Legacy public/ items have no thumbs — the grid keeps their full image.
  const merged = [
    ...r2Photos,
    ...files.map((f) => {
      const full = `/row100k/rowtember-profiles/${encodeURIComponent(f)}`;
      return { src: full, full };
    }),
  ];
  const photos = merged.map((p, i) => ({ ...p, alt: `Rowtember — photo ${i + 1}` }));

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{galleryCss}</style>

      <RowBar active="gallery" sticky={false} />

      <div className="gal-band">
        <Gallery photos={photos} admin={admin} />
      </div>

      <RowFooter />
    </div>
  );
}
