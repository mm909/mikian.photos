import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getEffectiveActor, isAdmin } from "@/lib/permissions";
import { HomeFooter } from "@/components/home/HomeFooter";
import { Board, type BoardRow } from "./Board";
import { AccountControl, EntryForm, type MyEntry } from "./EntryForm";
import { EventStickers } from "./EventStickers";
import { eventPath } from "./paths";
import { RosterSticker } from "./RosterSticker";
import { eventBySlug, isClosed, raceWeekendState, readCategory, shortDay } from "../../events";
import { ROW, refreshStale, rowOut } from "../../row";
import { BLACK, anton, barlowCondensed, css } from "../../theme";

/* THE HYROX EVENT PAGE, THE DEV COPY (paths.ts; owner, 2026-10-15: "make
 * these changes live but under a /dev path"): the weekend's facts in the
 * race's own look, the form where someone says what they are racing and
 * with whom (EntryForm.tsx), and THE BOARD — everyone who has, by day and
 * category, with the record hyresult knows (Board.tsx). One page per
 * event in events.ts, by slug. Google sign-in is required to post. The
 * admin sees THE LIST in the bar. Admin-only in production until the
 * owner says this copy replaces /hyrox/<event>.
 *
 * THE RECORD KEEPS ITSELF FRESH: on a view, a few of the stalest rows
 * are read from hyresult again (row.ts refreshStale) — oftener during
 * the race weekend, so the finishes come in as they are run.
 *
 * THE BAR is the page's own, the Rowtember way — a wordmark and a chip —
 * and the marketplace header stays off (RunnerChrome.tsx; owner,
 * 2026-10-13: "we especially do not want that Mikian.Musser"). The footer
 * is the house footer (HomeFooter). */

export const dynamic = "force-dynamic";
export const viewport: Viewport = { themeColor: BLACK };

export async function generateMetadata({ params }: { params: { event: string } }): Promise<Metadata> {
  const ev = eventBySlug(params.event);
  if (!ev) return { title: "Hyrox (dev)" };
  return {
    title: `${ev.name} — Who is racing (dev)`,
    description: `Racing ${ev.name}? Put your name on the board and see who else is.`,
    robots: { index: false, follow: false },
  };
}

export default async function HyroxEventDevPage({ params }: { params: { event: string } }) {
  const ev = eventBySlug(params.event);
  if (!ev) notFound();
  const actor = await getEffectiveActor();
  const admin = actor ? isAdmin(actor) : false;
  if (process.env.NODE_ENV === "production" && !admin) notFound();
  const weekend = raceWeekendState(ev);

  let rows: BoardRow[] = [];
  let mine: MyEntry[] = [];
  let unreadable = false;
  try {
    const all = await refreshStale(ev, await db.hyroxEntry.findMany({ where: { event: ev.slug }, orderBy: { createdAt: "asc" }, select: ROW }), weekend);
    rows = all.map((r) => rowOut(r));
    if (actor) {
      mine = all
        .filter((r) => r.userId === actor.photographerId)
        .flatMap((r) => {
          const cat = readCategory(r.format, r.division, r.gender);
          if (!cat) return [];
          const out = rowOut(r);
          return [{ ...out, ...cat }];
        });
    }
  } catch (err) {
    console.error("hyrox: failed to read the board (table pushed?)", err);
    unreadable = true;
  }

  const closed = isClosed(ev);
  const first = ev.days[0];
  const last = ev.days[ev.days.length - 1];
  const yr = `’${String(ev.year).slice(-2)}`;

  return (
    <div className={`hx ${anton.variable} ${barlowCondensed.variable}`}>
      <style>{css}</style>

      <div className="hx-bar">
        <a href={eventPath(ev)} className="hx-wm">
          Hyrox
          <small>
            {ev.city} {yr} · dev
          </small>
        </a>
        <AccountControl ev={ev} signedIn={actor !== null} name={actor?.name ?? ""} admin={admin} />
      </div>
      <div className="hx-stripe" />

      <header className="wrap">
        <p className="hx-crumb">Hyrox / Season {String(ev.year - 1).slice(-2)}/{String(ev.year).slice(-2)}</p>
        <h1 className="disp">
          {ev.city}
          <br />
          <span className="yr">{yr}</span>
        </h1>
        <p className="hx-tag">Let us know you’re racing.</p>

        <div className="hx-facts">
          <div className="hx-fact">
            <div className="k">When</div>
            <div className="v">
              {first.dow}–{last.dow}
              <small>
                {shortDay(first).replace(/^\w+, /, "")}–{shortDay(last).replace(/^\w+, /, "").replace(/^\w+ /, "")}, {ev.year}
              </small>
            </div>
          </div>
          <div className="hx-fact">
            <div className="k">Where</div>
            <div className="v">
              {ev.city}
              <small>{ev.venue}</small>
            </div>
          </div>
          <div className="hx-fact">
            <div className="k">On the board</div>
            <div className="v">
              {rows.length}
              <small>{rows.length === 1 ? "entry" : "entries"} so far</small>
            </div>
          </div>
        </div>
        {/* THE EVENT'S STICKERS (owner, 2026-10-14): the mark alone, and
         * the days-away count, for anyone. */}
        <EventStickers ev={ev} mine={mine} />
      </header>

      <section className="wrap" id="in">
        <div className="hx-head">
          <h2 className="disp">{mine.length > 0 ? "My races" : "I am racing"}</h2>
          <span>{closed ? "Closed" : `Closes ${shortDay(last).replace(/^\w+, /, "")}`}</span>
        </div>
        {unreadable ? <p className="hx-err">The board could not be read — has the table been pushed?</p> : null}
        <EntryForm ev={ev} signedIn={actor !== null} closed={closed} defaults={{ name: actor?.name ?? "" }} mine={mine} />
      </section>

      <section className="wrap" id="board">
        <div className="hx-head">
          <h2 className="disp">The board</h2>
          <span>
            {rows.length} {rows.length === 1 ? "entry" : "entries"}
          </span>
        </div>
        <Board ev={ev} rows={rows} weekend={weekend} />
        {/* THE ROSTER AS A STICKER (owner, 2026-10-14: "a way to share a
         * whole schedule for everyone who signed up ... the Vegas roster"):
         * the whole board, or one day of it, in the four looks. */}
        <RosterSticker ev={ev} rows={rows} />
      </section>

      <HomeFooter />
    </div>
  );
}
