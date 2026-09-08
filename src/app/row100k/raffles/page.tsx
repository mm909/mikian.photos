import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { RAFFLES, rafflePhase } from "../raffles";
import { EMPTY_RAFFLE_STATE, raffleEntrants, raffleState, type Entrant, type RaffleState } from "../raffleData";
import { RaffleAdmin } from "./RaffleAdmin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Raffles — 100K September",
  robots: { index: false, follow: false },
};

/* Page-local styles — .rf-adm prefix, theme.ts untouched. Text child of a
 * style tag: no double quotes, angle brackets or apostrophes in here. */
const rfAdmCss = `
.row100k .rf-adm{margin-top:8px}
.row100k .rf-adm + .rf-adm{margin-top:34px}
.row100k .rf-adm-note{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.12em;color:var(--gray);text-transform:uppercase;margin:8px 0 0;line-height:1.7}
.row100k .rf-adm-note a{color:var(--ink);text-decoration:underline;text-underline-offset:3px}
.row100k .rf-adm-win{margin-top:22px;border:2px solid var(--ink);background:var(--ink);color:var(--paper);padding:16px 18px;box-shadow:4px 4px 0 var(--water)}
.row100k .rf-adm-win .k{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:rgba(244,243,238,.7)}
.row100k .rf-adm-win .n{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(22px,5.6vw,32px);text-transform:uppercase;line-height:1.05;margin-top:8px}
.row100k .rf-adm-win .n a{color:var(--paper);text-decoration:none}
.row100k .rf-adm-win .n a:hover{text-decoration:underline;text-underline-offset:4px}
.row100k .rf-adm-win .l{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(244,243,238,.7);margin-top:8px;line-height:1.8}
.row100k .rf-adm-ok{margin-top:14px;font-family:var(--row-mono),monospace;font-size:12px;color:var(--water);line-height:1.7}
.row100k .rf-adm .send{margin-top:22px;font-size:18px;padding:16px}
.row100k .rf-adm .act-row{margin-top:16px}
.row100k .rf-adm .sec-head{margin-top:34px}
.row100k .rf-adm table.board{margin-top:8px}
.row100k .rf-adm table.board td.adm{color:var(--gray);font-size:10px;letter-spacing:.1em}
`;

/* THE RAFFLES — admin only (owner, 2026-09-08: "give me a page to select
 * the winner for raffles that we set up"). One panel per raffle in
 * raffles.ts: where it stands on the clock, everyone in the hat with their
 * rows and meters, the DRAW button, the winner once drawn, and the switch
 * that puts the partner's second-chance link on the partners page. The
 * rest of the world gets a 404, the same gate as the other admin pages.
 * Real numbers always — this is the owner's ledger. */
export default async function RafflesPage() {
  const viewer = await resolveViewer();
  if (!viewer.actor || !viewer.isAdmin) notFound();

  const views = await Promise.all(
    RAFFLES.map(async (r) => {
      let state: RaffleState = EMPTY_RAFFLE_STATE(r.slug);
      let entrants: Entrant[] = [];
      let unreadable = false;
      try {
        [state, entrants] = await Promise.all([raffleState(r.slug), raffleEntrants(r)]);
      } catch (err) {
        console.error(`row100k/raffles: failed to load ${r.slug}`, err);
        unreadable = true;
      }
      return { raffle: r, phase: rafflePhase(r), state, entrants, unreadable };
    }),
  );

  const inProduction = process.env.NODE_ENV === "production";

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{rfAdmCss}</style>
      <RowBar {...barProps(viewer)} />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The raffles</h2>
            <span className="mono">
              ADMIN ONLY — {RAFFLES.length} {RAFFLES.length === 1 ? "RAFFLE" : "RAFFLES"} · ONE TICKET PER ROWER · ADMINS NEVER DRAWN
            </span>
          </div>

          {views.length === 0 && <p className="board-empty">NO RAFFLES SET UP — ADD ONE IN raffles.ts.</p>}

          {views.map((v) => (
            <RaffleAdmin
              key={v.raffle.slug}
              raffle={v.raffle}
              phase={v.phase}
              state={v.state}
              entrants={v.entrants}
              unreadable={v.unreadable}
              inProduction={inProduction}
            />
          ))}
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
