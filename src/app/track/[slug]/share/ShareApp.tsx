"use client";

import { useCallback, useMemo, useState } from "react";
import type { Snapshot } from "@/lib/tracker/types";
import { usePoll } from "../usePoll";
import { ShareFrame, type Deck } from "../../ShareFrame";
import { CARDS, FORMATS, FRAME, cardPainter, factsFromShell, factsOf, isAnimated, placeCard, stickerFile, type CardId, type Format, type Painter, type Shell } from "../../shareCards";

/* THE STICKERS PAGE, client side (owner, 2026-10-15: "these are stickers
 * to place on stories … try again"). Polls the snapshot every 15 s the way
 * the public page does (usePoll: paused while hidden, backing off on
 * errors, keeping the last good one), builds the facts from it, and hands
 * one card painter to the frame. Seven cards; THE MARK needs no snapshot,
 * so it is there from the first paint, the others unlock when the numbers
 * arrive, and FINISH is only offered once the crew is in. The picked card,
 * runner and size live here; the look lives in the frame.
 *
 * The painter rebuilds its facts on every paint, so the clocks carry the
 * seconds since the poll — that is what makes THE CLOCK tick. */

export function ShareApp({ shell, dev }: { shell: Shell; dev: boolean }) {
  const poll = usePoll<Snapshot>(`/api/track/${encodeURIComponent(shell.slug)}/snapshot`, { intervalMs: 15_000 });
  const snap = poll.data;
  /* For the pickers. */
  const facts = useMemo(() => (snap ? factsOf(snap) : factsFromShell(shell)), [snap, shell]);

  const [pickedCard, setPickedCard] = useState<CardId | null>(null);
  const [pickedRunner, setPickedRunner] = useState<string | null>(null);
  const [format, setFormat] = useState<Format>("sticker");

  /* The chips this moment offers: FINISH only once finished (owner: "what
   * is the finish supposed to be, 'not yet'?"). */
  const offered = CARDS.filter((c) => !c.finished || facts.finished);
  const offeredIds = new Set(offered.map((c) => c.id));

  /* Nothing picked yet: the card the moment calls for. */
  const defaultCard: CardId = !facts.hasData ? "mark" : facts.finished ? "finish" : facts.started ? "mile" : "mark";
  const card: CardId = pickedCard && offeredIds.has(pickedCard) && (facts.hasData || pickedCard === "mark") ? pickedCard : defaultCard;

  const runners = facts.participants;
  const runner =
    (pickedRunner && runners.some((r) => r.id === pickedRunner) ? pickedRunner : null) ??
    facts.onCourse[0]?.participant_id ??
    runners.find((r) => r.legs > 0)?.id ??
    runners[0]?.id ??
    null;

  const paint = useCallback<Painter>(
    (ctx, look, kit, draw, anim) => {
      const f = snap ? factsOf(snap) : factsFromShell(shell);
      return placeCard(ctx, look, kit, draw, FRAME[format], cardPainter(card, f, runner), anim);
    },
    [snap, shell, format, card, runner],
  );

  /* Every card the moment allows, in the look on screen, for SHARE ALL /
   * DOWNLOAD ALL. */
  const deck = useCallback<Deck>(
    (look) => {
      const f = snap ? factsOf(snap) : factsFromShell(shell);
      return CARDS.filter((c) => (f.hasData || !c.data) && (!c.finished || f.finished)).map((c) => ({
        name: stickerFile(shell.slug, c.id, format, look, "png"),
        paint: (ctx2, l, k, d) => placeCard(ctx2, l, k, d, FRAME[format], cardPainter(c.id, f, runner)),
      }));
    },
    [snap, shell, format, runner],
  );

  const liveHref = `/track/${encodeURIComponent(shell.slug)}`;

  return (
    <div className="shr">
      <header className="shr-head">
        <a className="shr-back" href={liveHref}>
          ← Live
        </a>
        <h1>Stickers</h1>
        {dev && <span className="shr-dev">dev</span>}
      </header>
      <p className="shr-sub mono">{shell.name}</p>

      {!facts.hasData &&
        (poll.loading ? (
          <p className="shr-wait">Loading the live numbers…</p>
        ) : (
          <p className="shr-wait is-off" role="status">
            The live numbers aren&rsquo;t loading{poll.error ? ` (${poll.error})` : ""} — retrying. The mark works without them.
          </p>
        ))}

      <ShareFrame
        paint={paint}
        deck={deck}
        basename={(look) => stickerFile(shell.slug, card, format, look)}
        label="Story sticker"
        animated={isAnimated(card)}
        animKey={`${card}-${format}`}
        pickers={
          <>
            <p className="shr-lab">Card</p>
            <div className="shr-pick cards" role="group" aria-label="Card">
              {offered.map((c) => (
                <button key={c.id} type="button" aria-pressed={card === c.id} disabled={c.data && !facts.hasData} onClick={() => setPickedCard(c.id)}>
                  {c.label}
                  {c.animated ? <span className="shr-anim" aria-label="animated" title="Animated" /> : null}
                </button>
              ))}
            </div>
            {card === "runner" && runners.length > 0 && (
              <label className="shr-runner">
                <span className="shr-lab">Runner</span>
                <select className="shr-sel" value={runner ?? ""} onChange={(e) => setPickedRunner(e.target.value || null)}>
                  {runners.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                      {r.on_course ? " · on course" : r.legs > 0 ? ` · ${r.legs} ${r.legs === 1 ? "leg" : "legs"}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="shr-lab">Size</p>
            <div className="shr-pick fmt" role="group" aria-label="Size">
              {FORMATS.map((f) => (
                <button key={f.id} type="button" aria-pressed={format === f.id} onClick={() => setFormat(f.id)}>
                  {f.label}
                  {f.id === "story" ? " 9:16" : f.id === "post" ? " 4:5" : ""}
                </button>
              ))}
            </div>
            <p className="shr-lab">Look</p>
          </>
        }
      />

      <p className="shr-note">
        The numbers refresh every 15 s while this page is open; a sticker is as of the last refresh, and the miles are about — the route is roughly 142 and the crew will run
        more or less of it. Clear is for pasting over a photo. Story is 1080 × 1920, post 1080 × 1350, sticker as tall as it needs. The clock and the mile move: save
        those as a video to post them moving.
      </p>
    </div>
  );
}
