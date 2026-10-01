"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GOAL_METERS, fmtMeters, fmtRowerNumber } from "@/lib/row100k";
import { Blocks } from "../../Blackout";

/* THE 100K BOARD, drawn (see page.tsx). The server hands the month, the
 * count, the sections and who is looking; this draws the mock's frames —
 * the bar, the kick, the strip, the board with its bars, the gap row for
 * a rower not yet in, and the sheet — and makes the two calls:
 *
 *   OPT IN          POST /api/row100k/month-optin
 *   NOT THIS MONTH  DELETE, from the line under the strip once in
 *
 * Both refresh the route so the server list catches up; the strip flips
 * at once. The sheet opens on its own for a signed-in rower who is on the
 * roster but not on this month's board, once per month per browser (a
 * localStorage note), and NOT THIS MONTH on it just closes it. */

export type BoardRow = {
  rowerNumber: number;
  name: string;
  meters: number;
  masked: boolean;
  digits?: number;
  me: boolean;
};

export type BoardSection = {
  key: "club" | "athlete" | "participant" | "warming";
  title: string;
  rows: BoardRow[];
  /* The line printed when the section is empty; null to print nothing. */
  lock: string | null;
};

type Reply = { ok?: boolean; in?: boolean; count?: number; error?: string };

const ASKED = (month: string) => `row100k.b100k.asked.${month}`;

export function Board100k({
  month,
  count: initialCount,
  sections,
  unreadable,
  signedIn,
  me,
  signInHref,
}: {
  month: { key: string; label: string; name: string; days: number; day: number };
  count: number;
  sections: BoardSection[];
  unreadable: boolean;
  signedIn: boolean;
  me: { rowerNumber: number; name: string; meters: number; in: boolean } | null;
  signInHref: string;
}) {
  const router = useRouter();
  const [inNow, setInNow] = useState(me?.in ?? false);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    setInNow(me?.in ?? false);
    setCount(initialCount);
  }, [me?.in, initialCount]);

  // The sheet, once per month per browser, for a rower on the roster who
  // is not on this month's board.
  useEffect(() => {
    if (!me || me.in || unreadable) return;
    try {
      if (localStorage.getItem(ASKED(month.key)) === "1") return;
    } catch {
      /* storage blocked — ask anyway */
    }
    const t = setTimeout(() => setSheet(true), 500);
    return () => clearTimeout(t);
  }, [me, month.key, unreadable]);

  const notThisMonth = () => {
    try {
      localStorage.setItem(ASKED(month.key), "1");
    } catch {
      /* fine */
    }
    setSheet(false);
  };

  const call = async (method: "POST" | "DELETE") => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/row100k/month-optin", { method });
      const data = (await res.json().catch(() => ({}))) as Reply;
      if (res.ok && data.ok) {
        setInNow(data.in === true);
        if (typeof data.count === "number") setCount(data.count);
        setSheet(false);
        router.refresh();
      } else setErr(data.error ?? "Couldn't take that — try again.");
    } catch {
      setErr("Couldn't take that — try again.");
    }
    setBusy(false);
  };

  /* OPT IN by state: a stranger signs in; an account not on the roster
   * joins first (the front page's form); a rower opts into the month. */
  const optIn = () => {
    if (!signedIn) {
      window.location.href = signInHref;
      return;
    }
    if (!me) {
      window.location.href = "/row100k#join";
      return;
    }
    void call("POST");
  };

  /* Rank numbers run across the sections from 1; a rower not yet in sees
   * the gap row where their meters would land. */
  let rank = 0;
  const gapAfter = (() => {
    if (!me || inNow) return null;
    const all = sections.flatMap((s) => s.rows);
    const i = all.findIndex((r) => r.meters < me.meters);
    return i === -1 ? all.length : i;
  })();
  let seen = 0;
  const listedAny = sections.some((s) => s.rows.length > 0);

  const gapRow = (
    <button type="button" className="bk-gap" onClick={optIn} disabled={busy}>
      Opt in to be on this board
    </button>
  );

  return (
    <div className="bk-page">
      <header className="bk-bar">
        <div className="bk-r1">
          <span className="bk-wm">Rowtember</span>
          {me ? (
            <span className="bk-chip">{fmtRowerNumber(me.rowerNumber)}</span>
          ) : (
            <Link className="bk-chip" href={signedIn ? "/row100k#join" : signInHref}>
              {signedIn ? "Opt in" : "Sign in"}
            </Link>
          )}
        </div>
        <nav className="bk-r2" aria-label="Sections">
          <span className="on">Board</span>
          <Link href="/row100k#log">Log</Link>
          <Link href={me ? `/row100k/r/${me.rowerNumber}` : "/row100k"}>You</Link>
        </nav>
      </header>

      <div className="bk-kick">
        The board · {month.label} · day {month.day} of {month.days}
      </div>
      <div className="bk-strip">
        {inNow ? (
          <span className="t">
            <i>You are in</i> · {count} in
          </span>
        ) : (
          <span className="t">
            The {month.name} 100K · {count} in
          </span>
        )}
        {!inNow && (
          <button type="button" className="bk-ctl m" onClick={optIn} disabled={busy}>
            {busy ? "…" : "Opt in"}
          </button>
        )}
      </div>
      {inNow && me && (
        <p className="bk-under">
          <button type="button" className="bk-quiet" onClick={() => void call("DELETE")} disabled={busy}>
            {busy ? "…" : "Not this month"}
          </button>
        </p>
      )}
      {err && <p className="bk-err">{err}</p>}
      {unreadable && <p className="bk-err">The opt-in list could not be read — has the table been pushed?</p>}

      <div className="bk-board" role="table" aria-label={`The ${month.name} 100K board`}>
        <div className="bk-row bk-head" role="row">
          <span role="columnheader">#</span>
          <span role="columnheader">Rower</span>
          <span role="columnheader" className="num">
            Meters
          </span>
        </div>
        {sections.map((s) => {
          if (s.rows.length === 0 && s.lock === null && s.key === "warming") {
            // Nothing warming up: the section is not drawn at all.
            return null;
          }
          return (
            <div key={s.key} role="rowgroup">
              <div className="bk-div" role="row">
                <span role="cell">{s.title}</span>
              </div>
              {s.rows.length === 0 ? (
                s.lock ? (
                  <div className="bk-lock" role="row">
                    <span role="cell">{s.lock}</span>
                  </div>
                ) : null
              ) : (
                s.rows.map((r) => {
                  rank += 1;
                  const here = seen;
                  seen += 1;
                  const pct = r.masked ? 0 : Math.min(100, (r.meters / GOAL_METERS) * 100);
                  return (
                    <div key={r.rowerNumber}>
                      {gapAfter === here ? gapRow : null}
                      <div className={`bk-row${r.me ? " me" : ""}`} role="row">
                        {!r.masked && <span className="bar" style={{ width: `${pct}%` }} aria-hidden="true" />}
                        <span className="rk" role="cell">
                          {rank}
                        </span>
                        <Link className="who" href={`/row100k/r/${r.rowerNumber}`} role="cell">
                          <span className="n">{fmtRowerNumber(r.rowerNumber)} · </span>
                          {r.name}
                          {r.me ? <span className="u">You</span> : null}
                        </Link>
                        <span className="num" role="cell">
                          {r.masked ? <Blocks digits={r.digits ?? 6} /> : fmtMeters(r.meters)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
        {gapAfter !== null && gapAfter >= seen ? gapRow : null}
        {!listedAny && !me && (
          <p className="bk-empty">Nobody is on the {month.name} 100K board yet.</p>
        )}
      </div>

      {/* THE SHEET: the ask, over the board. */}
      <div className={`bk-scrim${sheet ? " on" : ""}`} onClick={notThisMonth} aria-hidden="true" />
      <section className={`bk-sheet${sheet ? " on" : ""}`} aria-label="Opt in" aria-hidden={!sheet}>
        <h2>
          Row 100,000 meters in <i>{month.name}</i>
        </h2>
        <p>Your {month.name} rows count toward it. You are on the board.</p>
        <button type="button" className="bk-ctl l" onClick={optIn} disabled={busy}>
          {busy ? "…" : "Opt in"}
        </button>
        <button type="button" className="bk-quiet" onClick={notThisMonth}>
          Not this month
        </button>
      </section>
    </div>
  );
}
