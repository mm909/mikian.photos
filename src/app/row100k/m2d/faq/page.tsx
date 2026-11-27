import type { Metadata } from "next";
import Link from "next/link";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";
import { board100kCss } from "../../board/board100kCss";
import { M2D_CAP, m2dView } from "../../m2d";
import { m2dCss } from "../m2dCss";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "M2D FAQ — Rowtember",
  description: "How the M2D dollars add up, how to log a row for M2D, and the questions people ask.",
};

/* THE M2D FAQ (owner, 2026-11-25: tapping CONCEPT2 or ROWTEMBER in the
 * receipts opens a page that shows the math). Public, as /m2d is: part of
 * the live page, so no development gate. The app's twin is M2dFaq in
 * mobile/src/screens/M2D.tsx; the same numbers, from m2dView. Nothing here
 * asks anybody for money (owner: "I don't want to ask people for money"). */

const num = (n: number) => Math.round(n).toLocaleString("en-US");
const usd = (d: number) => (d >= 1000 ? `$${num(d)}` : `$${d.toFixed(2)}`);
const cents = (c: number) => (c >= 100 ? `$${(c / 100).toFixed(c % 100 ? 2 : 0)}` : `${Math.round(c * 100) / 100}¢`);

export default async function M2dFaqPage() {
  const viewer = await resolveViewer();
  const v = await m2dView(viewer).catch(() => null);

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{board100kCss}</style>
      <style>{m2dCss}</style>
      <RowBar active="m2d" {...barProps(viewer)} />
      <main className="bd m2 m2-faq">
        <div className="wrap front">
          <h1 className="bd-date">
            <b>M2D FAQ</b>
            <span>
              <Link href="/m2d">Back to M2D</Link>
            </span>
          </h1>
          {!v ? (
            <p className="bd-say" role="alert">
              M2D could not be read just now. Try again.
            </p>
          ) : (
            <>
              {/* THE M2D FAQ (owner, 2026-11-26: "this page should be a M2D FAQ
                  and a section of that is the how it adds up"; "change the
                  Rowtember site as well"): HOW IT ADDS UP, HOW DO I LOG A ROW,
                  QUESTIONS, as the app's. */}
              <h2 className="m2-sec">How it adds up</h2>
              <h2 id="concept2">
                Concept2 <i>{usd(v.totals.raised)}</i>
              </h2>
              <p>
                Every rower who reaches 100,000 meters between Nov 26 and Dec 24 earns a donation from Concept2: 2¢ a kilometer for the first 100,
                then 4¢ a kilometer after that. It goes to the charity the rower picks in their Concept2 Logbook.
              </p>
              <p>
                Our Concept2 figure adds that up for every registered Rowtember rower past 100K, from the rows they log on ROW:{" "}
                {v.totals.past100k} {v.totals.past100k === 1 ? "rower" : "rowers"} so far, {usd(v.totals.raised)}. Concept2 counts the
                meters in each rower&apos;s Logbook, so its own number can differ.
              </p>

              <h2 id="rowtember">
                {v.match.by} <i>{usd(v.totals.matched)}</i>
              </h2>
              <p>
                {v.match.by} matches Concept2: {cents(v.rate)} for every kilometer a registered rower logs on ROW, from the first meter.
              </p>
              <dl className="sum">
                <div>
                  <dt>Meters by registered rowers</dt>
                  <dd>{num(v.totals.inMeters ?? 0)} m</dd>
                </div>
                <div>
                  <dt>Kilometers × {cents(v.rate)}</dt>
                  <dd>
                    {num((v.totals.inMeters ?? 0) / 1000)} km × {cents(v.rate)}
                  </dd>
                </div>
                <div>
                  <dt>{v.match.by}</dt>
                  <dd>{usd(v.totals.matched)}</dd>
                </div>
              </dl>
              <p>Where it goes, so far:</p>
              <dl className="sum">
                {v.charities.map((c) => (
                  <div key={c.key}>
                    <dt>
                      {c.url ? (
                        <a href={c.url} target="_blank" rel="noopener noreferrer">
                          {c.full} ↗
                        </a>
                      ) : (
                        c.full
                      )}
                    </dt>
                    <dd>{usd(v.totals.split[c.key as keyof typeof v.totals.split] ?? 0)}</dd>
                  </div>
                ))}
                {v.totals.unpicked > 0 ? (
                  <div>
                    <dt>No charity picked yet</dt>
                    <dd>{usd(v.totals.unpicked)}</dd>
                  </div>
                ) : null}
              </dl>
              <p>
                <Link href="/m2d" className="m2-btn">
                  Pick my charity
                </Link>
              </p>

              {/* WHAT A ROW RAISES (owner, 2026-11-25: the 50K to 300K lines
                  moved here from the M2D page, so the board comes sooner). */}
              {/* WHAT YOUR METERS ARE WORTH, A TABLE (owner, 2026-11-26: "should
                  have a concept 2 Col, a ROW col, and a total. And then
                  something for the special donations if there are any"). */}
              <h2 id="ladder">What your meters are worth</h2>
              {(() => {
                const pledge = Math.max(0, (v.perKm ?? v.rate) - v.rate);
                const cols: [string, (m: number) => number][] = [
                  ["Concept2", (m) => (m < 100_000 ? 0 : 2 + 0.04 * (m / 1000 - 100))],
                  [v.match.by, (m) => ((m / 1000) * v.rate) / 100],
                  ...(pledge > 0 ? ([["Pledges", (m: number) => ((m / 1000) * pledge) / 100]] as [string, (m: number) => number][]) : []),
                ];
                return (
                  <>
                    <table className="m2-worth-t">
                      <thead>
                        <tr>
                          <th>You row</th>
                          {cols.map(([k]) => (
                            <th key={k}>{k}</th>
                          ))}
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[10_000, 50_000, 100_000, 150_000, 200_000, 300_000].map((m) => (
                          <tr key={m}>
                            <td>{num(m / 1000)}K</td>
                            {cols.map(([k, d]) => (
                              <td key={k}>{usd(d(m))}</td>
                            ))}
                            <td className="t">{usd(cols.reduce((a, [, d]) => a + d(m), 0))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p>
                      A kilometer is {cents(v.perKm ?? v.rate)} under 100K and {cents((v.perKm ?? v.rate) + 4)} past it. Concept2&apos;s part starts at
                      100K.{pledge > 0 ? " Each pledge stops at its cap." : ""}
                    </p>
                  </>
                );
              })()}

              {/* HOW TO LOG (owner, 2026-11-26: "we don't want to have them
                  connect to the rower with their phone and submit that way we
                  instead want to show them how to log on the concept 2 site ...
                  We want users to use our app to connect the ergs"). */}
              <h2 id="log">How do I log a row?</h2>
              <p>Log every row in both places: on ROW for the board and the match, and in your Concept2 Logbook for Concept2&apos;s part.</p>
              <h3>1. On ROW</h3>
              <ol className="m2-steps">
                <li>
                  <span className="k">1</span>
                  <div>
                    <b>Connect ROW to the monitor</b>
                    <p>Tap the + at the top of the ROW app and connect to the monitor by Bluetooth before you start.</p>
                  </div>
                </li>
                <li>
                  <span className="k">2</span>
                  <div>
                    <b>Row</b>
                    <p>The row logs itself, with the full telemetry. Save it, and it counts for M2D right away.</p>
                  </div>
                </li>
                <li>
                  <span className="k">3</span>
                  <div>
                    <b>Not connected? Type it in</b>
                    <p>Tap the + (or Log a row here) and enter your meters and time instead, with a photo of the monitor if you like. A typed row counts for M2D the same.</p>
                  </div>
                </li>
              </ol>
              <h3>2. On Concept2</h3>
              <ol className="m2-steps">
                <li>
                  <span className="k">1</span>
                  <div>
                    <b>Open log.concept2.com</b>
                    <p>
                      Sign in to your{" "}
                      <a href="https://log.concept2.com" target="_blank" rel="noopener noreferrer">
                        Concept2 Logbook ↗
                      </a>
                      .
                    </p>
                  </div>
                </li>
                <li>
                  <span className="k">2</span>
                  <div>
                    <b>Add Workout</b>
                    <p>Type the same row in: the meters, the time and the date. Save.</p>
                  </div>
                </li>
                <li>
                  <span className="k">3</span>
                  <div>
                    <b>Check it counted</b>
                    <p>Open the Holiday Challenge in your Logbook: your meters toward 100K are there. Meters can go in until Jan 4.</p>
                  </div>
                </li>
              </ol>

              <h2>Questions</h2>
              <h3>When is it?</h3>
              <p>Thursday, Nov 26 to Thursday, Dec 24. Concept2 takes meters into the Logbook until Jan 4.</p>
              <h3>How do I register?</h3>
              <p>
                Make a free Concept2 Logbook, pick a charity there, and add your rows there at log.concept2.com. Then tell us: press
                I&apos;m registered on <Link href="/m2d">the M2D page</Link> and pick the charity {v.match.by}&apos;s part goes to.
              </p>
              <h3>How do I change my charity?</h3>
              <p>
                Until Dec 24: Change on the M2D page, or on your profile in the ROW app, where you can also split it across the three.
              </p>
              <h3>What counts?</h3>
              <p>
                For {v.match.by}: rows logged on ROW from Nov 26 to Dec 24 by registered rowers. For Concept2: the meters in your Concept2
                Logbook.
              </p>
              <h3>Is there a limit?</h3>
              <p>
                Concept2 sets none: every rower past 100K earns its donation, at 4¢ a kilometer for every kilometer after 100. Meters go into the
                Logbook until 11:59 pm GMT on Jan 4. {v.match.by} matches up to ${M2D_CAP.toLocaleString("en-US")}.
              </p>
              <h3>Can I add to it?</h3>
              <p>
                Yes: <Link href="/m2d/give">add cents to every kilometer</Link>.
              </p>
              <h3>Does it cost me anything?</h3>
              <p>No. It is free.</p>
            </>
          )}
        </div>
      </main>
      <RowFooter front />
    </div>
  );
}
