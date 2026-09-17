import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { analyseSession, comparableRows } from "@/lib/pm5/analysis";
import { getErgSession, listErgSessions } from "@/lib/pm5/store";
import type { TelemetryDoc, TelemetrySavedRow } from "@/lib/pm5/session";
import { ErgBar } from "../../ErgBar";
import { ergPageOpen, ergViewer, type ErgViewer } from "../../gate";
import { reviewCss } from "../../reviewCss";
import { Review } from "./Review";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Session — Erg telemetry",
  robots: { index: false, follow: false },
};

/* ONE SAVED PIECE, READ AFTER THE FACT (owner, 2026-09-17: "I really want
 * to emphasise the post hoc analysis screen").
 *
 * The page does the fetching and nothing else: the row and its document,
 * the rest of the account saved rows for the rank, and — when there is a
 * comparable piece already saved at this distance — that one document
 * too, so its force curve can be drawn behind this one. Everything after
 * that is analyseSession in src/lib/pm5/analysis.ts and the markup in
 * Review.tsx.
 *
 * THE REVIEW GROUND IS PAPER: cream, ink, water blue. The live screens
 * are ink. A piece being rowed and a piece being read are different
 * kinds of thing and they should not look alike.
 *
 * A row outside the account is a 404 here, the same as it is on the
 * route: an id says nothing about whose it is. */

function Shell({ v, children }: { v: ErgViewer; children: React.ReactNode }) {
  return (
    <div className="eg-paper">
      <style>{reviewCss}</style>
      <ErgBar active="sessions" viewer={v} />
      <div className="eg-wrap">{children}</div>
    </div>
  );
}

export default async function ErgSessionPage({ params }: { params: { id: string } }) {
  const v = await ergViewer();
  if (!ergPageOpen(v)) notFound();

  if (!v.userId) {
    return (
      <Shell v={v}>
        <div className="eg-head">
          <h1>Session</h1>
          <span className="eg-eyebrow">Sign in to read a saved piece</span>
        </div>
        <div className="eg-block">
          <b>Saved sessions belong to an account.</b> Sign in with Google and this link opens the piece it was
          saved under.
        </div>
        <p className="eg-btns">
          <a className="eg-btn" href={`/api/auth/signin?callbackUrl=${encodeURIComponent(`/erg/s/${params.id}`)}`}>
            Sign in
          </a>
        </p>
      </Shell>
    );
  }

  const scope = { userId: v.userId, isAdmin: v.isAdmin };
  let found: { row: TelemetrySavedRow; doc: TelemetryDoc } | null = null;
  let history: TelemetrySavedRow[] = [];
  let compare: { title: string; doc: TelemetryDoc } | null = null;

  try {
    found = await getErgSession({ ...scope, id: params.id });
    if (found) {
      /* THE RANK IS AGAINST THIS ACCOUNT, never against everyone: an
       * admin reading his own board wants his own pieces behind it. */
      history = await listErgSessions({ userId: v.userId, limit: 500 });
      const best = comparableRows(found.doc, history, found.row.id)[0];
      if (best) {
        const other = await getErgSession({ ...scope, id: best.id });
        if (other) compare = { title: other.row.title, doc: other.doc };
      }
    }
  } catch (err) {
    console.error("erg session page: load failed", err);
    return (
      <Shell v={v}>
        <div className="eg-head">
          <h1>Session</h1>
          <span className="eg-eyebrow">The database did not answer</span>
        </div>
        <div className="eg-block">
          <b>Could not load this session.</b> The database did not answer — try the link again in a moment.
        </div>
        <p className="eg-btns">
          <Link className="eg-btn eg-btn-quiet" href="/erg/sessions">
            All sessions
          </Link>
        </p>
      </Shell>
    );
  }

  if (!found) notFound();

  const a = analyseSession({ doc: found.doc, id: found.row.id, history, compare });

  return (
    <Shell v={v}>
      <Review row={found.row} a={a} />
    </Shell>
  );
}
