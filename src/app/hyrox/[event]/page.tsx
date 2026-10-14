import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getEffectiveActor, isAdmin } from "@/lib/permissions";
import { HomeFooter } from "@/components/home/HomeFooter";
import { Board, type BoardRow } from "./Board";
import { AccountControl, EntryForm, type MyEntry } from "./EntryForm";
import { RosterSticker } from "./RosterSticker";
import { eventBySlug, eventPath, isClosed, partnersFromColumns, readCategory, shortDay } from "../events";
import { BLACK, anton, barlowCondensed, css } from "../theme";

/* THE HYROX EVENT PAGE (owner, 2026-10-13): the weekend's facts in the
 * race's own look, the form where someone says what they are racing and
 * with whom (EntryForm.tsx), and THE BOARD — everyone who has, by day and
 * category (Board.tsx). One page per event in events.ts, by slug. Google
 * sign-in is required to post; the board is read by anyone the page lets
 * in. The admin sees THE LIST, with emails, in the bar.
 *
 * THE BAR is the page's own, the Rowtember way — a wordmark and a chip —
 * and the marketplace header stays off (RunnerChrome.tsx; owner,
 * 2026-10-13: "we especially do not want that Mikian.Musser"). The footer
 * is the house footer (HomeFooter: @mikian_, the email, FOR YOURSELF AND
 * OTHERS — "the same footer across the board"). No link to the ticket
 * page (owner: "things are going to sell out ... I don't really care").
 *
 * LIVE AND PUBLIC (owner, 2026-10-13, evening: "let's just make it live
 * so there's no more gated behind admin or anything like that"). It wore
 * the development gate for its first day. */

export const dynamic = "force-dynamic";
export const viewport: Viewport = { themeColor: BLACK };

export async function generateMetadata({ params }: { params: { event: string } }): Promise<Metadata> {
  const ev = eventBySlug(params.event);
  if (!ev) return { title: "Hyrox" };
  return {
    title: `${ev.name} — Who is racing`,
    description: `Racing ${ev.name}? Put your name on the board and see who else is.`,
  };
}

export default async function HyroxEventPage({ params }: { params: { event: string } }) {
  const ev = eventBySlug(params.event);
  if (!ev) notFound();
  const actor = await getEffectiveActor();
  const admin = actor ? isAdmin(actor) : false;

  let rows: BoardRow[] = [];
  let mine: MyEntry[] = [];
  let unreadable = false;
  try {
    const all = await db.hyroxEntry.findMany({ where: { event: ev.slug }, orderBy: { createdAt: "asc" } });
    rows = all.map((r) => ({
      id: r.id,
      name: r.name,
      instagram: r.instagram,
      format: r.format,
      division: r.division,
      gender: r.gender,
      day: r.day,
      partners: partnersFromColumns(r.partners, r.partnerIgs),
      startTime: r.startTime,
    }));
    if (actor) {
      mine = all
        .filter((r) => r.userId === actor.photographerId)
        .flatMap((r) => {
          const cat = readCategory(r.format, r.division, r.gender);
          if (!cat) return [];
          return [{ id: r.id, name: r.name, instagram: r.instagram, ...cat, day: r.day, partners: partnersFromColumns(r.partners, r.partnerIgs), startTime: r.startTime }];
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
            {ev.city} {yr}
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
        <Board ev={ev} rows={rows} />
        {/* THE ROSTER AS A STICKER (owner, 2026-10-14: "a way to share a
         * whole schedule for everyone who signed up ... the Vegas roster"):
         * the whole board, or one day of it, in the four looks. */}
        <RosterSticker ev={ev} rows={rows} />
      </section>

      <HomeFooter />
    </div>
  );
}
