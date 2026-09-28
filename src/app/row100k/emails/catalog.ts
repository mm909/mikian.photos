import { GOAL_METERS, daysElapsed, fmtRowerNumber, nowMs } from "@/lib/row100k";
import { pacificDayKey } from "@/lib/rowPeriod";
import type { RaceDef } from "../raceday";
import { waveEmail } from "../raceEmail";
import { signupNote } from "../raceSignupMail";
import { milestoneMail, rowLoggedMail } from "../rowMail";
import { settleMonthDefault } from "../shirt";
import { receiptEmail, settledEmail, sizeChangedEmail } from "../shirtEmail";
import { joinNote } from "../joinMail";

/* EVERY MAIL ROWTEMBER SENDS, built by the very functions the routes call,
 * on a made-up rower (owner, 2026-09-27: "Show me what the email looks like
 * that racers will get for their wave. Show me what it looks like on an
 * emails page"). Nothing here sends, reads a row or writes one — the page
 * (emails/page.tsx) hands in the race and today's tally and gets the mail
 * back exactly as the inbox would.
 *
 * The rower is the one both preview routes already use, so every preview
 * of every mail on the site is the same person. */

const SAMPLE = { name: "Sasha Vance", rowerNumber: 12 };

export type MailKey = "wave" | "shirt" | "shirt-size" | "shirt-owed" | "race-signup" | "join" | "row" | "milestone";

export type ShownMail = {
  key: MailKey;
  /* The word in the menu. */
  label: string;
  /* Who it lands with, in a few words. */
  to: string;
  /* What sends it. */
  when: string;
  subject: string;
  text: string;
  /* null for the plain-text notes the owner gets. */
  html: string | null;
};

/* Racer-facing first, the owner's own notes after; the wave note leads
 * because it is the one going out today. */
export const MAIL_KEYS: { key: MailKey; label: string }[] = [
  { key: "wave", label: "Wave note" },
  { key: "shirt", label: "Shirt receipt" },
  { key: "shirt-size", label: "Shirt size changed" },
  { key: "shirt-owed", label: "Shirt owed" },
  { key: "race-signup", label: "Race sign-up" },
  { key: "join", label: "New rower" },
  { key: "row", label: "Row logged" },
  { key: "milestone", label: "Milestone" },
];

export function parseMailKey(raw: string | string[] | undefined): MailKey {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return MAIL_KEYS.some((m) => m.key === v) ? (v as MailKey) : "wave";
}

export function buildMail(o: {
  key: MailKey;
  race: RaceDef;
  wave: number;
  /* The field as it stands, for the sign-up note's tally; -1 = not read. */
  racing: number;
  watching: number;
  origin: string;
}): ShownMail {
  const label = MAIL_KEYS.find((m) => m.key === o.key)?.label ?? o.key;
  const payUrl = `${o.origin}/row100k/shirt/pay`;
  const today = pacificDayKey(nowMs());
  const row = {
    ...SAMPLE,
    meters: 6_000,
    seconds: 1_440,
    day: today,
    title: "Morning row",
    total: 84_210,
    sessions: 14,
    profileUrl: `${o.origin}/row100k/r/${SAMPLE.rowerNumber}`,
  };

  switch (o.key) {
    case "wave": {
      const m = waveEmail({ race: o.race, ...SAMPLE, wave: o.wave });
      return { key: o.key, label, to: "Each racer with a wave · bcc you", when: "Email the waves, in the race console · again if their wave moves", ...m };
    }
    case "shirt": {
      const m = receiptEmail({ ...SAMPLE, size: "M", kind: "stock", meters: 52_340 });
      return { key: o.key, label, to: "The rower who ordered · bcc you", when: "A shirt is ordered", ...m };
    }
    case "shirt-size": {
      const m = sizeChangedEmail({ ...SAMPLE, from: "L", size: "M", kind: "stock", meters: 52_340 });
      return { key: o.key, label, to: "The rower who ordered · bcc you", when: "A shirt changes size", ...m };
    }
    case "shirt-owed": {
      const m = settledEmail({ ...SAMPLE, size: "M", meters: 52_340, free: false, payUrl, month: settleMonthDefault().label });
      return { key: o.key, label, to: "A rower short of the 100K · bcc you", when: "Settle the month, in the shop console", ...m };
    }
    case "race-signup": {
      const m = signupNote({
        race: o.race,
        event: "new",
        ...SAMPLE,
        role: "racer",
        division: o.race.brackets.find((b) => b.key === "F")?.key ?? o.race.brackets[0]?.key ?? "F",
        email: "sasha@example.com",
        racing: o.racing,
        watching: o.watching,
        /* No baseUrl: the route passes none, so the door-list link is the
         * one the owner actually gets. */
      });
      return { key: o.key, label, to: "You · a reply goes to the rower", when: "Somebody enters race day", html: null, ...m };
    }
    case "join": {
      const m = joinNote({
        rowerNumber: SAMPLE.rowerNumber,
        displayName: SAMPLE.name,
        instagram: "sashavance",
        division: "F",
        accountName: SAMPLE.name,
        accountEmail: "sasha@example.com",
      });
      return { key: o.key, label, to: "You · a reply goes to the rower", when: "A new rower opts in", html: null, ...m };
    }
    case "row": {
      const m = rowLoggedMail(row, { kind: "none" });
      return { key: o.key, label, to: "You", when: "Any rower logs a row · censored while lights out is on", html: null, ...m };
    }
    case "milestone": {
      const m = milestoneMail({ ...row, total: GOAL_METERS + 1_500 }, [GOAL_METERS], daysElapsed());
      return { key: o.key, label, to: "You", when: "A row carries a rower past 50K, 100K, 250K and up", html: null, ...m };
    }
  }
}

/* "RACER 012 · SASHA VANCE" — who the sample is, for the page's own line. */
export const SAMPLE_LINE = `${fmtRowerNumber(SAMPLE.rowerNumber)} · ${SAMPLE.name}`;
