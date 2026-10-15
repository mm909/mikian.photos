"use client";

import { useCallback, useMemo, useState } from "react";
import type { Snapshot } from "@/lib/tracker/types";
import { usePoll } from "../usePoll";
import { ShareFrame, type Deck } from "../../ShareFrame";
import { CARDS, FORMATS, FRAME, cardPainter, factsFromShell, factsOf, placeCard, stickerFile, type CardId, type Format, type Painter, type Shell } from "../../shareCards";

/* THE STICKERS PAGE, client side (owner, 2026-10-15: "create several and
 * we can remove the ones we don't like … the goal is that we paste these
 * onto the story"). Polls the snapshot every 15 s the way the public page
 * does (usePoll: paused while hidden, backing off on errors, keeping the
 * last good one), builds the facts from it, and hands one card painter to
 * the frame. Eight cards in the owner's order; THE MARK needs no snapshot,
 * so it is there from the first paint and the others unlock when the
 * numbers arrive. The picked card, runner and size live here; the look
 * lives in the frame. */

export function ShareApp({ shell, dev }: { shell: Shell; dev: boolean }) {
  const poll = usePoll<Snapshot>(`/api/track/${encodeURIComponent(shell.slug)}/snapshot`, { intervalMs: 15_000 });
  const snap = poll.data;
  /* For the pickers. The painter rebuilds its own facts per paint so the
   * clocks carry the seconds since the poll. */
  const facts = useMemo(() => (snap ? factsOf(snap) : factsFromShell(shell)), [snap, shell]);

  const [pickedCard, setPickedCard] = useState<CardId | null>(null);
  const [pickedRunner, setPickedRunner] = useState<string | null>(null);
  const [format, setFormat] = useState<Format>("sticker");

  /* Nothing picked yet: the card the moment calls for. */
  const defaultCard: CardId = !facts.hasData ? "mark" : facts.finished ? "finish" : facts.started ? "miles" : "mark";
  const card: CardId = pickedCard && (facts.hasData || pickedCard === "mark") ? pickedCard : defaultCard;

  const runners = facts.participants;
  const runner =
    (pickedRunner && runners.some((r) => r.id === pickedRunner) ? pickedRunner : null) ??
    facts.onCourse[0]?.participant_id ??
    runners.find((r) => r.legs > 0)?.id ??
    runners[0]?.id ??
    null;

  const paint = useCallback<Painter>(
    (ctx, look, kit, draw) => {
      const f = snap ? factsOf(snap) : factsFromShell(shell);
      return placeCard(ctx, look, kit, draw, FRAME[format], cardPainter(card, f, runner));
    },
    [snap, shell, format, card, runner],
  );

  /* Every card the moment allows, in the look on screen, for SHARE ALL /
   * DOWNLOAD ALL. */
  const deck = useCallback<Deck>(
    (_ctx, look) => {
      const f = snap ? factsOf(snap) : factsFromShell(shell);
      return CARDS.filter((c) => f.hasData || !c.data).map((c) => ({
        name: stickerFile(shell.slug, c.id, format, look),
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
        filename={(look) => stickerFile(shell.slug, card, format, look)}
        label="Story sticker"
        pickers={
          <>
            <p className="shr-lab">Card</p>
            <div className="shr-pick cards" role="group" aria-label="Card">
              {CARDS.map((c) => (
                <button key={c.id} type="button" aria-pressed={card === c.id} disabled={c.data && !facts.hasData} onClick={() => setPickedCard(c.id)}>
                  {c.label}
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
        The numbers refresh every 15 s while this page is open; a sticker is as of the last refresh. Clear is for pasting over a photo. Story is 1080 × 1920, post 1080 × 1350,
        sticker as tall as it needs.
      </p>
    </div>
  );
}
