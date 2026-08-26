"use client";

import { Fragment, useState } from "react";
import {
  fmtMeters,
  fmtRowerNumber,
  tierFor,
  visibleTiers,
  type Boards as BoardData,
  type Tier,
  type TotalRow,
} from "@/lib/row100k";

export type Tab = "ALL" | "M" | "F";

export const TAB_LABEL: Record<Tab, string> = { ALL: "Everyone", M: "Men's", F: "Women's" };
export const TAB_WORD: Record<Tab, string> = { ALL: "everyone", M: "men", F: "women" };

/* Names link to the rower's profile page (their IG link lives there).
 * Takes anything row-shaped — total, record and weekly rows all qualify. */
export function Who({ row }: { row: { name: string; rowerNumber: number } }) {
  return (
    <span className="who">
      <span style={{ color: "var(--gray)", fontFamily: "var(--row-mono), monospace", fontWeight: 400 }}>
        {fmtRowerNumber(row.rowerNumber)} ·{" "}
      </span>
      <a href={`/row100k/r/${row.rowerNumber}`}>{row.name}</a>
    </span>
  );
}

function Movement({ delta }: { delta: number }) {
  if (!delta) return null;
  return delta > 0 ? (
    <span className="mv up" title={`Up ${delta} since the last logged day`}>
      ▲{delta}
    </span>
  ) : (
    <span className="mv dn" title={`Down ${-delta} since the last logged day`}>
      ▼{-delta}
    </span>
  );
}

/* Section titles for the tier ladder, rarity spelled out like item drops.
 * The 100k section keeps its club name — that's the one people chase. */
const TIER_TITLE: Record<Tier["key"], string> = {
  t10: "10k — common",
  t50: "50k — rare",
  t100: "The 100k club — epic",
  t250: "250k — legend",
};

/* THE BOARD on the main page: the community strip and the standings — total
 * meters, sectioned into rarity tiers (visibleTiers: every tier reached plus
 * the next locked one, highest first), with everyone under 10k warming up at
 * the bottom. Rank numbers stay global across sections. Everything deeper
 * (records, the weeks, the calendar, the curve) lives on /row100k/stats. */
export function Boards({ boards, started }: { boards: BoardData; started: boolean }) {
  const [tab, setTab] = useState<Tab>("ALL");
  const total = boards.total.filter((r) => tab === "ALL" || r.division === tab);

  const maxMeters = total.reduce((m, r) => Math.max(m, r.meters), 0);
  const sections = [...visibleTiers(maxMeters)].reverse(); // highest first
  const warming = total.filter((r) => tierFor(r.meters) === null);
  const rankOf = new Map(total.map((r, i) => [r.participantId, i + 1]));

  return (
    <div>
      <div className="comm">
        <div className="c">
          <div className="n">{boards.community.meters.toLocaleString("en-US")}</div>
          <div className="l">meters combined</div>
        </div>
        <div className="c">
          <div className="n">{boards.community.people}</div>
          <div className="l">rowers in</div>
        </div>
        <div className="c">
          <div className="n">{boards.community.sessions}</div>
          <div className="l">sessions</div>
        </div>
        <div className="c">
          <div className="n">{boards.community.finished}</div>
          <div className="l">finished 100k</div>
        </div>
      </div>

      <div className="tabs">
        {(["ALL", "M", "F"] as const).map((t) => (
          <button
            key={t}
            aria-pressed={tab === t}
            className={tab === t ? "on" : undefined}
            onClick={() => setTab(t)}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {total.length === 0 ? (
        <p className="board-empty">
          {started
            ? "NOBODY ON THIS BOARD YET — BE FIRST."
            : "THE START LIST IS FILLING — METERS SHOW UP HERE SEP 1."}
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="board">
            <thead>
              <tr>
                <th className="rk">#</th>
                <th>Rower</th>
                <th aria-label="Movement" />
                <th style={{ textAlign: "right" }}>Meters</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((t) => {
                const locked = maxMeters < t.meters;
                const members = total.filter((r) => tierFor(r.meters)?.key === t.key);
                return (
                  <Fragment key={t.key}>
                    <tr className={`divrow ${locked ? "locked" : t.rarity}`}>
                      <td colSpan={4}>{TIER_TITLE[t.key]}</td>
                    </tr>
                    {locked ? (
                      <tr className="lockrow">
                        <td colSpan={4}>
                          UNLOCKS AT {t.meters.toLocaleString("en-US")} M — NOBODY HERE YET
                        </td>
                      </tr>
                    ) : (
                      members.map((r) => (
                        <TotalRowTr
                          key={r.participantId}
                          r={r}
                          rank={rankOf.get(r.participantId) ?? 0}
                          tier={t}
                        />
                      ))
                    )}
                  </Fragment>
                );
              })}
              {warming.length > 0 && (
                <>
                  <tr className="divrow rest">
                    <td colSpan={4}>Warming up</td>
                  </tr>
                  {warming.map((r) => (
                    <TotalRowTr key={r.participantId} r={r} rank={rankOf.get(r.participantId) ?? 0} />
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      <a className="big-act stats-link" href="/row100k/stats">
        Records, the calendar &amp; the curve →
      </a>
    </div>
  );
}

function TotalRowTr({ r, rank, tier }: { r: TotalRow; rank: number; tier?: Tier }) {
  return (
    <tr className={tier ? `tier-${tier.rarity}` : undefined}>
      <td className="rk">{rank}</td>
      <td>
        <Who row={r} />
        {tier && <span className={`tierbadge ${tier.rarity}`}>{tier.label}</span>}
      </td>
      <td>
        <Movement delta={r.delta} />
      </td>
      <td className="num">
        {fmtMeters(r.meters)}
        <div className="rowbar" aria-hidden="true">
          <div className="f" style={{ width: `${Math.min(100, r.pct)}%` }} />
        </div>
      </td>
    </tr>
  );
}
