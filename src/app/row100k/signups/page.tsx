import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { CHALLENGE, fmtRowerNumber, isRow100kAdmin } from "@/lib/row100k";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Signups — 100K September",
  robots: { index: false, follow: false },
};

/* Admin-only roster: every rower in join order — bib, name, @, board, when
 * they joined. The rest of the world gets a 404; the boards are the public
 * view of this data. */
export default async function SignupsPage() {
  const actor = await getEffectiveActor();
  if (!actor || !isRow100kAdmin(actor.email, actor.roles)) notFound();

  const rowers = await db.rowParticipant.findMany({
    where: { challenge: CHALLENGE },
    select: {
      rowerNumber: true,
      displayName: true,
      instagram: true,
      division: true,
      createdAt: true,
    },
    orderBy: { rowerNumber: "asc" },
  });

  const joined = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <RowBar />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The signups</h2>
            <span className="mono">ADMIN ONLY — {rowers.length} ROWERS, JOIN ORDER</span>
          </div>
          {rowers.length === 0 ? (
            <p className="board-empty">NOBODY&rsquo;S SIGNED UP YET.</p>
          ) : (
            <table className="board">
              <thead>
                <tr>
                  <th>Bib</th>
                  <th>Name</th>
                  <th>Instagram</th>
                  <th>Board</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {rowers.map((r) => (
                  <tr key={r.rowerNumber}>
                    <td className="rk">{fmtRowerNumber(r.rowerNumber)}</td>
                    <td className="who">
                      <a href={`/row100k/r/${r.rowerNumber}`}>{r.displayName}</a>
                    </td>
                    <td>
                      <a
                        href={`https://instagram.com/${r.instagram}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        @{r.instagram}
                      </a>
                    </td>
                    <td>{r.division === "F" ? "W" : r.division}</td>
                    <td>{joined(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
