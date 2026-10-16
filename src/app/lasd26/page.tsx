import type { Metadata, Viewport } from "next";
import { Countdown } from "./Countdown";
import { LasdPage } from "./LasdPage";
import { SignInLine } from "./SignInLine";
import { getTeamViewer } from "@/lib/lasd26/team";
import { LASD_ASSETS, lasdPath } from "@/lib/lasd26/paths";

/**
 * THE LANDING of the team site at /lasd26 (lib/lasd26/paths.ts). LIVE since
 * 2026-10-16 (owner: "we are going to make some of this live now"); it was
 * built one folder down as the dev copy and moved up over the old
 * crew-call page. Open to everyone and indexable — the team pages behind
 * it keep their own rules.
 *
 * The crew call is CLOSED (owner, 2026-10-15: "the van is full"). The page
 * stays as the front of the team site: the race, the weekend, the photos,
 * the countdown; where the form stood, a signed-out visitor gets one line
 * that signs them in. The crew runs it with Just Friends LV, the Las Vegas
 * run club, so they are named beside No Shortcuts (text only — owner,
 * 2026-10-16: "Remove the JF logo here").
 *
 * The weekend is Thursday to SATURDAY (owner, 2026-10-16: "We are actually
 * coming back Saturday"): out Thursday, race Friday, home Saturday.
 */

export const metadata: Metadata = {
  title: "LASD26 — Crew Call",
  description:
    "A Vegas crew at the No Shortcuts Time Trial — a ~130-mile unsanctioned relay from Santa Monica Pier to San Diego, with Just Friends LV. Crew call is closed: the van is full.",
  openGraph: {
    title: "LASD26 — Crew Call",
    description:
      "A Vegas crew for the No Shortcuts Time Trial — Santa Monica Pier to San Diego, Oct 22–24. Crew call is closed: the van is full.",
    images: [{ url: `${LASD_ASSETS}/golden-hour.jpg`, width: 1100, height: 1375 }],
  },
};

export const viewport: Viewport = {
  themeColor: "#F4F3EE",
};

// Session-aware (the bar's account button, the foot line) — never render statically.
export const dynamic = "force-dynamic";

export default async function Lasd26Page() {
  const viewer = await getTeamViewer();

  return (
    <LasdPage viewer={viewer} active="crew-call">
      <header className="hero">
        <div className="wrap" style={{ padding: 0 }}>
          <h1>
            Run it
            <br />
            down the
            <br />
            {/* The period is drawn as a lime disc (theme.ts .hero h1 .o;
             * owner, 2026-10-16: "a circle instead of a square"); the
             * real "." is there for a screen reader, visually hidden. */}
            coast
            <span className="o" aria-hidden="true" />
            <span className="sr">.</span>
          </h1>
          <p className="sub">
            We&rsquo;re taking a Vegas crew to the No Shortcuts Time Trial — a
            ~130-mile unsanctioned relay from Santa Monica Pier to San Diego.
            One van. One long Friday. A whole weekend together.
          </p>
          <p className="with mono">No Shortcuts × Just Friends LV</p>
          {/* Owner, 2026-10-16: "Reduce the copy to just 'the van is full'". */}
          <span className="cc-mark">The van is full</span>
        </div>
      </header>

      <div className="frame">
        <div className="ph">
          <img
            src={`${LASD_ASSETS}/road-bw.jpg`}
            width={1100}
            height={1375}
            alt="Runner from behind on an open road, arms out, black and white"
          />
        </div>
      </div>

      <div className="facts">
        <div className="in">
          <div className="cell">
            <div className="k mono">Race day</div>
            <div className="v">
              Fri 10.23<small>start 5:00 AM</small>
            </div>
          </div>
          <div className="cell">
            <div className="k mono">Start → Finish</div>
            <div className="v">SM Pier → San Diego</div>
          </div>
          <div className="cell">
            <div className="k mono">Crew</div>
            <div className="v">
              18<small>16 runners + 2 crew · 2 teams</small>
            </div>
          </div>
          <div className="cell">
            <div className="k mono">Est. cost</div>
            <div className="v">
              ~$371
              <small>
                per person · <a href={lasdPath("/expenses")}>see expenses</a>
              </small>
            </div>
          </div>
        </div>
      </div>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The Weekend</h2>
            <span className="mono">THU 10.22 → SAT 10.24</span>
          </div>
          <div className="day">
            <div className="d">
              THU<span>10.22</span>
            </div>
            <div>
              <h3>Vegas → LA</h3>
              <p>Drive out. Big dinner, gear check, lights out early.</p>
            </div>
          </div>
          <div className="day race">
            <div className="d">
              FRI<span>10.23</span>
            </div>
            <div>
              <h3>Race day</h3>
              <p>5:00am start · 130 miles from LA to SD.</p>
            </div>
          </div>
          <div className="day">
            <div className="d">
              SAT<span>10.24</span>
            </div>
            <div>
              <h3>SD → Vegas</h3>
              <p>Breakfast, then the drive home.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="inter">
        <div className="ph">
          <img
            src={`${LASD_ASSETS}/golden-hour.jpg`}
            width={1100}
            height={1375}
            loading="lazy"
            alt="Runner in white tank mid-stride at golden hour"
          />
        </div>
      </div>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>LASD 26</h2>
            <span className="mono">START — FRI 10.23 · 5:00 AM PT</span>
          </div>
          <Countdown />
        </div>
      </section>

      <div className="inter">
        <div className="ph">
          <img
            src={`${LASD_ASSETS}/blur-hillside.jpg`}
            width={1000}
            height={1250}
            loading="lazy"
            alt="Motion-blurred runner in pink shorts against green hillside"
          />
        </div>
      </div>

      {/* Where the form stood: one line for the signed-out (owner,
       * 2026-10-16: "Reduce the bottom copy to just 'On the team -> Sign
       * in'"), and NOTHING once signed in — the bar's doors and the account
       * menu are the way to expenses (owner, 2026-10-16: "We can remove On
       * the team → Expenses"). The crew-call list lives in the account
       * menu's DEVELOPMENT group, not on the page. */}
      {viewer.actor === null && (
        <div className="form-sec">
          <div className="wrap">
            <SignInLine />
          </div>
        </div>
      )}

      <footer>
        <div className="wrap" style={{ padding: 0 }}>
          <div className="big">NO SHORTCUTS TIME TRIAL — 7TH EDITION</div>
          <p className="mono">
            Race →{" "}
            <a
              href="https://instagram.com/noshortcutstt"
              target="_blank"
              rel="noopener noreferrer"
            >
              @noshortcutstt
            </a>
            <br />
            with Just Friends LV →{" "}
            <a
              href="https://instagram.com/justfriends.lv"
              target="_blank"
              rel="noopener noreferrer"
            >
              @justfriends.lv
            </a>
            <br />
            Crew questions →{" "}
            <a
              href="https://instagram.com/mikian_"
              target="_blank"
              rel="noopener noreferrer"
            >
              @mikian_
            </a>{" "}
            ·{" "}
            <a
              href="https://instagram.com/jazz.mayy"
              target="_blank"
              rel="noopener noreferrer"
            >
              @jazz.mayy
            </a>
          </p>
          <p className="mono" style={{ marginTop: 18 }}>
            for yourself and others
          </p>
        </div>
      </footer>
    </LasdPage>
  );
}
