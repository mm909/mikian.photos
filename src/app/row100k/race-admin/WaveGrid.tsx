"use client";

import { fmtRowerNumber } from "@/lib/row100k";
import { waveCount, waveTime, type RaceDef } from "../raceday";
import type { Racer } from "../racedayData";

/* THE SEED — quickest 5k first, a rower with no time at the back, rower
 * number to break a tie. The same order the route lays the waves out in
 * (api/row100k/raceday/waves), so what the console shows and what the
 * database holds cannot read differently. */
export function bySeed(a: Racer, b: Racer): number {
  const at = a.best5k ? a.best5k.seconds : Number.POSITIVE_INFINITY;
  const bt = b.best5k ? b.best5k.seconds : Number.POSITIVE_INFINITY;
  if (at !== bt) return at - bt;
  return a.rowerNumber - b.rowerNumber;
}

/* THE GRID — wave 1 when the first wave goes off, wave 2 race.waveMinutes
 * after it, who is in each and how full it is against the ergs on the floor
 * (race.waveSize). No clock time is typed here: the console can move the
 * first wave, so every time comes off the race this is handed (waveTime).
 * The rowers never see this (owner, 2026-09-10: "they do not need to know
 * when the wave starts") — it is the sheet the owner works off on the night
 * (the race is 6–9 PM: "6-9pm on the 27th"). Inside a wave the
 * order is the seed, so a card reads like a start list; a wave everybody in
 * it shares a bracket with says so in its head. */
export function WaveGrid({ race, field }: { race: RaceDef; field: Racer[] }) {
  const assigned = field.filter((r) => r.wave !== null);
  const waiting = field.filter((r) => r.wave === null).sort(bySeed);
  const last = assigned.reduce((n, r) => Math.max(n, r.wave ?? 0), 0);
  const waves = Math.max(last, assigned.length > 0 ? waveCount(race, assigned.length) : 0);
  const nums = Array.from({ length: waves }, (_, i) => i + 1);

  const bracketOf = (members: Racer[]) => {
    const keys = [...new Set(members.map((m) => m.division))];
    if (keys.length !== 1) return "";
    return race.brackets.find((b) => b.key === keys[0])?.label ?? "";
  };

  if (nums.length === 0 && waiting.length === 0) {
    return <p className="board-empty">NOBODY IN THE FIELD YET — THE GRID FILLS ITSELF ONCE NAMES COME IN.</p>;
  }

  return (
    <div className="ra-grid">
      {nums.map((n) => {
        const members = field.filter((r) => r.wave === n).sort(bySeed);
        const label = bracketOf(members);
        return (
          <div key={n} className={`ra-wave${members.length >= race.waveSize ? " full" : ""}`}>
            <div className="h">
              <span>
                Wave {n}
                {label ? ` · ${label}` : ""}
              </span>
              <span className="t">{waveTime(race, n)}</span>
            </div>
            <div className="f">
              {members.length}
              <span className="s"> / {race.waveSize}</span>
            </div>
            <ul>
              {members.length === 0 ? (
                <li>
                  <span className="d">EMPTY</span>
                </li>
              ) : (
                members.map((r) => (
                  <li key={r.id}>
                    <span className="w">
                      <span className="n">{fmtRowerNumber(r.rowerNumber)} </span>
                      {r.name}
                    </span>
                    <span className="q">{r.best5k ? r.best5k.text : "—"}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        );
      })}

      {waiting.length > 0 && (
        <div className="ra-wave open">
          <div className="h">
            <span>No wave yet</span>
            <span className="t">—</span>
          </div>
          <div className="f">
            {waiting.length}
            <span className="s"> WAITING</span>
          </div>
          <ul>
            {waiting.map((r) => (
              <li key={r.id}>
                <span className="w">
                  <span className="n">{fmtRowerNumber(r.rowerNumber)} </span>
                  {r.name}
                </span>
                <span className="q">{r.division}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
