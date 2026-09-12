import { fmtRowerNumber } from "@/lib/row100k";
import { RACE_ROLES, type RaceDef, type RaceRole } from "./raceday";

/* THE SIGNUP NOTE (owner, 2026-09-12: "send me an email whenever someone
 * signs up for race day"). One plain-text line to the owner every time a
 * name arrives in the field, sent from the signup POST
 * (api/row100k/raceday) and nowhere else.
 *
 * PURE, and that is the point: race in, person in, the field as it stands
 * in, { subject, text } out. Nothing here reads the database, reaches the
 * network or knows what Resend is, so every wording below can be looked at
 * without mailing anybody — which is how the subjects got read as phone
 * notifications before the first one was ever sent.
 *
 * NOT raceEmail.ts, which is a different letter to a different person: that
 * one is the wave note, it goes to a ROWER on race morning, and it is
 * cream-paper HTML with the gym's mark in it. This is a nudge to one inbox.
 * Plain text on purpose — it is read on a lock screen, and half of them
 * never get opened at all.
 *
 * THE SUBJECT IS THE WHOLE MAIL, most days. He will read it far more often
 * than the body, and a phone shows roughly forty characters of it, so the
 * order is deliberate: WHO, then what they signed up as, then the tally —
 * the two facts that need no thought first, the running totals last, where
 * losing them to a truncation costs nothing (the body prints them again).
 *
 * HIS ADDRESS IS IN THE BODY ON PURPOSE. This note goes to OWNER_EMAIL and
 * to nobody else, so a rower's email on a line of it is the owner reading
 * his own sign-up sheet, not a leak — and it is the fastest way for him to
 * answer somebody from a desk rather than a phone. The reply-to carries the
 * same address, which is the usual way in; the printed line is for when he
 * wants to copy it. Nothing else about a rower rides along: no meters, no
 * 5k, no handle. A name, a number, a bracket and a way to reply. */

export type SignupNote = { subject: string; text: string };

/* WHAT HAPPENED TO THE FIELD. A NAME ARRIVING is the thing he asked for,
 * and it has two shapes — somebody new, and somebody who had withdrawn
 * putting their name back. Both are a body in the room that was not there a
 * second ago, so both are mail.
 *
 * A ROLE SWITCH IS NOT IN HERE, deliberately: a racer turning spectator is
 * the same person in the same room, and mailing it would turn one rower
 * changing their mind twice into two notes about nothing.
 *
 * "withdrew" IS WRITTEN AND NOTHING CALLS IT. He asked for sign-ups and a
 * shrinking field is arguably as worth knowing as a growing one — but that
 * is his call, not mine, so the wording is ready and the trigger is not
 * pulled. Turning it on is ONE line in the signup route: in the `withdraw`
 * branch, right after the `db.rowRaceSignup.update` that stamps withdrewAt,
 * set the same `arrival` variable the enter branch sets — `arrival =
 * "withdrew";` — and the note at the foot of the route sends itself, with
 * the tally already correct because it is read after the write. */
export type SignupEvent = "new" | "returning" | "withdrew";

export type SignupArrival = {
  race: RaceDef;
  event: SignupEvent;
  /* The rower, as the field lists them (racedayData.Racer). */
  name: string;
  rowerNumber: number;
  role: RaceRole;
  /* "M" | "F", or whatever the row carries when it is neither. */
  division: string;
  /* The address they signed up with — the reply-to, and printed once. */
  email: string;
  /* THE FIELD AFTERWARDS, counted the way the route counts it: `racing` is
   * live racers only, `watching` is live spectators, withdrawals are in
   * neither. Handed in rather than derived because the caller has already
   * paid for the read, and because a pure builder must not go and look. */
  racing: number;
  watching: number;
  /* Where the door list lives. Nobody has to pass it — left off, this walks
   * the same ladder the wave note's pictures walk (env, then the domain we
   * live on). The preview and the tests pass their own. */
  baseUrl?: string;
};

/* A long name has to not eat the subject: the tally lives at the end of it,
 * and an inbox list that shows sixty characters should still get to the
 * numbers. The body always prints the name whole. */
const SUBJECT_NAME = 32;

function shortName(raw: string): string {
  const n = raw.trim() || "Someone";
  return n.length <= SUBJECT_NAME ? n : `${n.slice(0, SUBJECT_NAME - 1).trimEnd()}…`;
}

/* The subject's verb and the body's one explaining line, per event. Adding
 * a fourth kind of news is an entry here and a caller; see the note above
 * "withdrew". A null line means the facts speak for themselves. */
const NEWS: Record<SignupEvent, { said: (who: string, what: string) => string; line: string | null }> = {
  new: {
    said: (who, what) => `${who} is in as a ${what}`,
    line: null,
  },
  returning: {
    said: (who, what) => `${who} is back in as a ${what}`,
    line: "They had taken their name out — this is them putting it back.",
  },
  withdrew: {
    said: (who) => `${who} is out`,
    line: "They took their name out. The row stays, and so does the wave they had — the console will show the hole.",
  },
};

/* The same ladder raceEmail.assetUrl walks, for the same reason: a mail has
 * no site under it, so the door list has to be an absolute address. A base
 * that is not http(s) falls back to the domain rather than printing a link
 * that goes nowhere — the owner tapping a dead link at 6 PM on race day is
 * the failure worth spending three lines on. */
function siteUrl(base: string | undefined, path: string): string {
  const b = (base ?? process.env.NEXT_PUBLIC_BASE_URL ?? "https://mikianmusser.com").trim().replace(/\/+$/, "");
  return `${/^https?:\/\//i.test(b) ? b : "https://mikianmusser.com"}${path}`;
}

/* "Racer" / "Spectator", off the same table the page and the ads set their
 * buttons from, so the word in the mail can never drift from the word the
 * rower pressed. */
const roleLabel = (role: RaceRole): string => RACE_ROLES.find((r) => r.key === role)?.label ?? role;

/* "Men" / "Women", off the race's own brackets. A row carrying neither (an
 * "X" rower) prints whatever it carries rather than a blank — the owner
 * should see the odd one, not have it tidied away. */
const bracketLabel = (race: RaceDef, division: string): string =>
  race.brackets.find((b) => (b.key as string) === division)?.label ?? (division || "no bracket");

export function signupNote(a: SignupArrival): SignupNote {
  const news = NEWS[a.event];
  const what = roleLabel(a.role).toLowerCase();
  /* THE TALLY, in the two words that do not repeat the role: "12 racing · 3
   * watching" beside "is in as a racer" says two different things, where
   * "12 racers" beside it says one thing twice. Numerals always — a tally
   * is read, not parsed, and "1 racing" is fine on a phone.
   *
   * A NEGATIVE COUNT MEANS THE CALLER COULD NOT READ THE FIELD. listRacers
   * fails open, so a hiccup on the re-read hands back an empty list rather
   * than an error, and printing that as "0 racing" would tell the owner
   * something false about his own race at the one moment he is paying
   * attention to it. Say the field was not read and let the door list be
   * the answer — the note is a nudge towards it, never a record. */
  const counted = a.racing >= 0 && a.watching >= 0;
  const tally = counted ? `${a.racing} racing · ${a.watching} watching` : "field not read just now";

  return {
    subject: `${a.race.title}: ${news.said(shortName(a.name), what)} — ${tally}`,
    text: [
      `ROWTEMBER · ${a.race.title.toUpperCase()} · ${a.race.when}`,
      ``,
      /* The number alone when there is no name — which happens only on the
       * fallback path, where the field could not be re-read and the route
       * sent what the request itself knew. A leading middle dot with
       * nothing in front of it reads as a rendering fault, and the whole
       * point of that path is to look deliberate. */
      a.name.trim()
        ? `${a.name} · rower ${fmtRowerNumber(a.rowerNumber)}`
        : `Rower ${fmtRowerNumber(a.rowerNumber)}`,
      `${roleLabel(a.role)} · ${bracketLabel(a.race, a.division)}`,
      a.email,
      ...(news.line ? [``, news.line] : []),
      ``,
      `THE FIELD NOW`,
      tally,
      ``,
      `THE DOOR LIST`,
      siteUrl(a.baseUrl, "/row100k/race-admin"),
    ].join("\n"),
  };
}
