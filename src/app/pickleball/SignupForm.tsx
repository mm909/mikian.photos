"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SKILLS, teamName } from "./tournament";
import { OptedInSticker } from "./Stickers";
import type { TeamRow } from "./BracketView";

/* OPT IN (owner, 2026-11-02): two names and a self-rated level, no
 * account, no email asked. On save the OPTED IN stamp slams down and the
 * team's sticker is right there to post. The owner gets a mail on every
 * save (the standing rule); seeding is his, by hand, later. */

export function SignupForm({ locked }: { locked: boolean }) {
  const router = useRouter();
  const [player1, setPlayer1] = useState("");
  const [player2, setPlayer2] = useState("");
  const [skill, setSkill] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<TeamRow | null>(null);

  if (locked) {
    return <p className="pb-empty">The bracket is locked — signups are closed. Scroll down and watch it play out.</p>;
  }

  if (done) {
    return (
      <div className="pb-done">
        <span className="pb-stamp">Opted in</span>
        <p>
          <b>{teamName(done.player1, done.player2)}</b> is on the list. Seeding is by hand — the bracket goes up when the field locks. Post the
          sticker so your opponents know what’s coming.
        </p>
        <OptedInSticker team={done} />
        <button
          type="button"
          className="pb-cta quiet"
          onClick={() => {
            setDone(null);
            setPlayer1("");
            setPlayer2("");
            setSkill("");
          }}
        >
          Opt in another team
        </button>
      </div>
    );
  }

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/pickleball/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player1: player1.trim(), player2: player2.trim(), skill }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; team?: TeamRow } | null;
      if (!res.ok || !data?.ok || !data.team) throw new Error(data?.error || "Couldn’t save that — try again.");
      setDone(data.team);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t save that — try again.");
    }
    setBusy(false);
  };

  return (
    <form
      className="pb-form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="two">
        <div>
          <label className="fl" htmlFor="pb-p1">
            Player one
          </label>
          <input id="pb-p1" type="text" maxLength={40} autoComplete="name" value={player1} onChange={(e) => setPlayer1(e.target.value)} placeholder="Your name" />
        </div>
        <div>
          <label className="fl" htmlFor="pb-p2">
            Player two
          </label>
          <input id="pb-p2" type="text" maxLength={40} value={player2} onChange={(e) => setPlayer2(e.target.value)} placeholder="Your partner" />
        </div>
      </div>
      <label className="fl">How do you rate yourselves?</label>
      <div className="pb-seg" role="group" aria-label="Skill level">
        {SKILLS.map((s) => (
          <button key={s.id} type="button" aria-pressed={skill === s.id} onClick={() => setSkill(skill === s.id ? "" : s.id)}>
            {s.label}
          </button>
        ))}
      </div>
      <p className="pb-hint">A hint for the seeding, nothing more — be honest, it only hurts you in round one.</p>
      {err ? <p className="pb-err">{err}</p> : null}
      <button type="submit" className="pb-cta" disabled={busy || player1.trim() === "" || player2.trim() === ""}>
        {busy ? "Saving…" : "Opt in"}
      </button>
    </form>
  );
}

/* The teams fact, counting itself up on load. */
export function Count({ to }: { to: number }) {
  const [n, setN] = useState(to);
  useEffect(() => {
    if (to <= 0 || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setN(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const ms = 900;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setN(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    setN(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{n}</>;
}
