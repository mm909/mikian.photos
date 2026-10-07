import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { devTitle, gateTrackerPage } from "@/lib/tracker/gate";
import { fmtDateTime } from "@/lib/tracker/format";
import { baseCss, fontClass } from "./theme";

/* /track — a tiny index of the synced events, for the owner and local dev.
 * Spectators arrive by a shared /track/<slug> link and never see this.
 * Same gate as every tracker page (admin-only in production while in
 * development); the crew/van links print the key for admins only, since
 * the key IS the door to those pages. */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: devTitle("Live tracker"),
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#101214" };

const css = `
.trk .idx{padding:28px 16px 48px}
.trk .idx h1{font-family:var(--trk-cond),sans-serif;font-weight:600;font-size:30px;line-height:1.05;margin-top:8px}
.trk .idx ul{list-style:none;margin-top:20px;display:flex;flex-direction:column;gap:12px}
.trk .idx li{padding:14px 16px}
.trk .idx .ev{display:flex;align-items:baseline;justify-content:space-between;gap:12px;text-decoration:none}
.trk .idx .ev .n{font-family:var(--trk-cond),sans-serif;font-weight:600;font-size:22px;line-height:1.1}
.trk .idx .meta{margin-top:6px;color:var(--muted);font-size:14px}
.trk .idx .links{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.trk .idx .links a{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;border-radius:8px;border:1px solid var(--line);text-decoration:none;font-size:14px;font-weight:600}
.trk .idx .nokey{color:var(--warn);font-size:13px;margin-top:8px}
.trk .idx code{font-family:var(--trk-mono),ui-monospace,monospace;font-size:13px}
`;

export default async function TrackIndexPage() {
  const { admin } = await gateTrackerPage();
  const events = await db.trackerEvent.findMany({
    orderBy: { startTime: "desc" },
    select: {
      id: true,
      name: true,
      kind: true,
      startTime: true,
      timezone: true,
      status: true,
      crewKey: true,
      _count: { select: { entries: true } },
    },
  });

  return (
    <div className={`trk ${fontClass}`}>
      <style dangerouslySetInnerHTML={{ __html: baseCss + css }} />
      <div className="wrap idx">
        <p className="mono">Live tracker</p>
        <h1>Events</h1>
        {events.length === 0 && (
          <p className="muted" style={{ marginTop: 14 }}>
            No events synced yet. Run <code>npm run track:sync</code>, or POST <code>/api/track/sync</code> as an admin.
          </p>
        )}
        <ul>
          {events.map((ev) => {
            const k = encodeURIComponent(ev.crewKey);
            return (
              <li key={ev.id} className="panel">
                <Link className="ev" href={`/track/${ev.id}`}>
                  <span className="n">{ev.name}</span>
                  <span className="mono">{ev.status === "archived" ? "archived" : ev.kind}</span>
                </Link>
                <div className="meta">
                  {fmtDateTime(ev.startTime.toISOString(), ev.timezone)} · {ev._count.entries} {ev._count.entries === 1 ? "entry" : "entries"} · <code>/track/{ev.id}</code>
                </div>
                {admin && (
                  <>
                    <div className="links">
                      <Link href={`/track/${ev.id}/join`}>Runner setup</Link>
                      {ev.crewKey ? (
                        <>
                          <Link href={`/track/${ev.id}/crew?k=${k}`}>Crew</Link>
                          <Link href={`/track/${ev.id}/van?k=${k}`}>Van</Link>
                        </>
                      ) : null}
                    </div>
                    {!ev.crewKey && <p className="nokey">No crew key: set the env var named in events/{ev.id}.yaml and re-sync.</p>}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
