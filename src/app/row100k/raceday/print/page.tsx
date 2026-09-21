import type { Metadata } from "next";
import { archivo, archivoBlack, spaceMono } from "../../theme";
import { hoursLine, waveTime, type RaceDef } from "../../raceday";
import { resolvedRace } from "../../racedaySettings";
import { printCss } from "./printCss";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Race day flyers — print",
  robots: { index: false, follow: false },
};

/* THE FLYERS (owner, 2026-09-21: "make me flyers for race day that I can
 * print out and put at local gyms. Give me a few options and make sure they
 * are in a format I can send to a print shop").
 *
 * ONE PAGE, THREE SHEETS, US LETTER. Each sheet is a real 8.5 by 11 inch
 * box with @page set to match, so PRINT TO PDF from any browser — or
 * headless Chrome with --print-to-pdf, which is how the PDFs in the repo
 * were made — gives a print shop a letter-size PDF with vector type and
 * the fonts embedded. Nothing is rasterised.
 *
 *   ?look=a   PAPER — ink on white, the cheap one for any printer
 *   ?look=b   INK   — white on black, the race day page as a poster
 *   ?look=c   TABS  — ink on white with a tear-off strip of eight tabs
 *   (none)    all three, one after another, for choosing on screen
 *   &flat=1   no grey ground or shadow, for a straight screenshot
 *
 * THE FACTS come off the race AS IT STANDS (resolvedRace: the console can
 * move the doors and the first wave), the same read the page and the ads
 * make, so a flyer can never say a time the page has stopped saying.
 *
 * THE CODE points at the race day page, where the ask is now two steps for
 * anybody: sign in with Google, put your name in. The flyer says so in as
 * many words, because the one thing that must not happen at a gym is a
 * stranger reading Rowtember and deciding the race is not for them.
 *
 * NO SPONSOR on paper yet. Print is the most permanent surface there is;
 * the room sponsor goes here the day they accept (raceday.ts SPONSOR_SHOWN)
 * and not before. */

const URL_WORD = "mikianmusser.com/row100k/raceday";
const QR = "/row100k/print/qr-raceday.svg";
const QR_WHITE = "/row100k/print/qr-raceday-white.svg";
const MARK_INK = "/row100k/print/strip-barbell-ink.png";

type Look = "a" | "b" | "c";
const LOOKS: { key: Look; label: string }[] = [
  { key: "a", label: "Paper" },
  { key: "b", label: "Ink" },
  { key: "c", label: "Tear-off" },
];

type Facts = {
  title: string;
  sub: string;
  year: string;
  dow: string;
  date: string;
  hours: string;
  firstWave: string;
  every: number;
  room: string;
  venue: string;
  venueMark: RaceDef["venueMark"];
  brackets: string;
  meters: string;
};

function factsOf(race: RaceDef): Facts {
  const [dow, date] = race.when.split(",").map((s) => s.trim());
  return {
    title: race.title,
    sub: race.sub,
    year: race.day.slice(0, 4),
    dow: dow ?? "",
    date: date ?? race.when,
    hours: hoursLine(race).replace(/:00/g, ""),
    firstWave: waveTime(race, 1),
    every: race.waveMinutes,
    room: race.room,
    venue: race.venue,
    venueMark: race.venueMark,
    brackets: race.brackets.map((b) => b.label.toLowerCase()).join(" and "),
    meters: race.meters.toLocaleString("en-US"),
  };
}

export default async function RaceDayPrintPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const one = (k: string) => {
    const v = searchParams?.[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const pick = one("look");
  const looks: Look[] = pick === "a" || pick === "b" || pick === "c" ? [pick] : ["a", "b", "c"];
  const flat = one("flat") === "1";
  const race = await resolvedRace();
  const f = factsOf(race);
  const fonts = `${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`;

  return (
    <div className={`pr ${flat ? "flat " : ""}${fonts}`}>
      <style>{printCss}</style>
      {!flat && (
        <nav className="pr-nav" aria-label="Looks">
          <span className="k">Race day flyers · US letter · print to PDF</span>
          <a className={pick ? "" : "on"} href="/row100k/raceday/print">
            All three
          </a>
          {LOOKS.map((l) => (
            <a key={l.key} className={pick === l.key ? "on" : ""} href={`/row100k/raceday/print?look=${l.key}`}>
              {l.label}
            </a>
          ))}
        </nav>
      )}
      {looks.map((l) => (l === "c" ? <TearOff key={l} f={f} /> : <Bill key={l} f={f} ink={l === "b"} />))}
    </div>
  );
}

/* The bill, on paper or on ink — the same sheet with the colours swapped
 * and the white-on-transparent house mark used as it is on ink. */
function Bill({ f, ink }: { f: Facts; ink: boolean }) {
  return (
    <section className={ink ? "pr-sheet pr-b" : "pr-sheet pr-a"}>
      <Head f={f} />
      <h1 className="pr-title">
        <span>Race</span>
        <span>Day</span>
      </h1>
      <hr className="pr-rule" />
      <p className="pr-sub">{f.sub}</p>
      <p className="pr-wave">
        First wave {f.firstWave} · waves of eight every {f.every} min · {f.brackets}
      </p>
      <Grid f={f} />
      <p className="pr-where">
        <b>{f.room}</b> at {f.venue}. Row {f.meters} m on the clock, or come and watch — a spectator holds a place in
        the room and nothing else.
      </p>
      <Foot f={f} ink={ink} />
    </section>
  );
}

/* The tear-off: the same bill, a size smaller, over eight tabs a reader
 * takes with them. Each tab carries the code and the address, so the
 * flyer keeps working after the first tab goes. */
function TearOff({ f }: { f: Facts }) {
  return (
    <section className="pr-sheet pr-a pr-c">
      <Head f={f} />
      <h1 className="pr-title">
        <span>Race</span>
        <span>Day</span>
      </h1>
      <hr className="pr-rule" />
      <p className="pr-sub">{f.sub}</p>
      <p className="pr-wave">
        First wave {f.firstWave} · waves of eight every {f.every} min · {f.brackets}
      </p>
      <Grid f={f} />
      <Foot f={f} ink={false} />
      <p className="pr-cut" aria-hidden="true">
        <span>Take one</span>
        <span>{f.room} · {f.venue}</span>
      </p>
      <div className="pr-tabs">
        {Array.from({ length: 8 }, (_, i) => (
          <div className="pr-tab" key={i}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={QR} alt="" />
            <span>
              mikianmusser.com
              <br />
              /row100k/raceday
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Head({ f }: { f: Facts }) {
  return (
    <header className="pr-top">
      <span>Rowtember {f.year}</span>
      <span>
        {f.dow} {f.date}
      </span>
    </header>
  );
}

function Grid({ f }: { f: Facts }) {
  return (
    <div className="pr-facts">
      <div>
        <b>{f.date}</b>
        <span>{f.dow}</span>
      </div>
      <div>
        <b>{f.hours}</b>
        <span>Doors</span>
      </div>
      <div>
        <b>Free</b>
        <span>Racer or spectator</span>
      </div>
    </div>
  );
}

function Foot({ f, ink }: { f: Facts; ink: boolean }) {
  const mark = ink ? f.venueMark?.src : MARK_INK;
  return (
    <div className="pr-foot">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="pr-qr" src={ink ? QR_WHITE : QR} alt={`QR code for ${URL_WORD}`} />
      <div className="pr-how">
        <b>Scan to put your name in</b>
        <span>{URL_WORD}</span>
        <small>Sign in with Google, put your name in, done. You do not have to be doing Rowtember to race.</small>
      </div>
      {mark ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="pr-mark" src={mark} alt={f.venueMark?.alt ?? f.venue} />
      ) : (
        <span />
      )}
    </div>
  );
}
