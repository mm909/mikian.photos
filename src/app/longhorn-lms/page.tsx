import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getEffectiveActor, isOwner } from "@/lib/permissions";
import { photoUrl, photosServable, thumbKey } from "../row100k/photoUrls";
import { AccountControl, SignupForm, type Existing } from "./SignupForm";
import { CAPSTONE_URL, LOOP_MILES, OWNER_IG, RACE, RACE_NAME, ULTRASIGNUP_URL, isClosed } from "./race";
import { css, playfair, spaceMono } from "./theme";

/* THE LONGHORN LMS PAGE (owner, 2026-10-12: "a page where runners of the
 * Longhorn Backyard Ultra can let me know that they are running" — for
 * the runners who want photos from him). The race facts in Capstone's
 * voice, a link to their page and to UltraSignup, then the form
 * (SignupForm.tsx). Google sign-in is required; the owner sees THE LIST
 * in the bar. Closes three days after the start (race.ts).
 *
 * IN DEVELOPMENT (CLAUDE.md, "hold it until I can review"): owner-only in
 * production, a 404 for anyone else; open in local dev. */

export const metadata: Metadata = {
  title: "Longhorn LMS (dev) — I am running",
  description: "Running the Longhorn Last Person Standing? Tell Mikian, and the photos find you.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#151311" };

export const dynamic = "force-dynamic";

export default async function LonghornPage() {
  const actor = await getEffectiveActor();
  const owner = actor ? isOwner(actor) : false;
  if (process.env.NODE_ENV === "production" && !owner) notFound();

  let existing: Existing | null = null;
  if (actor) {
    try {
      const row = await db.raceRunnerSignup.findUnique({ where: { race_userId: { race: RACE, userId: actor.photographerId } } });
      if (row) {
        let url: string | null = null;
        if (row.photoKey && photosServable()) {
          url = await photoUrl(thumbKey(row.photoKey)).catch(() => null);
        }
        existing = {
          name: row.name,
          email: row.email,
          phone: row.phone,
          instagram: row.instagram,
          bib: row.bib,
          expectedLoops: row.expectedLoops,
          photoKey: row.photoKey,
          photoUrl: url,
        };
      }
    } catch (err) {
      console.error("longhorn-lms: failed to read the signup (table pushed?)", err);
    }
  }

  return (
    <div className={`lh ${playfair.variable} ${spaceMono.variable}`}>
      <style>{css}</style>

      <div className="lh-bar">
        <a href="/" className="lh-wm" style={{ textDecoration: "none" }}>
          Mikian
          <small>Musser · Photographs</small>
        </a>
        <AccountControl signedIn={actor !== null} name={actor?.name ?? ""} owner={owner} />
      </div>

      <header className="wrap">
        <p className="lh-crumb">Races / {RACE_NAME}</p>
        <h1>
          <span className="o">Longhorn</span>
          <br />
          Last Person
          <br />
          Standing
        </h1>
        <p className="lh-tag">I will be out there with a camera.</p>
        <p className="lh-lede">
          A backyard ultra in the Texas Hill Country. Every hour on the hour you run {LOOP_MILES} miles, come back, and do it again until one of you is left.
          I am shooting it. <b>If you are running and want photos, put your name in below</b> and I will find you on the course.
        </p>

        <div className="lh-facts">
          <div className="lh-fact">
            <div className="k">Race day</div>
            <div className="v">
              Sat, Dec 5<small>7:00 AM · the bell</small>
            </div>
          </div>
          <div className="lh-fact">
            <div className="k">Where</div>
            <div className="v">
              Dripping Springs<small>2705 Gatlin Creek Road, TX</small>
            </div>
          </div>
          <div className="lh-fact">
            <div className="k">The loop</div>
            <div className="v">
              {LOOP_MILES} mi<small>every hour · 200 ft of climb</small>
            </div>
          </div>
          <div className="lh-fact">
            <div className="k">It ends</div>
            <div className="v">
              Last one<small>standing wins</small>
            </div>
          </div>
        </div>

        <a className="lh-cta quiet" href={CAPSTONE_URL} target="_blank" rel="noopener noreferrer">
          The race, by Capstone Endurance →
        </a>
      </header>

      <section className="wrap" id="in">
        <div className="lh-head">
          <h2>I am running</h2>
          <span>{isClosed() ? "Closed" : "Closes Dec 8"}</span>
        </div>
        <SignupForm
          signedIn={actor !== null}
          closed={isClosed()}
          defaults={{ name: actor?.name ?? "", email: actor?.email ?? "" }}
          existing={existing}
        />
      </section>

      <footer>
        <div className="wrap">
          <p>
            Not registered yet?{" "}
            <a href={ULTRASIGNUP_URL} target="_blank" rel="noopener noreferrer">
              Register on UltraSignup
            </a>
            <br />
            Photos and questions →{" "}
            <a href={`https://instagram.com/${OWNER_IG}`} target="_blank" rel="noopener noreferrer">
              @{OWNER_IG}
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
