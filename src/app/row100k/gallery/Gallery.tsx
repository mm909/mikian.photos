"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Lightbox } from "../Lightbox";
import { uploadThumbForKey } from "../PhotoPair";

/* `src` is what the grid tile renders (the thumb when one exists, else the
 * full image); `full` is what the lightbox shows. `key` is the R2 object key
 * for photos the owner uploaded — null for the legacy public/ batch, which
 * ships inside the deploy and therefore can't be deleted at runtime. */
export type GalleryPhoto = { src: string; full: string; alt: string; key: string | null };

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
  const router = useRouter();
  const [idx, setIdx] = useState<number | null>(null);

  /* Keys deleted in this session. The server list only catches up on the next
   * render pass, so we drop them locally the moment the API says ok — that
   * keeps the grid honest and, more importantly, keeps the viewer from
   * stepping onto the photo it just removed. */
  const [gone, setGone] = useState<string[]>([]);
  const [armed, setArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);

  const visible = useMemo(
    () => photos.filter((p) => !(p.key != null && gone.includes(p.key))),
    [photos, gone]
  );
  const count = visible.length;

  // The lightbox always shows the full image, whatever the grid rendered.
  const lightboxPhotos = useMemo(
    () => visible.map((p) => ({ full: p.full, alt: p.alt })),
    [visible]
  );

  // Arming is per-photo: moving to another frame (or closing) disarms, so a
  // stray second tap can never delete something the owner didn't mean to.
  useEffect(() => {
    setArmed(false);
    setDelErr(null);
  }, [idx]);

  const current = idx != null && idx >= 0 && idx < count ? visible[idx] : null;
  const open = current != null;
  const delKey = admin && current ? current.key : null;

  const runDelete = async () => {
    if (!delKey || idx == null || deleting) return;
    setDeleting(true);
    setDelErr(null);
    try {
      const res = await fetch("/api/row100k/gallery/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: delKey }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "delete failed");
      setGone((prev) => [...prev, delKey]);
      setArmed(false);
      // The photo is out of the list now: stay on this index (which lands on
      // the NEXT photo), clamp to the new last one, and close if that was the
      // final frame.
      const remaining = count - 1;
      if (remaining < 1) setIdx(null);
      else setIdx(Math.min(idx, remaining - 1));
      router.refresh();
    } catch (err) {
      setDelErr(err instanceof Error ? err.message : "delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {admin && <Uploader />}

      {count === 0 ? (
        <p className="gal-empty">NOTHING HERE YET — THE CAMERA IS COMING.</p>
      ) : (
        <div className="gal-grid">
          {visible.map((p, i) => (
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

      {open && idx != null && (
        <Lightbox
          photos={lightboxPhotos}
          index={idx}
          onIndex={setIdx}
          onClose={() => setIdx(null)}
        />
      )}

      {/* Delete chrome for the open photo. The Lightbox is shared with the
        * feed and the log and takes no extra children, so this rides ABOVE it
        * as a sibling overlay (fixed, z-index 1001 against its 1000) — its own
        * subtree, so these taps never reach the lightbox backdrop handler,
        * while its keyboard and swipe handling keeps working untouched.
        * Admin-only, and only for R2-backed photos. */}
      {open && delKey && (
        <div className="gal-del">
          {delErr && <p className="gal-del-err">{delErr}</p>}
          {armed ? (
            <div className="gal-del-row">
              <button
                type="button"
                className="gal-del-btn is-sure"
                disabled={deleting}
                onClick={() => void runDelete()}
              >
                {deleting ? "DELETING…" : "SURE?"}
              </button>
              <button
                type="button"
                className="gal-del-keep"
                disabled={deleting}
                onClick={() => setArmed(false)}
              >
                KEEP
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="gal-del-btn"
              onClick={() => {
                setDelErr(null);
                setArmed(true);
              }}
            >
              DELETE
            </button>
          )}
        </div>
      )}
    </>
  );
}
