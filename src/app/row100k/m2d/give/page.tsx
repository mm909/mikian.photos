import type { Metadata } from "next";
import Link from "next/link";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";
import { board100kCss } from "../../board/board100kCss";
import { CHARITIES, m2dPrice } from "../../m2d";
import { m2dCss } from "../m2dCss";
import { GiveCalc } from "./GiveCalc";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Give with M2D — Rowtember",
  description: "Add cents to every kilometer Rowtember rowers row for charity, Nov 26 to Dec 24.",
};

/* THE GIVING PAGE (owner, 2026-11-25: "I need a donor landing page ... a
 * page that I can send to potential donators ... here's how many meters
 * there currently are. Here's what our current cent per kilometer is ... I
 * want to give $20, and they can see how that increases the cent").
 * PUBLIC BUT UNLISTED: made to be sent, so no development gate; no link on
 * the rail. No payments here: a giver writes in, gets a line on the
 * receipts, and at the close gives the line's dollars straight to the
 * charities, so nothing passes through ROWTEMBER and no fee is taken. The
 * price of a cent is m2dPrice (row100k/m2d.ts). */

const num = (n: number) => Math.round(n).toLocaleString("en-US");
const money = (d: number) => (d >= 1000 ? `$${num(d)}` : `$${d.toFixed(d % 1 ? 2 : 0)}`);
const cent = (c: number) => `${Math.round(c * 100) / 100}¢`;
const MAIL = "row@rowtember.com";

export default async function GivePage() {
  const viewer = await resolveViewer();
  const p = await m2dPrice().catch((err) => {
    console.error("row100k M2D give: not read", err);
    return null;
  });
  const subject = encodeURIComponent("M2D: I want to give");

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{board100kCss}</style>
      <style>{m2dCss}</style>
      <RowBar active="m2d" {...barProps(viewer)} />
      <main className="bd m2 m2-give">
        <div className="wrap front">
          <h1 className="bd-date">
            <b>M2D · Give</b>
            <span>{!p ? "" : !p.window.started ? "Nov 26 – Dec 24" : p.window.over ? "Wrapped" : `Day ${p.window.day} of ${p.window.days}`}</span>
          </h1>
          {!p ? (
            <p className="bd-say" role="alert">
              M2D could not be read just now. Try again.
            </p>
          ) : (
            <>
              <section className="m2-head" aria-label="Every kilometer is worth">
                <p className="m2-big">{cent(p.perKm)}</p>
                <p className="m2-kick">A kilometer, to charity, from the first meter</p>
                <p className="m2-give-lede">
                  For four weeks, Thanksgiving to Christmas Eve, Rowtember rowers turn their meters into dollars for three local charities.
                  Concept2 gives once a rower passes 100K. ROWTEMBER matches with {cent(p.rate)} on every kilometer from the first. Add
                  your own cents and every kilometer is worth more.
                </p>
              </section>

              <dl className="m2-from m2-give-now">
                <div>
                  <dt>Meters rowed so far</dt>
                  <dd>{num(p.meters)} m</dd>
                </div>
                <div>
                  <dt>Rowers opted in</dt>
                  <dd>{num(p.registered)}</dd>
                </div>
                <div>
                  <dt>
                    ROWTEMBER<small>Matches Concept2</small>
                  </dt>
                  <dd>{cent(p.rate)} / km</dd>
                </div>
                {p.givers.map((g) => (
                  <div key={g.name}>
                    <dt>{g.name}</dt>
                    <dd>{cent(g.rate)} / km</dd>
                  </div>
                ))}
                <div className="total">
                  <dt>Every kilometer</dt>
                  <dd>{cent(p.perKm)}</dd>
                </div>
              </dl>

              <section className="m2-worth" aria-label="The price of a cent">
                <div className="m2-worth-h">
                  <h2>The price of a cent</h2>
                </div>
                <p className="m2-give-big">
                  About <b>{money(p.cent.ask)}</b> adds 1¢ to every kilometer
                </p>
                <p className="m2-give-small">
                  Our best guess at what M2D rowers will row by Dec 24 is about {num(p.projected.likely)} m, so 1¢ a kilometer comes to
                  about {money(p.cent.likely)}. A slow month would make it {money(p.cent.low)}; our biggest month, {money(p.cent.high)}.
                </p>
              </section>

              <GiveCalc centAt={p.cent.ask} perKm={p.perKm} />

              <section className="m2-worth" aria-label="How to give">
                <div className="m2-worth-h">
                  <h2>How to give</h2>
                </div>
                <ol className="m2-steps">
                  <li>
                    <span className="k">1</span>
                    <div>
                      <b>Tell us</b>
                      <p>
                        Write to <a href={`mailto:${MAIL}?subject=${subject}`}>{MAIL}</a> with the name to show, and either the cents you
                        want to add or the most you want to give.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span className="k">2</span>
                    <div>
                      <b>Watch it grow</b>
                      <p>
                        Your name goes on the <Link href="/m2d">M2D</Link> receipts as its own line, in cents a kilometer, adding up with
                        every meter.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span className="k">3</span>
                    <div>
                      <b>Give it straight to the charities</b>
                      <p>
                        When M2D closes on Dec 24, you give your line&apos;s total directly to the charities, split the way the rowers picked.
                        Nothing passes through us, so no fee is taken and the receipt comes from them. Never more than the most you set.
                      </p>
                    </div>
                  </li>
                </ol>
              </section>

              <section className="m2-worth" aria-label="Where it goes">
                <div className="m2-worth-h">
                  <h2>Where it goes</h2>
                </div>
                <dl>
                  {CHARITIES.map((c) => (
                    <div key={c.key}>
                      <dt>
                        <a href={c.url} target="_blank" rel="noopener noreferrer">
                          {c.full} ↗
                        </a>
                        <small>{c.what}</small>
                      </dt>
                    </div>
                  ))}
                </dl>
              </section>

              <p className="m2-give-fine">
                The price of a cent is an estimate from the meters rowed so far and from past months. A pledge never passes the most you set:
                if more meters are rowed than expected, your cents cover them at a slightly lower rate. ROWTEMBER matches up to{" "}
                {money(p.cap)}. <Link href="/m2d/faq">How it adds up</Link>.
              </p>
            </>
          )}
        </div>
      </main>
      <RowFooter front />
    </div>
  );
}
