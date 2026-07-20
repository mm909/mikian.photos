import type { Metadata, Viewport } from "next";
import { db } from "@/lib/db";
import { isOwnerActor } from "@/lib/permissions";
import { ClearPile } from "../ClearPile";
import { archivo, archivoBlack, spaceMono, css } from "../theme";

/**
 * /lasd26/the-list — the shareable applicant list. Anyone with the link can
 * see who's in (name, role, instagram, when); applicant EMAILS and the
 * clear-the-list button render only for the signed-in owner.
 */

export const metadata: Metadata = {
  title: "LASD26 — The List",
  description: "Who's in so far.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#F4F3EE",
};

// Live list + session-dependent columns — never render statically.
export const dynamic = "force-dynamic";

/** MM.DD HH:MM in Pacific time. */
function stamp(d: Date): string {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${get("month")}.${get("day")} ${get("hour")}:${get("minute")}`;
}

export default async function TheListPage() {
  const owner = await isOwnerActor();
  const applicants = await db.crewApplication.findMany({
    where: { page: "lasd26" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      role: true,
      email: true,
      instagram: true,
      createdAt: true,
    },
  });

  return (
    <div
      className={`lasd26 ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}
    >
      <style>{css}</style>

      <div className="bar">
        <a className="mono" href="/lasd26">
          ← CREW CALL
        </a>
        <span className="mono tag">LASD26</span>
      </div>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The list</h2>
            <span className="mono">{applicants.length} IN — FRI 10.23</span>
          </div>
          {applicants.length === 0 ? (
            <p className="list-empty">NO NAMES YET.</p>
          ) : (
            <table className="pile">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Role</th>
                  {owner && <th>Email</th>}
                  <th>IG</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {applicants.map((a, i) => (
                  <tr key={a.id}>
                    <td>{i + 1}</td>
                    <td>{a.name}</td>
                    <td>{a.role}</td>
                    {owner && <td>{a.email || "—"}</td>}
                    <td>
                      {a.instagram ? (
                        <a
                          href={`https://instagram.com/${a.instagram}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          @{a.instagram}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{stamp(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {owner && applicants.length > 0 && (
            <ClearPile count={applicants.length} />
          )}
        </div>
      </section>

      <footer>
        <div className="wrap" style={{ padding: 0 }}>
          <p className="mono">for yourself and others</p>
        </div>
      </footer>
    </div>
  );
}
