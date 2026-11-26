"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fmtRowerNumber } from "@/lib/row100k";
import { Blocks } from "../Blackout";
import type { M2dView } from "../m2d";

/* SPLIT EVENLY (m2d.ts EVEN_SHARES), the default pick. */
const EVEN = "even";
const evenShares = { candlelighters: 34, shine: 33, inclusion: 33 };
const isEvenSplit = (s: Record<string, number | undefined>) => Object.entries(evenShares).every(([k, v]) => (s[k] ?? 0) === v);

/* THE M2D PAGE, drawn (page.tsx). One call: POST /api/row100k/m2d
 * { in, choice? }.
 *
 * THE ORDER (owner, 2026-11-25, of the app's tab, which this page mirrors:
 * "bring back whatever we had, like a total ... a receipts up there"):
 * the total, labelled RAISED; the goal; the receipts, CONCEPT2 then
 * ROWTEMBER with a line per charity, each a link to the FAQ's math
 * (/m2d/faq); the board. Never a match, never "Las Vegas", never a word
 * asking for money (owner: "I don't want to ask people for money").
 *
 * THE SITE KEEPS ITS SIGN-UP (the app is not public yet): a rower not yet
 * in gets the five steps, the one charity and I'M REGISTERED; a rower in
 * gets one quiet line, their charity and CHANGE. A visitor may pick before
 * signing in: the pick waits in this browser (PICK_KEY). */

const PICK_KEY = "row100k.m2d.pick";

const num = (n: number) => Math.round(n).toLocaleString("en-US");
/* "$7.02"; whole dollars from $1,000. */
const usd = (d: number) => (d >= 1000 ? `$${num(d)}` : `$${d.toFixed(2)}`);
/* "3¢", "2.5¢", "$1". */
const cents = (c: number) => (c >= 100 ? `$${(c / 100).toFixed(c % 100 ? 2 : 0)}` : `${Math.round(c * 100) / 100}¢`);
/* Concept2's part for some meters: nothing until 100K, then 2¢ a km for
 * the first 100 and 4¢ after (m2d.ts locked). */
const c2Of = (m: number) => (m < 100_000 ? 0 : 2 + 0.04 * (m / 1000 - 100));
/* Every giver on the site's side (ROWTEMBER and any pledge), a km. */
const oursOf = (m: number, perKm: number) => ((m / 1000) * perKm) / 100;
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
  const [changing, setChanging] = useState(false);
  const [joining, setJoining] = useState(false);
  const { window: w, totals: t, goal, charities, rate } = view;
  const perKm = view.perKm ?? rate;
  const by = view.match.by;

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
        body: JSON.stringify(
          choice === EVEN ? { in: on, shares: evenShares } : choice ? { in: on, choice } : { in: on },
        ),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setIsIn(on);
        if (choice) setPick(choice);
        setChanging(false);
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
   * the pick I'M REGISTERED will send (kept across the sign-in). */
  const choose = (k: string) => {
    if (w.over || busy) return;
    if (isIn) void send(true, k);
    else {
      setPick(k);
      keep(k);
    }
  };

  /* I'M REGISTERED: a rower sends it; a visitor signs in and comes back
   * here, the pick kept; an account that never joined Rowtember joins. */
  const register = () => {
    if (view.me) void send(true, pick && pick !== EVEN ? pick : undefined);
    else window.location.href = signedIn ? "/join" : signInHref;
  };
  const logHref = view.me ? "/#log" : signedIn ? "/join" : signInHref;

  /* What the rower's charity line says: one name, or a split made in the
   * app ("Candlelighters 50% · Shine A Light 50%"). */
  const shares = view.me?.shares ?? null;
  const mineText = (() => {
    if (pick === EVEN) return "Split evenly";
    if (pick) return charities.find((c) => c.key === pick)?.name ?? null;
    if (!shares) return "Split evenly";
    if (isEvenSplit(shares)) return "Split evenly";
    return charities
      .filter((c) => (shares[c.key as keyof typeof shares] ?? 0) > 0)
      .map((c) => `${c.name} ${shares[c.key as keyof typeof shares]}%`)
      .join(" · ");
  })();

  const steps: [string, React.ReactNode][] = [
    ["Make a free Concept2 Logbook", "Sign up at log.concept2.com, or sign in if you have one."],
    [
      "Pick a charity in your Logbook",
      "Invictus Games Foundation, Natural Resources Defense Council, War Child USA or Wood4Good, or Let Concept2 Choose. Do Not Donate means your meters raise nothing from Concept2.",
    ],
    ["Get your meters into the Logbook", "ErgData sends each row there. Nov 26 to Dec 24; meters can be entered until Jan 4."],
    [
      "Row 100K",
      "Concept2 donates for every rower who reaches 100K: 2 cents a kilometer, then 4 cents for each one past 100K. 100K earns a certificate, 200K the Holiday Challenge pin (50K for kids and adaptive rowers).",
    ],
    [
      "Log your rows on ROW too",
      <>
        {by} matches Concept2&apos;s {cents(rate)} on every kilometer logged here, from your first meter.{" "}
        <a className="m2-inline" href={logHref}>
          Log a row
        </a>
        . Sending your rows to Concept2 automatically is coming.
      </>,
    ],
  ];

  const picks = (
    <div className="m2-picks-wrap">
      <h3>Your charity</h3>
      <p className="m2-pick-lede">
        {by} matches Concept2&apos;s {cents(rate)} on every kilometer you row, from your first meter. It is split evenly across
        the three unless you pick one.
        {w.over ? "" : " You can change it until Dec 24."}
      </p>
      <div className="m2-picks" role="radiogroup" aria-label="Your charity">
        {(() => {
          const on = pick === EVEN || (!pick && (!shares || isEvenSplit(shares)));
          return (
            <div className={on ? "m2-pickbox on" : "m2-pickbox"}>
              <button type="button" role="radio" aria-checked={on} className="m2-pick" onClick={() => choose(EVEN)} disabled={busy || w.over}>
                <b>
                  <span className="m2-tick" aria-hidden="true">
                    {on ? "✓" : ""}
                  </span>
                  Split evenly
                </b>
                <span>A third to each of the three.</span>
              </button>
            </div>
          );
        })()}
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

  const share = Math.min(1, t.total / goal);

  return (
    <main className="bd m2">
      <div className="wrap front">
        <h1 className="bd-date">
          <b>M2D · Meters to dollars</b>
          <span>{!w.started ? `${day(w.first)} – ${day(w.last)}` : w.over ? "Wrapped" : `Day ${w.day} of ${w.days}`}</span>
        </h1>
        <div className="bd-days" role="img" aria-label={`Day ${w.day} of ${w.days}`}>
          {Array.from({ length: w.days }, (_, i) => (
            <i key={i} className={i < w.day ? "on" : undefined} />
          ))}
        </div>

        {/* THE TOTAL, labelled RAISED; $0.00 and STARTS NOV 26 before. */}
        <section className="m2-head" aria-label="Raised so far">
          <p className="m2-big">{usd(t.total)}</p>
          <p className="m2-kick">
            Raised
            {w.started ? <span className="m2-kick-q"> · {num(t.meters)} m rowed since {day(w.first)}</span> : null}
          </p>
          <div className="m2-goal">
            <div className="m2-goal-t">
              <span>Goal {usd(goal)} to charity</span>
              <span>{Math.round(share * 100)}%</span>
            </div>
            <div className="m2-track" role="img" aria-label={`${usd(t.total)} of ${usd(goal)}`}>
              <i style={{ width: `${(share * 100).toFixed(1)}%` }} />
            </div>
          </div>
          {/* THE RECEIPTS: each name opens the math (owner: tapping CONCEPT2
              or ROWTEMBER opens the FAQ that shows it). */}
          <dl className="m2-from">
            {/* THE METERS on the receipt, and each giver's rate under its
                name (owner, 2026-11-25: "the only thing that's missing is I
                want a number of meters ... the cents per meter to be shown
                somewhere"). */}
            <div>
              <dt>
                Meters rowed<small>By registered rowers</small>
              </dt>
              <dd style={{ color: "var(--ink)" }}>{num(t.inMeters)} m</dd>
            </div>
            <div>
              <dt>
                <Link href="/m2d/faq#concept2">Concept2 ›</Link>
                <small>2¢/km once a rower passes 100K, 4¢ after</small>
              </dt>
              <dd>{usd(t.raised)}</dd>
            </div>
            <div>
              <dt>
                <Link href="/m2d/faq#rowtember">{by} ›</Link>
                <small>Matches Concept2&apos;s {cents(rate)}/km, from your first meter</small>
              </dt>
              <dd>{usd(t.matched)}</dd>
            </div>
            {(t.givers ?? []).map((g) => (
              <div key={`${g.name}-${g.cents}-${g.cap}`}>
                <dt>
                  {/* An approved pledge (2026-11-26) reads "$1/km for 500
                      km · Name"; the old list keeps its own line. */}
                  {g.line ?? g.name}
                  <small>
                    {g.pledge
                      ? `${Math.round(g.km ?? 0).toLocaleString("en-US")} of ${Math.round(g.capKm ?? 0).toLocaleString("en-US")} km filled`
                      : `${cents(g.cents)}/km pledged, up to $${g.cap.toLocaleString("en-US")}`}
                  </small>
                </dt>
                <dd>{usd(g.dollars)}</dd>
              </div>
            ))}
            {/* No charity lines here (owner, 2026-11-25: "we don't need to
                say ... Candlelighters, Shine A Light, Project Inclusion");
                the split by charity is on the FAQ. */}
            <div className="total">
              <dt>Total</dt>
              <dd>{usd(t.total)}</dd>
            </div>
          </dl>
          {/* WHAT YOUR METERS ARE WORTH (owner, 2026-11-25: "if you row this
              much, this is how much gets donated. And you have rowed this
              much so far, so this is how much is donated ... here's how much
              your meters are worth"). */}
          <section className="m2-worth" aria-label="What your meters are worth">
            {/* YOUR CHARITY, at the head of this, to the right (owner,
                2026-11-25: "some text to the right that says ... change
                your contribution ... I really want the board to be front and
                center"): no line of its own above the board. */}
            <div className="m2-worth-h">
              <h2>What your meters are worth</h2>
              {isIn && !w.over ? (
                <button type="button" className="m2-quiet" onClick={() => setChanging((c) => !c)} disabled={busy}>
                  {changing ? "Done" : mineText ? `${mineText} · change` : "Pick your charity"}
                </button>
              ) : isIn && mineText ? (
                <span className="m2-quiet-t">{mineText}</span>
              ) : null}
            </div>
            <dl>
            <div className="rate">
              <dt>A kilometer under 100K</dt>
              <dd>{cents(perKm)}</dd>
            </div>
            <div className="rate">
              <dt>A kilometer past 100K</dt>
              <dd>{cents(perKm + 4)}</dd>
            </div>
            {view.me && w.started ? (
              <div className="you">
                <dt>You, {num(view.me.meters)} m so far</dt>
                <dd>{usd(view.me.dollars)}</dd>
              </div>
            ) : null}
            </dl>
          </section>
        </section>

        {/* IN: one quiet line, the charity, CHANGE. NOT IN: one small call
            that opens the sign-up. */}
        {isIn ? (
          <section className="m2-quietline" aria-label="Your M2D">
            {changing || (!mineText && !w.over) ? picks : null}
            {changing && !w.over ? (
              <p className="m2-undo">
                <button type="button" className="m2-quiet" onClick={() => void send(false)} disabled={busy}>
                  Not registered? Undo
                </button>
              </p>
            ) : null}
          </section>
        ) : !joining && !w.over ? (
          <p className="m2-join">
            <button type="button" className="m2-go small" onClick={() => setJoining(true)}>
              Opt in to M2D
            </button>
          </p>
        ) : !w.over ? (
          <section className="m2-call" aria-labelledby="m2-ask">
            <h2 id="m2-ask">
              Row <i>for charity</i>
            </h2>
            <p className="m2-lede">
              The Concept2 Holiday Challenge, {day(w.first)} to {day(w.last)}. Concept2 donates for every rower who reaches
              100K: 2 cents a kilometer to the charity they pick in their Logbook, then 4 cents for every kilometer past 100K. {by} matches Concept2&apos;s {cents(rate)} on every kilometer you row, from your first meter, to the charity you
              pick here.
            </p>
            <h3>Opt in to M2D: {steps.length} steps</h3>
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
              <button type="button" className="m2-go" onClick={register} disabled={busy}>
                {busy ? "Saving" : "I'm registered"}
              </button>
              <p className="m2-note">
                {view.me
                    ? `${mineText} gets ${by}'s part for your meters.`
                    : signedIn
                      ? "Join Rowtember first; your pick waits here."
                      : "You sign in first; your pick waits here."}
              </p>
            </div>
          </section>
        ) : null}
        {err ? (
          <p className="bd-say" role="alert">
            {err}
          </p>
        ) : null}

        {/* THE BOARD, in dollars: Concept2's and ROWTEMBER's for each rower. */}
        <div className="bd-strip">
          <span className="t">M2D board · {t.rowers} rowing</span>
          <Link className="bd-ctl" href="/m2d/faq">
            How it adds up
          </Link>
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
                  className={["bd-row", r.me ? "me" : "", r.meters >= 100_000 ? "past" : ""].filter(Boolean).join(" ")}
                  role="row"
                  aria-current={r.me ? "true" : undefined}
                >
                  {/* THE BAR TO 100K (owner, 2026-11-25: "a bar showing maybe
                      your meters up to the 100K ... once they hit the 100K,
                      their meters are worth this amount"): full and in the
                      accent once past it, when Concept2 starts giving. */}
                  {r.blocks == null ? (
                    <span className="bd-bar" style={{ width: `calc((100% - var(--bd-figs)) * ${Math.min(1, r.meters / 100_000).toFixed(4)})` }} aria-hidden="true" />
                  ) : null}
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
        {view.rows.some((r) => !r.in && r.dollars != null) ? (
          <p className="m2-note">The bar runs to 100K, where Concept2&apos;s donation begins. Grey dollars: not registered yet.</p>
        ) : null}
      </div>
    </main>
  );
}
