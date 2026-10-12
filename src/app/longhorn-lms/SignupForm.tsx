"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import { downscaleToJpeg, uploadThumbForKey } from "../row100k/PhotoPair";
import { LIST_PATH, PATH, igHandle } from "./race";

/* THE FORM (owner, 2026-10-12): name, Instagram, email, phone, a photo of
 * themselves, how many loops they expect, and a bib number once they have
 * one. Signed in with Google, so the same runner comes back to the same
 * row and can fill the bib in later. The photo goes straight to R2 the
 * row-photo way (downscale → sign → PUT → thumb). On a save the screen
 * says so; nothing is emailed to the runner. */

const SIGN = "/api/longhorn-lms/photo/sign";
const MAX_EDGE = 1600;
const QUALITY = 0.82;

export type Existing = {
  name: string;
  email: string;
  phone: string;
  instagram: string;
  bib: string;
  expectedLoops: number | null;
  photoKey: string;
  photoUrl: string | null;
};

export function AccountControl({ signedIn, name, owner }: { signedIn: boolean; name: string; owner: boolean }) {
  return (
    <div className="lh-acct">
      {signedIn ? (
        <>
          <span className="who">{name}</span>
          {owner ? <a href={LIST_PATH}>The list</a> : null}
          <button type="button" onClick={() => void signOut({ callbackUrl: PATH })}>
            Sign out
          </button>
        </>
      ) : (
        <button type="button" onClick={() => void signIn("google", { callbackUrl: PATH })}>
          Sign in
        </button>
      )}
    </div>
  );
}

export function SignupForm({
  signedIn,
  closed,
  defaults,
  existing,
}: {
  signedIn: boolean;
  closed: boolean;
  /* From the Google account: a name and an email to start from. */
  defaults: { name: string; email: string };
  existing: Existing | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(existing?.name ?? defaults.name);
  const [email, setEmail] = useState(existing?.email ?? defaults.email);
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [instagram, setInstagram] = useState(existing?.instagram ?? "");
  const [bib, setBib] = useState(existing?.bib ?? "");
  const [loops, setLoops] = useState(existing?.expectedLoops ? String(existing.expectedLoops) : "");
  const [photoKey, setPhotoKey] = useState(existing?.photoKey ?? "");
  const [preview, setPreview] = useState<string | null>(existing?.photoUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [created, setCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = async (list: FileList | null) => {
    const file = list?.[0];
    if (!file || uploading) return;
    setError(null);
    setUploading(true);
    try {
      const blob = await downscaleToJpeg(file, MAX_EDGE, QUALITY);
      const signRes = await fetch(SIGN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: "image/jpeg", contentLength: blob.size }),
      });
      const sign = (await signRes.json().catch(() => ({}))) as { ok?: boolean; key?: string; url?: string; error?: string };
      if (!signRes.ok || !sign.ok || !sign.key || !sign.url) throw new Error(sign.error ?? "Upload failed — try again.");
      const put = await fetch(sign.url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: blob });
      if (!put.ok) throw new Error("Upload failed — check your signal and try again.");
      await uploadThumbForKey(SIGN, sign.key, blob);
      setPhotoKey(sign.key);
      setPreview(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that photo — try a different one.");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async () => {
    if (status === "sending") return;
    setError(null);
    if (!name.trim()) return setError("Add your name first.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Add an email I can reach you at.");
    if (phone.replace(/\D/g, "").length < 7) return setError("Add a phone number.");
    if (!igHandle(instagram)) return setError("Add your Instagram — that is where the photos go.");
    if (loops.trim() && !(Number.isInteger(Number(loops)) && Number(loops) >= 1 && Number(loops) <= 200))
      return setError("Loops is a whole number, 1 to 200.");
    if (uploading) return setError("Hold on — the photo is still uploading.");
    if (!photoKey) return setError("Add a photo of yourself so I know who to look for.");
    setStatus("sending");
    try {
      const res = await fetch("/api/longhorn-lms/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          instagram: igHandle(instagram),
          bib: bib.trim(),
          expectedLoops: loops.trim() ? Number(loops) : null,
          photoKey,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; created?: boolean; error?: string };
      if (res.ok && data.ok) {
        setCreated(data.created === true);
        setStatus("sent");
        router.refresh();
        return;
      }
      setError(data.error ?? "Something went wrong — try again.");
    } catch {
      setError("Something went wrong — try again.");
    }
    setStatus("idle");
  };

  if (closed) {
    return <p className="lh-hint">Sign-ups are closed — the race has been run. Photos are on their way.</p>;
  }

  if (!signedIn) {
    return (
      <>
        <p className="lh-lede">
          Sign in with Google so I can keep your entry together, and so you can come back and add your bib number once you have it.
        </p>
        <button type="button" className="lh-cta" onClick={() => void signIn("google", { callbackUrl: `${PATH}#in` })}>
          Sign in with Google →
        </button>
      </>
    );
  }

  if (status === "sent") {
    return (
      <div className="lh-done">
        <h3>
          You are <span className="o">on the list</span>.
        </h3>
        <p>
          {created ? "I will look for you on the course." : "Your entry is updated."} Photos land on Instagram under <b>@{igHandle(instagram)}</b>.
          {bib.trim() ? null : " No bib yet? Come back to this page once you have one and add it."}
        </p>
        <button type="button" className="lh-cta quiet" onClick={() => setStatus("idle")}>
          Edit my entry
        </button>
      </div>
    );
  }

  return (
    <form
      className="lh-form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {existing ? <p className="lh-hint">You are already on the list — change anything below and save.</p> : null}
      <label className="fl" htmlFor="lh-name">
        Name <i>*</i>
      </label>
      <input id="lh-name" type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} />

      <label className="fl" htmlFor="lh-ig">
        Instagram <i>*</i>
      </label>
      <input id="lh-ig" type="text" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@yourhandle" autoComplete="off" autoCapitalize="none" maxLength={80} />
      <p className="lh-hint">The photos go out here first.</p>

      <div className="two">
        <div>
          <label className="fl" htmlFor="lh-email">
            Email <i>*</i>
          </label>
          <input id="lh-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={200} />
        </div>
        <div>
          <label className="fl" htmlFor="lh-phone">
            Phone <i>*</i>
          </label>
          <input id="lh-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" maxLength={32} />
        </div>
      </div>

      <label className="fl" htmlFor="lh-photo">
        A photo of you <i>*</i>
      </label>
      <div className="lh-photo">
        <div className="lh-photo-frame" onClick={() => fileRef.current?.click()} role="button" tabIndex={0} aria-label="Add a photo of yourself" onKeyDown={(e) => (e.key === "Enter" || e.key === " " ? fileRef.current?.click() : undefined)}>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" />
          ) : (
            <span className="ph">{uploading ? "Uploading…" : "Tap to add"}</span>
          )}
        </div>
        <div className="lh-photo-words">
          So I know who I am looking for on the course. A face, in daylight, is best.
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? "Uploading…" : preview ? "Change photo" : "Add photo"}
          </button>
        </div>
        <input ref={fileRef} id="lh-photo" type="file" accept="image/*" hidden onChange={(e) => void pick(e.currentTarget.files)} />
      </div>

      <div className="two">
        <div>
          <label className="fl" htmlFor="lh-loops">
            Loops you expect
          </label>
          <input id="lh-loops" type="number" inputMode="numeric" min={1} max={200} value={loops} onChange={(e) => setLoops(e.target.value)} placeholder="24" />
        </div>
        <div>
          <label className="fl" htmlFor="lh-bib">
            Bib number
          </label>
          <input id="lh-bib" type="text" inputMode="numeric" value={bib} onChange={(e) => setBib(e.target.value)} placeholder="Once you have one" maxLength={12} />
        </div>
      </div>

      {error ? <p className="lh-err">{error}</p> : null}
      <button type="submit" className="lh-cta" disabled={status === "sending" || uploading}>
        {status === "sending" ? "Saving…" : existing ? "Save my entry →" : "I am running →"}
      </button>
    </form>
  );
}
