"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ShareDialog } from "../ShareMenu";
import { CARDS, RACE_CARD_IDS, availableCards, type ShareData } from "../share/cards";
import type { RaceRole } from "../raceday";

/* THE SHARE LINK ON RACE DAY (owner, 2026-09-11: "There should be a
 * shareable for whenever you sign up for race day. showing that you've
 * signed up to race. And just a shareable with the event name and logo",
 * and then, looking at the live page on his phone while opted in: "There
 * should be a share link on this race day page").
 *
 * One button and one dialog, and the only thing on this page that knows how
 * the race cards are fed. Both entry points go through it — the rower's own
 * block in SignupPanel and the tear-off under the bill — so the two can
 * never drift on what a card is allowed to say.
 *
 * THE PICKER IS RESTRICTED, and that is not a style choice. The payload a
 * race day page can honestly build comes off a RowRaceSignup row: it knows
 * who is in the field and nothing whatever about their September. So meters,
 * sessions and the day map are zeroed here, and `only={RACE_CARD_IDS}` is
 * what keeps that from becoming a TOTAL card reading 0 METERS. The two ship
 * together; neither is safe without the other.
 *
 * AND A ROWER'S OTHER CARDS ARE NOT OFFERED HERE — deliberately. Reaching
 * them would mean this page also read the log, the record boards and the
 * blackout rules, which is the profile's whole job and a second copy of it;
 * the bar carries their number two taps away, and the deck is honest there.
 * What belongs here is the race.
 *
 * WHICH CARD YOU LAND ON is the first one this viewer can actually make.
 * CARDS orders the pool and puts the rower's own card ahead of the bill, so
 * somebody in the field opens on I'M RACING and a stranger opens on the
 * event. Read off the pool rather than named, so the rule lives in the
 * registry once. */

/* The race block as the page hands it over: display-ready, upper-cased, and
 * derived off the race AS IT STANDS the way the bill above is. `mine` is not
 * in it — that is the viewer's own half, and it is the one thing the server
 * render can be stale about the second somebody presses a button. */
export type RaceFacts = Omit<NonNullable<ShareData["race"]>, "mine">;

/* The cards this surface may open, taken off the registry rather than by
 * name. They both carry the house's PNG and both declare the same `prepare`,
 * so warming one warms the other. */
const RACE_CARDS = CARDS.filter((c) => RACE_CARD_IDS.includes(c.id));

export function RaceShare({
  facts,
  role = null,
  wave = null,
  rowerNumber = 0,
  label,
  btn = "outline-btn",
  openSignal = 0,
}: {
  facts: RaceFacts;
  /* What the viewer signed up as, or null for anybody not in the field —
   * which is what keeps the I'M RACING card out of a stranger's picker while
   * the event card stays in everybody's. */
  role?: RaceRole | null;
  /* A wave the rower has ALREADY BEEN TOLD ABOUT, or null. The caller owes
   * that distinction: see the note at the call site in SignupPanel. */
  wave?: number | null;
  /* Only ever the download filename and the usage ping — no race card prints
   * a number. 0 where there is no rower, the way the community cards ride. */
  rowerNumber?: number;
  label: string;
  btn?: string;
  /* A counter the parent bumps to pop the dialog open by itself (the profile
   * does this the moment a row is logged; here it is the moment somebody
   * opts in). Anything non-zero and unseen opens it — including on the first
   * render, because the block that holds this button does not exist until
   * the act that pops it has already succeeded. */
  openSignal?: number;
}) {
  const [open, setOpen] = useState(false);
  /* The house mark has landed. Nothing on a card reads this; see the memo. */
  const [markReady, setMarkReady] = useState(false);

  const payload = useMemo<ShareData>(
    () => ({
      /* THE ZEROES. Every one of these is a field no card in RACE_CARD_IDS
       * so much as looks at — the race cards carry no name, no number and no
       * meters — and `only` is what guarantees nothing else can be reached
       * to print them. */
      displayName: "",
      rowerNumber,
      instagram: "",
      meters: 0,
      sessions: 0,
      byDay: {},
      race: { ...facts, mine: role ? { role, wave } : null },
    }),
    [facts, role, wave, rowerNumber],
  );

  /* WARM THE HOUSE MARK ON MOUNT, not on the press. The PNG is the same
   * same-origin file the bill above has already rendered, so this is a cache
   * hit that costs nothing — and it means the FIRST paint a rower sees,
   * thirty seconds after opting in, has the gym's logo on it rather than the
   * card's type fallback. card.prepare is the uncapped wait (cards.ts keeps
   * the deadline in prepareCard, for callers that paint on a clock); it
   * always settles, a 404 included, so nothing here can hang. */
  useEffect(() => {
    if (!payload.race?.mark) return;
    let live = true;
    void Promise.all(RACE_CARDS.map((c) => c.prepare?.(payload) ?? Promise.resolve())).then(() => {
      if (live) setMarkReady(true);
    });
    return () => {
      live = false;
    };
  }, [payload]);

  /* THE REPAINT, for the one case the warm loses: a mark that arrives after
   * the dialog is already up. ShareDialog paints when `data` changes
   * identity and on nothing else, so the arrival is published as a new
   * object rather than as a new fact — the card reads the flag nowhere, it
   * re-reads the image, which readyRaceMark now hands over. */
  const data = useMemo<ShareData>(
    () => ({ ...payload }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payload, markReady],
  );

  /* The pool this viewer's picker will actually hold, in CARDS order. */
  const pool = useMemo(
    () => availableCards(data).filter((c) => RACE_CARD_IDS.includes(c.id)),
    [data],
  );

  const seen = useRef(0);
  useEffect(() => {
    if (openSignal === 0 || openSignal === seen.current) return;
    seen.current = openSignal;
    setOpen(true);
  }, [openSignal]);

  return (
    <>
      <button
        type="button"
        className={btn}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      <ShareDialog
        data={data}
        open={open}
        onClose={() => setOpen(false)}
        preferredCardId={pool[0]?.id}
        only={RACE_CARD_IDS}
      />
    </>
  );
}
