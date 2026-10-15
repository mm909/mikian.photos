import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { gateLasdDev } from "@/lib/lasd26/devGate";
import { ClearPile } from "../../ClearPile";
import { LasdPage } from "../LasdPage";

/**
 * THE LIST, the dev copy (lasdPath("/the-list") = /lasd26/dev/the-list;
 * lib/lasd26/paths.ts) — the crew-call applicant list, OWNER ONLY in every
 * environment (owner, 2026-10-15: "in a dev tab only that I can see"). It
 * used to be a shareable link with emails hidden from everyone but the
 * owner; now anyone else gets a 404 and the only door is the DEVELOPMENT
 * group of the account menu. The table and the clear button (ClearPile,
 * shared with the live /lasd26/the-list one folder up) stay as they were.
 */

export const metadata: Metadata = {
  title: "LASD26 — The List (dev)",
  description: "Who put their name in.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#F4F3EE",
};

// Live list + session-gated — never render statically.
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
  const viewer = await gateLasdDev();
  if (!viewer.owner) notFound();

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
    <LasdPage viewer={viewer} active="none">
      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The list</h2>
            <span className="mono">{applicants.length} IN — CREW CALL CLOSED</span>
          </div>
          {applicants.length === 0 ? (
            <p className="list-empty">NO NAMES.</p>
          ) : (
            <table className="pile">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Email</th>
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
                    <td>{a.email || "—"}</td>
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
          {applicants.length > 0 && <ClearPile count={applicants.length} />}
        </div>
      </section>

      <footer>
        <div className="wrap" style={{ padding: 0 }}>
          <p className="mono">for yourself and others</p>
        </div>
      </footer>
    </LasdPage>
  );
}
