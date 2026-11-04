"use client";

import { useState } from "react";
import { ShareDialog } from "../ShareMenu";
import { DAILY_CARD_IDS, type DailyShare, type ShareData } from "../share/cards";

/* THE DAILY on the poster page (owner, 2026-11-04: "I want a really easy
 * cut and paste way to add stats to my daily video ... Put them inside the
 * poster shareable menu"). The site's share dialog, held to the daily
 * stickers (share/cards.ts DAILY_CARD_IDS): the men's and women's boards,
 * and who rowed today and yesterday. COPY IMAGE on a phone is the cut and
 * paste. An admin's section; the page reads the payload for nobody else.
 *
 * The personal fields are stand-ins — every card the `only` list allows
 * draws from `daily` alone. */

const OPENERS: { label: string; prefer: string }[] = [
  { label: "The board", prefer: "rowtember-daily-board-m" },
  { label: "Rowed today", prefer: "rowtember-daily-today-1" },
];

export function DailyStickers({ daily }: { daily: DailyShare | null }) {
  const [open, setOpen] = useState(false);
  const [prefer, setPrefer] = useState<string | undefined>(undefined);

  const data: ShareData = {
    displayName: "EVERYONE",
    rowerNumber: 0,
    instagram: "",
    meters: 0,
    sessions: 0,
    byDay: {},
    month: null,
    ...(daily ? { daily } : {}),
  };
  const today = daily?.days.find((d) => d.key === "today");

  return (
    <section className="po-daily">
      <div className="wrap">
        <div className="sec-head">
          <h2>The daily</h2>
          <span className="mono">STICKERS FOR THE VIDEO · ADMIN</span>
        </div>
        {daily ? (
          <>
            <p className="po-eye">
              {today && today.rows.length > 0
                ? `${today.asOf} · ${today.rows.length} ${today.rows.length === 1 ? "ROWER" : "ROWERS"} SO FAR TODAY`
                : "NOBODY HAS LOGGED TODAY YET · YESTERDAY IS IN THE MENU"}
            </p>
            <div className="po-acts">
              {OPENERS.map((o) => (
                <button
                  key={o.prefer}
                  type="button"
                  className="po-btn"
                  onClick={() => {
                    setPrefer(o.prefer);
                    setOpen(true);
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <ShareDialog
              data={data}
              open={open}
              onClose={() => setOpen(false)}
              preferredCardId={prefer}
              only={DAILY_CARD_IDS}
            />
          </>
        ) : (
          <p className="po-eye">THE BOARD COULD NOT BE READ · TRY AGAIN IN A MINUTE</p>
        )}
      </div>
    </section>
  );
}
