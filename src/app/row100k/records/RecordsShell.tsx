"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ELITE_LABEL, digitCount, partialShape } from "@/lib/blackoutRules";
import { fmtDay, fmtMeters, fmtRecordTime, fmtSplit } from "@/lib/row100k";
import { BlockShape, Blocks } from "../Blackout";
import { Boards, Who, fold, rowMatches, type Tab } from "../Boards";
import { StatsShare } from "../StatsShare";
import { BOARD_CARD_IDS } from "../share/cards";
import { TextMenu } from "../TextMenu";
import { BoardFind } from "./BoardFind";
import { DIV_DEFS, RECORD_DEFS, divMatch, parseDiv, recordDef, type DivKey, type RecordDef, type RecordKey, type RecordRowLite } from "./defs";
import { LeadBlock } from "./LeadBlock";
import type { RecordsPayload } from "./recordsData";
import { recordsHref } from "./recordsUrl";

/* THE FULL RANKINGS, below the bar, as one client shell (owner,
 * 2026-09-25: "why is there a loading page between each click (category,
 * bracket, month)? There shouldn't be").
 *
 * The server renders this once with the record, the bracket and the
 * period the URL named (records/[record]/page.tsx → recordsData.ts). From
 * then on nothing navigates:
 *   - the CATEGORY word swaps between the five rankings already in hand;
 *   - the BRACKET word (All / Men's / Women's) is a filter over them;
 *   - the MONTH word fetches the period as JSON from
 *     /api/row100k/records?m= (the same builder, masked for this viewer
 *     the same way) and swaps it in, remembering every period seen so the
 *     way back is instant.
 * The URL follows with history.replaceState — the record key in the path,
 * ?d= and ?m= in the query (recordsUrl.ts spells it; the server reads it)
 * — so a reload or a shared link lands on the same view, and every soft
 * line keeps a real href for a middle click. The tap line
 * (NavProgress.tsx) never runs: no page is coming. Scroll never resets:
 * nothing here touches it. While a month is on its way the page dims a
 * touch (aria-busy) so the tap is seen to land; a fetch that fails falls
 * back to loading the page the old way rather than leaving the wrong
 * month on screen. The stats page's StatsShell.tsx is the model.
 *
 * THE HEAD is three words that are menus on one mono line — DECEMBER 2026
 * · TOTAL METERS · ALL (owner, 2026-09-25: "the five chips wrap into ugly
 * rows: condense them into a word menu next to the month word, the way
 * DECEMBER 2026 is a word; and if there is room, a third word for ALL /
 * MEN'S / WOMEN'S") — on every width; the bracket word drops to its own
 * line on a phone (recordsCss.ts). Under it the leader of the record for
 * the bracket and the period (LeadBlock.tsx), the pace on the holder line
 * so the block never changes height (owner, 2026-09-25: "the pace still
 * sits below the number, name and date — put it above them, or a better
 * place"), then FIND A ROWER over the table (BoardFind.tsx, every
 * category), the table, and one line to the stats page for the period.
 *
 * Blackout: every row here arrived masked from recordsData.ts. TOTAL
 * METERS is the board (Boards.tsx, its tiers, arrows and progress bars,
 * the elite in blocks by average split); the other four are flat
 * rankings where a hidden rower's meters draw as blocks and their times
 * print (owner, 2026-09-08). Nothing in here decides who is hidden. */

export function RecordsShell({
  initial,
  recordKey: key0,
  div0,
}: {
  initial: RecordsPayload;
  /* The URL segment, validated by the page. */
  recordKey: RecordKey;
  /* From ?d=, validated by the page. */
  div0: DivKey;
}) {
  const [data, setData] = useState<RecordsPayload>(initial);
  const [key, setKey] = useState<RecordKey>(key0);
  const [div, setDiv] = useState<DivKey>(div0);
  const [busy, setBusy] = useState(false);

  /* Every period seen this visit, by key — the way back is a swap. */
  const seen = useRef<Map<string, RecordsPayload>>(new Map([[initial.period.key, initial]]));
  /* The latest request wins; an older answer landing late is dropped. */
  const seq = useRef(0);

  const periodKey = data.period.key;
  const cur = data.currentMonthKey;

  const goPeriod = useCallback(
    async (pk: string) => {
      const my = ++seq.current;
      const had = seen.current.get(pk);
      if (had) {
        setData(had);
        return;
      }
      setBusy(true);
      try {
        const res = await fetch(`/api/row100k/records?m=${encodeURIComponent(pk)}`, {
          cache: "no-store",
          credentials: "same-origin",
          headers: { accept: "application/json" },
        });
        const json = (await res.json()) as { ok: boolean; data?: RecordsPayload; error?: string };
        if (!res.ok || !json.ok || !json.data) throw new Error(json.error ?? `HTTP ${res.status}`);
        if (my !== seq.current) return;
        seen.current.set(pk, json.data);
        setData(json.data);
      } catch (err) {
        console.error("row100k/records: could not swap the period in place", err);
        if (my !== seq.current) return;
        /* The old way: the page itself, at the address the pick meant. */
        window.location.assign(recordsHref({ key, d: div, m: pk }, cur));
      } finally {
        if (my === seq.current) setBusy(false);
      }
    },
    [key, div, cur],
  );

  /* THE URL FOLLOWS THE VIEW. replaceState, never push: a pick is not a
   * page, and the back button should leave the rankings altogether. Next
   * syncs its router to a replaceState (14.1+), so usePathname and
   * useSearchParams users see the change without a fetch. */
  useEffect(() => {
    const href = recordsHref({ key, d: div, m: periodKey }, cur);
    const now = window.location.pathname + window.location.search;
    if (now === href) return;
    try {
      window.history.replaceState(null, "", href);
    } catch {
      /* A browser that refuses is a browser that keeps the old address. */
    }
  }, [key, div, periodKey, cur]);

  const def = recordDef(key) ?? RECORD_DEFS[0];
  const href = (q: { key?: string; d?: string; m?: string }) => recordsHref({ key, d: div, m: periodKey, ...q }, cur);

  /* THE MONTH WORD — every month so far and all time, each a soft line:
   * a plain tap swaps the period in place, a middle click opens the page. */
  const monthWord = (
    <TextMenu
      options={data.periods.map((o) => ({ key: o.key, label: o.label, href: href({ m: o.key }), soft: true }))}
      value={periodKey}
      ariaLabel="Which month"
      onPick={(k) => {
        if (k !== periodKey) void goPeriod(k);
      }}
    />
  );

  /* THE CATEGORY WORD: the five rankings are already here, so this is a
   * swap. */
  const catWord = (
    <TextMenu
      options={RECORD_DEFS.map((d) => ({ key: d.key, label: d.title, href: href({ key: d.key }), soft: true }))}
      value={key}
      ariaLabel="Which record"
      onPick={(k) => setKey((recordDef(k) ?? RECORD_DEFS[0]).key)}
    />
  );

  /* THE BRACKET WORD: All / Men's / Women's, a filter over the rows. */
  const divWord = (
    <TextMenu
      options={DIV_DEFS.map((d) => ({ key: d.key, label: d.label, href: href({ d: d.key }), soft: true }))}
      value={div}
      ariaLabel="Which bracket"
      onPick={(k) => setDiv(parseDiv(k))}
    />
  );

  /* The ranking for the category and the bracket, places within it. */
  const rows = (data.records[key] ?? []).filter((r) => divMatch(div, r.division));
  const first = rows[0];

  /* THE LEADER: the first row of the ranking as it stands for this
   * bracket and period. TOTAL METERS while the elite are hidden has no
   * leader — the row at the top is the fastest hidden rower by split,
   * nobody's number one — so the block draws the longest hidden total in
   * blocks over LIGHTS OUT, exactly as the stats page does. The masking is
   * the row's own (recordsData.ts): a hidden meters value is a digit
   * count, a half-covered run-up total draws its tail as blocks, and a
   * time is public for everyone (owner, 2026-09-08). */
  const eliteRows = key === "total" ? rows.filter((r) => r.unranked) : [];
  const eliteDigits = eliteRows.reduce((n, r) => Math.max(n, r.digits ?? digitCount(r.value)), 1);
  const pace = first && def.dist ? fmtSplit(def.dist, first.value) : undefined;

  const tab = div.toUpperCase() as Tab;

  return (
    <div className="rec-shell rec-swap" aria-busy={busy || undefined}>
      <section>
        <div className="wrap">
          {/* THE HEAD: three words that are menus (owner, 2026-09-25). The
              first two never part; the bracket drops to its own line on a
              phone, its dot with it. */}
          <div className="rec-head">
            <h1 className="rec-period">
              <span className="rec-w">
                {monthWord}
                <span className="dot">·</span>
                {catWord}
              </span>
              <span className="rec-w rec-w2">
                <span className="dot">·</span>
                {divWord}
              </span>
            </h1>
          </div>

          {/* THE LEADER, the stats page's stat block (owner, 2026-09-24),
              the pace on the holder line (owner, 2026-09-25). */}
          {eliteRows.length > 0 ? (
            <LeadBlock
              value={
                <>
                  <Blocks digits={eliteDigits} /> <span className="u">m</span>
                </>
              }
              label={ELITE_LABEL}
            />
          ) : first ? (
            <LeadBlock
              value={<LiteVal r={first} def={def} unit="big" />}
              holder={{ rowerNumber: first.rowerNumber, name: first.name }}
              day={first.day}
              sessions={first.sessions}
              pace={pace}
              paceInline
            />
          ) : (
            <p className="board-empty rec-lead-empty">
              {data.unavailable
                ? "THE RECORDS COULD NOT BE READ JUST NOW — RELOAD IN A MOMENT."
                : data.started
                  ? "NOTHING ON THIS ONE YET."
                  : "THE START LIST IS FILLING — METERS SHOW UP HERE SEP 1."}
            </p>
          )}

          {/* Same line the board prints; an admin sees nothing hidden and
              is told so. The board says it on its own (Boards.tsx); the
              four flat rankings say it here — the meters ones that the
              elite are hidden, a time board that its times are shown. */}
          {key !== "total" && (data.blackout.active || data.anyHidden) && (
            <p className="bo-note rec-note">
              {data.anyHidden
                ? `${ELITE_LABEL}${def.kind === "time" ? " · TIMES ARE SHOWN" : ""}`
                : `${ELITE_LABEL} IS ON — YOU SEE EVERYTHING`}
            </p>
          )}

          {/* FIND A ROWER over every table (owner, 2026-09-25), then the
              table itself: the board on TOTAL METERS, a flat ranking on the
              other four. */}
          <BoardFind>
            {(q) =>
              key === "total" ? (
                <Boards
                  boards={data.board}
                  started={data.started}
                  blackout={data.blackout}
                  head={false}
                  tab={tab}
                  movement={data.movement}
                  query={q}
                  foot={false}
                />
              ) : (
                <FlatTable rows={rows} def={def} meId={data.meId} query={q} started={data.started} unavailable={data.unavailable} />
              )
            }
          </BoardFind>

          {/* The one line under every table: the stats page for the period
              (owner, 2026-09-25: "at the bottom of the board, have the
              callout be to the STATS page"). A real link: the stats page is
              a page. */}
          <a className="big-act stats-link" href={data.statsHref}>
            The stats →
          </a>

          {/* SHARE THE BOARD: the sticker, ten places to a card, under the
              board only — the flat rankings have no sticker. */}
          {key === "total" && data.share ? (
            <StatsShare community={data.share} prefer={BOARD_CARD_IDS[0]} only={BOARD_CARD_IDS} label="SHARE THE BOARD" />
          ) : null}
        </div>
      </section>
    </div>
  );
}

/* A record value: a time with tenths, or meters with its unit — small and
 * grey inside the headline, plain in a table cell. A hidden row draws
 * blocks for its digit count (the value itself is 0 by now); a total in
 * the run-up draws its covered tail as blocks (blackoutRules.partialShape,
 * the board's own treatment). A time is never masked (owner, 2026-09-08). */
function LiteVal({ r, def, unit }: { r: RecordRowLite; def: RecordDef; unit: "big" | "table" }) {
  if (def.kind === "time") return <>{fmtRecordTime(r.value)}</>;
  const num = r.masked ? (
    <Blocks digits={r.digits ?? digitCount(r.value)} />
  ) : r.hideLow ? (
    <BlockShape shape={partialShape(r.value, r.hideLow, r.digits)} label="partly hidden" />
  ) : unit === "big" ? (
    Math.round(r.value).toLocaleString("en-US")
  ) : (
    fmtMeters(r.value)
  );
  if (unit === "table") return r.masked || r.hideLow ? <>{num} m</> : <>{num}</>;
  return (
    <>
      {num} <span className="u">m</span>
    </>
  );
}

/* THE FLAT RANKING of a record other than TOTAL METERS: place, rower, the
 * time or the meters, the pace as its own column on a 5k or 10k (owner,
 * 2026-09-24: "remove the /500m on the time; just say their time and then
 * their pace"), and the day. The day column is for wide screens; on a
 * phone the day sits under the value in the same cell (recordsCss.ts), so
 * the name keeps its one line. The viewer's own row wears the tint the
 * stats boards use, so their place is findable on the full list (owner,
 * 2026-09-05: seeing where you are matters).
 *
 * FIND A ROWER narrows what is drawn, never what is counted: a row found
 * keeps the place it holds on the whole ranking. */
function FlatTable({
  rows,
  def,
  meId,
  query,
  started,
  unavailable,
}: {
  rows: RecordRowLite[];
  def: RecordDef;
  meId: string | null;
  query: string;
  started: boolean;
  unavailable: boolean;
}) {
  const q = fold(query);
  const finding = q !== "";
  const placed = rows.map((r, i) => ({ r, place: i + 1 }));
  const shown = finding ? placed.filter(({ r }) => rowMatches(r, q)) : placed;

  if (rows.length === 0) {
    return (
      <p className="board-empty">
        {unavailable
          ? "THE RECORDS COULD NOT BE READ JUST NOW — RELOAD IN A MOMENT."
          : started
            ? "NOTHING ON THIS ONE YET."
            : "THE START LIST IS FILLING — METERS SHOW UP HERE SEP 1."}
      </p>
    );
  }
  if (shown.length === 0) return <p className="board-empty">NOBODY ON THIS BOARD MATCHES.</p>;

  const dayOf = (r: RecordRowLite): ReactNode => (r.day ? fmtDay(r.day) : "");

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="board rec-flat">
        <thead>
          <tr>
            <th className="rk">#</th>
            <th>Rower</th>
            <th style={{ textAlign: "right" }}>{def.kind === "time" ? "Time" : "Meters"}</th>
            {def.dist ? <th style={{ textAlign: "right" }}>Pace</th> : null}
            <th className="rec-dcol" style={{ textAlign: "right" }}>
              Day
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map(({ r, place }) => (
            <tr key={r.participantId} className={r.participantId === meId ? "fin" : undefined}>
              <td className="rk">{place}</td>
              {/* Name and number only reach the browser for a hidden rower
                  (recordsData.ts), so the link is safe: the profile masks
                  the same way. */}
              <td className="wc">
                <Who row={{ name: r.name, rowerNumber: r.rowerNumber }} />
              </td>
              <td className="num">
                <LiteVal r={r} def={def} unit="table" />
                <span className="rec-dsub">{dayOf(r)}</span>
              </td>
              {def.dist ? <td className="num">{fmtSplit(def.dist, r.value)}</td> : null}
              <td className="num rec-dcol" style={{ color: "var(--gray)" }}>
                {dayOf(r)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
