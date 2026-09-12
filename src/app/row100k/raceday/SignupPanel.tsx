"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { fmtRowerNumber } from "@/lib/row100k";
import { RACE_ROLES, waveTime, type RaceDef, type RaceRole } from "../raceday";
import type { Racer } from "../racedayData";
import { RaceShare, type RaceFacts } from "./RaceShare";

/* THE ACT on the race day page: one block that is whatever the viewer needs
 * it to be — sign in, opt in, put my name in, or the confirmation that they
 * are in. Everything it can do is one POST to /api/row100k/raceday, which
 * re-authenticates and re-checks the gate; nothing here is trusted.
 *
 * IT SITS WHERE THE AD PRINTS ITS OPT IN SLAB (owner, 2026-09-11: the page
 * should be the flyer). So it is the foot of the bill rather than a box of
 * its own: rdCss.ts opens it on the same thick rule the bracket and the
 * house open on, and the filled button IS the slab — white paper, ink type,
 * a verb flush left. Nothing here says the hours or the first wave in typed
 * words; the bill above says both, off the race.
 *
 * WHAT CAME OFF (owner, same message): the registration-closes line, which
 * this block printed in three of its states. closesAt still refuses a late
 * entry — the rule stays, it just no longer announces itself.
 *
 * TWO WAYS IN (owner, 2026-09-11: "we need there to be a way to sign up as
 * a spectator versus as just a racer"). They are the same act with a role
 * on it, so they are the same block: the RACER is the filled button, the
 * obvious thing to press; the SPECTATOR is an outline button on the rail
 * one line under it, in plain sight and not hunted for. Pressing either
 * when already in SWITCHES — the row, the place in the order and the waiver
 * stamp all stay — so a spectator who decides to pull loses nothing.
 *
 * THE WAVE, and what we tell a rower about it (owner, 2026-09-10: "they do
 * not need to know when the wave starts"): the number shows as soon as one
 * is assigned, the START TIME only once the wave note has actually been
 * emailed. Until that email goes out the grid can still be re-drawn, and a
 * rower holding a start time that moves is worse than one holding none.
 *
 * TAKING A NAME OUT is two presses and no lecture (owner: a cancel that
 * scolds is not a cancel). The row is kept, not deleted, so a name can go
 * back in on the same line it left.
 *
 * WHAT GETS A SECOND PRESS is whatever costs something. Opting out always
 * does. Switching to spectator normally does not — the row survives it —
 * EXCEPT once a wave has been assigned: the route drops wave and
 * waveEmailedAt in the same write, so one mis-tap on a rail of identical
 * grey buttons would throw away a wave the rower has already been emailed
 * about, and the note in their inbox would then point at a wave they are
 * not in. So the press is instant while there is no wave to lose and asks
 * once, naming the wave, as soon as there is.
 *
 * THE SHAREABLE (owner, 2026-09-11: "just a shareable with the event name
 * and logo"). It rides in the block a rower is already reading — their own
 * — on its own rail above the change-your-mind rail, because posting it is
 * the happy act and opting out is not, and it stays there after
 * registration closes: the invitation is never truer than on the morning
 * itself.
 *
 * IT NO LONGER OPENS BY ITSELF. There was a `popped` counter here, bumped
 * on JOINING and only on joining — never a role switch, never a waiver tick
 * — that threw the dialog up the second a name went in, the way the profile
 * pops one the second a row is logged. That earned its place while the card
 * was I'M RACING: the claim was made at the moment it became true, and
 * showing somebody their own claim is a celebration. The owner kept the
 * event card and dropped the claim one the same evening ("I just like the
 * race day sticker"), and the bill says nothing about the person who just
 * pressed the button — it is the same picture a stranger gets off the
 * tear-off strip. A modal holding a poster nobody asked for is the
 * jack-in-the-box the old rule was written against, so the counter, the
 * waiver exception it carried and RaceShare.openSignal all went with the
 * card. The button is still there and it still says what it does. */

const RACE_PATH = "/row100k/raceday";

/* The two roles come out of raceday.ts (RACE_ROLES) rather than being typed
 * again here: the owner wrote those words, and a page that paraphrases them
 * will drift from the console and the mail the first time one of them is
 * edited. THE SPECTATOR HAS NO LINE any more — only a label (owner,
 * 2026-09-11: "remove the phrase come watch, no wave, no erg") — so the two
 * places this file used to print SPECTATOR.line say something else or say
 * nothing; see each of them. */
const roleOf = (key: RaceRole) => RACE_ROLES.find((r) => r.key === key) ?? RACE_ROLES[0];
const SPECTATOR = roleOf("spectator");

export function SignupPanel({
  race,
  signedIn,
  joined,
  open,
  mine: initialMine,
  share,
}: {
  race: RaceDef;
  signedIn: boolean;
  joined: boolean;
  /* The race is still taking names (raceday.racePhase). */
  open: boolean;
  mine: Racer | null;
  /* The race, as the share cards print it — built by the page off the same
   * values the bill above does (RaceShare.RaceFacts). */
  share: RaceFacts;
}) {
  const router = useRouter();
  const [mine, setMine] = useState<Racer | null>(initialMine);
  /* Which question the rail is asking, if it is asking one: OUT is taking
   * the name off the list, WATCH is giving up an assigned wave. */
  const [confirm, setConfirm] = useState<null | "out" | "watch">(null);
  const [busy, setBusy] = useState<null | "racer" | "spectator" | "withdraw" | "waiver">(null);
  const [error, setError] = useState<string | null>(null);
  /* THE WAIVER (owner sent the link, 2026-09-11). It is signed on the gym's
   * own system, so this site can only ask — and asking is not a gate: a
   * rower who has not got to it yet still gets their name in, and the
   * console keeps the chase list. Ticked here, stamped by the route. Only a
   * racer is ever asked: a spectator does not pull. */
  const [waiver, setWaiver] = useState(initialMine?.waiverAt !== null && initialMine !== null);

  const inField = mine !== null && mine.withdrewAt === null;
  const racing = inField && mine?.role === "racer";
  const signed = mine?.waiverAt != null;

  const act = async (
    action: "enter" | "withdraw",
    o: { role?: RaceRole; waiver?: boolean; busy: "racer" | "spectator" | "withdraw" | "waiver" },
  ) => {
    setBusy(o.busy);
    setError(null);
    try {
      const res = await fetch("/api/row100k/raceday", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, role: o.role, waiver: o.waiver === true }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; mine?: Racer | null };
      if (res.ok && data.ok) {
        setMine(data.mine ?? null);
        setConfirm(null);
        /* NOTHING POPS HERE any more. A join used to raise the share dialog
         * on its own, everywhere except over the waiver ask — see the note
         * at the top of the file for why it earned that and why the card it
         * celebrated is gone. */
        // The racer list is rendered on the server below this block.
        router.refresh();
      } else setError(data.error ?? "Couldn't take that — try again.");
    } catch {
      setError("Couldn't take that — try again.");
    }
    setBusy(null);
  };

  /* Signed out and not opted in are live buttons that do the thing, the way
   * the shirt shop does it — never a dead button with an explanation. */
  if (!signedIn) {
    return (
      <div className="rd-act">
        <p className="rd-eye">Opt in</p>
        <button type="button" className="send" onClick={() => signIn("google", { callbackUrl: RACE_PATH })}>
          Sign in to opt in
        </button>
        <p className="rd-small mono">RACE OR WATCH — SIGN IN FIRST</p>
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
      </div>
    );
  }

  if (inField && mine) {
    const bracket = race.brackets.find((b) => b.key === mine.division);
    const emailed = racing && mine.wave !== null && mine.waveEmailedAt !== null;
    /* WHICH THEY ARE, said on the row that carries their number — the one
     * line a rower reads back to check they signed up as the thing they
     * meant to. */
    const who = `ROWER ${fmtRowerNumber(mine.rowerNumber)} · ${
      racing ? (bracket?.label ?? "No bracket").toUpperCase() : SPECTATOR.label.toUpperCase()
    }`;
    return (
      <div className="rd-act in">
        {/* Before a wave exists the block says the one thing there is to
         * say; after it, the wave IS the headline. The day is already the
         * biggest thing on the bill above, so it is not repeated here. */}
        <p className="rd-eye">{racing ? (mine.wave === null ? "Your entry" : "You are in") : "Your spot"}</p>
        <p className="rd-you">{racing && mine.wave !== null ? `Wave ${mine.wave}` : "You are in"}</p>
        <p className="rd-wave mono">
          {who}
          {emailed && mine.wave !== null ? ` · ${waveTime(race, mine.wave).toUpperCase()}` : ""}
        </p>
        {/* And once the wave time is up there, the line under it says the
         * one thing the bill has not already shouted at the rower: the room
         * to walk into. It used to print the venue and the day again — four
         * facts the sheet above carries, stacked on top of the only new one
         * — and the day half was the last typed date on the surface, free to
         * drift from the one page.tsx derives off race.day. */}
        {/* A SPECTATOR GETS THE ROOM, which is what a racer gets once their
         * wave has been mailed. This line used to be SPECTATOR.line — COME
         * WATCH. NO WAVE, NO ERG — until the owner struck it, and the block
         * above already says YOUR SPOT and YOU ARE IN, so restating that
         * they are not rowing was the sentence he was reading. What is
         * actually left to tell somebody who is coming to watch is the same
         * thing it is for a racer: which door. */}
        <p className="rd-small mono">
          {!racing
            ? race.room.toUpperCase()
            : mine.wave === null
              ? "WAVE NOT ASSIGNED"
              : emailed
                ? race.room.toUpperCase()
                : "START TIME TO COME"}
        </p>

        {/* The one thing still owed, if it is owed: the gym needs a signed
         * waiver before anybody rows. Once it is done the block says
         * nothing at all (owner, 2026-09-11) — a done thing is not news.
         * A spectator is never asked; they are not pulling. */}
        {race.waiver &&
          racing &&
          (signed ? null : (
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
                disabled={busy !== null}
                onClick={() => void act("enter", { role: mine.role, waiver: true, busy: "waiver" })}
              >
                {busy === "waiver" ? "…" : "I have signed it"}
              </button>
            </div>
          ))}

        {/* THE SHAREABLE, on a rail of its own above the one that takes a
         * name back off the list — see the note at the top of the file.
         *
         * IT HANDS OVER THE RACE AND NOT THE ROWER. This call used to pass
         * `role` and `wave` — the wave only ever one the rower had already
         * been TOLD about, a notch tighter than the number on screen,
         * because a page corrects itself on the next load and a PNG in a
         * camera roll never can. The card that printed them is retired
         * (owner, 2026-09-11: "I just like the race day sticker"), so the
         * props are gone and that rule with them; what is left is the event
         * card, which is the same for everybody and never goes stale. */}
        <div className="rd-two">
          <span className="mono">Post it?</span>
          <RaceShare facts={share} rowerNumber={mine.rowerNumber} label="Share race day" />
        </div>

        {open ? (
          confirm === "out" ? (
            <div className="rd-two">
              <span className="mono">Opt out of Sunday?</span>
              <button
                type="button"
                className="outline-btn"
                disabled={busy !== null}
                onClick={() => void act("withdraw", { busy: "withdraw" })}
              >
                {busy === "withdraw" ? "…" : "Opt out"}
              </button>
              <button type="button" className="quiet-btn" disabled={busy !== null} onClick={() => setConfirm(null)}>
                Never mind
              </button>
            </div>
          ) : confirm === "watch" ? (
            /* The cost is named before the act, because it is a cost the
             * rower cannot undo: opting back in as a racer works, but it
             * comes back with no wave and the owner has to lay the grid
             * out again. */
            <div className="rd-two">
              <span className="mono">Give up wave {mine.wave} and come and watch?</span>
              <button
                type="button"
                className="outline-btn"
                disabled={busy !== null}
                onClick={() => void act("enter", { role: "spectator", busy: "spectator" })}
              >
                {busy === "spectator" ? "…" : "Come and watch"}
              </button>
              <button type="button" className="quiet-btn" disabled={busy !== null} onClick={() => setConfirm(null)}>
                Never mind
              </button>
            </div>
          ) : (
            /* THE SWITCH. A spectator changing their mind is an UP move, so
             * it gets the outline button; a racer stepping back is quiet,
             * beside the opt out. Either way it is one press and the row
             * survives it. */
            <div className="rd-two">
              {racing ? (
                <>
                  <button type="button" className="quiet-btn" onClick={() => setConfirm("out")}>
                    Opt out
                  </button>
                  <button
                    type="button"
                    className="quiet-btn"
                    disabled={busy !== null}
                    onClick={() =>
                      /* No wave yet, nothing to lose: go. A wave assigned,
                       * ask first — see the note at the top of the file. */
                      mine.wave === null
                        ? void act("enter", { role: "spectator", busy: "spectator" })
                        : setConfirm("watch")
                    }
                  >
                    {busy === "spectator" ? "…" : "Come and watch instead"}
                  </button>
                </>
              ) : (
                <>
                  <span className="mono">Decided to pull?</span>
                  <button
                    type="button"
                    className="outline-btn"
                    disabled={busy !== null}
                    onClick={() => void act("enter", { role: "racer", waiver, busy: "racer" })}
                  >
                    {busy === "racer" ? "…" : "Opt in as a racer"}
                  </button>
                  <button type="button" className="quiet-btn" onClick={() => setConfirm("out")}>
                    Opt out
                  </button>
                </>
              )}
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
        {/* The gym, without its town: this read race.venueLine, which is
         * "The Strip Barbell · Las Vegas", and LAS VEGAS came off every race
         * surface on 2026-09-11. */}
        <p className="rd-small mono">{race.venue.toUpperCase()}</p>
      </div>
    );
  }

  return (
    <div className="rd-act">
      <p className="rd-eye">{wasIn ? "Your name is out" : "Opt in"}</p>
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
      <button
        type="button"
        className="send"
        disabled={busy !== null}
        onClick={() => void act("enter", { role: "racer", waiver, busy: "racer" })}
      >
        {busy === "racer" ? "…" : wasIn ? "Opt back in to race" : "Opt in to race"}
      </button>
      {/* THE SECOND WAY IN. Same rail the opt out uses, so it reads as the
       * other half of the same decision rather than a footnote. */}
      <div className="rd-two">
        <span className="mono">Not pulling?</span>
        <button
          type="button"
          className="outline-btn"
          disabled={busy !== null}
          onClick={() => void act("enter", { role: "spectator", busy: "spectator" })}
        >
          {busy === "spectator" ? "…" : `Sign up as a ${SPECTATOR.label.toLowerCase()}`}
        </button>
      </div>
      {/* Nothing under the rail. A mono line here read COME WATCH. NO WAVE,
       * NO ERG and the owner took it off (2026-09-11) — the button beside
       * NOT PULLING? already says spectator, and a gloss under a button
       * that needs none is the page explaining itself. The element went
       * with the sentence rather than being left to render empty. */}
      {error && <p className="form-err">{error}</p>}
    </div>
  );
}
