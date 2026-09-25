import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fmtMeters } from "@/lib/pm5/pm5";
import { fmtSplit, fmtWhen } from "@/lib/pm5/analysis";
import { fmtTenthsClock, type TelemetrySavedRow } from "@/lib/pm5/session";
import { listErgSessions } from "@/lib/pm5/store";
import { ergPageOpen, ergViewer } from "../gate";
import { reviewCss } from "../reviewCss";
import { ErgShell } from "../Shell";
import { DeleteSession } from "../s/DeleteSession";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sessions — Erg telemetry",
  robots: { index: false, follow: false },
};

/* SESSIONS (owner, 2026-09-17: "save them independently of each other"
 * and "let us build the post hoc analysis screen").
 *
 * Every piece this account has saved, newest first, one row each. The
 * title opens the analysis screen; PLAY hands the id to the monitors
 * screen, which builds a playback driver out of the saved document and
 * feeds it to a card exactly like a monitor in the room. This is also
 * where the PLAY BACK A SAVED ROW button on the monitors screen lands
 * (it arrives with play=1, which only changes the line at the top).
 *
 * A REVIEW SURFACE, so it wears paper rather than the ink of the live
 * screens. No heart rate column, no challenge, no rower number — a
 * session belongs to an account and prints the erg and the piece.
 *
 * WHAT EXPLAINS IS AT THE FOOT (owner, 2026-09-17: "whenever we have text
 * that explains something, let us put it on the bottom of the page rather
 * than the top"). What is left at the top is the title, the count and the
 * controls — and the one thing that BLOCKS a reader, which is being signed
 * out, because that is not an explanation, it is the answer. */

const dash = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v).toLocaleString("en-US") : "—");

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <ErgShell ground="paper" sheet={reviewCss}>
      {children}
    </ErgShell>
  );
}

export default async function ErgSessionsPage({ searchParams }: { searchParams: { play?: string } }) {
  const v = await ergViewer();
  if (!ergPageOpen(v)) notFound();
  const picking = searchParams.play === "1";

  if (!v.userId) {
    return (
      <Shell>
        <div className="eg-head">
          <h1>Sessions</h1>
          <span className="eg-eyebrow">Sign in to see what is saved</span>
        </div>
        <div className="eg-block">
          <b>Saved sessions belong to an account.</b> Sign in with Google to see the pieces saved under yours.
          Monitors and SIMULATE work signed out; SAVE does not.
        </div>
        <p className="eg-btns">
          <a className="eg-btn" href={`/row100k/sign-in?callbackUrl=${encodeURIComponent("/erg/sessions")}`}>
            Sign in
          </a>
        </p>
      </Shell>
    );
  }

  let rows: TelemetrySavedRow[] = [];
  let failed = false;
  try {
    rows = await listErgSessions({ userId: v.userId, limit: 500 });
  } catch (err) {
    console.error("erg sessions page: list failed", err);
    failed = true;
  }

  const meters = rows.reduce((a, r) => a + (r.simulated ? 0 : r.meters), 0);

  return (
    <Shell>
      <div className="eg-head">
        <h1>Sessions</h1>
        <span className="eg-eyebrow">
          {rows.length.toLocaleString("en-US")} saved · {fmtMeters(meters)} rowed
        </span>
      </div>

      {failed ? (
        <div className="eg-block">
          <b>The database did not answer.</b> Nothing has been lost — reload the page in a moment.
        </div>
      ) : null}

      {rows.length ? (
        <div className="rv-tablewrap">
          <table className="rv-table">
            <thead>
              <tr>
                <th className="lead">Piece</th>
                <th>Distance</th>
                <th>Time</th>
                <th>Split</th>
                <th>Rate</th>
                <th>Strokes</th>
                <th>Watts</th>
                <th className="lead">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="lead">
                    <Link className="rv-open" href={`/erg/s/${r.id}`}>
                      {r.title}
                    </Link>
                    <br />
                    {fmtWhen(r.startedAt)} · {r.device}
                    {r.simulated ? " · simulated" : ""}
                  </td>
                  <td>{r.meters.toLocaleString("en-US")} m</td>
                  <td>{fmtTenthsClock(r.tenths)}</td>
                  <td className="pace">{fmtSplit(r.avgPaceTenths)}</td>
                  <td>{dash(r.avgSpm)}</td>
                  <td>{dash(r.strokes)}</td>
                  <td>{dash(r.avgWatts)}</td>
                  <td className="lead">
                    <span style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
                      <Link className="eg-btn eg-btn-quiet" href={`/erg?play=${encodeURIComponent(r.id)}`}>
                        Play
                      </Link>
                      <DeleteSession id={r.id} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : failed ? null : (
        <div className="eg-empty">
          Nothing saved yet — pair a monitor on MONITORS, row a piece, and SAVE puts it here.
        </div>
      )}

      <p className="eg-btns" style={{ marginTop: 22 }}>
        <Link className="eg-btn eg-btn-quiet" href="/erg">
          Back to monitors
        </Link>
      </p>

      {/* ---- WHAT EXPLAINS, AT THE FOOT (owner, 2026-09-17) ---- */}
      <div className="eg-tail">
        {picking ? (
          <p>
            <b>Pick a row to play back.</b> PLAY opens the monitors screen and feeds that saved document to a row
            the same way a monitor in the room feeds one — the same numbers, the same charts, the same force
            curve, at the speed it was rowed.
          </p>
        ) : null}
        <p>
          <b>Every piece saved to this account.</b> Open one for the read: how it ranks, how it was paced, what
          moved through it, and the splits as the monitor recorded them. PLAY hands it back to the monitors
          screen as a row that plays.
        </p>
        <p>
          A session is filed under the account that saved it, and a piece only reaches this list once SAVE has
          run — until then it lives in the tab that recorded it.
        </p>
      </div>

      <p className="eg-foot">Erg telemetry · saved sessions belong to the account that saved them</p>
    </Shell>
  );
}
