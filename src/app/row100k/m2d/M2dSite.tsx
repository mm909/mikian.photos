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

/* Concept2's rule (row100k/m2d.ts worth), here for the graph. */
const worth = (meters: number) => {
  const km = Math.max(0, meters) / 1000;
  return Math.round((km <= 100 ? 0.02 * km : 2 + 0.04 * (km - 100)) * 100) / 100;
};

/* METERS TO DOLLARS, DRAWN (owner, 2026-11-25: "We need to explain this
 * section better or with a graph"): nothing until 100K (dashed), $2 at
 * 100K, then 4 cents a kilometer, $6 at 200K and $10 at 300K; the
 * certificate and the pin marked; YOU a dot at your meters. The app draws
 * the same (mobile/src/screens/M2D.tsx M2dGraph). */
const GW = 340;
const GH = 196;
function Graph({ meters }: { meters: number | null }) {
  const m = Math.max(0, meters ?? 0);
  const xmax = Math.max(300_000, Math.ceil((m * 1.12) / 100_000) * 100_000);
  const ymax = worth(xmax);
  const [L, R, T, B] = [14, 18, 26, 28];
  const sx = (x: number) => L + (x / xmax) * (GW - L - R);
  const sy = (d: number) => GH - B - (d / ymax) * (GH - T - B);
  const youX = sx(Math.min(m, xmax));
  const youY = sy(m >= 100_000 ? worth(m) : 0);
  const label = m >= 100_000 ? `YOU · ${usd(worth(m))}` : `YOU · ${Math.round(m / 1000)}K`;
  return (
    <svg
      className="m2-g"
      viewBox={`0 0 ${GW} ${GH}`}
      role="img"
      aria-label={`Meters to dollars: nothing until 100K, $2 at 100K, $6 at 200K, $10 at 300K.${meters == null ? "" : ` ${label}.`}`}
    >
      <line x1={L} y1={GH - B} x2={GW - R} y2={GH - B} className="ax" />
      <line x1={sx(0)} y1={sy(0)} x2={sx(100_000)} y2={sy(0)} className="ln dash" />
      <text x={sx(0)} y={sy(0) - 8} className="lb sm" textAnchor="start">
        NOTHING UNTIL 100K
      </text>
      <line x1={sx(100_000)} y1={sy(0)} x2={sx(100_000)} y2={sy(2)} className="jump" />
      <line x1={sx(100_000)} y1={sy(2)} x2={sx(xmax)} y2={sy(worth(xmax))} className="ln" />
      <circle cx={sx(100_000)} cy={sy(2)} r={5} className="ms" />
      <text x={sx(100_000) + 10} y={sy(2) + 16} className="mk" textAnchor="start">
        $2 · CERTIFICATE
      </text>
      <circle cx={sx(200_000)} cy={sy(6)} r={5} className="ms" />
      <text x={sx(200_000) + 10} y={sy(6) + 16} className="mk" textAnchor="start">
        $6 · PIN
      </text>
      {xmax >= 300_000 ? (
        <text x={sx(300_000) - 2} y={sy(10) - 10} className="mk" textAnchor="end">
          $10
        </text>
      ) : null}
      {[0, 100_000, 200_000, 300_000]
        .filter((x) => x <= xmax)
        .map((x) => (
          <text key={x} x={sx(x)} y={GH - 9} className="lb" textAnchor={x === 0 ? "start" : "middle"}>
            {x === 0 ? "0 M" : `${x / 1000}K`}
          </text>
        ))}
      {meters != null ? (
        <>
          <circle cx={youX} cy={youY} r={7} className="you" />
          <text x={m >= 100_000 ? youX - 10 : youX + 10} y={m >= 100_000 ? youY - 12 : youY - 30} className="yl" textAnchor={m >= 100_000 ? "end" : "start"}>
            {label}
          </text>
        </>
      ) : null}
    </svg>
  );
}

/* The one plain line under it, in real numbers, the match doubling it. */
function words(meters: number | null, by: string, isIn: boolean): string {
  if (meters == null) return `At 100K your meters give $2. Every 10K after adds 40¢. ${by} matches every cent.`;
  if (meters < 100_000) return `You're ${num(100_000 - meters)} m from your first $2. After that, every 10K adds 40¢, and ${by} matches every cent.`;
  const d = worth(meters);
  return `${usd(d)} so far, +40¢ every 10K. Concept2 ${usd(d)} + ${by} ${usd(d)} = ${usd(d * 2)} to charity.${isIn ? "" : " Register so it counts."}`;
}

export function M2dSite({ view, signedIn, signInHref }: { view: M2dView; signedIn: boolean; signInHref: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [isIn, setIsIn] = useState(view.me?.in ?? false);
  const [pick, setPick] = useState<string | null>(view.me?.choice ?? null);
  /* Once picked only that charity shows; CHANGE opens the three again until
   * Dec 24 (owner, 2026-11-25: "Once we select a charity we could prob hide
   * the others"). */
  const [changing, setChanging] = useState(false);
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
    setChanging(false);
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

  const mine = charities.find((c) => c.key === pick);
  const picks = !match.on ? null : mine && !changing ? (
    <div className="m2-picks-wrap">
      <p className="m2-kick">Your match goes to</p>
      <div className="m2-pickbox on m2-mine">
        <div className="m2-pick" role="status">
          <b>
            <span className="m2-tick" aria-hidden="true">
              ✓
            </span>
            {mine.name}
          </b>
          <span>{mine.what}</span>
        </div>
      </div>
      <div className="m2-mine-row">
        {mine.url ? (
          <a className="m2-site" href={mine.url} target="_blank" rel="noopener noreferrer">
            Their site ↗
          </a>
        ) : (
          <span />
        )}
        {!w.over ? (
          <button type="button" className="m2-quiet" onClick={() => setChanging(true)} disabled={busy}>
            Change
          </button>
        ) : null}
      </div>
    </div>
  ) : (
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
  );

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

        {/* METERS TO DOLLARS: the graph and one plain line, the viewer's
            own dot when there is a rower to put on it. */}
        <section className="m2-explain" aria-label="How meters become dollars">
          <p className="m2-kick">How your meters become dollars</p>
          <Graph meters={view.me ? view.me.meters : null} />
          <p className="m2-words">{words(view.me ? view.me.meters : null, match.by, isIn)}</p>
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
              {/* REGISTERED as a status, Open Concept2 the one link, Undo
               * small and set apart (owner, 2026-11-25: "We need to explain
               * this section better"). */}
              <div className="m2-status">
                <p role="status">✓ Registered</p>
                <a className="bd-ctl" href={view.link} target="_blank" rel="noopener noreferrer">
                  Open Concept2 ↗
                </a>
              </div>
              <p className="m2-note">Your rows logged on ROW count toward the match.</p>
              {match.on && !pick && !w.over ? <p className="bd-say">Pick where {match.by}&apos;s match goes.</p> : null}
              {picks}
              {!w.over ? (
                <p className="m2-undo">
                  <button type="button" className="m2-quiet" onClick={() => void send(false)} disabled={busy}>
                    Not registered? Undo
                  </button>
                </p>
              ) : null}
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
