"use client";

import { useMemo, useState } from "react";
import type { ClientShell } from "@/lib/tracker/eventData";
import { fmtAgo } from "@/lib/tracker/format";
import { CopyButton, OnlinePill, TrackHeader, apiUrl, fetchJson, freshness, slotInfoOf, slotNameOf, useStoredChoice, useTick, useVisiblePoll, type SlotInfoByEntry } from "../crew/ui";

/**
 * Runner setup (TRACKER_SPEC.md §11 Runner setup): pick your name, see
 * EXACTLY what to type into Traccar Client — server address and your own
 * device identifier, both with a copy button — the settings we recommend,
 * the phone checklist, and a live "we last heard from your phone N s ago"
 * check so every runner can prove their setup before race day.
 *
 * No key: this page is for the runners, who have no crew link. It reads
 * only /api/track/[slug]/devices, which is behind the tracker's read gate.
 *
 * Pairs (owner, 2026-10-15: "we are running two by two"): the setup is the
 * same — one phone, one device id — so the page only adds one line saying
 * the crew marks who is in A and who is in B.
 */

/** One row of GET /api/track/[slug]/devices (the URL contract). */
interface DeviceRow {
  external_id: string;
  source: string;
  role: string;
  participant_id: string | null;
  participant_name: string | null;
  entry_id: string | null;
  last_fix_time: string | null;
  age_s: number | null;
  battery_pct: number | null;
  accuracy_m: number | null;
}

const POLL_MS = 10_000;

export function JoinApp({ shell, traccarUrl, admin, slotInfo }: { shell: ClientShell; traccarUrl: string | null; admin: boolean; slotInfo: SlotInfoByEntry }) {
  const slug = shell.id;
  const now = useTick(1000);

  const people = useMemo(
    () => shell.entries.flatMap((e) => e.participants.map((p) => ({ p, e }))),
    [shell.entries],
  );
  const [pid, setPid, loaded] = useStoredChoice(`trk:join:${slug}`);
  const me = useMemo(() => people.find((x) => x.p.id === pid) ?? null, [people, pid]);
  const device = me?.p.device ?? null;

  /* "Running in pairs: the crew taps who is in A and who is in B" — only
   * for an entry with more than one slot; a classic relay says nothing. */
  const pairsLine = useMemo(() => {
    const info = slotInfoOf(slotInfo, me?.e.id);
    if (info.slots < 2) return null;
    const names = Array.from({ length: info.slots }, (_, i) => slotNameOf(info, i + 1));
    if (info.slots === 2) return `Running in pairs: the crew taps who is in ${names[0]} and who is in ${names[1]}.`;
    return `Running ${info.slots} at a time: the crew taps who is in each of ${names.join(", ")}.`;
  }, [slotInfo, me]);

  /* Live check */
  const [devices, setDevices] = useState<DeviceRow[] | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  useVisiblePoll(
    async () => {
      try {
        const data = await fetchJson<{ devices: DeviceRow[] }>(apiUrl(slug, "devices"));
        setDevices(data.devices ?? []);
        setFetchedAt(Date.now());
        setCheckError(null);
      } catch (err) {
        setCheckError(err instanceof Error ? err.message : "Could not reach the server");
      }
    },
    POLL_MS,
    Boolean(device),
  );
  const mine = device && devices ? devices.find((d) => d.external_id === device.externalId && d.source === device.source) ?? null : null;
  // age_s was true when the server answered; add the seconds since.
  const ageS = mine && mine.age_s !== null && fetchedAt && now ? mine.age_s + (now - fetchedAt) / 1000 : null;
  const fresh = freshness(ageS);

  const entryStyle = me ? ({ "--entry": me.e.color } as React.CSSProperties) : undefined;

  return (
    <div className="c-page" style={entryStyle}>
      <TrackHeader kicker="Runner setup" title={shell.name} right={<OnlinePill />} />

      <main className="c-main">
        {!loaded ? (
          <div className="c-section c-sub">…</div>
        ) : !me ? (
          <section className="c-section">
            <p className="c-lead">Who are you?</p>
            {shell.entries.map((e) => (
              <div key={e.id} style={{ marginBottom: 18 }}>
                <div className="c-h">
                  <span className="c-teamchip" style={{ "--entry": e.color } as React.CSSProperties}>
                    <span className="tag">{e.shortName}</span> {e.name}
                  </span>
                </div>
                <div className="c-people" style={{ "--entry": e.color } as React.CSSProperties}>
                  {e.participants.map((p) => (
                    <button key={p.id} type="button" className="c-person" onClick={() => setPid(p.id)}>
                      <span className="chip" aria-hidden="true">
                        {p.initials}
                      </span>
                      {p.name}
                      {!p.device && <small>no phone set up</small>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <p className="c-sub">Remembered on this phone.</p>
          </section>
        ) : (
          <>
            <section className="c-section">
              <div className="c-h">
                <span className="c-teamchip">
                  <span className="tag">{me.e.shortName}</span> {me.e.name}
                </span>
                <button type="button" className="c-link" onClick={() => setPid(null)}>
                  Not you?
                </button>
              </div>
              <div className="c-now">
                <span className="chip">{me.p.initials}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="who">{me.p.name}</div>
                  <div className="since">{device ? "Your phone is the tracker. Set it up below." : "Your phone is not set up for tracking yet."}</div>
                </div>
              </div>
              {pairsLine && <p className="c-sub">{pairsLine}</p>}
            </section>

            {!device ? (
              <section className="c-section">
                <p className="c-lead">Your phone is not set up for tracking yet — ask the crew.</p>
                <p className="c-sub">
                  The owner adds a device for you in the event file and runs the sync; then this page shows what to enter.
                </p>
              </section>
            ) : (
              <>
                {/* Live check first: the thing a runner comes back to */}
                <section className="c-section">
                  <div className="c-h">
                    <span className="mono">Live check</span>
                    <span className="mono">
                      {checkError ? <span className="bad">{checkError}</span> : fetchedAt && now ? `checked ${fmtAgo((now - fetchedAt) / 1000)}` : "checking…"}
                    </span>
                  </div>
                  <div className={`c-live ${fresh}`} aria-live="polite">
                    {mine && mine.last_fix_time && ageS !== null ? (
                      <>
                        <span className="mono">We last heard from your phone</span>
                        <div className="big">{fmtAgo(ageS)}</div>
                        <div className="meta">
                          {mine.battery_pct !== null && <span>Battery {Math.round(mine.battery_pct)}%</span>}
                          {mine.accuracy_m !== null && <span>Accuracy ±{Math.round(mine.accuracy_m)} m</span>}
                          <span>
                            {fresh === "ok" ? "Working." : fresh === "warn" ? "Getting quiet — is the app still running?" : "Too long ago. Open the app and check the service is on."}
                          </span>
                        </div>
                      </>
                    ) : devices === null && !checkError ? (
                      <>
                        <span className="mono">We last heard from your phone</span>
                        <div className="big">…</div>
                      </>
                    ) : (
                      <>
                        <span className="mono">We last heard from your phone</span>
                        <div className="big">Nothing yet</div>
                        <div className="meta">
                          <span>Open the app and start the service. This updates every 10 seconds.</span>
                        </div>
                      </>
                    )}
                  </div>
                </section>

                <section className="c-section">
                  <div className="c-h">
                    <span className="mono">What to enter in Traccar Client</span>
                  </div>
                  <ol className="c-steps">
                    <li>
                      <b>Get the app.</b> Search <b>&ldquo;Traccar Client&rdquo;</b> on the App Store (iPhone) or Google Play (Android). Open it.
                    </li>
                    <li>
                      <b>Server URL</b> — exactly this, port included:
                      <div className="c-field" style={{ marginTop: 8 }}>
                        {traccarUrl ? (
                          <div className="c-copy">
                            <span className="c-code">{traccarUrl}</span>
                            <CopyButton text={traccarUrl} />
                          </div>
                        ) : (
                          <div className="c-copy">
                            <span className="c-sub">Ask the crew for the server address.</span>
                          </div>
                        )}
                      </div>
                    </li>
                    <li>
                      <b>Device identifier</b> — yours, nobody else&rsquo;s:
                      <div className="c-field" style={{ marginTop: 8 }}>
                        <div className="c-copy">
                          <span className="c-code">{device.externalId}</span>
                          <CopyButton text={device.externalId} />
                        </div>
                      </div>
                    </li>
                    <li>
                      <b>Settings</b> — our recommendation for a day on the road:
                      <div className="c-settings" style={{ marginTop: 8 }}>
                        <div className="c-kv">
                          <span>Location accuracy</span>
                          <b>Highest</b>
                        </div>
                        <div className="c-kv">
                          <span>Distance</span>
                          <b>20 m</b>
                        </div>
                        <div className="c-kv">
                          <span>Interval (frequency)</span>
                          <b>15 s</b>
                        </div>
                        <div className="c-kv">
                          <span>Offline buffering</span>
                          <b>On</b>
                        </div>
                        <div className="c-kv">
                          <span>Stop detection</span>
                          <b>On</b>
                        </div>
                      </div>
                    </li>
                    <li>
                      <b>Start the service</b> — the switch at the top of the app — and watch the live check above turn green.
                    </li>
                  </ol>
                </section>

                <section className="c-section">
                  <div className="c-h">
                    <span className="mono">Phone checklist</span>
                  </div>
                  <ul className="c-check">
                    <li>
                      <span>
                        Location permission <b>&ldquo;Always&rdquo;</b>, Precise location on.
                        <small>iPhone: Settings → Traccar Client → Location. Android: App info → Permissions → Location → Allow all the time.</small>
                      </span>
                    </li>
                    <li>
                      <span>
                        <b>Low Power Mode off</b> (iPhone) / Battery Saver off (Android).
                        <small>Both slow location updates to a crawl. Carry a battery pack instead.</small>
                      </span>
                    </li>
                    <li>
                      <span>
                        <b>Never swipe the app closed.</b>
                        <small>Force-quitting from the app switcher stops tracking until you open it again.</small>
                      </span>
                    </li>
                    <li>
                      <span>
                        Android: battery use <b>Unrestricted</b> — &ldquo;don&rsquo;t kill my app&rdquo;.
                        <small>App info → Battery → Unrestricted. Samsung: also take it out of &ldquo;Sleeping apps&rdquo;.</small>
                      </span>
                    </li>
                    <li>
                      <span>
                        After a restart, <b>open the app once</b>.
                        <small>It does not resume on its own after a reboot.</small>
                      </span>
                    </li>
                    <li>
                      <span>
                        Keep <b>mobile data on</b>; airplane mode off.
                        <small>Fixes are buffered without signal and sent later, but only if data is allowed.</small>
                      </span>
                    </li>
                  </ul>
                </section>
              </>
            )}
          </>
        )}

        <footer className="c-foot">
          Your position is shared with the crew and on the event&rsquo;s live page during the event.
          {admin && (
            <>
              {" "}
              <a href={`/track/${encodeURIComponent(slug)}`}>Public page →</a>
            </>
          )}
        </footer>
      </main>
    </div>
  );
}
