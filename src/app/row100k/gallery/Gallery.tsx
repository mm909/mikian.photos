"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Lightbox } from "../Lightbox";
import { uploadThumbForKey } from "../PhotoPair";

/* `src` is what the grid tile renders (the thumb when one exists, else the
 * full image); `full` is what the lightbox shows. */
export type GalleryPhoto = { src: string; full: string; alt: string };

/* Owner-only upload strip on the black band. Each file goes sign → PUT
 * straight to R2 (the raw file, no re-encoding — these are finished
 * exports), sequentially so the progress line reads honestly. A small jpeg
 * thumbnail rides along after each main upload (best-effort — a dead thumb
 * never fails the publish; the grid just renders the full image). When at
 * least one file lands we refresh the route, which re-lists the R2 prefix
 * server-side and the new photos join the grid. */
function Uploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const handleFiles = async (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (busy || files.length === 0) return;
    setBusy(true);
    setErrors([]);
    const failed: string[] = [];
    let landed = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(`UPLOADING ${i + 1} / ${files.length}`);
      try {
        const signRes = await fetch("/api/row100k/gallery/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentType: file.type, contentLength: file.size }),
        });
        const sign = (await signRes.json().catch(() => ({}))) as {
          ok?: boolean;
          key?: string;
          url?: string;
          error?: string;
        };
        if (!signRes.ok || !sign.ok || !sign.key || !sign.url) {
          throw new Error(sign.error ?? "upload failed");
        }
        const put = await fetch(sign.url, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!put.ok) throw new Error("storage refused the upload");
        // Grid thumbnail next to the main object — never throws, and a
        // failure here must not mark the photo failed (it already landed).
        await uploadThumbForKey("/api/row100k/gallery/sign", sign.key, file);
        landed++;
      } catch (err) {
        failed.push(
          `${file.name} — ${err instanceof Error ? err.message : "upload failed"}`
        );
      }
    }

    setProgress(null);
    setErrors(failed);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    if (landed > 0) router.refresh();
  };

  return (
    <>
      <div className="gal-admin">
        {progress != null && <p className="gal-progress">{progress}</p>}
        <button
          type="button"
          className="gal-add"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          + ADD PHOTOS
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => void handleFiles(e.currentTarget.files)}
        />
      </div>
      {errors.length > 0 && (
        <ul className="gal-errs">
          {errors.map((msg) => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      )}
    </>
  );
}

export function Gallery({ photos, admin }: { photos: GalleryPhoto[]; admin: boolean }) {
  const [idx, setIdx] = useState<number | null>(null);
  const count = photos.length;

  // The lightbox always shows the full image, whatever the grid rendered.
  const lightboxPhotos = useMemo(
    () => photos.map((p) => ({ full: p.full, alt: p.alt })),
    [photos]
  );

  return (
    <>
      {admin && <Uploader />}

      {count === 0 ? (
        <p className="gal-empty">NOTHING HERE YET — THE CAMERA IS COMING.</p>
      ) : (
        <div className="gal-grid">
          {photos.map((p, i) => (
            <button
              key={p.full}
              type="button"
              className="gal-tile"
              onClick={() => setIdx(i)}
              aria-label={`${p.alt} — open viewer`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt={p.alt} loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {idx != null && (
        <Lightbox
          photos={lightboxPhotos}
          index={idx}
          onIndex={setIdx}
          onClose={() => setIdx(null)}
        />
      )}
    </>
  );
}
