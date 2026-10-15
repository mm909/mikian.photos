import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getEffectiveActor, isAdmin } from "@/lib/permissions";
import { HomeFooter } from "@/components/home/HomeFooter";
import { AccountControl } from "../EntryForm";
import { ListCard, type ListEntry } from "../ListCard";
import { eventPath } from "../paths";
import { RefreshAll } from "../RefreshAll";
import { categoryRank, dayOf, eventBySlug, readCategory, shortDay, startMinutes } from "../../../events";
import { ROW, rowOut } from "../../../row";
import { BLACK, anton, barlowCondensed, css } from "../../../theme";

/* THE LIST — the owner's, and only his (owner, 2026-10-13: "make the list
 * button up on the top only accessible by me for now"; a 404 for anyone
 * else in production, and the bar shows THE LIST to the admin alone). On
 * a local build the page asks for the sign-in instead, so the owner can
 * reach it from a fresh dev server.
 *
 * REDESIGNED FOR THE PHONE (same day: "we're going to be viewing it from
 * a phone, not from a computer, 90% of the time ... I don't want to
 * scroll left or right ... we don't need the runner's email, we don't
 * need to know when they signed up"): no table. One card per entry
 * (ListCard.tsx), by day, then BY START TIME — the waves in order, the
 * entries without one last (owner, 2026-10-15: "I want to be able to say,
 * who's running in the 8 a.m. wave, these are the people that are there,
 * and then the 8:10 wave") — then category, then name. UPDATE over the
 * list reads every entry from hyresult again (RefreshAll.tsx). The CSV
 * keeps every column for a spreadsheet. */

export const viewport: Viewport = { themeColor: BLACK };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { event: string } }): Promise<Metadata> {
  const ev = eventBySlug(params.event);
  return { title: `${ev?.name ?? "Hyrox"} — The list (dev)`, robots: { index: false, follow: false } };
}

export default async function TheListPage({ params }: { params: { event: string } }) {
  const ev = eventBySlug(params.event);
  if (!ev) notFound();
  const actor = await getEffectiveActor();
  const admin = actor ? isAdmin(actor) : false;
  if (!admin && process.env.NODE_ENV === "production") notFound();

  const shell = (body: React.ReactNode) => (
    <div className={`hx ${anton.variable} ${barlowCondensed.variable}`}>
      <style>{css}</style>
      <div className="hx-bar">
        <a href={eventPath(ev)} className="hx-wm">
          Hyrox
          <small>
            {ev.city} ’{String(ev.year).slice(-2)} · the list · dev
          </small>
        </a>
        <AccountControl ev={ev} signedIn={actor !== null} name={actor?.name ?? ""} admin={admin} />
      </div>
      <div className="hx-stripe" />
      <section className="wrap">{body}</section>
      <HomeFooter />
    </div>
  );

  if (!admin) {
    return shell(
      <>
        <div className="hx-head">
          <h2 className="disp">The list</h2>
          <span>Owner only</span>
        </div>
        <p className="hx-hint" style={{ marginTop: 24 }}>
          {actor ? `Signed in as ${actor.email}, which is not the owner's account. ` : "Not signed in. "}
          Use SIGN IN in the bar with the owner's Google account — on a local build this page shows instead of a 404.
        </p>
      </>,
    );
  }

  let rows: ListEntry[] = [];
  let unreadable = false;
  try {
    const all = await db.hyroxEntry.findMany({ where: { event: ev.slug }, select: ROW });
    rows = all.map((r) => rowOut(r));
  } catch (err) {
    console.error("hyrox: failed to read the list (table pushed?)", err);
    unreadable = true;
  }

  const dayIndex = (d: string) => {
    const i = ev.days.findIndex((x) => x.date === d);
    return i === -1 ? 99 : i;
  };
  const rank = (r: ListEntry) => {
    const cat = readCategory(r.format, r.division, r.gender);
    return cat ? categoryRank(cat) : 999;
  };
  const sorted = rows.slice().sort((a, b) => dayIndex(a.day) - dayIndex(b.day) || startMinutes(a.startTime) - startMinutes(b.startTime) || rank(a) - rank(b) || a.name.localeCompare(b.name));

  return shell(
    <>
      <div className="hx-head">
        <h2 className="disp">The list</h2>
        <span>
          {rows.length} {rows.length === 1 ? "entry" : "entries"} ·{" "}
          <a href={`/api/hyrox/${ev.slug}/list.csv`} style={{ color: "inherit" }}>
            CSV
          </a>
        </span>
      </div>
      {unreadable ? <p className="hx-err">The list could not be read — has the table been pushed? Locally: npm run prisma:push.</p> : null}
      {rows.length > 0 ? <RefreshAll slug={ev.slug} /> : null}
      {rows.length === 0 && !unreadable ? <p className="hx-empty">Nobody yet.</p> : null}
      {sorted.length > 0 ? (
        <div className="hx-roster">
          {sorted.map((r, i) => {
            const d = dayOf(ev, r.day);
            const newDay = i === 0 || sorted[i - 1].day !== r.day;
            return (
              <div key={r.id}>
                {newDay ? <h3 className="hx-roster-day disp">{d ? shortDay(d) : r.day}</h3> : null}
                <ListCard ev={ev} entry={r} n={i + 1} />
              </div>
            );
          })}
        </div>
      ) : null}
    </>,
  );
}
