import { notFound } from "next/navigation";
import { computeBoards, type Division } from "@/lib/row100k";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { BarAccount } from "../BarAccount";
import { Dashboard } from "../Dashboard";
import { Boards } from "../Boards";

/* DEV-ONLY design preview for /row100k states that need a session or a
 * particular date to reach naturally: the joined dashboard (mock data), and
 * the pre-launch board (signups but zero meters / nobody at all).
 * ?view=dashboard[&tab=log|rows|curve] | ?view=startlist | ?view=empty
 * Returns 404 in production builds. */
export const dynamic = "force-dynamic";

const MOCK_ROWS = (() => {
  const rows: { id: string; day: string; meters: number; seconds: number; note: string }[] = [];
  const days = [2, 3, 5, 6, 8, 9, 11, 12, 14, 15, 17, 18, 19, 20];
  const meters = [5000, 3200, 6100, 1000, 4800, 5000, 7400, 2600, 10000, 4200, 5000, 3800, 6000, 5200];
  days.forEach((d, i) => {
    const m = meters[i];
    const split = 112 + ((i * 7) % 26);
    rows.push({
      id: `mock-${i}`,
      day: `2026-09-${String(d).padStart(2, "0")}`,
      meters: m,
      seconds: Math.round((m / 500) * split),
      note: i === 3 ? "1k test" : i === 8 ? "long one" : "",
    });
  });
  return rows.reverse();
})();

const START_LIST = ["Avery", "Blake", "Casey", "Drew", "Ellis", "Finley", "Gray", "Harper"].map((n, i) => ({
  id: `p${i}`,
  displayName: `Test ${n}`,
  instagram: `test.${n.toLowerCase()}`,
  division: i % 2 === 0 ? "M" : "F",
  rowerNumber: i + 1,
}));

export default function Row100kPreview({
  searchParams,
}: {
  searchParams: { view?: string; menu?: string };
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const view = searchParams.view ?? "dashboard";
  const meters = MOCK_ROWS.reduce((s, r) => s + r.meters, 0);
  const byDay = new Map<string, number>();
  for (const r of MOCK_ROWS) byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.meters);
  const bigDay = Math.max(...byDay.values());

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <div className="bar">
        <span className="mono tag">ROW100K</span>
        {view === "dashboard" ? (
          <BarAccount signedIn rowerNumber={23} defaultOpen={searchParams.menu === "1"} />
        ) : (
          <span className="mono">PREVIEW — NOT REAL DATA</span>
        )}
      </div>
      <section>
        <div className="wrap">
          {view === "dashboard" ? (
            <div className="panel">
              <Dashboard
                rowerNumber={23}
                displayName="Mikian Musser"
                instagram="mikian_"
                division={"M" as Division}
                meters={meters}
                sessions={MOCK_ROWS.length}
                bigDay={bigDay}
                rows={MOCK_ROWS}
                defaultDay="2026-09-20"
                phase="open"
                simulateOpen
              />
            </div>
          ) : (
            <Boards
              boards={computeBoards(view === "startlist" ? START_LIST : [], [])}
              started={false}
            />
          )}
        </div>
      </section>
    </div>
  );
}
