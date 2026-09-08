import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { RowersTable, type AdminRower } from "../rowers/RowersTable";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rowers — 100K September",
  robots: { index: false, follow: false },
};

/* THE ROWERS — admin only. The signups roster and the moderation page,
 * condensed into one table (owner ask, 2026-09-08): every rower with their
 * meters rowed and sessions, a ... menu on the right end of the row, and
 * the rower's log opening inside the same table for fixing or removing
 * rows (rowers/RowersTable.tsx). The rest of the world gets a 404; the
 * boards are the public view of this data. /row100k/moderation redirects
 * here, carrying its ?r=<rowerNumber> so an old moderation link still
 * lands on that rower, open. Real numbers always — this is the truth
 * table, so the blackout (and the admin test blackout) never touches it. */

/* "Sep 4" — createdAt shifted minus 7 hours, the repo's Pacific convention
 * (the feed and dev stats stamp the same way), read back as UTC fields. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function joinedOn(createdAt: Date): string {
  const p = new Date(createdAt.getTime() - 7 * 3600_000);
  return `${MONTHS[p.getUTCMonth()]} ${p.getUTCDate()}`;
}

function parseNum(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 999999 ? n : null;
}

async function loadRowers(): Promise<AdminRower[]> {
  const [participants, entries] = await Promise.all([
    db.rowParticipant.findMany({
      where: { challenge: CHALLENGE },
      select: {
        id: true,
        userId: true,
        rowerNumber: true,
        displayName: true,
        instagram: true,
        division: true,
        createdAt: true,
      },
      orderBy: { rowerNumber: "asc" },
    }),
    db.rowEntry.findMany({
      where: { challenge: CHALLENGE },
      select: { id: true, participantId: true, day: true, meters: true, seconds: true, title: true },
      orderBy: [{ day: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  // The address behind the Google sign-in (RowParticipant.userId is the
  // Photographer id, no relation declared) — for the COPY EMAIL item.
  const users = await db.photographer.findMany({
    where: { id: { in: participants.map((p) => p.userId) } },
    select: { id: true, email: true },
  });
  const emailOf = new Map(users.map((u) => [u.id, u.email]));

  const rowsOf = new Map<string, AdminRower["rows"]>();
  for (const e of entries) {
    const list = rowsOf.get(e.participantId);
    const row = { id: e.id, day: e.day, meters: e.meters, seconds: e.seconds, title: e.title };
    if (list) list.push(row);
    else rowsOf.set(e.participantId, [row]);
  }

  return participants.map((p) => {
    const rows = rowsOf.get(p.id) ?? [];
    return {
      id: p.id,
      rowerNumber: p.rowerNumber,
      name: p.displayName,
      instagram: p.instagram,
      division: p.division,
      joined: joinedOn(p.createdAt),
      email: emailOf.get(p.userId) ?? null,
      meters: rows.reduce((s, r) => s + r.meters, 0),
      sessions: rows.length,
      seconds: rows.reduce((s, r) => s + r.seconds, 0),
      rows,
    };
  });
}

export default async function SignupsPage({ searchParams }: { searchParams?: { r?: string } }) {
  const viewer = await resolveViewer();
  if (!viewer.actor || !viewer.isAdmin) notFound();

  let rowers: AdminRower[] = [];
  let unreadable = false;
  try {
    rowers = await loadRowers();
  } catch (err) {
    console.error("row100k/signups: failed to load the rowers", err);
    unreadable = true;
  }

  const sessions = rowers.reduce((s, r) => s + r.sessions, 0);
  const meters = rowers.reduce((s, r) => s + r.meters, 0);
  const openNumber = parseNum(searchParams?.r);

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <RowBar {...barProps(viewer)} />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The rowers</h2>
            <span className="mono">
              ADMIN ONLY — {rowers.length} ROWERS · {sessions} SESSIONS · {Math.round(meters).toLocaleString("en-US")} M
            </span>
          </div>
          {unreadable ? (
            <p className="board-empty">THE ROSTER COULD NOT BE READ JUST NOW — RELOAD IN A MOMENT.</p>
          ) : (
            <RowersTable rowers={rowers} openNumber={openNumber} />
          )}
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
