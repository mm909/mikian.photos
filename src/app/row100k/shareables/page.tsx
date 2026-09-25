import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { CHALLENGE, isRow100kAdmin } from "@/lib/row100k";
import { siteSettings } from "@/lib/rowSettings";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { Who } from "../Boards";
import { CARDS } from "../share/cards";
import { ShareablesAdmin } from "./ShareablesAdmin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shareables — Rowtember",
  robots: { index: false, follow: false },
};

/* THE SHAREABLES (owner, 2026-09-16): every card in the registry as a
 * table — a preview, the label, how often it has been shared, and an ON /
 * OFF switch (rowSettings cards.off) — then the last fifty share events,
 * with the rower on the card AND the rower who pressed the button. This is
 * /row100k/dev/stats folded in ("combine this page on the shareables
 * menu"); that URL forwards here. Admin-only in production; open in local
 * dev so it can be checked without a session, the same gate the dev pages
 * wear.
 *
 * EVERY READ FAILS OPEN. The switches come from siteSettings (defaults when
 * the RowSetting table is not pushed); the counts and the recent list come
 * from ShareEvent, whose sharerRowerNumber column is not pushed yet either —
 * a select that names it and fails is retried without it, and the table
 * says which column is missing. The tracked-link section the old page kept
 * behind SHOW_LINKS=false is not carried over; RowLinkClick keeps
 * collecting. */

/* Absolute stamp, no relative time: createdAt shifted minus 7 hours (the
 * repo's Pacific convention — same as the feed's stampWhen), read back as
 * UTC fields. "SEP 4 · 3:54 PM". */
const STAMP_MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];
function stampWhen(createdAt: Date): string {
  const p = new Date(createdAt.getTime() - 7 * 3600_000);
  const h24 = p.getUTCHours();
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const min = String(p.getUTCMinutes()).padStart(2, "0");
  const ampm = h24 < 12 ? "AM" : "PM";
  return `${STAMP_MONTHS[p.getUTCMonth()]} ${p.getUTCDate()} · ${h}:${min} ${ampm}`;
}

/* Page-local styles — .sh- prefix, theme.ts untouched. Rendered as the text
 * child of a style tag, so no double quotes, no angle brackets, and no
 * apostrophes anywhere in the string (see the note in theme.ts).
 *
 * The stage repeats the share dialog's dark checkerboard: the cards are
 * white-on-transparent stickers and are invisible on paper. */
const shCss = `
.row100k table.board.sh-t td{vertical-align:middle}
.row100k table.board.sh-t th.sh-r{text-align:right}
.row100k table.board td.sh-pv{width:152px;padding:8px 6px}
.row100k .sh-stage{background-color:var(--frame);background-image:linear-gradient(45deg,rgba(255,255,255,.05) 25%,transparent 25%,transparent 75%,rgba(255,255,255,.05) 75%),linear-gradient(45deg,rgba(255,255,255,.05) 25%,transparent 25%,transparent 75%,rgba(255,255,255,.05) 75%);background-size:12px 12px;background-position:0 0,6px 6px;display:flex;align-items:center;justify-content:center;padding:6px;width:140px;min-height:56px;box-sizing:border-box}
.row100k .sh-canvas{display:block;max-width:100%;height:auto}
.row100k .sh-none{font-size:10px;letter-spacing:.12em;color:rgba(255,255,255,.55)}
.row100k table.board tr.sh-grp td{padding:22px 6px 6px;border-bottom:1px solid var(--ink);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--gray)}
.row100k .sh-name{font-family:var(--row-archivo),sans-serif;font-weight:700;font-size:14px}
.row100k .sh-id{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.06em;color:var(--gray);margin-top:2px}
.row100k table.board td.sh-n{color:var(--gray)}
.row100k table.board td.sh-n.on{color:var(--water);font-weight:700}
.row100k table.board td.sh-sw{white-space:nowrap}
.row100k .sh-sw .tabs{display:inline-flex;gap:0;margin:0}
.row100k .sh-sw .tabs button{padding:6px 10px;font-size:10px}
.row100k .sh-sw .tabs button+button{margin-left:-2px}
.row100k .sh-sw .tabs button:disabled{cursor:default}
.row100k table.board tr.sh-off .sh-stage,.row100k table.board tr.sh-off .sh-name{opacity:.45}
.row100k table.board td.sh-when{color:var(--gray);white-space:nowrap}
.row100k table.board td.sh-act{color:var(--water);font-weight:700;letter-spacing:.06em}
.row100k .sh-note{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.06em;color:var(--gray);margin-top:14px;line-height:1.7}
.row100k .sh-missing{font-family:var(--row-mono),monospace;font-size:12px;letter-spacing:.14em;color:var(--water);font-weight:700}
`;

type Ev = {
  cardId: string;
  action: string;
  rowerNumber: number | null;
  sharerRowerNumber: number | null;
  createdAt: Date;
};

const RECENT = 50;

export default async function ShareablesPage() {
  let admin = false;
  try {
    const actor = await getEffectiveActor();
    admin = !!actor && isRow100kAdmin(actor.email, actor.roles);
  } catch {
    /* no session backend in some local setups — the dev branch below still opens */
  }
  if (process.env.NODE_ENV === "production" && !admin) notFound();

  const settings = await siteSettings();

  /* All-time shares per card. */
  const counts: Record<string, number> = {};
  let eventsOk = true;
  try {
    const rows = await db.shareEvent.groupBy({
      by: ["cardId"],
      where: { challenge: CHALLENGE },
      _count: { _all: true },
    });
    for (const r of rows) counts[r.cardId] = r._count._all;
  } catch (err) {
    eventsOk = false;
    console.error("row100k shareables: share counts read failed", err);
  }

  /* The tail, newest first — with the sharer when the column is there. */
  let recent: Ev[] = [];
  let sharerOk = true;
  try {
    recent = await db.shareEvent.findMany({
      where: { challenge: CHALLENGE },
      select: { cardId: true, action: true, rowerNumber: true, sharerRowerNumber: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: RECENT,
    });
  } catch (err) {
    sharerOk = false;
    console.error("row100k shareables: recent read failed with the sharer column — retrying without", err);
    try {
      const rows = await db.shareEvent.findMany({
        where: { challenge: CHALLENGE },
        select: { cardId: true, action: true, rowerNumber: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: RECENT,
      });
      recent = rows.map((r) => ({ ...r, sharerRowerNumber: null }));
    } catch (again) {
      console.error("row100k shareables: recent read failed", again);
    }
  }

  /* Names for every number in the tail — subject and sharer — off the
   * roster. A failed read prints numbers alone. */
  const names = new Map<number, string>();
  const nums = [
    ...new Set(
      recent.flatMap((e) => [e.rowerNumber, e.sharerRowerNumber]).filter((n): n is number => n !== null && n > 0),
    ),
  ];
  if (nums.length > 0) {
    try {
      const people = await db.rowParticipant.findMany({
        where: { challenge: CHALLENGE, rowerNumber: { in: nums } },
        select: { rowerNumber: true, displayName: true },
      });
      for (const p of people) names.set(p.rowerNumber, p.displayName);
    } catch (err) {
      console.error("row100k shareables: roster read failed", err);
    }
  }

  const labelOf = (id: string): string => {
    const card = CARDS.find((c) => c.id === id);
    if (!card) return id;
    return id.startsWith("rowtember-board-") ? `The board · ${card.label}` : card.label;
  };

  /* A rower cell: number and name, linked; COMMUNITY for the community
   * cards (0); a dash for nobody. */
  const who = (n: number | null) =>
    n === null ? "—" : n === 0 ? "COMMUNITY" : <Who row={{ name: names.get(n) ?? "—", rowerNumber: n }} />;

  const offCount = settings.cardsOff.filter((id) => CARDS.some((c) => c.id === id)).length;

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{shCss}</style>
      <RowBar />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The cards</h2>
            <span className="mono">
              {CARDS.length} CARDS · {offCount} OFF
              {eventsOk ? "" : " · COUNTS UNAVAILABLE"}
            </span>
          </div>
          <ShareablesAdmin counts={counts} cardsOff={settings.cardsOff} />
          <p className="sh-note">
            OFF TAKES A CARD OUT OF EVERY PICKER ON THE SITE. THE SWITCHES LIVE IN THE ROWSETTING TABLE —
            UNTIL IT IS PUSHED THE CODE DEFAULTS STAND AND A SAVE WILL SAY SO.
          </p>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>Recent</h2>
            <span className="mono">LAST {Math.min(RECENT, recent.length)} · PACIFIC</span>
          </div>
          {recent.length === 0 ? (
            <p className="board-empty">NOTHING SHARED YET.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="board">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Card</th>
                    <th>Action</th>
                    <th>Subject</th>
                    <th>Shared by</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((e, i) => (
                    <tr key={i}>
                      <td className="sh-when">{stampWhen(e.createdAt)}</td>
                      <td>{labelOf(e.cardId)}</td>
                      <td className="sh-act">{e.action.toUpperCase()}</td>
                      <td>{who(e.rowerNumber)}</td>
                      <td>{who(e.sharerRowerNumber)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!sharerOk && (
            <p className="sh-note">
              <span className="sh-missing">SHARED BY needs npm run prisma:push</span> — ShareEvent.sharerRowerNumber
              is in the schema and not in the database yet; the route keeps every event and drops the sharer until it is.
            </p>
          )}
          <p className="sh-note">
            SUBJECT IS THE ROWER ON THE CARD; SHARED BY IS WHOEVER WAS SIGNED IN WHEN THEY PRESSED IT. MOST ROWS
            MATCH — THE ONES THAT DO NOT ARE SOMEBODY SHARING SOMEBODY ELSE.
          </p>
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
