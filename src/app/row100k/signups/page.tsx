import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CHALLENGE, ageOn, birthdayInput, nowMs, pacificDay } from "@/lib/row100k";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { RowersTable, type AdminAbout, type AdminRower } from "../rowers/RowersTable";
import { rowersCss } from "../rowers/rowersCss";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rowers — Rowtember",
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
 * table, so the blackout (and the admin test blackout) never touches it.
 * Two CSV links on the head line (owner, 2026-09-16: "download data to a
 * csv") — /api/row100k/export, admin only there too — and a third, the
 * whole field as JSON for a model (kind=llm, row100k/llmExport.ts).
 * DETAILS per rower (owner, 2026-09-30: "a summary on the rowers panel, I
 * can see more of their details, if they've entered their height and
 * weight"): the About you columns are read here, guarded (readAbout), and
 * the table prints them under the row (rowers/rowersCss.ts styles it). */

/* Page-local styles — .sg- prefix, the blackout page idiom: no double
 * quotes, no angle brackets and no apostrophes anywhere in the string. The
 * download links sit on the right of the head line, small. */
const sgCss = `
.row100k .sg-dl{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap;align-self:center}
.row100k .sg-dl .outline-btn{display:inline-block;padding:5px 10px;font-size:10px;line-height:1.4;text-decoration:none;white-space:nowrap}
`;

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

/* ABOUT YOU for the details block, read in its own query and CAUGHT the
 * way settings/page.tsx reads it: if those columns cannot be read — P2022
 * or anything else — every rower gets about: null (the block prints
 * dashes) and the rest of the table stands. The age is whole years on the
 * challenge clock, computed here so the client never does date math. */
async function readAbout(): Promise<Map<string, AdminAbout> | null> {
  try {
    const rows = await db.rowParticipant.findMany({
      where: { challenge: CHALLENGE },
      select: { id: true, birthday: true, heightCm: true, weightKg: true, homeGym: true },
    });
    const at = nowMs();
    return new Map(
      rows.map((r) => [
        r.id,
        {
          birthday: birthdayInput(r.birthday),
          age: r.birthday ? ageOn(r.birthday, at) : null,
          heightCm: r.heightCm,
          weightKg: r.weightKg,
          homeGym: r.homeGym ?? "",
        },
      ]),
    );
  } catch (err) {
    console.error("row100k/signups: the About you columns could not be read (not pushed yet?)", err);
    return null;
  }
}

async function loadRowers(): Promise<AdminRower[]> {
  const [participants, entries, aboutOf] = await Promise.all([
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
    readAbout(),
  ]);

  // The address and the name behind the Google sign-in
  // (RowParticipant.userId is the Photographer id, no relation declared)
  // — for the COPY EMAIL item and the details block.
  const users = await db.photographer.findMany({
    where: { id: { in: participants.map((p) => p.userId) } },
    select: { id: true, email: true, name: true },
  });
  const userOf = new Map(users.map((u) => [u.id, u]));

  const rowsOf = new Map<string, AdminRower["rows"]>();
  for (const e of entries) {
    const list = rowsOf.get(e.participantId);
    const row = { id: e.id, day: e.day, meters: e.meters, seconds: e.seconds, title: e.title };
    if (list) list.push(row);
    else rowsOf.set(e.participantId, [row]);
  }

  return participants.map((p) => {
    const rows = rowsOf.get(p.id) ?? [];
    const user = userOf.get(p.userId);
    return {
      id: p.id,
      rowerNumber: p.rowerNumber,
      name: p.displayName,
      instagram: p.instagram,
      division: p.division,
      joined: joinedOn(p.createdAt),
      joinedDay: pacificDay(p.createdAt.getTime()),
      email: user?.email ?? null,
      googleName: user?.name ?? null,
      about: aboutOf?.get(p.id) ?? null,
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
      <style>{rowersCss}</style>
      <style>{sgCss}</style>
      <RowBar {...barProps(viewer)} />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The rowers</h2>
            <span className="mono">
              ADMIN ONLY — {rowers.length} ROWERS · {sessions} SESSIONS · {Math.round(meters).toLocaleString("en-US")} M
            </span>
            <span className="sg-dl">
              <a className="outline-btn" href="/api/row100k/export?kind=rows" download>
                Download CSV · Rows
              </a>
              <a className="outline-btn" href="/api/row100k/export?kind=rowers" download>
                Download CSV · Rowers
              </a>
              <a className="outline-btn" href="/api/row100k/export?kind=llm" download>
                Export JSON · Everyone
              </a>
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
