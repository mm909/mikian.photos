import Link from "next/link";
import { CONTACT_EMAIL, DEMO_URL, SALES_SNAPSHOT } from "@/lib/directorStats";
import { CourseHeatmap } from "./CourseHeatmap";
import { FinishDistributions } from "./FinishDistributions";
import { WinnersBoard } from "./WinnersBoard";

/* ============================================================
   Shared bits
   ============================================================ */

const MAXW = 1080;

function Eyebrow({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: ".18em",
        textTransform: "uppercase",
        color: color ?? "var(--accent)",
      }}
    >
      {children}
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  accent,
  blurb,
  dark,
  center,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  blurb?: string;
  dark?: boolean;
  center?: boolean;
}) {
  const ink = dark ? "var(--fg-on-dark)" : "var(--ink)";
  const muted = dark ? "rgba(245,242,236,.66)" : "var(--muted)";
  let titleNode: React.ReactNode = title;
  if (accent && title.includes(accent)) {
    const [a, b] = title.split(accent);
    titleNode = (
      <>
        {a}
        <em className="acc">{accent}</em>
        {b}
      </>
    );
  }
  return (
    <div style={{ maxWidth: 680, margin: center ? "0 auto" : undefined, textAlign: center ? "center" : "left" }}>
      <Eyebrow color={dark ? "var(--accent-l)" : "var(--accent)"}>{eyebrow}</Eyebrow>
      <h2
        style={{
          margin: "12px 0 0",
          fontFamily: "var(--font-serif)",
          fontWeight: 500,
          fontSize: "clamp(28px, 3.4vw, 42px)",
          lineHeight: 1.08,
          letterSpacing: "-.018em",
          color: ink,
        }}
      >
        {titleNode}
      </h2>
      {blurb && (
        <p style={{ margin: "16px 0 0", fontSize: 17, lineHeight: 1.55, color: muted, maxWidth: 620, marginLeft: center ? "auto" : undefined, marginRight: center ? "auto" : undefined }}>
          {blurb}
        </p>
      )}
    </div>
  );
}

/* Minimal line icons (stroke = currentColor) */
function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "face":
      return (
        <svg {...common}><circle cx="12" cy="12" r="9" /><circle cx="9" cy="10" r="0.6" fill="currentColor" /><circle cx="15" cy="10" r="0.6" fill="currentColor" /><path d="M9 15c.9.8 1.9 1.2 3 1.2s2.1-.4 3-1.2" /></svg>
      );
    case "bib":
      return (
        <svg {...common}><rect x="4" y="6" width="16" height="12" rx="2" /><path d="M8 4v2M16 4v2M8.5 10h7M8.5 13.5h4" /></svg>
      );
    case "search":
      return (<svg {...common}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>);
    case "download":
      return (<svg {...common}><path d="M12 4v10M8 11l4 4 4-4" /><path d="M5 19h14" /></svg>);
    case "pin":
      return (<svg {...common}><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>);
    case "chart":
      return (<svg {...common}><path d="M4 20V4M4 20h16" /><path d="M8 20v-6M12 20v-9M16 20v-4M20 20V8" /></svg>);
    case "trophy":
      return (<svg {...common}><path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" /><path d="M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3M10 14h4M9 20h6M12 14v6" /></svg>);
    case "camera":
      return (<svg {...common}><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>);
    case "bolt":
      return (<svg {...common}><path d="M13 3 5 13h6l-1 8 8-10h-6l1-8Z" /></svg>);
    case "crop":
      return (<svg {...common}><path d="M6 2v16h16M2 6h16v16" /></svg>);
    case "zip":
      return (<svg {...common}><path d="M5 4h14v16H5zM12 4v3M12 9v2M12 13v2" /></svg>);
    default:
      return null;
  }
}

/* ============================================================
   Hero
   ============================================================ */

export function Hero() {
  return (
    <section style={{ background: "linear-gradient(180deg, var(--paper) 0%, var(--cream) 100%)", borderBottom: "1px solid var(--line)" }}>
      <div
        style={{
          maxWidth: MAXW,
          margin: "0 auto",
          padding: "72px 24px 64px",
          display: "grid",
          gridTemplateColumns: "1.1fr .9fr",
          gap: 48,
          alignItems: "center",
        }}
        className="director-hero"
      >
        <div>
          <Eyebrow>For race directors</Eyebrow>
          <h1
            style={{
              margin: "16px 0 0",
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              fontSize: "clamp(38px, 5.2vw, 66px)",
              lineHeight: 1.02,
              letterSpacing: "-.02em",
              color: "var(--ink)",
            }}
          >
            Race photos your runners <em className="acc">actually buy</em>.
          </h1>
          <p style={{ margin: "22px 0 0", fontSize: 19, lineHeight: 1.55, color: "var(--muted)", maxWidth: 520 }}>
            We photograph your event — or power your own photographers — and make every runner&rsquo;s
            shots findable in seconds by face or bib. Beautiful galleries, honest pricing, and a
            director dashboard timing alone can&rsquo;t match.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 30 }}>
            <a className="btn btn--primary btn--lg" href={DEMO_URL} target="_blank" rel="noreferrer">
              Book a demo →
            </a>
            <a className="btn btn--ghost btn--lg" href="#two-ways">
              See how it works
            </a>
          </div>
          <div style={{ marginTop: 18, fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: ".04em", color: "var(--muted)" }}>
            Prefer email?{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--accent)", textDecorationColor: "var(--accent)" }}>
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>

        {/* Decorative coverage teaser */}
        <HeroArt />
      </div>
    </section>
  );
}

function HeroArt() {
  return (
    <div className="director-hero-art" style={{ position: "relative" }}>
      <div
        className="card"
        style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow-lg)" }}
      >
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>
          Photo coverage · live
        </div>
        <svg viewBox="0 0 320 200" width="100%" style={{ display: "block" }} aria-hidden>
          <defs>
            <radialGradient id="heroGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--accent-l)" stopOpacity="0.6" />
              <stop offset="45%" stopColor="var(--accent)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </radialGradient>
            <filter id="heroSoft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6" /></filter>
          </defs>
          {/* glow */}
          <g filter="url(#heroSoft)">
            <circle cx="56" cy="150" r="40" fill="url(#heroGlow)" />
            <circle cx="150" cy="60" r="30" fill="url(#heroGlow)" />
            <circle cx="232" cy="120" r="46" fill="url(#heroGlow)" />
            <circle cx="280" cy="56" r="30" fill="url(#heroGlow)" />
          </g>
          {/* route */}
          <path
            d="M40 160 C 80 120, 90 60, 150 60 S 210 150, 250 120 S 290 70, 286 54"
            fill="none"
            stroke="var(--ink-soft)"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.55"
          />
          {/* dots */}
          {[
            [48, 152], [60, 144], [54, 160], [146, 64], [158, 56], [150, 70],
            [226, 124], [238, 116], [232, 132], [276, 58], [284, 50], [270, 64],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={1.8} fill="var(--accent-d)" opacity={0.6} />
          ))}
          <circle cx="40" cy="160" r="4.5" fill="var(--ink)" stroke="var(--paper)" strokeWidth="2" />
          <circle cx="286" cy="54" r="5.5" fill="var(--accent)" stroke="var(--paper)" strokeWidth="2" />
        </svg>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 14 }}>
          {[
            ["1,248", "photos"],
            ["540", "runners matched"],
            ["7", "hotspots"],
          ].map(([v, l]) => (
            <div key={l}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 500, color: "var(--ink)" }}>{v}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)" }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Value strip
   ============================================================ */

export function ValueStrip() {
  const items = [
    ["camera", "We shoot it — or you do", "Hire our photographers, or bring your own and use the platform."],
    ["search", "Found in seconds", "Runners search by face or bib. No scrolling thousands of frames."],
    ["bolt", "Delivered same week", "Galleries go live fast, full-resolution and clean."],
    ["chart", "Reporting you'll use", "Coverage maps, finish-time analytics, and sales by distance."],
  ];
  return (
    <section style={{ background: "var(--ink-deep)" }}>
      <div style={{ maxWidth: MAXW, margin: "0 auto", padding: "26px 24px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 28 }} className="director-strip">
        {items.map(([icon, title, blurb]) => (
          <div key={title} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ color: "var(--accent-l)", flexShrink: 0, marginTop: 2 }}><Icon name={icon} size={20} /></span>
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 14.5, fontWeight: 600, color: "var(--fg-on-dark)" }}>{title}</div>
              <div style={{ fontSize: 13, lineHeight: 1.45, color: "rgba(245,242,236,.6)", marginTop: 3 }}>{blurb}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================================================
   Buying flow
   ============================================================ */

export function BuyingFlow() {
  const steps = [
    ["search", "Search by face or bib", "A runner snaps a selfie or types their bib number. That's the entire ask."],
    ["face", "We surface every shot", "Face + bib matching pulls every frame they appear in — even the ones where their bib is hidden."],
    ["camera", "One bundle, all their photos", "No à-la-carte math. One clear price for every photo of them, full resolution."],
    ["download", "Download in seconds", "Paid, delivered, done — straight to their phone, ready to post."],
  ];
  return (
    <section style={{ background: "var(--paper)" }}>
      <div style={{ maxWidth: MAXW, margin: "0 auto", padding: "84px 24px" }}>
        <SectionHead
          eyebrow="The buying experience"
          title="Finding your photos takes seconds — that's why they buy."
          accent="that's why they buy"
          blurb="The reason platforms lose sales is friction. Ours removes it. Every step below is what a runner from your race actually does."
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18, marginTop: 44 }} className="director-grid-4">
          {steps.map(([icon, title, blurb], i) => (
            <div key={title} className="card" style={{ padding: 22, background: "var(--surface)", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: "var(--accent)" }}><Icon name={icon} /></span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--warm)" }}>0{i + 1}</span>
              </div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 19, fontWeight: 500, color: "var(--ink)", lineHeight: 1.2 }}>{title}</div>
              <div style={{ fontSize: 14, lineHeight: 1.5, color: "var(--muted)" }}>{blurb}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Matching tech (face + bib)
   ============================================================ */

export function MatchingTech() {
  return (
    <section style={{ background: "var(--cream)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
      <div style={{ maxWidth: MAXW, margin: "0 auto", padding: "84px 24px" }}>
        <SectionHead
          eyebrow="The technology"
          title="Every photo, matched two ways."
          accent="two ways"
          blurb="Bibs get torn, folded, and hidden behind water cups. Faces turn away from the lens. Running both matchers means almost no runner slips through — and almost no sale is lost."
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 44 }} className="director-grid-2">
          <TechCard
            icon="face"
            title="Face recognition"
            blurb="A single selfie finds every appearance across the whole event — start line, mid-course, finish, podium. Works even when the bib is turned away or obscured."
            chips={["Selfie → all photos", "Bib-free matches", "Groups & relay teams"]}
          />
          <TechCard
            icon="bib"
            title="Bib recognition"
            blurb="We read bib numbers straight off the photo — angled, partial, or motion-blurred — and tie each frame to your roster automatically. No manual tagging."
            chips={["Reads partial bibs", "Auto-linked to roster", "No manual tagging"]}
          />
        </div>
        <div style={{ marginTop: 22, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12.5, letterSpacing: ".06em", color: "var(--muted)" }}>
          Faces and bibs are used only to match runners to their own photos — never shared, never sold.
        </div>
      </div>
    </section>
  );
}

function TechCard({ icon, title, blurb, chips }: { icon: string; title: string; blurb: string; chips: string[] }) {
  return (
    <div className="card" style={{ padding: 28, background: "var(--surface)", border: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span style={{ width: 44, height: 44, borderRadius: 10, background: "var(--green-bg)", color: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={icon} size={24} />
        </span>
        <div style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 500, color: "var(--ink)" }}>{title}</div>
      </div>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: "var(--muted)" }}>{blurb}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
        {chips.map((c) => (
          <span key={c} style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".04em", color: "var(--ink)", background: "var(--cream)", border: "1px solid var(--line)", borderRadius: 999, padding: "5px 11px" }}>
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   Flagship — course coverage map
   ============================================================ */

export function CoverageSection() {
  return (
    <section style={{ background: "var(--paper)" }}>
      <div style={{ maxWidth: MAXW, margin: "0 auto", padding: "84px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.35fr", gap: 44, alignItems: "center" }} className="director-grid-2">
          <div>
            <SectionHead
              eyebrow="Course coverage"
              title="See where every photo was taken."
              accent="every photo"
              blurb="Each frame is GPS-tagged and laid over your real course. Spot your hot zones, find the gaps before race day, and put photographers exactly where the runners — and the sales — are."
            />
            <ul style={{ listStyle: "none", padding: 0, margin: "26px 0 0", display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                ["pin", "Every photo plotted on your actual GPX route"],
                ["chart", "Find under-covered stretches before the gun goes off"],
                ["camera", "Staff the spots that convert — finish, turnaround, cheer zones"],
              ].map(([icon, text]) => (
                <li key={text} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ color: "var(--accent)", marginTop: 1 }}><Icon name={icon} size={18} /></span>
                  <span style={{ fontSize: 15, color: "var(--ink)" }}>{text}</span>
                </li>
              ))}
            </ul>
          </div>
          <CourseHeatmap />
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Race insights — distributions, winners, sales
   ============================================================ */

export function InsightsSection() {
  return (
    <section style={{ background: "var(--cream)", borderTop: "1px solid var(--line)" }}>
      <div style={{ maxWidth: MAXW, margin: "0 auto", padding: "84px 24px" }}>
        <SectionHead
          eyebrow="Race insights"
          title="The report your timing company can't give you."
          accent="can't give you"
          blurb="Every event comes with a director dashboard: who finished, how the field spread out, and exactly how your photos sold."
        />
        <div style={{ marginTop: 40 }}>
          <FinishDistributions />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }} className="director-grid-2">
          <WinnersBoard />
          <PurchaseReport />
        </div>
      </div>
    </section>
  );
}

function PurchaseReport() {
  const s = SALES_SNAPSHOT;
  const kpis = [
    [s.photosCaptured.toLocaleString(), "Photos captured"],
    [s.runnersMatched.toLocaleString(), "Runners matched"],
    [s.buyers.toLocaleString(), "Photo buyers"],
    [`${s.conversionPct}%`, "Conversion"],
    [`$${s.revenue.toLocaleString()}`, "Photo revenue"],
    [`$${s.payoutToOrganizer.toLocaleString()}`, "Your payout"],
  ];
  const maxConv = Math.max(...s.byDistance.map((d) => d.conversionPct));
  const maxRev = s.salesByDay[s.salesByDay.length - 1].revenue;

  // sparkline
  const sw = 220, sh = 46;
  const spark = s.salesByDay
    .map((d, i) => {
      const x = (i / (s.salesByDay.length - 1)) * sw;
      const y = sh - (d.revenue / maxRev) * sh;
      return `${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" L ");

  return (
    <div className="card" style={{ padding: 22, background: "var(--surface)", border: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ color: "var(--accent)" }}><Icon name="chart" size={18} /></span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)" }}>
          Photo sales report
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 18 }}>
        {kpis.map(([v, l]) => (
          <div key={l}>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 500, color: "var(--ink)", lineHeight: 1.1 }}>{v}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", marginTop: 3 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Conversion by distance */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
        Conversion by distance
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
        {s.byDistance.map((d) => (
          <div key={d.key} style={{ display: "grid", gridTemplateColumns: "40px 1fr 38px", gap: 10, alignItems: "center" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink)" }}>{d.label}</span>
            <span style={{ height: 8, background: "var(--cream)", borderRadius: 5, overflow: "hidden", display: "block" }}>
              <span style={{ display: "block", height: "100%", width: `${(d.conversionPct / maxConv) * 100}%`, background: "var(--accent)", borderRadius: 5 }} />
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", textAlign: "right" }}>{d.conversionPct}%</span>
          </div>
        ))}
      </div>

      {/* Revenue over first week */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>
        Revenue · first 7 days
      </div>
      <svg viewBox={`0 0 ${sw} ${sh}`} width="100%" height={sh} style={{ display: "block" }}>
        <path d={`M ${spark} L ${sw} ${sh} L 0 ${sh} Z`} fill="var(--accent)" opacity={0.1} />
        <path d={`M ${spark}`} fill="none" stroke="var(--accent)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/* ============================================================
   Download options
   ============================================================ */

export function DownloadOptions() {
  const opts = [
    ["download", "Full resolution", "Clean, full-size files ready to print — no marks, no fuss."],
    ["crop", "Web & social", "Pre-cropped for stories, posts, and avatars in a tap."],
    ["zip", "The whole race", "Every photo of a runner in one download — one click."],
    ["bolt", "Instant delivery", "Ready the moment they check out, straight to their phone."],
  ];
  return (
    <section style={{ background: "var(--paper)", borderTop: "1px solid var(--line)" }}>
      <div style={{ maxWidth: MAXW, margin: "0 auto", padding: "84px 24px" }}>
        <SectionHead
          eyebrow="Delivery"
          title="Delivered the way runners actually want them."
          accent="actually want them"
          blurb="The download is the moment the photo becomes theirs. We make it effortless — clean files, the crops they need, none of the watermark clutter."
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18, marginTop: 44 }} className="director-grid-4">
          {opts.map(([icon, title, blurb]) => (
            <div key={title} style={{ padding: "22px 4px", borderTop: "2px solid var(--accent)" }}>
              <span style={{ color: "var(--accent)" }}><Icon name={icon} /></span>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 19, fontWeight: 500, color: "var(--ink)", marginTop: 12 }}>{title}</div>
              <div style={{ fontSize: 14, lineHeight: 1.5, color: "var(--muted)", marginTop: 6 }}>{blurb}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Two ways to work with us
   ============================================================ */

export function TwoPaths() {
  return (
    <section id="two-ways" style={{ background: "var(--cream)", borderTop: "1px solid var(--line)" }}>
      <div style={{ maxWidth: MAXW, margin: "0 auto", padding: "84px 24px" }}>
        <SectionHead
          eyebrow="Two ways to work together"
          title="We photograph it, or you bring your own."
          accent="you bring your own"
          center
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 44 }} className="director-grid-2">
          {/* Done for you */}
          <div className="card" style={{ padding: 32, background: "var(--ink-deep)", border: "1px solid var(--ink)", display: "flex", flexDirection: "column" }}>
            <Eyebrow color="var(--accent-l)">Done for you</Eyebrow>
            <h3 style={{ margin: "12px 0 0", fontFamily: "var(--font-serif)", fontSize: 27, fontWeight: 500, color: "var(--fg-on-dark)" }}>We photograph your race</h3>
            <p style={{ margin: "12px 0 0", fontSize: 15, lineHeight: 1.55, color: "rgba(245,242,236,.66)" }}>
              Our photographers cover your course. We handle the gallery, the matching, the storefront,
              and the payments — and you share in every sale. Zero lift for your team.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "18px 0 24px", display: "flex", flexDirection: "column", gap: 9 }}>
              {["On-course photographers, staffed to your hot zones", "Full gallery + storefront, managed end to end", "Revenue share back to your event", "Director dashboard & post-race report"].map((t) => (
                <li key={t} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, color: "rgba(245,242,236,.82)" }}>
                  <span style={{ color: "var(--accent-l)", marginTop: 1 }}>✓</span>
                  {t}
                </li>
              ))}
            </ul>
            <a className="btn btn--primary btn--lg" href={DEMO_URL} target="_blank" rel="noreferrer" style={{ marginTop: "auto", alignSelf: "flex-start" }}>
              Book a demo →
            </a>
          </div>

          {/* Bring your own */}
          <div className="card" style={{ padding: 32, background: "var(--surface)", border: "1px solid var(--line)", display: "flex", flexDirection: "column" }}>
            <Eyebrow>Self-serve platform</Eyebrow>
            <h3 style={{ margin: "12px 0 0", fontFamily: "var(--font-serif)", fontSize: 27, fontWeight: 500, color: "var(--ink)" }}>Bring your own photographers</h3>
            <p style={{ margin: "12px 0 0", fontSize: 15, lineHeight: 1.55, color: "var(--muted)" }}>
              Already have shooters? Put them on the platform. They upload, our face + bib matching does
              the heavy lifting, and your runners buy through galleries that sell themselves.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "18px 0 24px", display: "flex", flexDirection: "column", gap: 9 }}>
              {["Your photographers, your brand", "Automatic face + bib matching", "Self-serve uploads & galleries", "Keep more of every sale"].map((t) => (
                <li key={t} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, color: "var(--ink)" }}>
                  <span style={{ color: "var(--accent)", marginTop: 1 }}>✓</span>
                  {t}
                </li>
              ))}
            </ul>
            <Link className="btn btn--dark btn--lg" href="/photographer" style={{ marginTop: "auto", width: "auto", alignSelf: "flex-start" }}>
              Become a photographer →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Final CTA
   ============================================================ */

export function FinalCta() {
  return (
    <section style={{ background: "var(--ink-deep)" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "88px 24px", textAlign: "center" }}>
        <Eyebrow color="var(--accent-l)">Let&rsquo;s talk</Eyebrow>
        <h2 style={{ margin: "14px 0 0", fontFamily: "var(--font-serif)", fontWeight: 500, fontSize: "clamp(30px, 4vw, 48px)", lineHeight: 1.05, letterSpacing: "-.018em", color: "var(--fg-on-dark)" }}>
          Let&rsquo;s photograph your <em className="acc-l">next race</em>.
        </h2>
        <p style={{ margin: "18px auto 0", fontSize: 17, lineHeight: 1.55, color: "rgba(245,242,236,.66)", maxWidth: 520 }}>
          Tell us about your event and we&rsquo;ll walk you through coverage, pricing, and what your
          runners (and your bottom line) get out of it.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 30 }}>
          <a className="btn btn--primary btn--lg" href={DEMO_URL} target="_blank" rel="noreferrer">
            Book a demo →
          </a>
          <a className="btn btn--lg" href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--fg-on-dark)", border: "1px solid rgba(245,242,236,.28)" }}>
            Email us
          </a>
        </div>
        <div style={{ marginTop: 18, fontFamily: "var(--font-mono)", fontSize: 12.5, letterSpacing: ".04em", color: "rgba(245,242,236,.55)" }}>
          {CONTACT_EMAIL}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Slim footer
   ============================================================ */

export function DirectorFooter() {
  return (
    <footer style={{ background: "var(--ink-deep)", borderTop: "1px solid rgba(245,242,236,.1)" }}>
      <div style={{ maxWidth: MAXW, margin: "0 auto", padding: "26px 24px", display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "var(--font-serif)", fontWeight: 700, fontSize: 18, color: "var(--fg-on-dark)" }}>
          Mikian<span style={{ color: "var(--accent-l)" }}>.</span>Photos
        </div>
        <div style={{ display: "flex", gap: 22, fontFamily: "var(--font-sans)", fontSize: 13 }}>
          <Link href="/" style={{ color: "rgba(245,242,236,.7)", textDecoration: "none" }}>Runner site</Link>
          <Link href="/privacy" style={{ color: "rgba(245,242,236,.7)", textDecoration: "none" }}>Privacy</Link>
          <Link href="/terms" style={{ color: "rgba(245,242,236,.7)", textDecoration: "none" }}>Terms</Link>
        </div>
      </div>
    </footer>
  );
}
