"use client";

import { useEffect, useMemo, useState } from "react";
import { ShareDialog } from "../ShareMenu";
import { CARDS, RACE_CARD_IDS, type ShareData } from "../share/cards";

/* THE SHARE LINK ON RACE DAY (owner, 2026-09-11: "There should be a
 * shareable for whenever you sign up for race day. showing that you've
 * signed up to race. And just a shareable with the event name and logo",
 * and then, looking at the live page on his phone while opted in: "There
 * should be a share link on this race day page").
 *
 * One button and one dialog, and the only thing on this page that knows how
 * the race card is fed. Both entry points go through it — the rower's own
 * block in SignupPanel and the tear-off under the bill — so the two can
 * never drift on what a card is allowed to say.
 *
 * IT HANDS OVER THE EVENT AND NOTHING ELSE, since the owner kept one of the
 * two cards: "I do not like the I am racing sticker. I just like the race
 * day sticker." The card that claimed something about the VIEWER is gone,
 * so this component stopped asking who the viewer is — there was a `role`
 * and a `wave` here, threaded down from SignupPanel under a careful rule
 * about only ever passing a wave the rower had already been TOLD about, and
 * with no card left to print either of them the rule and the props went
 * together. A prop nobody prints is a promise nobody keeps.
 *
 * AND THE DIALOG NO LONGER POPS ITSELF. It used to open on its own the
 * second somebody opted in, the way the profile pops one the second a row
 * is logged — earned, because the card being made at that moment was that
 * person's own claim, made at the moment they made it. The bill is not
 * about them: it is the same picture before they opt in and after, it is
 * already on the page as the tear-off strip under the act, and throwing it
 * up unasked would be a jack-in-the-box holding a poster. The button stays
 * in their block; pressing it is now the whole act.
 *
 * THE PICKER IS RESTRICTED, and that is not a style choice. The payload a
 * race day page can honestly build comes off a RowRaceSignup row: it knows
 * who is in the field and nothing whatever about their September. So meters,
 * sessions and the day map are zeroed here, and `only={RACE_CARD_IDS}` is
 * what keeps that from becoming a TOTAL card reading 0 METERS. The two ship
 * together; neither is safe without the other — and it held while the list
 * held ONE card, because it is the LIST and not the count that guards it.
 * There are two in it since 2026-09-12 (the bill, and the same day with the
 * facts stripped off it), which brings the chip row back: ShareDialog draws
 * no picker under two cards, so this dialog was the card and the buttons for
 * as long as race day had one sticker.
 *
 * AND A ROWER'S OTHER CARDS ARE NOT OFFERED HERE — deliberately. Reaching
 * them would mean this page also read the log, the record boards and the
 * blackout rules, which is the profile's whole job and a second copy of it;
 * the bar carries their number two taps away, and the deck is honest there.
 * What belongs here is the race. */

/* The race block as the page hands it over: display-ready, upper-cased, and
 * derived off the race AS IT STANDS the way the bill above is. It used to
 * be this type MINUS `mine`, the viewer's own half; there is no `mine` on a
 * race payload any more, so the two are the same thing again. */
export type RaceFacts = NonNullable<ShareData["race"]>;

/* The cards this surface may open — two since 2026-09-12, the bill and the
 * name alone — taken off the registry rather than by name, so warming them
 * here and drawing them there cannot drift. */
const RACE_CARDS = CARDS.filter((c) => RACE_CARD_IDS.includes(c.id));

export function RaceShare({
  facts,
  rowerNumber = 0,
  label,
  btn = "outline-btn",
}: {
  facts: RaceFacts;
  /* Only ever the download filename and the usage ping — the card prints no
   * number. 0 where there is no rower, the way the community cards ride. */
  rowerNumber?: number;
  label: string;
  btn?: string;
}) {
  const [open, setOpen] = useState(false);
  /* The house mark has landed. Nothing on the card reads this; see the memo. */
  const [markReady, setMarkReady] = useState(false);

  const payload = useMemo<ShareData>(
    () => ({
      /* THE ZEROES. Every one of these is a field no card in RACE_CARD_IDS
       * so much as looks at — the bill carries no name, no number and no
       * meters — and `only` is what guarantees nothing else can be reached
       * to print them. */
      displayName: "",
      rowerNumber,
      instagram: "",
      meters: 0,
      sessions: 0,
      byDay: {},
      race: facts,
    }),
    [facts, rowerNumber],
  );

  /* WARM THE HOUSE MARK ON MOUNT, not on the press. The PNG is the same
   * same-origin file the bill above has already rendered, so this is a cache
   * hit that costs nothing — and it means the FIRST paint a rower sees has
   * the gym's logo on it rather than the card's type fallback. card.prepare
   * is the uncapped wait (cards.ts keeps the deadline in prepareCard, for
   * callers that paint on a clock); it always settles, a 404 included, so
   * nothing here can hang. */
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
      {/* No preferredCardId: ShareDialog opens on the first card of the pool
        * and CARDS orders the bill above the name, so this still opens on the
        * bill — the picture already printed down the page, and the one a
        * stranger can act on. Stripping it back is a chip away. */}
      <ShareDialog data={data} open={open} onClose={() => setOpen(false)} only={RACE_CARD_IDS} />
    </>
  );
}
