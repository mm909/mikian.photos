"use client";

import { useState } from "react";

/* THE EMAIL BOX (android/page.tsx): an email and a name, sent to
 * api/row100k/android; the count turns over to the new one. */
export function TesterForm({ have: have0, goal: goal0 }: { have: number; goal: number }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ have: number; goal: number; again: boolean } | null>(null);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/row100k/android", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, name }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; have?: number; goal?: number; again?: boolean };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "That did not save. Try again.");
      setDone({ have: data.have ?? have0 + 1, goal: data.goal ?? goal0, again: !!data.again });
    } catch (x) {
      setErr(x instanceof Error ? x.message : "That did not save. Try again.");
    }
    setBusy(false);
  };
  if (done) {
    return (
      <section className="m2-calc" aria-live="polite">
        <p className="m2-give-big">
          {done.again ? "You are already in." : "You are in."} <b>{done.have}</b>/{done.goal}
        </p>
        <p className="m2-give-small">Watch your email for the link (step 2). It can take a day. Thank you.</p>
      </section>
    );
  }
  return (
    <form className="m2-calc" onSubmit={send}>
      <p className="m2-calc-q">Your Google email</p>
      <label className="m2-calc-in">
        <input type="email" required autoComplete="email" inputMode="email" placeholder="you@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Your Google email" style={{ fontSize: 22 }} />
      </label>
      <p className="m2-calc-q" style={{ marginTop: 16 }}>
        Your name <span style={{ fontWeight: 400, color: "var(--gray)" }}>(optional)</span>
      </p>
      <label className="m2-calc-in">
        <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Your name" style={{ fontSize: 22 }} maxLength={60} />
      </label>
      <button type="submit" className="m2-go" disabled={busy || !email.trim()} style={{ marginTop: 20, maxWidth: "none" }}>
        {busy ? "Sending" : `Make it ${have0 + 1}`}
      </button>
      {err ? (
        <p className="bd-say" role="alert" style={{ marginTop: 10 }}>
          {err}
        </p>
      ) : null}
      <p className="m2-give-small">We only use it to add you to the test. It is never shown.</p>
    </form>
  );
}
