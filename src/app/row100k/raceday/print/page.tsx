import type { Metadata } from "next";
import { archivo, archivoBlack, spaceMono } from "../../theme";
import { hoursLine, type RaceDef } from "../../raceday";
import { resolvedRace } from "../../racedaySettings";
import { printCss } from "./printCss";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Race day flyers — print",
  robots: { index: false, follow: false },
};

/* THE FLYER (owner, 2026-09-21: "make me flyers for race day that I can
 * print out and put at local gyms … in a format I can send to a print
 * shop"; then, of the three looks offered: "I like version A. Ink on
 * white" — and off it came the wave line, the words under the date, time
 * and price, the address and the sentence at the foot. What is left is
 * the bill, the code and the house, and the call to action is OPT IN).
 *
 * ONE SHEET, US LETTER. A real 8.5 by 11 inch box with @page set to match,
 * so PRINT TO PDF from any browser — or headless Chrome with
 * --print-to-pdf, which is how the PDF the owner has was made — gives a
 * print shop a letter-size PDF with vector type and the fonts embedded.
 *
 *   ?flat=1   no grey ground or shadow, for a straight screenshot
 *
 * THE FACTS come off the race AS IT STANDS (resolvedRace: the console can
 * move the doors), the same read the page and the ads make, so the flyer
 * can never say a time the page has stopped saying.
 *
 * NO SPONSOR on paper yet. Print is the most permanent surface there is;
 * the room sponsor goes here the day they accept (raceday.ts SPONSOR_SHOWN)
 * and not before. */

const QR = "/row100k/print/qr-raceday.svg";
const MARK_INK = "/row100k/print/strip-barbell-ink.png";

type Facts = {
  sub: string;
  year: string;
  dow: string;
  date: string;
  hours: string;
  venue: string;
};

function factsOf(race: RaceDef): Facts {
  const [dow, date] = race.when.split(",").map((s) => s.trim());
  return {
    sub: race.sub,
    year: race.day.slice(0, 4),
    dow: dow ?? "",
    date: date ?? race.when,
    hours: hoursLine(race).replace(/:00/g, ""),
    venue: race.venue,
  };
}

export default async function RaceDayPrintPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const v = searchParams?.flat;
  const flat = (Array.isArray(v) ? v[0] : v) === "1";
  const race = await resolvedRace();
  const f = factsOf(race);
  const fonts = `${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`;

  return (
    <div className={`pr ${flat ? "flat " : ""}${fonts}`}>
      <style>{printCss}</style>
      <section className="pr-sheet">
        <header className="pr-top">
          <span>Rowtember {f.year}</span>
          <span>
            {f.dow} {f.date}
          </span>
        </header>
        <h1 className="pr-title">
          <span>Race</span>
          <span>Day</span>
        </h1>
        <hr className="pr-rule" />
        <p className="pr-sub">{f.sub}</p>
        <div className="pr-facts">
          <div>
            <b>{f.date}</b>
          </div>
          <div>
            <b>{f.hours}</b>
          </div>
          <div>
            <b>Free</b>
          </div>
        </div>
        <div className="pr-foot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="pr-qr" src={QR} alt="QR code for the race day sign-up" />
          <p className="pr-cta">Opt in</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="pr-mark" src={MARK_INK} alt={f.venue} />
        </div>
      </section>
    </div>
  );
}
