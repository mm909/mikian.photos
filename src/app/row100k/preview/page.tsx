import Link from "next/link";
import { notFound } from "next/navigation";
import { computeBoards, type Division } from "@/lib/row100k";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { BarAccount } from "../BarAccount";
import { BarNav } from "../BarNav";
import { RowBar } from "../RowBar";
import { Dashboard } from "../Dashboard";
import { LogPanel } from "../LogPanel";
import { Boards } from "../Boards";
import { JoinSim } from "./JoinSim";

/* DEV-ONLY design preview for /row100k states that need a session or a
 * particular date to reach naturally: the joined dashboard (mock data), the
 * profile logging station + share dialog, and the pre-launch board (signups
 * but zero meters / nobody at all).
 * ?view=dashboard | ?view=log | ?view=join (the signup moment, no Google —
 * fill the form, land on the fresh dashboard, bib dialog pops) |
 * ?view=startlist | ?view=board | ?view=empty
 * Returns 404 in production builds. */
export const dynamic = "force-dynamic";

const MOCK_ROWS = (() => {
  const rows: { id: string; day: string; meters: number; seconds: number }[] = [];
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

/* view=board: the same start list with a couple of weeks of fake meters so
 * the record cards + standings render populated. */
const BOARD_ENTRIES = START_LIST.flatMap((p, i) =>
  [2, 4, 7, 9, 12, 14, 16].slice(0, 3 + (i % 5)).map((day, k) => {
    const meters = k === 1 && i % 3 === 0 ? [1000, 5000, 10000][i % 3] : 3000 + ((i * 900 + k * 700) % 5000);
    return {
      participantId: p.id,
      day: `2026-09-${String(day + (i % 3)).padStart(2, "0")}`,
      meters,
      seconds: Math.round((meters / 500) * (115 + ((i * 13 + k * 7) % 30))),
    };
  }),
);

export default function Row100kPreview({
  searchParams,
}: {
  searchParams: { view?: string; menu?: string };
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const view = searchParams.view ?? "dashboard";
  const meters = MOCK_ROWS.reduce((s, r) => s + r.meters, 0);
  const byDay: Record<string, number> = {};
  for (const r of MOCK_ROWS) byDay[r.day] = (byDay[r.day] ?? 0) + r.meters;

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      {view === "dashboard" ? (
        /* Menu preview needs a pre-opened menu, which the real RowBar has no
         * prop for — this one view keeps a hand bar, built from the same
         * three children (.bar-lead, rail, .bar-right) so the phone reflow
         * and the pill behave exactly as on the real pages. */
        <div className="bar">
          <span className="bar-lead">
            <Link className="bar-brand" href="/">
              Mikian<span className="dot">.</span>Musser
            </Link>
          </span>
          <BarNav active="home" />
          <span className="bar-right">
            <BarAccount signedIn rowerNumber={23} admin defaultOpen={searchParams.menu === "1"} />
          </span>
        </div>
      ) : (
        <RowBar>
          <span className="mono">PREVIEW — NOT REAL DATA</span>
        </RowBar>
      )}
      {view === "log" ? (
        /* The profile's logging station with mock data — it renders its own
         * sections. The share dialog is reachable here without a session,
         * which is what makes phone testing over the LAN possible. */
        <LogPanel
          data={{
            displayName: "Mikian Musser",
            rowerNumber: 23,
            instagram: "mikian_",
            meters,
            sessions: MOCK_ROWS.length,
            byDay,
            division: "M",
            longest: Math.max(...MOCK_ROWS.map((r) => r.meters)),
            rank: { place: 3, of: 14 },
            records: [
              { key: "total", label: "Total meters", place: 3, value: "69,300 m" },
              { key: "fastest5000", label: "Fastest 5k", place: 1, value: "19:04.2" },
              { key: "longest", label: "Longest row", place: 2, value: "10,000 m" },
              { key: "bigday", label: "Biggest day", place: 6, value: "10,000 m" },
            ],
          }}
          rows={MOCK_ROWS}
          defaultDay="2026-09-20"
          phase="open"
          simulate
        />
      ) : (
        <section>
          <div className="wrap">
            {view === "join" ? (
              <JoinSim />
            ) : view === "dashboard" ? (
              <div className="panel">
                <Dashboard
                  rowerNumber={23}
                  displayName="Mikian Musser"
                  instagram="mikian_"
                  division={"M" as Division}
                  meters={meters}
                  sessions={MOCK_ROWS.length}
                  rows={MOCK_ROWS}
                  phase="open"
                  defaultDay="2026-09-20"
                  defaultTitle={`Rowtember #${MOCK_ROWS.length + 1}`}
                  simulate
                />
              </div>
            ) : (
              <Boards
                boards={computeBoards(
                  view === "startlist" || view === "board" ? START_LIST : [],
                  view === "board" ? BOARD_ENTRIES : [],
                )}
                started={view === "board"}
              />
            )}
          </div>
        </section>
      )}
    </div>
  );
}
