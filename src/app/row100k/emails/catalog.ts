import { GOAL_METERS, daysElapsed, fmtRowerNumber, nowMs } from "@/lib/row100k";
import { pacificDayKey } from "@/lib/rowPeriod";
import type { MailWave } from "@/lib/rowSettings";
import type { RaceDef } from "../raceday";
import { waveEmail } from "../raceEmail";
import { signupNote } from "../raceSignupMail";
import { milestoneMail, rowLoggedMail } from "../rowMail";
import { settleMonthDefault } from "../shirt";
import { receiptEmail, settledEmail, sizeChangedEmail } from "../shirtEmail";
import { joinNote } from "../joinMail";
import { dailySummaryMail, emptyDailyInput, fmtDayShort, yesterdayKey, type DailyInput } from "../dailyMail";

/* EVERY MAIL ROWTEMBER SENDS, built by the very functions the routes call,
 * on a made-up rower (owner, 2026-09-27: "Show me what the email looks like
 * that racers will get for their wave. Show me what it looks like on an
 * emails page"). Nothing here sends, reads a row or writes one — the page
 * (emails/page.tsx) hands in the race and today's tally and gets the mail
 * back exactly as the inbox would.
 *
 * The rower is the one both preview routes already use, so every preview
 * of every mail on the site is the same person.
 *
 * THE ONE EXCEPTION is the daily summary (2026-09-30): it has no rower in
 * it, so the page shows it on yesterday's REAL numbers, read through the
 * same function the cron reads with (dailyData.ts). The page hands the
 * read in; null means it failed, and the mail is shown on an empty day
 * with the envelope saying so. */

const SAMPLE = { name: "Sasha Vance", rowerNumber: 12 };

export type MailKey = "wave" | "shirt" | "shirt-size" | "shirt-owed" | "race-signup" | "join" | "row" | "milestone" | "daily";

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
  /* The page's right-hand line when the mail is not on the sample rower:
   * "Real · Wed Oct 1" for the daily summary. Absent, the sample line. */
  stamp?: string;
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
  { key: "daily", label: "Daily summary" },
];

export function parseMailKey(raw: string | string[] | undefined): MailKey {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return MAIL_KEYS.some((m) => m.key === v) ? (v as MailKey) : "wave";
}

export function buildMail(o: {
  key: MailKey;
  race: RaceDef;
  wave: number;
  /* The owner's words for the wave note (siteSettings().mailWave) — the
   * page passes what the send reads, so the preview is the letter. */
  mailWave: MailWave;
  /* The field as it stands, for the sign-up note's tally; -1 = not read. */
  racing: number;
  watching: number;
  origin: string;
  /* Yesterday as dailyData.ts read it, for the daily summary only; null
   * when the read failed (or the page did not need it). */
  daily?: DailyInput | null;
}): ShownMail {
  const label = MAIL_KEYS.find((m) => m.key === o.key)?.label ?? o.key;
  const payUrl = `${o.origin}/shirt/pay`;
  const today = pacificDayKey(nowMs());
  const row = {
    ...SAMPLE,
    meters: 6_000,
    seconds: 1_440,
    day: today,
    title: "Morning row",
    total: 84_210,
    sessions: 14,
    profileUrl: `${o.origin}/r/${SAMPLE.rowerNumber}`,
  };

  switch (o.key) {
    case "wave": {
      const m = waveEmail({ race: o.race, ...SAMPLE, wave: o.wave, copy: o.mailWave });
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
    case "daily": {
      const yesterday = yesterdayKey(nowMs());
      const input = o.daily ?? emptyDailyInput(yesterday);
      const m = dailySummaryMail(input);
      return {
        key: o.key,
        label,
        to: "You",
        when: `Every morning at 6:15${o.daily ? "" : " · yesterday not read"}`,
        stamp: `Real · ${fmtDayShort(input.day)}`,
        ...m,
      };
    }
  }
}

/* "RACER 012 · SASHA VANCE" — who the sample is, for the page's own line. */
export const SAMPLE_LINE = `${fmtRowerNumber(SAMPLE.rowerNumber)} · ${SAMPLE.name}`;
