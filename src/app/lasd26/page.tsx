import type { Metadata, Viewport } from "next";
import { CrewForm } from "./CrewForm";
import { Countdown } from "./Countdown";
import { isOwnerActor } from "@/lib/permissions";
import { archivo, archivoBlack, spaceMono, css } from "./theme";

export const metadata: Metadata = {
  title: "LASD26 — Crew Call",
  description:
    "We're taking a Vegas crew to the No Shortcuts Time Trial — a ~130-mile unsanctioned relay from Santa Monica Pier to San Diego. One van. One long Friday. A whole weekend together.",
  openGraph: {
    title: "LASD26 — Crew Call",
    description:
      "A Vegas crew for the No Shortcuts Time Trial — Santa Monica Pier to San Diego, Oct 22–25.",
    images: [{ url: "/lasd26/golden-hour.jpg", width: 1100, height: 1375 }],
  },
};

export const viewport: Viewport = {
  themeColor: "#F4F3EE",
};

// Session-gated (owner-only simulate + list link) — never render statically.
export const dynamic = "force-dynamic";

export default async function Lasd26Page() {
  // Owner-only extras: the simulate button on the form and the link to
  // /lasd26/the-list. Sign in happens on the main site — this page keeps no
  // auth UI of its own.
  const owner = await isOwnerActor();

  return (
    <div
      className={`lasd26 ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}
    >
      <style>{css}</style>

      <div className="bar">
        <span className="mono">NO SHORTCUTS TT · 7TH EDITION</span>
        <span className="mono tag">LASD26</span>
      </div>

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
          <span className="cc-mark">This is crew call</span>
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
            <div className="k mono">Crew size</div>
            <div className="v">
              10<small>8 runners + 2 crew</small>
            </div>
          </div>
          <div className="cell">
            <div className="k mono">Est. cost</div>
            <div className="v">
              $450–550<small>per person</small>
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

      <div className="form-sec" id="apply">
        <div className="wrap">
          <div className="sec-head">
            <h2>Put your name in</h2>
            <span className="mono">CLOSES WHEN THE VAN IS FULL</span>
          </div>
          <CrewForm simulate={owner} />
        </div>
      </div>

      {owner && (
        <p className="owner-link mono">
          <a href="/lasd26/the-list">THE LIST → /lasd26/the-list</a>
        </p>
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
    </div>
  );
}
