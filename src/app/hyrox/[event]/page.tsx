import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getEffectiveActor, isAdmin } from "@/lib/permissions";
import { Board, type BoardRow } from "./Board";
import { AccountControl, EntryForm, type MyEntry } from "./EntryForm";
import { eventBySlug, isClosed, readCategory, shortDay } from "../events";
import { BLACK, anton, barlowCondensed, css } from "../theme";

/* THE HYROX EVENT PAGE (owner, 2026-10-13): the weekend's facts in the
 * race's own look, the form where someone says what they are racing and
 * with whom (EntryForm.tsx), and THE BOARD — everyone who has, by day and
 * category (Board.tsx). One page per event in events.ts, by slug. Google
 * sign-in is required to post; the board is read by anyone the page lets
 * in. The admin sees THE LIST, with emails, in the bar.
 *
 * IN DEVELOPMENT (CLAUDE.md; owner: "make this page live, but behind my
 * admin account"): admin-only in production, a 404 for anyone else; open
 * in local dev. */

export const dynamic = "force-dynamic";
export const viewport: Viewport = { themeColor: BLACK };

export async function generateMetadata({ params }: { params: { event: string } }): Promise<Metadata> {
  const ev = eventBySlug(params.event);
  if (!ev) return { title: "Hyrox (dev)" };
  return {
    title: `${ev.name} (dev) — Who is racing`,
    description: `Racing ${ev.name}? Put your name on the board, see who else is, and grab a sticker.`,
    robots: { index: false, follow: false },
  };
}

export default async function HyroxEventPage({ params }: { params: { event: string } }) {
  const ev = eventBySlug(params.event);
  if (!ev) notFound();
  const actor = await getEffectiveActor();
  const admin = actor ? isAdmin(actor) : false;
  if (process.env.NODE_ENV === "production" && !admin) notFound();

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
      partners: r.partners,
      teamName: r.teamName,
      startTime: r.startTime,
    }));
    if (actor) {
      mine = all
        .filter((r) => r.userId === actor.photographerId)
        .flatMap((r) => {
          const cat = readCategory(r.format, r.division, r.gender);
          if (!cat) return [];
          return [{ id: r.id, name: r.name, email: r.email, instagram: r.instagram, ...cat, day: r.day, partners: r.partners, teamName: r.teamName, startTime: r.startTime }];
        });
    }
  } catch (err) {
    console.error("hyrox: failed to read the board (table pushed?)", err);
    unreadable = true;
  }

  const closed = isClosed(ev);
  const first = ev.days[0];
  const last = ev.days[ev.days.length - 1];

  return (
    <div className={`hx ${anton.variable} ${barlowCondensed.variable}`}>
      <style>{css}</style>

      <div className="hx-bar">
        <a href="/" className="hx-wm">
          Mikian
          <small>Musser · Photographs</small>
        </a>
        <AccountControl ev={ev} signedIn={actor !== null} name={actor?.name ?? ""} admin={admin} />
      </div>
      <div className="hx-stripe" />

      <header className="wrap">
        <p className="hx-crumb">Hyrox / Season {String(ev.year - 1).slice(-2)}/{String(ev.year).slice(-2)}</p>
        <h1 className="disp">
          {ev.city}
          <br />
          <span className="yr">’{String(ev.year).slice(-2)}</span>
        </h1>
        <p className="hx-tag">Who is racing, what, and which day.</p>
        <p className="hx-lede">
          {ev.name} is {shortDay(first)} to {shortDay(last)} at the {ev.venue}. <b>Racing it? Put your name on the board</b> — your category, your day, your partner — and see who else is in. Then grab a sticker for your story.
        </p>

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

        <a className="hx-cta quiet" href={ev.url} target="_blank" rel="noopener noreferrer">
          The event, at hyrox.com →
        </a>
      </header>

      <section className="wrap" id="in">
        <div className="hx-head">
          <h2 className="disp">{mine.length > 0 ? "My races" : "I am racing"}</h2>
          <span>{closed ? "Closed" : `Closes ${shortDay(last).replace(/^\w+, /, "")}`}</span>
        </div>
        {unreadable ? <p className="hx-err">The board could not be read — has the table been pushed?</p> : null}
        <EntryForm ev={ev} signedIn={actor !== null} closed={closed} defaults={{ name: actor?.name ?? "", email: actor?.email ?? "" }} mine={mine} />
      </section>

      <section className="wrap" id="board">
        <div className="hx-head">
          <h2 className="disp">The board</h2>
          <span>
            {rows.length} {rows.length === 1 ? "entry" : "entries"}
          </span>
        </div>
        <Board ev={ev} rows={rows} />
        <p className="hx-board-note">Names and categories as people entered them. Start times go up as Hyrox announces them and people add theirs.</p>
      </section>

      <footer>
        <div className="wrap">
          <p>
            Not registered yet?{" "}
            <a href={ev.url} target="_blank" rel="noopener noreferrer">
              Tickets at hyrox.com
            </a>
            <br />
            Photos and questions →{" "}
            <a href="https://instagram.com/mikian_" target="_blank" rel="noopener noreferrer">
              @mikian_
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
