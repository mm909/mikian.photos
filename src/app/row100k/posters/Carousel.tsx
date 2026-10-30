import { MARK } from "@/lib/row100k";

/* THE CAROUSEL CARDS on the poster page (owner, 2026-10-30, with a rower
 * poster in the post format: "I need a title screen here. Just a post
 * size rowtember with the white background"; "And a thank you for opting
 * in end screen"; then "Put them on the poster page"). The cover and the
 * last card of an Instagram carousel of posters, on the poster's own
 * cream: the mark alone with the nameplate rule, and THANK YOU FOR
 * OPTING IN with the sign-off. Drawn once by scripts/title-card.html and
 * scripts/end-card.html (og-render.mjs) into public/row100k/title in the
 * three Instagram sizes the studio offers — they carry no number, so
 * nothing about them is per rower or per month, and a static file beats
 * a canvas here. No address, no handle (the sticker rule).
 *
 * The month's own mark leads (row100k.ts MARK: ROWTEMBER, ROWVEMBER in
 * November); the other edition's card stays on the page, tagged, so the
 * November cover is here in October. Server component. */

const SIZES = [
  { key: "post", label: "Post 4:5", w: 1080, h: 1350 },
  { key: "story", label: "Story 9:16", w: 1080, h: 1920 },
  { key: "square", label: "Square 1:1", w: 1080, h: 1080 },
] as const;

type Card = { file: string; name: string; tag: string; alt: string };

const EDITIONS: Card[] = [
  { file: "rowtember", name: "Rowtember", tag: "TITLE SCREEN", alt: "ROWTEMBER on cream" },
  { file: "rowvember", name: "Rowvember", tag: "TITLE SCREEN · NOVEMBER", alt: "ROWVEMBER on cream, the V in brown" },
];
const THANKS: Card = { file: "thank-you", name: "Thank you", tag: "END SCREEN", alt: "THANK YOU FOR OPTING IN on cream" };

export function Carousel() {
  const lead = EDITIONS.filter((c) => c.file.toUpperCase() === MARK);
  const rest = EDITIONS.filter((c) => c.file.toUpperCase() !== MARK);
  const cards = [...lead, THANKS, ...rest];
  return (
    <section className="po-car">
      <div className="wrap">
        <div className="sec-head">
          <h2>The carousel</h2>
          <span className="mono">TITLE AND END SCREENS · INSTAGRAM</span>
        </div>
        <div className="po-car-grid">
          {cards.map((c) => (
            <figure key={c.file} className="po-car-card">
              <p className="po-eye">{c.tag}</p>
              <a className="po-frame po-car-frame" href={`/row100k/title/${c.file}-post.png`} download={`${c.file}-post.png`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/row100k/title/${c.file}-post.png`} alt={c.alt} width={1080} height={1350} loading="lazy" />
              </a>
              <figcaption className="po-acts">
                {SIZES.map((s) => (
                  <a key={s.key} className="po-btn" href={`/row100k/title/${c.file}-${s.key}.png`} download={`${c.file}-${s.key}.png`}>
                    {s.label}
                  </a>
                ))}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
