"use client";

import { useState } from "react";
import {
  FORMAT_LABEL,
  catWords,
  categoryLabel,
  categoryRank,
  hyresultEventUrl,
  hyresultResultUrl,
  hyresultUrl,
  isDebut,
  isNewPr,
  partnerSlots,
  prLabel,
  readCategory,
  shortDay,
  type Category,
  type Format,
  type HyroxEvent,
  type Partner,
} from "../../events";

/* THE BOARD (owner, 2026-10-13: "a public sign-up board ... I want to be
 * able to go on a page and see that my friends are running these doubles
 * on this day, or this person's running a singles on this day"; 10-15:
 * "here's who's running from Vegas that you might know, here's when
 * they're running, here's their debut, here's their PR time, and here's
 * links to see where they're at and their profile"). Every entry on the
 * event, by day, then by category, then by name. Each name is a link to
 * its page on hyresult (10-15, second pass: "if you click on the name
 * then it takes you to the hyresult page"); DEBUT sits in a yellow box
 * beside the names; PRO in an outlined box on the category (same day:
 * "highlight the pro on the board"; "the pro and debut tags should look
 * a little different"). The start time on the right with the PR under
 * it; once the race is run the finish in yellow, linked to the result,
 * with PR beside it when it beat the old one — the PR time itself goes
 * ("once they have a finish time we can remove their PR time"). Never a
 * count of earlier races: debuts only. Never the email. Over the board,
 * during and after the weekend, a chip to hyresult's event page — the
 * results, live.
 *
 * THE PICKS (owner, 2026-10-15: "on the board, we should be able to
 * select the dates and the events ... show me all of Men's Pro ... show
 * me all of doubles ... show me Friday, Saturday, Sunday"): a row of day
 * chips and a row of race chips — every format, and every category that
 * has someone on the board — and the board narrows to the pick. The page
 * hands it the rows and where the weekend stands; the picks live here. */

export type BoardRow = {
  id: string;
  name: string;
  instagram: string;
  format: string;
  division: string;
  gender: string;
  day: string;
  partners: Partner[];
  startTime: string;
  priorRaces: number | null;
  pr: string;
  finishTime: string;
  resultIdp: string;
};

export type Weekend = "before" | "live" | "after";

type DayPick = "all" | string;
/* "all", one format ("format:doubles"), or one category by its key
 * ("cat:singles/pro/men"). */
type RacePick = "all" | `format:${Format}` | `cat:${string}`;

const catKey = (c: Category) => `${c.format}/${c.division}/${c.gender}`;

function Handle({ h }: { h: string }) {
  return (
    <a href={`https://instagram.com/${h}`} target="_blank" rel="noopener noreferrer">
      @{h}
    </a>
  );
}

/* A name, linked to its hyresult page. */
export function NameLink({ n }: { n: string }) {
  return (
    <a href={hyresultUrl(n)} target="_blank" rel="noopener noreferrer" title={`${n} on hyresult`}>
      {n}
    </a>
  );
}

/* THE CATEGORY as a heading: MEN'S SINGLES with PRO (or ADAPTIVE) in an
 * outlined box; open says nothing. */
export function CategoryWords({ cat }: { cat: Category | null }) {
  const { words, tag } = catWords(cat);
  return (
    <>
      {words}
      {tag ? <i className="pro">{tag}</i> : null}
    </>
  );
}

/* THE NAMES, joined with an ampersand, TBD for a partner not yet named,
 * DEBUT boxed at the end of the line; the handles under. */
export function Names({ r }: { r: { name: string; instagram: string; format: string; division: string; gender: string; partners: Partner[]; priorRaces: number | null } }) {
  const cat = readCategory(r.format, r.division, r.gender);
  const slots = cat ? partnerSlots(cat.format) : 0;
  const names = [r.name, ...r.partners.map((p) => p.name)];
  const missing = Math.max(0, slots - r.partners.length);
  const handles = [r.instagram, ...r.partners.map((p) => p.instagram)].filter(Boolean);
  return (
    <div className="names">
      {names.map((n, i) => (
        <span key={i}>
          {i > 0 ? <span className="amp">&amp;</span> : null}
          <NameLink n={n} />
        </span>
      ))}
      {missing > 0 ? (
        <span className="tbd">
          <span className="amp">&amp;</span>
          {missing === 1 ? "TBD" : `${missing} TBD`}
        </span>
      ) : null}
      {isDebut(r) ? <b className="debut">Debut</b> : null}
      {handles.length > 0 ? (
        <small>
          {handles.map((h, i) => (
            <span key={h + i}>
              {i > 0 ? " · " : null}
              <Handle h={h} />
            </span>
          ))}
        </small>
      ) : null}
    </div>
  );
}

/* THE TIME, on the right: the finish once run (yellow, linked to the
 * result, PR beside it when it beat the old one), else the start time
 * with the PR under it. The time is the thing to scan for. */
export function Time({ r }: { r: BoardRow }) {
  if (r.finishTime) {
    return (
      <div className="start done">
        <span className="t">
          {r.resultIdp ? (
            <a href={hyresultResultUrl(r.resultIdp)} target="_blank" rel="noopener noreferrer">
              {r.finishTime}
            </a>
          ) : (
            r.finishTime
          )}
          {isNewPr(r) ? <b className="newpr">PR</b> : null}
        </span>
        <small>Finish</small>
      </div>
    );
  }
  const pr = prLabel(r);
  if (!r.startTime && !pr) return null;
  return (
    <div className="start">
      {r.startTime ? <span className="t">{r.startTime}</span> : null}
      {pr ? <small>{pr}</small> : null}
    </div>
  );
}

export function Board({ ev, rows, weekend }: { ev: HyroxEvent; rows: BoardRow[]; weekend: Weekend }) {
  const [day, setDay] = useState<DayPick>("all");
  const [race, setRace] = useState<RacePick>("all");

  const results =
    weekend === "before" ? null : (
      <div className="hx-board-links">
        <a className="hx-chip" href={hyresultEventUrl(ev)} target="_blank" rel="noopener noreferrer">
          {weekend === "live" ? "Live results →" : "Results →"}
        </a>
      </div>
    );

  if (rows.length === 0)
    return (
      <>
        {results}
        <p className="hx-empty">Nobody on the board yet. Be the first.</p>
      </>
    );

  /* The formats and the categories with someone on the board, in
   * rulebook order, for the chips. */
  const formats = new Set<Format>();
  const cats = new Map<string, { cat: Category; rank: number }>();
  for (const r of rows) {
    const cat = readCategory(r.format, r.division, r.gender);
    if (!cat) continue;
    formats.add(cat.format);
    cats.set(catKey(cat), { cat, rank: categoryRank(cat) });
  }
  const formatChips = (["singles", "doubles", "relay"] as Format[]).filter((f) => formats.has(f));
  const catChips = [...cats.values()].sort((a, b) => a.rank - b.rank).map((x) => x.cat);

  const keep = (r: BoardRow): boolean => {
    if (day !== "all" && r.day !== day) return false;
    if (race === "all") return true;
    const cat = readCategory(r.format, r.division, r.gender);
    if (!cat) return false;
    if (race.startsWith("format:")) return cat.format === race.slice("format:".length);
    return catKey(cat) === race.slice("cat:".length);
  };
  const shown = rows.filter(keep);
  const narrowed = day !== "all" || race !== "all";

  return (
    <>
      {results}
      {ev.days.length > 1 ? (
        <div className="hx-filter" role="group" aria-label="Day">
          <button type="button" aria-pressed={day === "all"} onClick={() => setDay("all")}>
            All days
          </button>
          {ev.days.map((d) => (
            <button key={d.date} type="button" aria-pressed={day === d.date} onClick={() => setDay(d.date)}>
              {d.dow}
            </button>
          ))}
        </div>
      ) : null}
      {formatChips.length > 0 ? (
        <div className="hx-filter" role="group" aria-label="Race">
          <button type="button" aria-pressed={race === "all"} onClick={() => setRace("all")}>
            All races
          </button>
          {formatChips.length > 1
            ? formatChips.map((f) => (
                <button key={f} type="button" aria-pressed={race === `format:${f}`} onClick={() => setRace(`format:${f}`)}>
                  {FORMAT_LABEL[f]}
                </button>
              ))
            : null}
          {catChips.map((c) => (
            <button key={catKey(c)} type="button" aria-pressed={race === `cat:${catKey(c)}`} onClick={() => setRace(`cat:${catKey(c)}`)}>
              {categoryLabel(c)}
            </button>
          ))}
        </div>
      ) : null}
      {narrowed ? (
        <p className="hx-filter-count">
          {shown.length} of {rows.length} {rows.length === 1 ? "entry" : "entries"}
        </p>
      ) : null}
      {shown.length === 0 ? <p className="hx-empty">Nobody on the board for that pick yet.</p> : null}

      {ev.days.map((d) => {
        const today = shown.filter((r) => r.day === d.date);
        if (today.length === 0) return null;
        /* Group by category in rulebook order; sort by name within. */
        const groups = new Map<string, { rank: number; cat: Category | null; rows: BoardRow[] }>();
        for (const r of today) {
          const cat = readCategory(r.format, r.division, r.gender);
          const key = cat ? catKey(cat) : "other";
          const g = groups.get(key) ?? { rank: cat ? categoryRank(cat) : 999, cat, rows: [] };
          g.rows.push(r);
          groups.set(key, g);
        }
        const ordered = [...groups.entries()].sort((a, b) => a[1].rank - b[1].rank);
        return (
          <div className="hx-day" key={d.date}>
            <div className="hx-day-head">
              <h3 className="disp">{shortDay(d)}</h3>
              <span>
                {today.length} {today.length === 1 ? "entry" : "entries"}
              </span>
            </div>
            {ordered.map(([key, g]) => (
              <div className="hx-cat" key={key}>
                <h4>
                  <CategoryWords cat={g.cat} />
                </h4>
                {g.rows
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((r) => (
                    <div className="hx-row" key={r.id}>
                      <Names r={r} />
                      <Time r={r} />
                    </div>
                  ))}
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
