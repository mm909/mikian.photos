"use client";

import { useMemo, useState } from "react";

import { ShareDialog } from "../ShareMenu";
import { RACE_TIME_CARD_IDS, type ShareData } from "../share/cards";

/* SHARE YOUR TIME (owner, 2026-10-01): the one personal thing on the
 * archive. The page marks nobody — no YOU, no highlighted row — so the
 * racer finds themself here instead: a button in the top right of the
 * ticket opens a short list of every finisher with their time, a box to
 * search it by name, and a pick opens the share dialog on the two looks of
 * the race time card (share/cards.ts RACE_TIME_CARD_IDS).
 *
 * A SIGNED-IN RACER SHARES THEIR OWN TIME AND NOBODY ELSE S (owner, later
 * the same night). When the viewer is on the sheet (`mine`), the button
 * opens the dialog straight on their card — no list, no search, no other
 * name reachable. Signed out, or signed in but not on the sheet, the
 * picker is what it was. That is the whole of what the session buys on
 * this page; `mine` is the one thing the page derives from it.
 *
 * A REAL BUTTON, not a line of type (owner: not an underlined text link).
 * The outline button the profile wears for its SHARE, re-cut white on the
 * ink ground (rrCss.ts .rr-act), with the share glyph in front of the word
 * — the tray and the arrow, drawn inline so it takes the button s colour.
 *
 * THE LIST IS IN FLOW, not a popover. It opens under the ticket s mono
 * line and the sheet moves down to make room, the way the wave pane does
 * under its cells; a floating panel over a results table is a second
 * surface on a page that is supposed to be one.
 *
 * THE PAYLOAD IS A RESULT AND NOTHING ELSE. Everything the card prints
 * arrives display-ready off the finished board (RaceResults builds the
 * rows: the time already floored, the split, the tag the sheet gave it);
 * meters and sessions are zero and `only` keeps the picker to the two
 * looks, the same guarantee the race day bill ships under. */

export type ShareRacer = {
  id: string;
  name: string;
  rowerNumber: number;
  /* "21:41" — floored, as the sheet prints it. */
  time: string;
  wave: number;
  /* "2:10" */
  split: string;
  tag: "PR" | "FIRST 5K" | null;
};

function ShareGlyph() {
  return (
    <svg className="rr-actg" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M8 10.5V1.5M4.75 4.75 8 1.5l3.25 3.25M5.5 6.5H2.5v8h11v-8h-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

export function ShareTime({
  racers,
  mine,
  race,
}: {
  /* Every finisher, in place order — the picker s list. Empty when `mine`
   * is set: a racer s control never holds anybody else s row. */
  racers: ShareRacer[];
  /* The signed-in viewer s own result when they are on the sheet; null
   * signed out or not a finisher. */
  mine: ShareRacer | null;
  race: { title: string; day: string };
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<ShareRacer | null>(null);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return racers;
    return racers.filter((r) => r.name.toLowerCase().includes(needle));
  }, [racers, q]);

  const data = useMemo<ShareData | null>(() => {
    if (!picked) return null;
    return {
      displayName: picked.name,
      rowerNumber: picked.rowerNumber,
      instagram: "",
      meters: 0,
      sessions: 0,
      byDay: {},
      race: {
        title: race.title,
        sub: "",
        when: race.day,
        where: "",
        mark: null,
        time: {
          time: picked.time,
          name: picked.name,
          wave: picked.wave,
          split: picked.split,
          day: race.day,
          tag: picked.tag,
        },
      },
    };
  }, [picked, race]);

  /* The picker exists only for a viewer with no time of their own on the
   * sheet; a racer s button goes straight to their card. */
  const picks = mine === null;

  /* Nobody finished and nobody to share: no control. */
  if (picks && racers.length === 0) return null;

  return (
    <>
      <button
        type="button"
        className="outline-btn rr-act"
        aria-haspopup={picks ? undefined : "dialog"}
        aria-expanded={picks ? open : undefined}
        onClick={() => (picks ? setOpen((o) => !o) : setPicked(mine))}
      >
        <ShareGlyph />
        Share your time
      </button>
      {picks && open && (
        <div className="rr-sharep">
          <label className="rr-sharef">
            <span>Name</span>
            <input
              className="rr-sharein"
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <ul className="rr-sharel">
            {shown.map((r) => (
              <li key={r.id}>
                <button type="button" className="rr-sharer" onClick={() => setPicked(r)}>
                  <span className="nm">{r.name}</span>
                  <span className="wv">Wave {r.wave}</span>
                  <span className="tm">{r.time}</span>
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="rr-sharenone">No racer by that name</li>}
          </ul>
        </div>
      )}
      {data && (
        <ShareDialog
          data={data}
          open={picked !== null}
          onClose={() => setPicked(null)}
          only={RACE_TIME_CARD_IDS}
        />
      )}
    </>
  );
}
