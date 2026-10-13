import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getEffectiveActor, isAdmin } from "@/lib/permissions";
import { HomeFooter } from "@/components/home/HomeFooter";
import { AccountControl } from "../EntryForm";
import { categoryLabel, categoryRank, dayOf, eventBySlug, partnersFromColumns, readCategory, shortDay } from "../../events";
import { BLACK, anton, barlowCondensed, css } from "../../theme";

/* THE LIST — the owner's, and only his (owner, 2026-10-13: "make the list
 * button up on the top only accessible by me for now"; a 404 for anyone
 * else, and the bar shows THE LIST to the admin alone).
 *
 * REDESIGNED FOR THE PHONE (same day: "we're going to be viewing it from
 * a phone, not from a computer, 90% of the time ... I don't want to
 * scroll left or right ... we don't need the runner's email, we don't
 * need to know when they signed up"): no table. One card per entry, by
 * day then category then name — the name, the handle, the race, who with
 * and their handles, the start time once there is one. The CSV keeps
 * every column for a spreadsheet. */

export const viewport: Viewport = { themeColor: BLACK };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { event: string } }): Promise<Metadata> {
  const ev = eventBySlug(params.event);
  return { title: `${ev?.name ?? "Hyrox"} — The list`, robots: { index: false, follow: false } };
}

function Handle({ h }: { h: string }) {
  return (
    <a href={`https://instagram.com/${h}`} target="_blank" rel="noopener noreferrer">
      @{h}
    </a>
  );
}

export default async function TheListPage({ params }: { params: { event: string } }) {
  const ev = eventBySlug(params.event);
  if (!ev) notFound();
  const actor = await getEffectiveActor();
  if (!actor || !isAdmin(actor)) notFound();

  let rows: {
    id: string;
    name: string;
    instagram: string;
    format: string;
    division: string;
    gender: string;
    day: string;
    partners: string[];
    partnerIgs: string[];
    startTime: string;
  }[] = [];
  let unreadable = false;
  try {
    rows = await db.hyroxEntry.findMany({
      where: { event: ev.slug },
      select: { id: true, name: true, instagram: true, format: true, division: true, gender: true, day: true, partners: true, partnerIgs: true, startTime: true },
    });
  } catch (err) {
    console.error("hyrox: failed to read the list (table pushed?)", err);
    unreadable = true;
  }

  const dayIndex = (d: string) => {
    const i = ev.days.findIndex((x) => x.date === d);
    return i === -1 ? 99 : i;
  };
  const rank = (r: (typeof rows)[number]) => {
    const cat = readCategory(r.format, r.division, r.gender);
    return cat ? categoryRank(cat) : 999;
  };
  const sorted = rows.slice().sort((a, b) => dayIndex(a.day) - dayIndex(b.day) || rank(a) - rank(b) || a.name.localeCompare(b.name));

  return (
    <div className={`hx ${anton.variable} ${barlowCondensed.variable}`}>
      <style>{css}</style>
      <div className="hx-bar">
        <a href={`/hyrox/${ev.slug}`} className="hx-wm">
          Hyrox
          <small>
            {ev.city} ’{String(ev.year).slice(-2)} · the list
          </small>
        </a>
        <AccountControl ev={ev} signedIn name={actor.name} admin />
      </div>
      <div className="hx-stripe" />

      <section className="wrap">
        <div className="hx-head">
          <h2 className="disp">The list</h2>
          <span>
            {rows.length} {rows.length === 1 ? "entry" : "entries"} ·{" "}
            <a href={`/api/hyrox/${ev.slug}/list.csv`} style={{ color: "inherit" }}>
              CSV
            </a>
          </span>
        </div>
        {unreadable ? <p className="hx-err">The list could not be read — has the table been pushed?</p> : null}
        {rows.length === 0 && !unreadable ? <p className="hx-empty">Nobody yet.</p> : null}
        {sorted.length > 0 ? (
          <div className="hx-roster">
            {sorted.map((r, i) => {
              const cat = readCategory(r.format, r.division, r.gender);
              const d = dayOf(ev, r.day);
              const partners = partnersFromColumns(r.partners, r.partnerIgs);
              const newDay = i === 0 || sorted[i - 1].day !== r.day;
              return (
                <div key={r.id}>
                  {newDay ? <h3 className="hx-roster-day disp">{d ? shortDay(d) : r.day}</h3> : null}
                  <div className="hx-card">
                    <div className="hx-card-top">
                      <span className="n">{i + 1}</span>
                      <span className="cat">{cat ? categoryLabel(cat) : `${r.format} / ${r.division} / ${r.gender}`}</span>
                      {r.startTime ? <span className="start">{r.startTime}</span> : null}
                    </div>
                    <div className="hx-card-name disp">{r.name}</div>
                    {r.instagram ? (
                      <div className="hx-card-line">
                        <Handle h={r.instagram} />
                      </div>
                    ) : null}
                    {partners.length > 0 ? (
                      <div className="hx-card-with">
                        {partners.map((p, j) => (
                          <div className="hx-card-line" key={j}>
                            <span className="amp">&amp;</span> {p.name}
                            {p.instagram ? (
                              <>
                                {" "}
                                <Handle h={p.instagram} />
                              </>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
      <HomeFooter />
    </div>
  );
}
