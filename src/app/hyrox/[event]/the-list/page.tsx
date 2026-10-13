import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getEffectiveActor, isAdmin } from "@/lib/permissions";
import { AccountControl } from "../EntryForm";
import { categoryLabel, dayOf, eventBySlug, readCategory, shortDay } from "../../events";
import { BLACK, anton, barlowCondensed, css } from "../../theme";

/* THE LIST — the admin's: every entry on the event with the email, which
 * the board never shows. Oldest first; a CSV link. A 404 for anyone else. */

export const viewport: Viewport = { themeColor: BLACK };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { event: string } }): Promise<Metadata> {
  const ev = eventBySlug(params.event);
  return { title: `${ev?.name ?? "Hyrox"} — The list`, robots: { index: false, follow: false } };
}

export default async function TheListPage({ params }: { params: { event: string } }) {
  const ev = eventBySlug(params.event);
  if (!ev) notFound();
  const actor = await getEffectiveActor();
  if (!actor || !isAdmin(actor)) notFound();

  const when = new Intl.DateTimeFormat("en-US", { timeZone: ev.timeZone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  let rows: {
    id: string;
    name: string;
    email: string;
    instagram: string;
    format: string;
    division: string;
    gender: string;
    day: string;
    partners: string[];
    teamName: string;
    startTime: string;
    createdAt: Date;
  }[] = [];
  let unreadable = false;
  try {
    rows = await db.hyroxEntry.findMany({ where: { event: ev.slug }, orderBy: { createdAt: "asc" } });
  } catch (err) {
    console.error("hyrox: failed to read the list (table pushed?)", err);
    unreadable = true;
  }

  return (
    <div className={`hx ${anton.variable} ${barlowCondensed.variable}`}>
      <style>{css}</style>
      <div className="hx-bar">
        <a href={`/hyrox/${ev.slug}`} className="hx-wm">
          {ev.city} ’{String(ev.year).slice(-2)}
          <small>Hyrox · the board</small>
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
        {rows.length > 0 ? (
          <div className="hx-list-wrap">
            <table className="hx-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Instagram</th>
                  <th>Category</th>
                  <th>Day</th>
                  <th>With</th>
                  <th>Team</th>
                  <th>Start</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const cat = readCategory(r.format, r.division, r.gender);
                  const d = dayOf(ev, r.day);
                  return (
                    <tr key={r.id}>
                      <td className="n">{i + 1}</td>
                      <td className="who">{r.name}</td>
                      <td>
                        <a href={`mailto:${r.email}`}>{r.email}</a>
                      </td>
                      <td>
                        {r.instagram ? (
                          <a href={`https://instagram.com/${r.instagram}`} target="_blank" rel="noopener noreferrer">
                            @{r.instagram}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{cat ? categoryLabel(cat) : `${r.format}/${r.division}/${r.gender}`}</td>
                      <td>{d ? shortDay(d) : r.day}</td>
                      <td>{r.partners.length ? r.partners.join(", ") : "—"}</td>
                      <td>{r.teamName || "—"}</td>
                      <td>{r.startTime || "—"}</td>
                      <td className="when">{when.format(r.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
