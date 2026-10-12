import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getEffectiveActor, isOwner } from "@/lib/permissions";
import { photoUrl, photosServable, thumbKey } from "../../row100k/photoUrls";
import { AccountControl } from "../SignupForm";
import { PATH, RACE, RACE_SHORT } from "../race";
import { css, playfair, spaceMono } from "../theme";

/* THE LIST — the owner's (owner, 2026-10-12: "the list can be just for
 * me"): every runner who put their name in, oldest first, with the photo,
 * the handle, the email, the phone, the bib, the loops they expect and
 * when; a CSV link. A 404 for anyone else. */

export const metadata: Metadata = {
  title: `${RACE_SHORT} — The list`,
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#151311" };
export const dynamic = "force-dynamic";

const WHEN = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function TheListPage() {
  const actor = await getEffectiveActor();
  if (!actor || !isOwner(actor)) notFound();

  let rows: {
    id: string;
    name: string;
    email: string;
    phone: string;
    instagram: string;
    bib: string;
    expectedLoops: number | null;
    photoKey: string;
    createdAt: Date;
  }[] = [];
  let unreadable = false;
  try {
    rows = await db.raceRunnerSignup.findMany({ where: { race: RACE }, orderBy: { createdAt: "asc" } });
  } catch (err) {
    console.error("longhorn-lms: failed to read the list (table pushed?)", err);
    unreadable = true;
  }
  const canServe = photosServable();
  const pics = await Promise.all(
    rows.map(async (r) => ({
      thumb: r.photoKey && canServe ? await photoUrl(thumbKey(r.photoKey)).catch(() => null) : null,
      full: r.photoKey && canServe ? await photoUrl(r.photoKey).catch(() => null) : null,
    })),
  );

  return (
    <div className={`lh ${playfair.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <div className="lh-bar">
        <a href={PATH} className="lh-wm" style={{ textDecoration: "none" }}>
          Longhorn
          <small>Last Person Standing</small>
        </a>
        <AccountControl signedIn name={actor.name} owner />
      </div>

      <section className="wrap">
        <div className="lh-head">
          <h2>The list</h2>
          <span>
            {rows.length} running ·{" "}
            <a href="/api/longhorn-lms/list.csv" style={{ color: "inherit" }}>
              CSV
            </a>
          </span>
        </div>
        {unreadable ? <p className="lh-err">The list could not be read — has the table been pushed?</p> : null}
        {rows.length === 0 && !unreadable ? <p className="lh-empty">Nobody yet.</p> : null}
        {rows.length > 0 ? (
          <div className="lh-list-wrap">
            <table className="lh-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th></th>
                  <th>Runner</th>
                  <th>Instagram</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Bib</th>
                  <th>Loops</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id}>
                    <td className="n">{i + 1}</td>
                    <td className="pic">
                      {pics[i].thumb ? (
                        <a href={pics[i].full ?? pics[i].thumb ?? "#"} target="_blank" rel="noopener noreferrer" style={{ border: 0 }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={pics[i].thumb ?? ""} alt={r.name} />
                        </a>
                      ) : null}
                    </td>
                    <td className="who">{r.name}</td>
                    <td>
                      {r.instagram ? (
                        <a href={`https://instagram.com/${r.instagram}`} target="_blank" rel="noopener noreferrer">
                          @{r.instagram}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <a href={`mailto:${r.email}`}>{r.email}</a>
                    </td>
                    <td>
                      <a href={`tel:${r.phone.replace(/[^0-9+]/g, "")}`}>{r.phone}</a>
                    </td>
                    <td>{r.bib || "—"}</td>
                    <td>{r.expectedLoops ?? "—"}</td>
                    <td className="when">{WHEN.format(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
