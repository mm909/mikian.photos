"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fmtRowerNumber } from "@/lib/row100k";
import { fmtPacificStamp } from "@/lib/blackoutRules";
import { waveCount, waveTime, type RaceDef } from "../raceday";
import type { Racer } from "../racedayData";
import { bySeed, WaveGrid } from "./WaveGrid";

/* THE WAVE CONSOLE (owner, 2026-09-10). Four things in one page: the field
 * with everyone in it, AUTO-ASSIGN with a dry run before it writes, MANUAL
 * — a wave picker on every row, saved the moment it changes — and EMAIL THE
 * WAVES, also with a dry run. The grid sits between the machine and the
 * hand so the owner can see what either one did.
 *
 * Every write goes through /api/row100k/raceday/waves and the answer is
 * folded back into this list, so what is on the screen is what was saved.
 * No meters anywhere: a blackout-masked total reads 0 (racedayData), and a
 * zero in the owner's own console is worse than no column at all.
 *
 * RACERS AND SPECTATORS ARE TWO LISTS (owner, 2026-09-11). Every verb that
 * touches a WAVE — the count, the auto-assign, the grid, the picker, the
 * mail — runs off the RACERS and cannot see anybody else, so a spectator
 * can never be swept into a wave or a wave note. They get a list of their
 * own at the foot, because the owner still needs to know how many bodies
 * are going to be in the room. */

/* What the route answers with — declared here rather than imported from a
 * route file (the settle panel's idiom). */
type PlanRow = {
  id: string;
  rowerNumber: number;
  name: string;
  division: string;
  best5k: string;
  from: number | null;
  to: number;
};
type PlanOut = { dryRun: boolean; mix: boolean; assigned: number; moved: number; waves: number; plan: PlanRow[] };
type MailRow = {
  id: string;
  rowerNumber: number;
  name: string;
  email: string;
  wave: number;
  time: string;
  sent: boolean;
  reason: string;
};
type MailOut = { dryRun: boolean; due: number; sent: number; failed: number; results: MailRow[] };

const stampDay = (iso: string) => fmtPacificStamp(iso).split(" · ")[0].toUpperCase();

export function RaceWaves({ race, racers, unreadable }: { race: RaceDef; racers: Racer[]; unreadable: boolean }) {
  const router = useRouter();
  const [field, setField] = useState<Racer[]>(racers);
  /* THE ONE OVERRIDE on the auto rule: brackets apart, or one field. */
  const [mix, setMix] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanOut | null>(null);
  const [mail, setMail] = useState<MailOut | null>(null);
  /* Which irreversible button is waiting on its second press. */
  const [confirm, setConfirm] = useState<"auto" | "email" | null>(null);

  const live = field.filter((r) => !r.withdrewAt);
  /* THE ONLY POPULATION THE WAVES KNOW ABOUT: the people actually pulling. */
  const starters = live.filter((r) => r.role === "racer");
  const watchers = field
    .filter((r) => r.role === "spectator")
    .sort((a, b) => (a.withdrewAt ? 1 : 0) - (b.withdrewAt ? 1 : 0));
  const liveWatchers = watchers.filter((r) => !r.withdrewAt);
  const gone = field.filter((r) => r.withdrewAt && r.role === "racer");
  const assigned = starters.filter((r) => r.wave !== null);
  const told = assigned.filter((r) => r.waveEmailedAt);
  const due = assigned.length - told.length;
  const lastWave = starters.reduce((n, r) => Math.max(n, r.wave ?? 0), 0);
  /* One spare wave past whatever the field needs, so a rower can always be
   * pushed somewhere new by hand. */
  const pickMax = Math.min(20, Math.max(1, lastWave, waveCount(race, Math.max(1, starters.length))) + 1);
  const picks = Array.from({ length: pickMax }, (_, i) => i + 1);

  /* The field table is the racers, withdrawals and all — a hole in a wave
   * is something the owner has to be able to see. */
  const rows = field
    .filter((r) => r.role === "racer")
    .sort((a, b) => {
      const aw = a.withdrewAt ? 1 : 0;
      const bw = b.withdrewAt ? 1 : 0;
      if (aw !== bw) return aw - bw;
      const an = a.wave ?? 9_999;
      const bn = b.wave ?? 9_999;
      if (an !== bn) return an - bn;
      return bySeed(a, b);
    });
  const prorated = rows.some((r) => r.best5k?.prorated);

  const post = async (body: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/row100k/raceday/waves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ race: race.slug, ...body }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        /* THE DOOR LIST IS ABOVE THIS, and it is a server block reading the
         * same field off the same request. This console shows its writes
         * optimistically, so without a refresh the list forty lines up goes
         * on printing a dash for a rower this console has just put in wave
         * 2 — on race week that reads as a save that failed. Fire and
         * forget: the optimistic state is what the operator is watching,
         * and the refresh only has to catch the block that cannot know. */
        router.refresh();
        return data;
      }
      setError(data.error ?? "Couldn't do that — try again.");
    } catch {
      setError("Couldn't do that — try again.");
    }
    return null;
  };

  /* ------------------------------------------------------------- manual */

  const setWave = async (r: Racer, raw: string) => {
    const wave = raw === "" ? null : Number(raw);
    const moved = (r.wave ?? null) !== wave;
    const before = field;
    setBusy(r.id);
    /* Shown straight away, put back if the write refuses. */
    setField((all) =>
      all.map((x) => (x.id === r.id ? { ...x, wave, waveEmailedAt: moved ? null : x.waveEmailedAt } : x)),
    );
    const data = await post({ action: "set", id: r.id, wave });
    if (!data) setField(before);
    else {
      setOk(
        wave === null
          ? `${r.name.toUpperCase()} TAKEN OUT OF THE GRID`
          : `${r.name.toUpperCase()} TO WAVE ${wave} AT ${waveTime(race, wave)}${moved ? " — THEY WILL BE TOLD AGAIN" : ""}`,
      );
    }
    setBusy(null);
  };

  /* --------------------------------------------------------------- auto */

  const runAuto = async (dryRun: boolean) => {
    setBusy(dryRun ? "auto-dry" : "auto");
    const data = (await post({ action: "auto", dryRun, mix })) as (PlanOut & { ok: true }) | null;
    if (data) {
      setPlan(data);
      if (!dryRun) {
        const by = new Map(data.plan.map((p) => [p.id, p]));
        setField((all) =>
          all.map((x) => {
            const p = by.get(x.id);
            if (!p || p.from === p.to) return x;
            return { ...x, wave: p.to, waveEmailedAt: null };
          }),
        );
        setMail(null);
        setOk(`${data.assigned} RACERS INTO ${data.waves} ${data.waves === 1 ? "WAVE" : "WAVES"} · ${data.moved} MOVED`);
      }
    }
    setBusy(null);
    setConfirm(null);
  };

  /* -------------------------------------------------------------- email */

  const runEmail = async (dryRun: boolean) => {
    setBusy(dryRun ? "email-dry" : "email");
    const data = (await post({ action: "email", dryRun })) as (MailOut & { ok: true }) | null;
    if (data) {
      setMail(data);
      if (!dryRun) {
        const sent = new Set(data.results.filter((m) => m.sent).map((m) => m.id));
        const at = new Date().toISOString();
        setField((all) => all.map((x) => (sent.has(x.id) ? { ...x, waveEmailedAt: at } : x)));
        setOk(`${data.sent} TOLD${data.failed > 0 ? ` · ${data.failed} FAILED` : ""}`);
      }
    }
    setBusy(null);
    setConfirm(null);
  };

  if (unreadable) {
    return <p className="board-empty">THE FIELD COULD NOT BE READ JUST NOW — RELOAD IN A MOMENT.</p>;
  }

  return (
    <div className="ra">
      {/* ---------------------------------------------------- auto-assign */}
      <div className="sec-head ra-sec">
        <h2>Auto-assign</h2>
        <span className="mono">
          {starters.length} IN THE FIELD · {assigned.length} WITH A WAVE · {told.length} TOLD
          {liveWatchers.length > 0 ? ` · ${liveWatchers.length} WATCHING` : ""}
        </span>
      </div>
      <p className="ra-note">
        The brackets race each other: men with men, women with women, seeded by fastest 5k — quickest first, no time
        last — <b>{race.waveSize} to a wave</b>. Racers only: anybody who signed up to watch is not in the plan and
        never gets a wave. Dry run writes nothing. Assigning overwrites any wave you set by hand and forgets who was
        told, so everybody moved is told again.
      </p>
      <div className="tabs ra-tabs" role="group" aria-label="Bracket rule">
        <button type="button" className={!mix ? "on" : undefined} aria-pressed={!mix} onClick={() => setMix(false)}>
          Brackets apart
        </button>
        <button type="button" className={mix ? "on" : undefined} aria-pressed={mix} onClick={() => setMix(true)}>
          Mix the brackets
        </button>
      </div>
      <div className="ra-act">
        <button
          type="button"
          className="outline-btn"
          disabled={busy !== null || starters.length === 0}
          onClick={() => void runAuto(true)}
        >
          {busy === "auto-dry" ? "…" : "Dry run"}
        </button>
        {confirm === "auto" ? (
          <>
            <button type="button" className="send" disabled={busy !== null} onClick={() => void runAuto(false)}>
              {busy === "auto" ? "…" : `Yes, lay out ${starters.length}`}
            </button>
            <button type="button" className="outline-btn" disabled={busy !== null} onClick={() => setConfirm(null)}>
              Leave it alone
            </button>
          </>
        ) : (
          <button
            type="button"
            className="send"
            disabled={busy !== null || starters.length === 0}
            onClick={() => setConfirm("auto")}
          >
            Assign the waves
          </button>
        )}
      </div>
      {plan && (
        <>
          <p className="ra-note">
            {plan.dryRun ? "DRY RUN — NOTHING WRITTEN. " : "ASSIGNED. "}
            {plan.assigned} RACERS INTO {plan.waves} {plan.waves === 1 ? "WAVE" : "WAVES"} · {plan.moved}{" "}
            {plan.moved === 1 ? "MOVE" : "MOVES"} · {plan.mix ? "BRACKETS MIXED" : "BRACKETS APART"}
          </p>
          {plan.plan.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table className="board ra-t">
                <thead>
                  <tr>
                    <th>Rower</th>
                    <th>Bracket</th>
                    <th>Fastest 5k</th>
                    <th>Now</th>
                    <th>Wave</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.plan.map((p) => (
                    <tr key={p.id} className={p.from !== p.to ? "ra-moved" : undefined}>
                      <td className="who">
                        <span className="mono" style={{ color: "var(--gray)", fontWeight: 400 }}>
                          {fmtRowerNumber(p.rowerNumber)} ·{" "}
                        </span>
                        {p.name}
                      </td>
                      <td className="mono">{p.division}</td>
                      <td className="mono">{p.best5k || "—"}</td>
                      <td className="mono" style={{ color: "var(--gray)" }}>
                        {p.from ?? "—"}
                      </td>
                      <td className="ra-move mono">
                        {p.to} · {waveTime(race, p.to)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ----------------------------------------------------------- grid */}
      <div className="sec-head ra-sec">
        <h2>The grid</h2>
        <span className="mono">
          FIRST WAVE {waveTime(race, 1)} · EVERY {race.waveMinutes} MINUTES · {race.waveSize} ERGS
        </span>
      </div>
      <WaveGrid race={race} field={starters} />

      {/* ---------------------------------------------------------- field */}
      <div className="sec-head ra-sec">
        <h2>The field</h2>
        <span className="mono">
          {rows.length} {rows.length === 1 ? "RACER" : "RACERS"}
          {gone.length > 0 ? ` · ${gone.length} WITHDREW` : ""}
        </span>
      </div>
      <p className="ra-note">Change a wave here and it saves itself. A changed wave is told again.</p>
      <p className="ra-foot ra-swipe">SLIDE THE FIELD SIDEWAYS FOR THE WAVE PICKER.</p>
      {rows.length === 0 ? (
        <p className="board-empty">NOBODY HAS PUT THEIR NAME IN YET.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="board ra-t">
            <thead>
              <tr>
                <th>Rower</th>
                <th>Bracket</th>
                <th>Fastest 5k</th>
                <th>Waiver</th>
                <th>Wave</th>
                <th>Told</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.withdrewAt ? "ra-out" : undefined}>
                  <td className="who">
                    <span className="mono" style={{ color: "var(--gray)", fontWeight: 400 }}>
                      {fmtRowerNumber(r.rowerNumber)} ·{" "}
                    </span>
                    <Link href={`/row100k/r/${r.rowerNumber}`}>{r.name}</Link>
                    {r.note && (
                      <div className="mono" style={{ fontSize: 10, color: "var(--gray)", fontWeight: 400 }}>
                        {r.note}
                      </div>
                    )}
                  </td>
                  <td className="mono">{r.division}</td>
                  <td className="mono">
                    {r.best5k ? r.best5k.text : "—"}
                    {r.best5k?.prorated ? "*" : ""}
                  </td>
                  {/* The waiver is signed on the gym's system, so this is
                   * what the rower TOLD us — a chase list for the door, not
                   * a fact this site can check. */}
                  <td className="mono">
                    {r.waiverAt ? (
                      <span style={{ color: "var(--gray)" }}>SIGNED</span>
                    ) : (
                      <span style={{ color: "#b3400f", fontWeight: 700 }}>OWED</span>
                    )}
                  </td>
                  <td className="ra-w">
                    <select
                      className={`ra-pick${r.wave === null ? " open" : ""}`}
                      aria-label={`Wave for ${r.name}`}
                      value={r.wave === null ? "" : String(r.wave)}
                      disabled={busy !== null || !!r.withdrewAt}
                      onChange={(e) => void setWave(r, e.target.value)}
                    >
                      <option value="">— NO WAVE</option>
                      {picks.map((n) => (
                        <option key={n} value={String(n)}>
                          {n} · {waveTime(race, n)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="ra-tell mono">
                    {r.withdrewAt ? (
                      <span style={{ color: "var(--gray)" }}>WITHDREW</span>
                    ) : r.wave === null ? (
                      <span style={{ color: "var(--gray)" }}>—</span>
                    ) : r.waveEmailedAt ? (
                      <span style={{ color: "var(--gray)" }}>TOLD {stampDay(r.waveEmailedAt)}</span>
                    ) : (
                      <span style={{ color: "var(--water)", fontWeight: 700 }}>NOT TOLD</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {prorated && <p className="ra-foot">* PRORATED FROM A LONGER ROW — THE SAME RULE THE RECORDS PAGE USES.</p>}

      {/* ----------------------------------------------------- spectators */}
      <div className="sec-head ra-sec">
        <h2>The spectators</h2>
        <span className="mono">{liveWatchers.length} COMING TO WATCH</span>
      </div>
      <p className="ra-note">
        No wave, no erg, no wave note — they are not in the plan above and cannot be put in one. Here so you know how
        many bodies are going to be in the room.
      </p>
      {watchers.length === 0 ? (
        <p className="board-empty">NOBODY HAS SIGNED UP TO WATCH.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="board ra-t">
            <thead>
              <tr>
                <th>Rower</th>
                <th>Bracket</th>
                <th>Signed up</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {watchers.map((r) => (
                <tr key={r.id} className={r.withdrewAt ? "ra-out" : undefined}>
                  <td className="who">
                    <span className="mono" style={{ color: "var(--gray)", fontWeight: 400 }}>
                      {fmtRowerNumber(r.rowerNumber)} ·{" "}
                    </span>
                    <Link href={`/row100k/r/${r.rowerNumber}`}>{r.name}</Link>
                    {r.note && (
                      <div className="mono" style={{ fontSize: 10, color: "var(--gray)", fontWeight: 400 }}>
                        {r.note}
                      </div>
                    )}
                  </td>
                  <td className="mono">{r.division}</td>
                  <td className="mono">{stampDay(r.createdAt)}</td>
                  <td className="ra-tell mono">
                    <span style={{ color: "var(--gray)" }}>{r.withdrewAt ? "WITHDREW" : "WATCHING"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------------------------------------------------------- email */}
      <div className="sec-head ra-sec">
        <h2>Email the waves</h2>
        <span className="mono">
          {due} {due === 1 ? "NOTE" : "NOTES"} TO SEND
        </span>
      </div>
      <p className="ra-note">
        Goes to every <b>racer</b> who has a wave and has not been told <b>that</b> wave — never a spectator. The note
        carries their wave and when
        it goes off, the day, the place, the hours, the {race.meters.toLocaleString("en-US")} m, that it is free, and to
        arrive fifteen minutes early. Dry run lists them and sends nothing.
      </p>
      <div className="ra-act">
        <button
          type="button"
          className="outline-btn"
          disabled={busy !== null || due === 0}
          onClick={() => void runEmail(true)}
        >
          {busy === "email-dry" ? "…" : "Dry run"}
        </button>
        {confirm === "email" ? (
          <>
            <button type="button" className="send" disabled={busy !== null} onClick={() => void runEmail(false)}>
              {busy === "email" ? "…" : `Yes, send ${due}`}
            </button>
            <button type="button" className="outline-btn" disabled={busy !== null} onClick={() => setConfirm(null)}>
              Not yet
            </button>
          </>
        ) : (
          <button
            type="button"
            className="send"
            disabled={busy !== null || due === 0}
            onClick={() => setConfirm("email")}
          >
            {due === 0 ? "Everybody has been told" : `Email ${due} ${due === 1 ? "racer" : "racers"}`}
          </button>
        )}
      </div>
      {mail && (
        <>
          <p className="ra-note">
            {mail.dryRun ? "DRY RUN — NOTHING SENT. " : "SENT. "}
            {mail.due} DUE · {mail.sent} SENT{mail.failed > 0 ? ` · ${mail.failed} FAILED` : ""}
          </p>
          {mail.results.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table className="board ra-t">
                <thead>
                  <tr>
                    <th>Rower</th>
                    <th>Wave</th>
                    <th>Address</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {mail.results.map((m) => (
                    <tr key={m.id}>
                      <td className="who">
                        <span className="mono" style={{ color: "var(--gray)", fontWeight: 400 }}>
                          {fmtRowerNumber(m.rowerNumber)} ·{" "}
                        </span>
                        {m.name}
                      </td>
                      <td className="mono">
                        {m.wave} · {m.time}
                      </td>
                      <td className="mono" style={{ fontSize: 11 }}>
                        {m.email || "—"}
                      </td>
                      <td
                        className="mono"
                        style={{
                          fontSize: 11,
                          color: m.sent ? "var(--water)" : "var(--gray)",
                          fontWeight: m.sent ? 700 : 400,
                        }}
                      >
                        {m.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {ok && <p className="ra-ok">{ok}</p>}
      {error && <p className="form-err">{error}</p>}
    </div>
  );
}
