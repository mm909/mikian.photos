import { notFound } from "next/navigation";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";
import type { AdminRower } from "../../rowers/RowersTable";
import { RowersMock } from "./RowersMock";

/* DEV-ONLY preview of the rowers table (the real page is /row100k/signups,
 * admin only, which a signed-out dev server 404s): the same component on
 * mock rowers, so the menu, the open log and the inline editor can be seen
 * and driven without a session. Writes are stubbed (RowersMock) — nothing
 * leaves the page. 404 in production, the same gate as /row100k/preview;
 * not in the account menu. */
export const dynamic = "force-dynamic";

const NAMES = ["Avery Stone", "Blake Ortiz", "Casey Lund", "Drew Nakamura", "Ellis Park", "Finley Roe", "Gray Holm", "Harper Quinn"];

const MOCK: AdminRower[] = NAMES.map((name, i) => {
  const n = 3 + ((i * 5) % 9);
  const rows = Array.from({ length: i === 5 ? 0 : n }, (_, k) => {
    const meters = [5000, 3200, 6100, 10000, 4800, 2000, 7400, 2600, 12000, 4200, 5000][(i + k) % 11];
    const split = 108 + ((i * 7 + k * 5) % 40);
    return {
      id: `mock-${i}-${k}`,
      day: `2026-09-${String(2 + ((k * 3 + i) % 19)).padStart(2, "0")}`,
      meters,
      seconds: Math.round((meters / 500) * split),
      title: k % 3 === 0 ? `Rowtember #${k + 1}` : k % 3 === 1 ? "Sunrise piece" : "",
    };
  }).sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  return {
    id: `mock-p${i}`,
    rowerNumber: i + 1,
    name,
    instagram: name.toLowerCase().replace(/\s+/g, "."),
    division: i % 2 === 0 ? "M" : "F",
    joined: `Aug ${20 + i}`,
    email: i === 6 ? null : `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    meters: rows.reduce((s, r) => s + r.meters, 0),
    sessions: rows.length,
    seconds: rows.reduce((s, r) => s + r.seconds, 0),
    rows,
  };
});

export default function RowersPreview({ searchParams }: { searchParams?: { r?: string } }) {
  if (process.env.NODE_ENV === "production") notFound();
  const openNumber = searchParams?.r ? Number(searchParams.r) : null;
  const sessions = MOCK.reduce((s, r) => s + r.sessions, 0);
  const meters = MOCK.reduce((s, r) => s + r.meters, 0);

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <RowBar>
        <span className="mono">PREVIEW — NOT REAL DATA · NOTHING SAVES</span>
      </RowBar>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The rowers</h2>
            <span className="mono">
              PREVIEW — {MOCK.length} ROWERS · {sessions} SESSIONS · {meters.toLocaleString("en-US")} M
            </span>
          </div>
          <RowersMock rowers={MOCK} openNumber={Number.isInteger(openNumber) ? openNumber : null} />
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
