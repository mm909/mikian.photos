"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { fmtRowerNumber } from "@/lib/row100k";
import { waveTime, type RaceDef } from "../raceday";
import type { Racer } from "../racedayData";

/* THE ACT on the race day page: one block that is whatever the viewer needs
 * it to be — sign in, opt in, put my name in, or the confirmation that they
 * are in. Everything it can do is one POST to /api/row100k/raceday, which
 * re-authenticates and re-checks the gate; nothing here is trusted.
 *
 * THE WAVE, and what we tell a rower about it (owner, 2026-09-10: "they do
 * not need to know when the wave starts"): the number shows as soon as one
 * is assigned, the START TIME only once the wave note has actually been
 * emailed. Until that email goes out the grid can still be re-drawn, and a
 * rower holding a start time that moves is worse than one holding none.
 *
 * TAKING A NAME OUT is two presses and no lecture (owner: a cancel that
 * scolds is not a cancel). The row is kept, not deleted, so a name can go
 * back in on the same line it left. */

const RACE_PATH = "/row100k/raceday";

export function SignupPanel({
  race,
  signedIn,
  joined,
  open,
  mine: initialMine,
}: {
  race: RaceDef;
  signedIn: boolean;
  joined: boolean;
  /* The race is still taking names (raceday.racePhase). */
  open: boolean;
  mine: Racer | null;
}) {
  const router = useRouter();
  const [mine, setMine] = useState<Racer | null>(initialMine);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* THE WAIVER (owner sent the link, 2026-09-11). It is signed on the gym's
   * own system, so this site can only ask — and asking is not a gate: a
   * rower who has not got to it yet still gets their name in, and the
   * console keeps the chase list. Ticked here, stamped by the route. */
  const [waiver, setWaiver] = useState(initialMine?.waiverAt !== null && initialMine !== null);

  const inField = mine !== null && mine.withdrewAt === null;
  const signed = mine?.waiverAt != null;

  const act = async (action: "enter" | "withdraw", saidWaiver = false) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/row100k/raceday", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, waiver: saidWaiver }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; mine?: Racer | null };
      if (res.ok && data.ok) {
        setMine(data.mine ?? null);
        setConfirm(false);
        // The racer list is rendered on the server below this block.
        router.refresh();
      } else setError(data.error ?? "Couldn't take that — try again.");
    } catch {
      setError("Couldn't take that — try again.");
    }
    setBusy(false);
  };

  /* Signed out and not opted in are live buttons that do the thing, the way
   * the shirt shop does it — never a dead button with an explanation. */
  if (!signedIn) {
    return (
      <div className="rd-act">
        <p className="rd-eye">Free to enter</p>
        <p className="rd-lede">Sign in and put your name in. That is the whole entry.</p>
        <button type="button" className="send" onClick={() => signIn("google", { callbackUrl: RACE_PATH })}>
          Sign in to enter
        </button>
        <p className="rd-small mono">{race.closesLine.toUpperCase()}</p>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="rd-act">
        <p className="rd-eye">One step first</p>
        <p className="rd-lede">Race day is for Rowtember rowers, so grab a rower number and come back.</p>
        <Link className="send" href="/row100k#join">
          Opt in to Rowtember
        </Link>
        <p className="rd-small mono">{race.closesLine.toUpperCase()}</p>
      </div>
    );
  }

  if (inField && mine) {
    const bracket = race.brackets.find((b) => b.key === mine.division);
    const emailed = mine.wave !== null && mine.waveEmailedAt !== null;
    return (
      <div className="rd-act in">
        {/* Before a wave exists the block says the one thing there is to
         * say; after it, the wave IS the headline. The day is already the
         * headline of the stub above, so it is not repeated here. */}
        <p className="rd-eye">{mine.wave === null ? "Your entry" : "You are in"}</p>
        <p className="rd-you">{mine.wave === null ? "You are in" : `Wave ${mine.wave}`}</p>
        <p className="rd-wave mono">
          ROWER {fmtRowerNumber(mine.rowerNumber)} · {(bracket?.label ?? "No bracket").toUpperCase()}
          {emailed && mine.wave !== null ? ` · ${waveTime(race, mine.wave).toUpperCase()}` : ""}
        </p>
        <p className="rd-small mono">
          {mine.wave === null
            ? "WAVE NOT ASSIGNED YET — IT COMES BY EMAIL"
            : emailed
              ? `${race.venueLine.toUpperCase()} · ${race.when.toUpperCase()}`
              : "YOUR START TIME COMES BY EMAIL"}
        </p>

        {/* The one thing still owed, if it is owed: the gym needs a signed
         * waiver before anybody rows. Quiet once it is done. */}
        {race.waiver &&
          (signed ? (
            <p className="rd-small mono">WAIVER SIGNED · SEE YOU THERE</p>
          ) : (
            <div className="rd-waiver">
              <p className="rd-small mono" style={{ margin: 0 }}>
                ONE THING LEFT — THE GYM NEEDS A SIGNED WAIVER
              </p>
              <a className="rd-wlink" href={race.waiver.url} target="_blank" rel="noopener noreferrer">
                Sign the waiver →
              </a>
              <button
                type="button"
                className="quiet-btn"
                disabled={busy}
                onClick={() => void act("enter", true)}
              >
                {busy ? "…" : "I have signed it"}
              </button>
            </div>
          ))}

        {open ? (
          confirm ? (
            <div className="rd-two">
              <span className="mono">Take your name out of Sunday?</span>
              <button type="button" className="outline-btn" disabled={busy} onClick={() => void act("withdraw")}>
                {busy ? "…" : "Take it out"}
              </button>
              <button type="button" className="quiet-btn" disabled={busy} onClick={() => setConfirm(false)}>
                Never mind
              </button>
            </div>
          ) : (
            <div className="rd-two">
              <button type="button" className="quiet-btn" onClick={() => setConfirm(true)}>
                Take my name out
              </button>
            </div>
          )
        ) : (
          <p className="rd-small mono">THE LIST IS FINAL — EMAIL IF SOMETHING CHANGES</p>
        )}
        {error && <p className="form-err">{error}</p>}
      </div>
    );
  }

  /* Not in the field: never entered, or took their name out. */
  const wasIn = mine !== null;
  if (!open) {
    return (
      <div className="rd-act">
        <p className="rd-eye">Registration is closed</p>
        <p className="rd-lede">
          {wasIn
            ? "Your name is not on the list for this one. Come watch — the next race will open again."
            : "Names are shut for this one. The next race will open again."}
        </p>
        <p className="rd-small mono">{race.venueLine.toUpperCase()}</p>
      </div>
    );
  }

  return (
    <div className="rd-act">
      <p className="rd-eye">{wasIn ? "Your name is out" : "Free to enter"}</p>
      <p className="rd-lede">
        {wasIn
          ? "Put it back any time before the list closes — same line, same number."
          : "Put your name in and we will email you your wave. Nothing to pay, nothing to print."}
      </p>
      {/* The waiver asked for BEFORE the button, so it is part of entering
       * rather than an afterthought — but never a gate: an unticked box
       * still puts the name in, and the page asks again afterwards. */}
      {race.waiver && (
        <label className="rd-check">
          <input type="checkbox" checked={waiver} onChange={(e) => setWaiver(e.target.checked)} />
          <span>
            I have signed the{" "}
            <a href={race.waiver.url} target="_blank" rel="noopener noreferrer">
              gym waiver
            </a>
          </span>
        </label>
      )}
      <button type="button" className="send" disabled={busy} onClick={() => void act("enter", waiver)}>
        {busy ? "…" : wasIn ? "Put my name back in" : "Put my name in"}
      </button>
      <p className="rd-small mono">{race.closesLine.toUpperCase()}</p>
      {error && <p className="form-err">{error}</p>}
    </div>
  );
}
