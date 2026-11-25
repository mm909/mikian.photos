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
  title: "M2D: how it adds up — Rowtember",
  description: "How the M2D dollars are worked out: Concept2's part, ROWTEMBER's part, and where each goes.",
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
            <b>M2D · How it adds up</b>
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
              <h2 id="concept2">
                Concept2 <i>{usd(v.totals.raised)}</i>
              </h2>
              <p>
                Concept2 gives nothing for a rower until they pass 100,000 meters between Nov 26 and Dec 24. Then it gives 2¢ for each of
                the first 100 kilometers, which is $2, and 4¢ for every kilometer after: 150K is $4, 200K is $6, 300K is $10. It goes to
                the charity the rower picks in their Concept2 Logbook.
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
                {v.match.by} matches Concept2: {cents(v.rate)} for every kilometer a registered rower logs on ROW, from the first meter. There is no
                minimum.
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
              <p>
                Each rower&apos;s part goes to the charity they picked, or across the three by the shares they set on their profile in
                the ROW app:
              </p>
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

              {/* WHAT A ROW RAISES (owner, 2026-11-25: the 50K to 300K lines
                  moved here from the M2D page, so the board comes sooner). */}
              <h2 id="ladder">What your meters raise</h2>
              <p>
                Concept2 and {v.match.by} together, for one registered rower: {cents(v.perKm ?? v.rate)} a kilometer under 100K,{" "}
                {cents((v.perKm ?? v.rate) + 4)} a kilometer past it.
              </p>
              <dl className="sum">
                {[50_000, 100_000, 150_000, 200_000, 300_000].map((m) => (
                  <div key={m}>
                    <dt>Row {num(m / 1000)}K</dt>
                    <dd>{usd((m < 100_000 ? 0 : 2 + 0.04 * (m / 1000 - 100)) + ((m / 1000) * (v.perKm ?? v.rate)) / 100)}</dd>
                  </div>
                ))}
              </dl>

              <h2>Questions</h2>
              <h3>When is it?</h3>
              <p>Thursday, Nov 26 to Thursday, Dec 24. Concept2 takes meters into the Logbook until Jan 4.</p>
              <h3>How do I register?</h3>
              <p>
                Make a free Concept2 Logbook, pick a charity there, and get your meters into it (ErgData does that). Then tell us: press
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
              <p>{v.match.by} matches up to ${M2D_CAP.toLocaleString("en-US")}.</p>
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
