import type { Metadata, Viewport } from "next";
import { Countdown } from "./Countdown";
import { LasdPage } from "./LasdPage";
import { getTeamViewer } from "@/lib/lasd26/team";

/**
 * /lasd26 — the crew-call landing, now CLOSED (owner, 2026-10-15: "the van
 * is full"). The page stays as the front of the team site: the race, the
 * weekend, the photos, the countdown; the form block is a closed notice
 * that sends the team to expenses. The crew runs it with Just Friends LV,
 * the Las Vegas run club, so they are on the page beside No Shortcuts.
 */

export const metadata: Metadata = {
  title: "LASD26 — Crew Call",
  description:
    "A Vegas crew at the No Shortcuts Time Trial — a ~130-mile unsanctioned relay from Santa Monica Pier to San Diego, with Just Friends LV. Crew call is closed: the van is full.",
  openGraph: {
    title: "LASD26 — Crew Call",
    description:
      "A Vegas crew for the No Shortcuts Time Trial — Santa Monica Pier to San Diego, Oct 22–25. Crew call is closed: the van is full.",
    images: [{ url: "/lasd26/golden-hour.jpg", width: 1100, height: 1375 }],
  },
};

export const viewport: Viewport = {
  themeColor: "#F4F3EE",
};

// Session-gated (the bar's account button) — never render statically.
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
            coast<span className="o">.</span>
          </h1>
          <p className="sub">
            We&rsquo;re taking a Vegas crew to the No Shortcuts Time Trial — a
            ~130-mile unsanctioned relay from Santa Monica Pier to San Diego.
            One van. One long Friday. A whole weekend together.
          </p>
          <p className="with mono">
            <img
              src="/lasd26/brand/jf-mark.png"
              width={150}
              height={150}
              alt="Just Friends LV"
            />
            <span>No Shortcuts × Just Friends LV</span>
          </p>
          <span className="cc-mark">Crew call is closed — the van is full</span>
        </div>
      </header>

      <div className="frame">
        <div className="ph">
          <img
            src="/lasd26/road-bw.jpg"
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
                per person · <a href="/lasd26/expenses">see expenses</a>
              </small>
            </div>
          </div>
        </div>
      </div>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The Weekend</h2>
            <span className="mono">THU 10.22 → SUN 10.25</span>
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
              <h3>Recover, loudly</h3>
              <p>All-day pool celebration at Town &amp; Country.</p>
            </div>
          </div>
          <div className="day">
            <div className="d">
              SUN<span>10.25</span>
            </div>
            <div>
              <h3>SD → Vegas</h3>
              <p>Checkout, breakfast, drive home.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="inter">
        <div className="ph">
          <img
            src="/lasd26/golden-hour.jpg"
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
            src="/lasd26/blur-hillside.jpg"
            width={1000}
            height={1250}
            loading="lazy"
            alt="Motion-blurred runner in pink shorts against green hillside"
          />
        </div>
      </div>

      {/* Where the form stood. The crew-call list lives in the account
       * menu's DEVELOPMENT group now, not on the page. */}
      <div className="form-sec" id="apply">
        <div className="wrap">
          <div className="sec-head">
            <h2>Crew call is closed</h2>
            <span className="mono">THE VAN IS FULL</span>
          </div>
          <p className="closed-p">
            The van is full. <strong>On the team?</strong> Sign in and open
            expenses.
          </p>
          <a className="send" href="/lasd26/expenses">
            Open expenses →
          </a>
        </div>
      </div>

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
