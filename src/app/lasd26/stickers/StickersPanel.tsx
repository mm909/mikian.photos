"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { COURSE_URL, type CourseFile } from "../route/course";
import { StickerFrame, type Deck, type Painter } from "./StickerFrame";
import { LOOKS, jfCoastCard, jfDaysCard, jfLaSdCard, jfMarkCard, nsMarkCard, nsMilesCard, nsRaceCard, placeCard, xLockupCard, xRouteCard, type CardPainter, type Family, type Fonts, type Look } from "./paint";

/* THE STICKERS PAGE'S BODY (owner, 2026-10-21): three families — JUST
 * FRIENDS, NO SHORTCUTS, BOTH — each a row of cards, each card in the
 * family's four looks, as a STICKER at its own height, a STORY (1080 ×
 * 1920) or a POST (1080 × 1350), with share / copy / download and SHARE
 * ALL for the family. The route card draws the course from
 * public/lasd26/route/course.json, fetched once here. Nine cards: the
 * START, THE VAN IS FULL, THE CREW and DONE cards of the first cut are gone
 * (owner, same day: "Lets remove 'start' 'the van is full', the crew and
 * done stickers"). */

type Format = "sticker" | "story" | "post";
const FRAME: Record<Format, number | null> = { sticker: null, story: 1920, post: 1350 };

type Card = { id: string; label: string; paint: CardPainter };

const FAMILIES: { id: Family; label: string }[] = [
  { id: "jf", label: "Just Friends" },
  { id: "ns", label: "No Shortcuts" },
  { id: "x", label: "Both" },
];

export function StickersPanel() {
  const [course, setCourse] = useState<CourseFile | null>(null);
  const [family, setFamily] = useState<Family>("x");
  const [cardId, setCardId] = useState("x-lockup");
  const [format, setFormat] = useState<Format>("sticker");
  const [lookId, setLookId] = useState<string>(LOOKS.x[0].id);

  useEffect(() => {
    let on = true;
    fetch(COURSE_URL)
      .then((r) => (r.ok ? (r.json() as Promise<CourseFile>) : Promise.reject(new Error(String(r.status)))))
      .then((c) => {
        if (on) setCourse(c);
      })
      .catch(() => {
        /* the route card paints without the line */
      });
    return () => {
      on = false;
    };
  }, []);

  const cards = useMemo<Record<Family, Card[]>>(
    () => ({
      jf: [
        { id: "jf-mark", label: "The mark", paint: jfMarkCard },
        { id: "jf-coast", label: "Run it down the coast", paint: jfCoastCard },
        { id: "jf-lasd", label: "LA → SD", paint: jfLaSdCard },
        { id: "jf-days", label: "Days away", paint: jfDaysCard },
      ],
      ns: [
        { id: "ns-mark", label: "The mark", paint: nsMarkCard },
        { id: "ns-race", label: "The race", paint: nsRaceCard },
        { id: "ns-miles", label: "115 miles", paint: nsMilesCard },
      ],
      x: [
        { id: "x-lockup", label: "The lockup", paint: xLockupCard },
        { id: "x-route", label: "The route", paint: xRouteCard(course) },
      ],
    }),
    [course],
  );

  const looks = LOOKS[family];
  const look = looks.find((l) => l.id === lookId) ?? looks[0];
  const list = cards[family];
  const card = list.find((c) => c.id === cardId) ?? list[0];

  const pickFamily = (f: Family) => {
    setFamily(f);
    setCardId(cards[f][0].id);
    setLookId(LOOKS[f][0].id);
  };

  const paint = useCallback<Painter>((ctx, lk: Look, fonts: Fonts, draw) => placeCard(ctx, fonts, lk, draw, FRAME[format], card.paint), [card, format]);

  const deck = useCallback<Deck>(
    (_ctx, lk: Look, _fonts: Fonts) =>
      list.map((c) => ({
        name: `lasd26-${c.id}-${format}-${lk.id}.png`,
        paint: (ctx: CanvasRenderingContext2D, l: Look, f: Fonts, draw: boolean) => placeCard(ctx, f, l, draw, FRAME[format], c.paint),
      })),
    [list, format],
  );

  return (
    <StickerFrame
      paint={paint}
      filename={(lk) => `lasd26-${card.id}-${format}-${lk.id}.png`}
      label="LASD26 sticker"
      looks={looks}
      look={look}
      onLook={(l) => setLookId(l.id)}
      deck={deck}
      pickers={
        <>
          <div className="st-pick fam" role="group" aria-label="Whose">
            {FAMILIES.map((f) => (
              <button key={f.id} type="button" aria-pressed={family === f.id} onClick={() => pickFamily(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="st-pick" role="group" aria-label="Card">
            {list.map((c) => (
              <button key={c.id} type="button" aria-pressed={card.id === c.id} onClick={() => setCardId(c.id)}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="st-pick" role="group" aria-label="Size">
            {(["sticker", "story", "post"] as Format[]).map((f) => (
              <button key={f} type="button" aria-pressed={format === f} onClick={() => setFormat(f)}>
                {f}
              </button>
            ))}
          </div>
        </>
      }
    />
  );
}
