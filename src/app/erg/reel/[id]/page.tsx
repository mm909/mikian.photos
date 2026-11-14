import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getErgSession, listErgSessions } from "@/lib/pm5/store";
import type { TelemetryDoc } from "@/lib/pm5/session";
import { CHALLENGE } from "@/lib/row100k";
import { editionOf, monthFromKey, monthName, pacificDayKey } from "@/lib/rowPeriod";
import { ergPageOpen, ergViewer } from "../../gate";
import { reviewCss } from "../../reviewCss";
import { ErgShell } from "../../Shell";
import { ReelStudio } from "../ReelStudio";
import { reelCss } from "../reelCss";
import { buildSeries, sampleDoc } from "../series";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reel graphics (dev) — Erg telemetry",
  robots: { index: false, follow: false },
};

/* REEL GRAPHICS FOR ONE SAVED PIECE (owner, 2026-11-13: "I need to get
 * graphics for the daily reel videos that I make after I row my daily 5k
 * for Rowvember").
 *
 * The page fetches and nothing else: the saved document, turned into the
 * time series the painters read, and the month's logged metres before the
 * day of the row so the counter can run 50,000 to 55,000 instead of 0 to
 * 5,000. Everything after that is ReelStudio in the browser.
 *
 * IN DEVELOPMENT (CLAUDE.md: new pages start there): it sits behind the
 * /erg door, which in production is an admin account only, and is linked
 * only from the saved sessions. */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <ErgShell ground="paper" sheet={reviewCss}>
      <style>{reelCss}</style>
      {children}
    </ErgShell>
  );
}

/* The month's logged metres before the day of the row, and on it. A failure
 * reads as zero: the box on the page takes a typed number either way. */
async function monthMetres(userId: string, firstDay: string, day: string): Promise<{ before: number; sameDay: number }> {
  try {
    const rows = await db.rowEntry.findMany({
      where: { participant: { userId, challenge: CHALLENGE }, day: { gte: firstDay, lte: day } },
      select: { day: true, meters: true },
    });
    let before = 0;
    let sameDay = 0;
    for (const r of rows) {
      if (r.day < day) before += r.meters;
      else sameDay += r.meters;
    }
    return { before, sameDay };
  } catch (err) {
    console.error("erg reel: month total lookup failed, starting the counter at zero", err);
    return { before: 0, sameDay: 0 };
  }
}

export default async function ErgReelPage({ params }: { params: { id: string } }) {
  const v = await ergViewer();
  if (!ergPageOpen(v)) notFound();

  /* LOCAL DEV IS OPEN, signed in or not (gate.ts), so a laptop with no
   * session reads any saved row. `latest` is the newest saved piece — the
   * viewer's own, or on a signed-out laptop the newest real row there is
   * (owner, 2026-11-13: "use real data in this sim"). `sample` is the
   * made-up 5 k, and what `latest` falls back to with no database. */
  const dev = process.env.NODE_ENV !== "production";
  const open = dev && !v.userId;
  let id = params.id;
  let sample = dev && id === "sample";
  if (id === "latest") {
    try {
      if (v.userId) id = (await listErgSessions({ userId: v.userId, limit: 1 }))[0]?.id ?? "";
      else if (open) id = (await db.rowTelemetry.findFirst({ where: { simulated: false, meters: { gte: 1000 } }, orderBy: { startedAt: "desc" }, select: { id: true } }))?.id ?? "";
    } catch (err) {
      console.error("erg reel page: latest lookup failed", err);
      id = "";
    }
    if (!id && dev) sample = true;
  }

  if (!sample && !open && !v.userId) {
    return (
      <Shell>
        <div className="eg-head">
          <h1>Reel graphics</h1>
          <span className="eg-eyebrow">Sign in to open a saved piece</span>
        </div>
        <p className="eg-btns">
          <a className="eg-btn" href={`/sign-in?callbackUrl=${encodeURIComponent(`/erg/reel/${params.id}`)}`}>
            Sign in
          </a>
        </p>
      </Shell>
    );
  }

  let doc: TelemetryDoc | null = null;
  let title = "Sample 5 k";
  let startedAt = "";
  let owner: string | null = v.userId;
  if (sample) doc = sampleDoc();
  else {
    try {
      const found = await getErgSession({ userId: v.userId ?? "", isAdmin: v.isAdmin || open, id });
      /* The month's total belongs to whoever saved the row. */
      if (found && open) owner = (await db.rowTelemetry.findUnique({ where: { id }, select: { userId: true } }))?.userId ?? null;
      if (found) {
        doc = found.doc;
        title = found.row.title;
        startedAt = found.row.startedAt;
      }
    } catch (err) {
      console.error("erg reel page: load failed", err);
      return (
        <Shell>
          <div className="eg-head">
            <h1>Reel graphics</h1>
            <span className="eg-eyebrow">The database did not answer</span>
          </div>
          <div className="eg-block">
            <b>Could not load this session.</b> Try the link again in a moment.
          </div>
        </Shell>
      );
    }
  }
  if (!doc) notFound();

  const atMs = Date.parse(startedAt || doc.startedAt) || Date.now();
  const day = pacificDayKey(atMs);
  const month = monthFromKey(day.slice(0, 7));
  const label = (month ? monthName(month) : "Month").toUpperCase();
  const totals = owner && month ? await monthMetres(owner, month.firstDay, day) : { before: 0, sameDay: 0 };
  const markSrc = month && editionOf(month) === "Rowvember" ? "/row100k/rowvember/rowvember-mark.svg" : null;

  return (
    <Shell>
      <div className="rv-top">
        <div>
          <span className="rv-eyebrow">Reel graphics · in development</span>
          <h1 className="rv-title">{title}</h1>
        </div>
        <div className="eg-btns" style={{ margin: 0 }}>
          {sample ? null : (
            <Link className="eg-btn eg-btn-quiet" href={`/erg/s/${id}`}>
              The read
            </Link>
          )}
          <Link className="eg-btn eg-btn-quiet" href="/erg/sessions">
            All sessions
          </Link>
        </div>
      </div>

      <ReelStudio
        series={buildSeries(doc)}
        label={label}
        day={Number(day.slice(8)) || 1}
        before={totals.before}
        markSrc={markSrc}
        fileBase={`${label.toLowerCase()}-${day}`}
      />

      <div className="eg-tail">
        <p>
          <b>Video has no transparency.</b> Record on the green screen, drop the clip over your footage and key the
          green out (CapCut: Remove background, Chroma key; Edits: Green screen). BLACK works with a Screen blend.
          RECORD ALL films every clip and every monitor screen one after another at the length picked.
          The brown and cream cards are finished shots of their own. STILL PNG is the frame on screen with nothing
          behind it.
        </p>
        <p>
          <b>The clip films as it plays.</b> A 10 second clip takes 10 seconds to record; keep this tab in front
          until it says the clip is ready, then SAVE / SHARE puts it in your camera roll.
        </p>
        <p>
          The starting total is every row you logged in {label} before {day}
          {totals.sameDay > 0 ? `; the ${totals.sameDay.toLocaleString("en-US")} m logged on the day itself are left out, as this row` : ""}. Type over it
          if it is off.
        </p>
      </div>
    </Shell>
  );
}
