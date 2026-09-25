import type { ReactNode } from "react";
import { LOOK_KEYS, type LookKey, type LookMe } from "./view";
import { LogWord } from "./LogWord";

/* THE LOOK SWITCHER, one mono line at the top: A · B · C · D · E as words,
 * the one showing in bold water. It exists only while ?look= is in the
 * URL (the page renders a look only then), so the ordinary landing never
 * carries it. */
export function LookSwitcher({ look }: { look: LookKey }) {
  return (
    <p className="lk-switch mono">
      <span className="k">Look</span>
      {LOOK_KEYS.map((k) => (
        <a key={k} href={`/row100k?look=${k}`} className={k === look ? "on" : ""} aria-current={k === look ? "page" : undefined}>
          {k.toUpperCase()}
        </a>
      ))}
    </p>
  );
}

/* THE ME HEAD (owner, 2026-09-25: "a few of my stats — my current count,
 * top-line numbers"): bib and name on the eyebrow with the month, then
 * this month's meters, hours and rows as one mono line, then LOG A ROW as
 * a word. No odometer. The log form (LogInPlace, mounted by the page) is
 * the `form` slot right under it, so the word opens it in place. */
export function MeHead({ me, monthLabel, form }: { me: LookMe; monthLabel: string; form: ReactNode }) {
  return (
    <section className="lk-me">
      <p className="lk-eye mono">
        <span>
          {me.numStr} · <a href={`/row100k/r/${me.rowerNumber}`}>{me.name}</a> · {monthLabel}
        </span>
      </p>
      <p className="lk-mine mono">
        <b>{me.metersStr}</b>
        <span className="dot">·</span>
        <b>{me.hoursStr}</b> {me.hoursStr === "1" ? "hour" : "hours"}
        <span className="dot">·</span>
        <b>{me.sessions}</b> {me.sessions === 1 ? "row" : "rows"}
      </p>
      <div className="lk-act">
        <LogWord />
      </div>
      <div className="lk-form">{form}</div>
    </section>
  );
}
