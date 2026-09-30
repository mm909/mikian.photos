import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { mailEnvelope } from "@/lib/email";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { siteSettings } from "@/lib/rowSettings";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { TextMenu } from "../TextMenu";
import { waveCount } from "../raceday";
import { WAVE_PLACEHOLDERS, WAVE_WORDS, wavePlaceholders } from "../raceEmail";
import { resolvedRace } from "../racedaySettings";
import { listRacers, type Racer } from "../racedayData";
import { MAIL_KEYS, SAMPLE_LINE, buildMail, parseMailKey } from "./catalog";
import { MailFrame } from "./MailFrame";
import { WaveWords } from "./WaveWords";
import { emailsCss } from "./emailsCss";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Emails — Rowtember",
  robots: { index: false, follow: false },
};

/* THE EMAILS (owner, 2026-09-27, race day: "Show me what the email looks
 * like that racers will get for their wave. Show me what it looks like on
 * an emails page"). Every mail Rowtember sends, one at a time, as it
 * arrives: who it is from, who it goes to, what sends it, the subject, and
 * the body in its own frame. The mail word picks which; the wave note
 * carries a second word for the wave, since its clock is the wave's.
 *
 * Built by the same functions the routes send with (catalog.ts), on the
 * race AS THE CONSOLE HAS IT (resolvedRace) — move the first wave in the
 * console and this page moves with it. A made-up rower; nothing is sent.
 *
 * THE WORDS (owner, 2026-09-30): under the wave note's envelope an admin
 * gets three plain textareas for the lines the letter lets him retype
 * (WaveWords.tsx, the mail.wave setting). The page reads the setting the
 * way the sender does and hands it to the same function, so the frame is
 * the letter that goes out.
 *
 * Admin only in production, open in local dev: the gate the other console
 * pages wear. */

type SearchParams = { [key: string]: string | string[] | undefined };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function EmailsPage({ searchParams }: { searchParams?: SearchParams }) {
  const viewer = await resolveViewer();
  if (process.env.NODE_ENV === "production" && !viewer.isAdmin) notFound();

  const key = parseMailKey(searchParams?.e);
  const [race, settings] = await Promise.all([resolvedRace(), siteSettings()]);

  /* The field, for two things only: how many waves the wave word offers,
   * and the sign-up note's tally. listRacers fails open; a field it could
   * not read is -1 to the tally, which prints "field not read". */
  let racers: Racer[] = [];
  let read = true;
  try {
    racers = await listRacers(race);
  } catch (err) {
    read = false;
    console.error("row100k/emails: field not read", err);
  }
  const live = racers.filter((r) => !r.withdrewAt);
  const racing = live.filter((r) => r.role === "racer");
  const assigned = racing.reduce((m, r) => Math.max(m, r.wave ?? 0), 0);
  const waves = Math.max(assigned, waveCount(race, racing.length), 1);
  const wRaw = Number(one(searchParams?.w));
  const wave = Number.isInteger(wRaw) && wRaw >= 1 && wRaw <= waves ? wRaw : 1;

  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "mikianmusser.com";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  const mail = buildMail({
    key,
    race,
    wave,
    mailWave: settings.mailWave,
    racing: read ? racing.length : -1,
    watching: read ? live.length - racing.length : -1,
    origin: `${proto}://${host}`,
  });
  const env = mailEnvelope();
  /* Each placeholder with what it prints for the wave shown, for the mono
   * line under the words. */
  const vars = wavePlaceholders(race, wave);
  const placeholders = WAVE_PLACEHOLDERS.map((name) => ({ name, value: vars[name] }));

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{emailsCss}</style>
      <RowBar {...barProps(viewer)} />

      <section>
        <div className="wrap em">
          <div className="pf-eye">
            <span className="em-words">
              <TextMenu
                options={MAIL_KEYS.map((m) => ({ key: m.key, label: m.label, href: m.key === "wave" ? "/row100k/emails" : `/row100k/emails?e=${m.key}` }))}
                value={key}
                ariaLabel="Which email"
              />
              {key === "wave" && (
                <>
                  <span className="dot">·</span>
                  <TextMenu
                    options={Array.from({ length: waves }, (_, i) => ({ key: String(i + 1), label: `Wave ${i + 1}`, href: `/row100k/emails?w=${i + 1}` }))}
                    value={String(wave)}
                    ariaLabel="Which wave"
                  />
                </>
              )}
            </span>
            <span className="r">Sample · {SAMPLE_LINE}</span>
          </div>

          <dl className="em-env">
            <dt>From</dt>
            <dd>{env.from}</dd>
            <dt>To</dt>
            <dd>{mail.to}</dd>
            <dt>Sent</dt>
            <dd>{mail.when}</dd>
            <dt>Subject</dt>
            <dd className="subj">{mail.subject}</dd>
          </dl>

          {key === "wave" && viewer.isAdmin && (
            <WaveWords words={settings.mailWave} defaults={{ ...WAVE_WORDS }} placeholders={placeholders} />
          )}

          {mail.html ? (
            <>
              <MailFrame html={mail.html} title={mail.subject} />
              <details className="em-plain">
                <summary>Plain text</summary>
                <pre className="em-text">{mail.text}</pre>
              </details>
            </>
          ) : (
            <pre className="em-text">{mail.text}</pre>
          )}
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
