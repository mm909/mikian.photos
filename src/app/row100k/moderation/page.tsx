import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CHALLENGE, fmtMeters, fmtRowerNumber } from "@/lib/row100k";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { boardDataRaw, EMPTY_BOARDS } from "../boardData";
import { resolvePhotoMedia } from "../photoUrls";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { ModerationTools, type ModeratedRower } from "./ModerationTools";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Moderation — 100K September",
  robots: { index: false, follow: false },
};

/* Admin-only: pick a rower, fix or delete their rows, remove them. Off the
 * profile page and onto its own (owner call, 2026-09-05). The rest of the
 * world gets a 404, same gate as /row100k/signups. The picked rower rides
 * in ?r=<rowerNumber> so a moderation link can be shared between admins. */

function parseNum(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 999999 ? n : null;
}

/* The picked rower's row and log — the same query the profile page runs,
 * so the ledger here is the ledger there. */
async function loadRower(num: number) {
  const participant = await db.rowParticipant.findUnique({
    where: { challenge_rowerNumber: { challenge: CHALLENGE, rowerNumber: num } },
    select: { id: true, rowerNumber: true, displayName: true, instagram: true, division: true },
  });
  if (!participant) return null;
  const entries = await db.rowEntry.findMany({
    where: { participantId: participant.id },
    select: {
      id: true,
      participantId: true,
      day: true,
      meters: true,
      seconds: true,
      title: true,
      photos: true,
    },
    orderBy: [{ day: "asc" }, { createdAt: "asc" }],
  });
  return { participant, entries };
}

export default async function ModerationPage({ searchParams }: { searchParams?: { r?: string } }) {
  const viewer = await resolveViewer();
  if (!viewer.actor || !viewer.isAdmin) notFound();

  // The roster comes off the raw board — the truth, never the masked view:
  // this page is admin-only by construction, and the board already carries
  // meters and sessions for everyone who has joined, logged or not.
  let boards = EMPTY_BOARDS;
  try {
    boards = await boardDataRaw();
  } catch (err) {
    console.error("row100k/moderation: failed to load the roster", err);
  }
  const roster = boards.total.slice().sort((a, b) => a.rowerNumber - b.rowerNumber);

  const num = parseNum(searchParams?.r);
  const picked = num ? await loadRower(num).catch(() => null) : null;

  let rower: ModeratedRower | null = null;
  let rows: Parameters<typeof ModerationTools>[0]["rows"] = [];
  if (picked) {
    const { participant: p, entries } = picked;
    rower = { id: p.id, rowerNumber: p.rowerNumber, name: p.displayName };
    // MyRow wants BOTH shapes: {full, thumb} pairs for the ledger squares
    // and the lightbox, the plain full-URL list for the editor's Current
    // strip (same build as the profile page).
    const photoMediaLists = await Promise.all(entries.map((e) => resolvePhotoMedia(e.photos)));
    rows = entries
      .map((e, i) => ({
        ...e,
        photos: photoMediaLists[i],
        photoUrls: photoMediaLists[i].map((m) => m.full),
      }))
      .reverse();
  }

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>

      <RowBar {...barProps(viewer)} />

      <section>
        <div className="wrap">
          {rower ? (
            <ModerationTools rower={rower} rows={rows} />
          ) : (
            <div className="sec-head">
              <h2>Moderation</h2>
              <span className="mono">
                {num ? `NO ROWER ${fmtRowerNumber(num)} — PICK ONE BELOW` : "ADMIN ONLY — PICK A ROWER"}
              </span>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The roster</h2>
            <span className="mono">ADMIN ONLY — {roster.length} ROWERS, NUMBER ORDER</span>
          </div>
          {roster.length === 0 ? (
            <p className="board-empty">NOBODY HAS SIGNED UP YET.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="board mod-pick">
                <thead>
                  <tr>
                    <th className="rk">#</th>
                    <th>Rower</th>
                    <th>Board</th>
                    <th style={{ textAlign: "right" }}>Meters</th>
                    <th style={{ textAlign: "right" }}>Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((r) => (
                    <tr key={r.participantId} className={r.rowerNumber === num ? "fin" : undefined}>
                      <td className="rk">{fmtRowerNumber(r.rowerNumber)}</td>
                      <td className="who">
                        <a href={`/row100k/moderation?r=${r.rowerNumber}`}>{r.name}</a>
                      </td>
                      <td>{r.division === "F" ? "W" : r.division}</td>
                      <td className="num">{fmtMeters(r.meters)}</td>
                      <td className="num" style={{ color: "var(--gray)" }}>
                        {r.sessions}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
