"use client";

import { useMemo, useState } from "react";

import { ShareDialog } from "../ShareMenu";
import { RACE_TIME_CARD_IDS, type ShareData } from "../share/cards";

/* SHARE YOUR TIME (owner, 2026-10-01): the one personal thing on the
 * archive. The page marks nobody — no YOU, no highlighted row — so the
 * racer finds themself here instead: a text control opens a short list of
 * every finisher with their time, a box to search it by name, and a pick
 * opens the share dialog on the three looks of the race time card
 * (share/cards.ts RACE_TIME_CARD_IDS). The signed-in racer, when there is
 * one, is first in the list before anybody types; that is the whole of
 * what the session buys on this page.
 *
 * THE LIST IS IN FLOW, not a popover. It opens under the control and the
 * sheet moves down to make room, the way the wave pane does under its
 * cells; a floating panel over a results table is a second surface on a
 * page that is supposed to be one.
 *
 * THE PAYLOAD IS A RESULT AND NOTHING ELSE. Everything the card prints
 * arrives display-ready off the finished board (RaceResults builds the
 * rows: the time already floored, the split, the tag the sheet gave it);
 * meters and sessions are zero and `only` keeps the picker to the three
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

export function ShareTime({
  racers,
  race,
}: {
  /* Every finisher, the signed-in one first when there is one. */
  racers: ShareRacer[];
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

  if (racers.length === 0) return null;

  return (
    <div className="rr-share">
      <button
        type="button"
        className="rr-act"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Share your time
      </button>
      {open && (
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
    </div>
  );
}
