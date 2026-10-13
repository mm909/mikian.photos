import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getEffectiveActor, isAdmin } from "@/lib/permissions";
import { EVENTS, eventPath, shortDay } from "./events";
import { BLACK, anton, barlowCondensed, css } from "./theme";

/* THE HYROX INDEX: one line per event in events.ts (owner, 2026-10-13:
 * "ideally, this can be made for other Hyrox events"). With one event it
 * is a door; with more it is the list. The same gate as the event pages. */

export const metadata: Metadata = {
  title: "Hyrox (dev) — Who is racing",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: BLACK };
export const dynamic = "force-dynamic";

export default async function HyroxIndexPage() {
  const actor = await getEffectiveActor();
  if (process.env.NODE_ENV === "production" && !(actor && isAdmin(actor))) notFound();

  return (
    <div className={`hx ${anton.variable} ${barlowCondensed.variable}`}>
      <style>{css}</style>
      <div className="hx-bar">
        <a href="/" className="hx-wm">
          Mikian
          <small>Musser · Photographs</small>
        </a>
      </div>
      <div className="hx-stripe" />
      <header className="wrap">
        <p className="hx-crumb">Hyrox</p>
        <h1 className="disp">
          Who is
          <br />
          <span className="yr">racing</span>
        </h1>
        <p className="hx-lede">Pick the event. Put your name on its board, see who else is in, grab a sticker.</p>
        <div className="hx-events">
          {EVENTS.map((ev) => (
            <a className="hx-event" href={eventPath(ev)} key={ev.slug}>
              <span className="t">{ev.name}</span>
              <small>
                {shortDay(ev.days[0])} – {shortDay(ev.days[ev.days.length - 1])} · {ev.venue}
              </small>
            </a>
          ))}
        </div>
      </header>
    </div>
  );
}
