import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";
import { board100kCss } from "../../board/board100kCss";
import { CHARITIES, m2dWindow } from "../../m2d";
import { pledgeViews, type PledgeView } from "../../m2dPledgeActions";
import { M2D_PLEDGE_LIVE, pledgeGated } from "../../m2dPledges";
import { m2dCss } from "../m2dCss";
import { pledgeCss } from "./pledgeCss";
import { PledgeSite } from "./PledgeSite";

export const dynamic = "force-dynamic";

export const metadata: Metadata = M2D_PLEDGE_LIVE
  ? { title: "Pledge to M2D — Rowtember", description: "Give for every kilometer Rowtember rowers row, Nov 26 to Dec 24, up to a cap you pick." }
  : { title: "Pledge to M2D (dev) — Rowtember", robots: { index: false, follow: false } };

/* THE M2D PLEDGE (owner, 2026-11-26: "$1 per kilometer for $500"; "let's
 * make sure they created an account"; "make sure it comes to me to review
 * it, to approve it"). A giver signs in with Google on rowtember.com, picks
 * a rate and a cap, and sends it; it saves pending and emails the owner,
 * who approves it at /dev/m2d-pledges. Rules: row100k/m2dPledges.ts.
 *
 * IN DEVELOPMENT (CLAUDE.md): admin-only in production, open in local dev,
 * (dev) in the title, linked only from the DEVELOPMENT group of the account
 * menu. The public /m2d/give page stays as it is until the owner says this
 * goes live. */

const SIGN_IN = `/sign-in?callbackUrl=${encodeURIComponent("/m2d/pledge")}`;

export default async function PledgePage() {
  const viewer = await resolveViewer();
  if (pledgeGated(viewer.isAdmin)) notFound();
  const w = m2dWindow();
  let mine: PledgeView[] = [];
  let readFailed = false;
  if (viewer.actor) {
    mine = await pledgeViews(viewer.actor.photographerId).catch((err) => {
      console.error("M2D pledge page: not read", err);
      readFailed = true;
      return [];
    });
  }

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{board100kCss}</style>
      <style>{m2dCss}</style>
      <style>{pledgeCss}</style>
      <RowBar active="m2d" {...barProps(viewer)} />
      <main className="bd m2 m2-give">
        <div className="wrap front">
          <h1 className="bd-date">
            <b>M2D · Pledge</b>
            <span>{!w.started ? "Nov 26 – Dec 24" : w.over ? "Wrapped" : `Day ${w.day} of ${w.days}`}</span>
          </h1>
          <p className="m2-give-lede" style={{ maxWidth: 560 }}>
            Pick what you&apos;ll give for every kilometer Rowtember rowers row, and the most you&apos;ll give. Your pledge covers the next
            kilometers rowed after we approve it, until it reaches your cap or Dec 24.
          </p>
          {w.over ? (
            <p className="bd-say">M2D closed on Dec 24. Thank you to everyone who pledged.</p>
          ) : (
            <PledgeSite signedIn={!!viewer.actor} signInHref={SIGN_IN} defaultName={viewer.actor?.name ?? ""} initial={mine} />
          )}
          {readFailed ? (
            <p className="bd-say" role="alert">
              Your pledges could not be read just now.
            </p>
          ) : null}

          <section className="m2-worth" aria-label="How it works">
            <div className="m2-worth-h">
              <h2>How it works</h2>
            </div>
            <ol className="m2-steps">
              <li>
                <span className="k">1</span>
                <div>
                  <b>Pledge</b>
                  <p>Pick a rate a kilometer and a cap. Sign in with Google so we know who you are.</p>
                </div>
              </li>
              <li>
                <span className="k">2</span>
                <div>
                  <b>We approve it</b>
                  <p>Mikian reads every pledge. Once it&apos;s approved you get an email, and it starts counting from the next kilometer rowed.</p>
                </div>
              </li>
              <li>
                <span className="k">3</span>
                <div>
                  <b>Watch it fill</b>
                  <p>
                    Your line is on the <Link href="/m2d">M2D</Link> receipts. Each kilometer&apos;s dollars go to the charity the rower who rowed
                    it picked.
                  </p>
                </div>
              </li>
              <li>
                <span className="k">4</span>
                <div>
                  <b>Give it straight to the charities</b>
                  <p>
                    When your cap fills, or on Dec 24, we email you your total and how much goes to each charity, with their donate links.
                    Nothing passes through us and no fee is taken.
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
        </div>
      </main>
      <RowFooter front />
    </div>
  );
}
