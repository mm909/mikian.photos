"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Lightbox } from "../Lightbox";
import { uploadThumbForKey } from "../PhotoPair";
import { COLOR_LABEL, type Color } from "../shirtPreorder";

/* THE CAROUSEL (owner, 2026-10-01: "instead of the graphic of the T, give
 * me a carousel that I can post photos in"). One per shirt, where the drawn
 * tee used to sit: the owner's photographs of it, swiped left to right on
 * a phone (scroll-snap, one frame at a time), a row of dots under them,
 * and a tap opening the house lightbox. Empty — no photo posted yet — it
 * is one flat frame in the shirt's own colour, so the colour cue the tee
 * carried is not lost.
 *
 * The owner sees two more words under the dots: ADD PHOTOS, which signs
 * and PUTs each file straight to R2 the gallery's way (Gallery.tsx
 * Uploader — raw file, then the small jpeg thumb beside it), and REMOVE,
 * which takes the frame in view back out. Both refresh the route so the
 * server listing catches up. */

export type ShirtPhoto = { key: string; full: string; thumb: string };

const SIGN = "/api/row100k/shirts/photos/sign";
const DELETE = "/api/row100k/shirts/photos/delete";

export function ShirtCarousel({ color, photos, admin }: { color: Color; photos: ShirtPhoto[]; admin: boolean }) {
  const router = useRouter();
  const stripRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [at, setAt] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const [gone, setGone] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const shown = useMemo(() => photos.filter((p) => !gone.includes(p.key)), [photos, gone]);
  const n = shown.length;
  const idx = Math.min(at, Math.max(0, n - 1));

  /* Which frame is in view: the strip's scroll offset over its width. */
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const onScroll = () => {
      const w = el.clientWidth || 1;
      setAt(Math.round(el.scrollLeft / w));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [n]);

  const go = (i: number) => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  const upload = async (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (busy || files.length === 0) return;
    setErr(null);
    let landed = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setBusy(`Uploading ${i + 1} / ${files.length}`);
      try {
        const signRes = await fetch(SIGN, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ color, contentType: file.type, contentLength: file.size }),
        });
        const sign = (await signRes.json().catch(() => ({}))) as { ok?: boolean; key?: string; url?: string; error?: string };
        if (!signRes.ok || !sign.ok || !sign.key || !sign.url) throw new Error(sign.error ?? "upload failed");
        const put = await fetch(sign.url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        if (!put.ok) throw new Error("storage refused the upload");
        await uploadThumbForKey(SIGN, sign.key, file);
        landed++;
      } catch (e) {
        setErr(`${file.name} — ${e instanceof Error ? e.message : "upload failed"}`);
      }
    }
    setBusy(null);
    if (inputRef.current) inputRef.current.value = "";
    if (landed > 0) router.refresh();
  };

  const remove = async () => {
    const p = shown[idx];
    if (!p || busy) return;
    if (!window.confirm("Remove this photo from the carousel?")) return;
    setBusy("Removing");
    setErr(null);
    try {
      const res = await fetch(DELETE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: p.key }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "remove failed");
      setGone((g) => [...g, p.key]);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "remove failed");
    }
    setBusy(null);
  };

  const label = COLOR_LABEL[color];

  return (
    <div className={`sp-car ${color}`}>
      {n === 0 ? (
        <div className="sp-car-empty" aria-label={`${label} shirt — no photos yet`}>
          <span className="mono">{admin ? "No photos yet" : "Photos coming"}</span>
        </div>
      ) : (
        <div className="sp-car-strip" ref={stripRef} role="group" aria-label={`${label} shirt photos`}>
          {shown.map((p, i) => (
            <button key={p.key} type="button" className="sp-car-frame" onClick={() => setOpen(i)} aria-label={`${label} shirt, photo ${i + 1} of ${n} — open viewer`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.thumb}
                alt={`${label} shirt, photo ${i + 1}`}
                loading={i === 0 ? "eager" : "lazy"}
                draggable={false}
                onError={(e) => {
                  const img = e.currentTarget;
                  if (img.getAttribute("src") !== p.full) img.src = p.full;
                }}
              />
            </button>
          ))}
        </div>
      )}
      {n > 1 && (
        <div className="sp-car-dots" role="tablist" aria-label={`${label} shirt photos`}>
          {shown.map((p, i) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={i === idx}
              aria-label={`Photo ${i + 1}`}
              className={i === idx ? "on" : undefined}
              onClick={() => go(i)}
            />
          ))}
        </div>
      )}
      {admin && (
        <div className="sp-car-admin">
          <button type="button" className="sp-go" disabled={busy !== null} onClick={() => inputRef.current?.click()}>
            {busy ?? "Add photos"}
          </button>
          {n > 0 && !busy && (
            <button type="button" className="sp-go quiet" onClick={() => void remove()}>
              Remove
            </button>
          )}
          <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => void upload(e.currentTarget.files)} />
        </div>
      )}
      {err && <p className="sp-err">{err}</p>}
      {open != null && n > 0 && (
        <Lightbox
          photos={shown.map((p, i) => ({ full: p.full, alt: `${label} shirt, photo ${i + 1}` }))}
          index={Math.min(open, n - 1)}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
