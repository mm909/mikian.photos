"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fmtRowerNumber } from "@/lib/row100k";
import { Blocks } from "../Blackout";
import type { M2dView } from "../m2d";

/* THE M2D PAGE, drawn (page.tsx). One call: POST /api/row100k/m2d
 * { in, choice? }.
 *
 * THE HEAD is one figure, the total raised for charity (owner, 2026-11-25:
 * "let's just show a total amount raised and show where the donated money
 * is coming from"), and under it where it comes from: Concept2 for the
 * meters, and ROWTEMBER's match split by the charity each rower picked. No
 * cap is printed anywhere (owner, the same day: "I don't want to say a
 * cap"). Before Nov 26 the figure is STARTS TOMORROW (or the days to go),
 * never a page of $0.00.
 *
 * THE PICK is one of three Las Vegas charities for ROWTEMBER's match,
 * changeable until Dec 24, sitting right over I'M REGISTERED (a solid
 * button) so the two read as one act. A visitor may pick before signing
 * in: the pick waits in this browser (PICK_KEY) and is there when they come
 * back from the sign-in page. */

const PICK_KEY = "row100k.m2d.pick";

const num = (n: number) => Math.round(n).toLocaleString("en-US");
/* "$7.02"; whole dollars from $1,000. */
const usd = (d: number) => (d >= 1000 ? `$${num(d)}` : `$${d.toFixed(2)}`);
/* "Nov 26" from "2026-11-26". */
const day = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

const SORRY = "Could not take that. Try again.";

export function M2dSite({ view, signedIn, signInHref }: { view: M2dView; signedIn: boolean; signInHref: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [isIn, setIsIn] = useState(view.me?.in ?? false);
  const [pick, setPick] = useState<string | null>(view.me?.choice ?? null);
  const { window: w, totals: t, goal, match, charities } = view;
  const name = (k: string | null) => charities.find((c) => c.key === k)?.name ?? null;

  /* A pick made before signing in comes back with the visitor. */
  useEffect(() => {
    if (view.me?.choice) return;
    try {
      const k = window.localStorage.getItem(PICK_KEY);
      if (k && charities.some((c) => c.key === k)) setPick(k);
    } catch {
      /* no storage: they pick again */
    }
  }, [view.me?.choice, charities]);

  const keep = (k: string | null) => {
    try {
      if (k) window.localStorage.setItem(PICK_KEY, k);
      else window.localStorage.removeItem(PICK_KEY);
    } catch {
      /* no storage */
    }
  };

  const send = async (on: boolean, choice?: string) => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/row100k/m2d", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(choice ? { in: on, choice } : { in: on }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setIsIn(on);
        if (choice) setPick(choice);
        keep(null);
        router.refresh();
      } else if (res.status === 401) window.location.href = signInHref;
      else setErr(data.error ?? SORRY);
    } catch {
      setErr(SORRY);
    }
    setBusy(false);
  };

  /* A tap on a charity: once registered it saves at once; before, it is
   * the pick I'M REGISTERED will send (kept in this browser across the
   * sign-in). */
  const choose = (k: string) => {
    if (w.over || busy) return;
    if (isIn) void send(true, k);
    else {
      setPick(k);
      keep(k);
    }
  };

  /* I'M REGISTERED, for whoever is looking: a rower sends it; a visitor
   * goes to sign in and comes back here, the pick kept; an account that
   * never joined Rowtember joins first. */
  const register = () => {
    if (view.me) void send(true, pick ?? undefined);
    else window.location.href = signedIn ? "/join" : signInHref;
  };
  const needPick = match.on && !pick;
  const logHref = view.me ? "/#log" : signedIn ? "/join" : signInHref;

  const steps: [string, React.ReactNode][] = [
    ["Make a free Concept2 Logbook", "Sign up at log.concept2.com, or sign in if you have one."],
    [
      "Pick a charity in your Logbook",
      "Invictus Games Foundation, Natural Resources Defense Council, War Child USA or Wood4Good, or Let Concept2 Choose. Do Not Donate means your meters raise nothing.",
    ],
    ["Get your meters into the Logbook", "ErgData sends each row there. Nov 26 to Dec 24; meters can be entered until Jan 4."],
    [
      "Row 100K",
      "Concept2 gives 2 cents a kilometer, then 4 cents for each one past 100K. 100K earns a certificate, 200K the Holiday Challenge pin (50K for kids and adaptive rowers).",
    ],
    [
      "Log your rows on ROW too",
      <>
        That&apos;s what {match.by} matches: only rows logged here count toward the match.{" "}
        <a className="m2-inline" href={logHref}>
          Log a row
        </a>
        . Sending your rows to Concept2 automatically is coming.
      </>,
    ],
  ];

  const picks = match.on ? (
    <div className="m2-picks-wrap">
      <h3>Where {match.by}&apos;s match goes</h3>
      <p className="m2-pick-lede">
        Pick one of three Las Vegas charities. {match.by} gives what Concept2 gives for your meters, and it goes here.
        {w.over ? "" : " You can change it until Dec 24."}
      </p>
      <div className="m2-picks" role="radiogroup" aria-label={`Where ${match.by}'s match goes`}>
        {charities.map((c) => {
          const on = pick === c.key;
          return (
            <div key={c.key} className={on ? "m2-pickbox on" : "m2-pickbox"}>
              <button
                type="button"
                role="radio"
                aria-checked={on}
                className="m2-pick"
                onClick={() => choose(c.key)}
                disabled={busy || w.over}
              >
                <b>
                  <span className="m2-tick" aria-hidden="true">
                    {on ? "✓" : ""}
                  </span>
                  {c.name}
                </b>
                <span>{c.what}</span>
              </button>
              {c.url ? (
                <a className="m2-site" href={c.url} target="_blank" rel="noopener noreferrer">
                  Their site ↗
                </a>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <main className="bd m2">
      <div className="wrap front">
        <h1 className="bd-date">
          <b>M2D · Meters to dollars</b>
          <span>{!w.started ? `Starts ${day(w.first)}` : w.over ? "Wrapped" : `Day ${w.day} of ${w.days}`}</span>
        </h1>
        <div className="bd-days" role="img" aria-label={`Day ${w.day} of ${w.days}`}>
          {Array.from({ length: w.days }, (_, i) => (
            <i key={i} className={i < w.day ? "on" : undefined} />
          ))}
        </div>

        {/* THE HEAD: the total, and where it comes from. */}
        <section className="m2-head" aria-label="Raised so far">
          <p className="m2-kick">Raised for charity by Rowtember rowers</p>
          {w.started ? (
            <p className="m2-big">{usd(t.total)}</p>
          ) : (
            <p className="m2-big m2-soon">{w.until <= 1 ? "Starts tomorrow" : `Starts in ${w.until} days`}</p>
          )}
          {w.started ? (
            <>
              <p className="m2-sub">
                {num(t.meters)} m rowed since {day(w.first)} · {t.registered} registered
              </p>
              <dl className="m2-from">
                <div>
                  <dt>From Concept2, for your meters</dt>
                  <dd>{usd(t.raised)}</dd>
                </div>
                {match.on ? (
                  <div>
                    <dt>Matched by {match.by}</dt>
                    <dd>{usd(t.matched)}</dd>
                  </div>
                ) : null}
              </dl>
              {match.on && t.matched > 0 ? (
                <p className="m2-split">
                  {charities.map((c, i) => (
                    <span key={c.key}>
                      {i ? " · " : ""}
                      {c.name} {usd(t.split[c.key as keyof typeof t.split] ?? 0)}
                    </span>
                  ))}
                  {t.unpicked > 0 ? <span> · Not picked yet {usd(t.unpicked)}</span> : null}
                </p>
              ) : null}
            </>
          ) : (
            <p className="m2-sub">
              {day(w.first)} to {day(w.last)} · {t.registered} registered so far
            </p>
          )}
          <div className="m2-goal">
            <div className="m2-goal-t">
              <span>Goal {usd(goal)} to charity</span>
              <span>{Math.round(Math.min(1, t.total / goal) * 100)}%</span>
            </div>
            <div className="m2-track" role="img" aria-label={`${usd(t.total)} of ${usd(goal)}`}>
              <i style={{ width: `${(Math.min(1, t.total / goal) * 100).toFixed(1)}%` }} />
            </div>
          </div>
        </section>

        {/* THE CALL: the rule, the five steps, the pick over the one press. */}
        <section className="m2-call" aria-labelledby="m2-ask">
          <h2 id="m2-ask">
            Row 100K <i>for charity</i>
          </h2>
          <p className="m2-lede">
            The Concept2 Holiday Challenge, {day(w.first)} to {day(w.last)}. Row 100,000 meters and Concept2 gives 2 cents a
            kilometer to the charity you pick in your Logbook, then 4 cents for every kilometer past 100K, toward its{" "}
            {usd(view.c2Goal)} goal.{match.on ? ` ${match.by} gives the same again, to a Las Vegas charity you pick here.` : ""} It
            is free.
          </p>
          {isIn ? (
            <>
              <div className="m2-yes">
                <p>
                  ✓ You are registered{pick ? ` · ${name(pick)}` : ""}. Your rows logged on ROW count here.
                </p>
                <button type="button" className="bd-quiet" onClick={() => void send(false)} disabled={busy}>
                  Undo
                </button>
              </div>
              {match.on && !pick && !w.over ? <p className="bd-say">Pick where {match.by}&apos;s match goes.</p> : null}
              {picks}
            </>
          ) : (
            <>
              <h3>Join in {steps.length} steps</h3>
              <ol className="m2-steps">
                {steps.map(([h, b], i) => (
                  <li key={h} className={i === steps.length - 1 ? "ours" : undefined}>
                    <span className="k">{i + 1}</span>
                    <div>
                      <b>{h}</b>
                      <p>{b}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="m2-c2">
                <a className="bd-ctl" href={view.link} target="_blank" rel="noopener noreferrer">
                  Open Concept2 ↗
                </a>
              </p>
              {picks}
              <div className="m2-act">
                <button type="button" className="m2-go" onClick={register} disabled={busy || needPick}>
                  {busy ? "Saving" : "I'm registered"}
                </button>
                <p className="m2-note">
                  {needPick
                    ? `Pick a charity above first.`
                    : view.me
                      ? `${name(pick)} gets ${match.by}'s match for your meters.`
                      : signedIn
                        ? "Join Rowtember first; your pick waits here."
                        : "You sign in first; your pick waits here."}
                </p>
              </div>
            </>
          )}
          {err ? (
            <p className="bd-say" role="alert">
              {err}
            </p>
          ) : null}
        </section>

        {/* THE BOARD in dollars: Concept2's dollars for each rower's meters. */}
        <div className="bd-strip">
          <span className="t">M2D board · {t.rowers} rowing</span>
        </div>
        <div className="bd-table" role="table" aria-label="The M2D board">
          {view.rows.length ? (
            <div role="rowgroup">
              <div className="bd-cols" role="row">
                <span role="columnheader">#</span>
                <span role="columnheader">Rower</span>
                <span role="columnheader" className="bd-num">
                  Meters
                </span>
                <span role="columnheader" className="bd-num">
                  Dollars
                </span>
              </div>
              {view.rows.map((r, i) => (
                <div
                  key={r.rowerNumber}
                  className={r.me ? "bd-row me" : "bd-row"}
                  role="row"
                  aria-current={r.me ? "true" : undefined}
                >
                  <div className="bd-in" role="presentation">
                    <span className="bd-rk" role="cell">
                      {r.blocks != null ? "" : i + 1}
                    </span>
                    <span className="bd-who" role="cell">
                      <span className="n">{fmtRowerNumber(r.rowerNumber)} · </span>
                      <a href={`/r/${r.rowerNumber}`}>{r.name}</a>
                    </span>
                    <span className="bd-num" role="cell">
                      {r.blocks != null ? <Blocks digits={r.blocks} /> : num(r.meters)}
                    </span>
                    <span
                      className={r.in ? "bd-num m2-usd" : "bd-num m2-usd off"}
                      role="cell"
                      title={r.in ? undefined : "Not registered yet"}
                    >
                      {r.dollars == null ? "" : usd(r.dollars)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div role="row">
              <div role="cell">
                <p className="bd-none">{w.started ? "Nobody has rowed yet" : `The board opens ${day(w.first)}`}</p>
              </div>
            </div>
          )}
        </div>
        {view.rows.length ? (
          <p className="m2-note">
            Dollars on the board are Concept2&apos;s for each rower&apos;s meters.
            {view.rows.some((r) => !r.in && r.dollars != null) ? " Grey dollars: not registered with Concept2 yet. Register and they count." : ""}
          </p>
        ) : null}
      </div>
    </main>
  );
}
