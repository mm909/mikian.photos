import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";

/* THE ANDROID TESTERS (owner, 2026-11-25: "a quick page explaining ... what
 * the beta testers for the Android need to do ... and then also let that be
 * the place where they can put in their email address"). Google Play needs
 * 12 testers opted in to the closed test for 14 days before the app can
 * go to production.
 *
 * Kept in one stored setting (RowSetting ANDROID_KEY, a JSON list): no new
 * table. Emails are never shown on the page; only the count is.
 *
 * THE COUNT (owner, the same day: "we always want to show, like, even when
 * we're full ... 10 out of 12 ... we're going to need some buffer ... once
 * we hit 11, make it 11 out of 13. Up to 20"): the goal shown is 12, or two
 * past the count once that passes 10, up to 20. The four who wrote in by
 * DM before the page existed are in the list itself (owner: "make sure
 * those 4 are added"), so BASE is 0. */
export const ANDROID_KEY = "android.testers";
export const ANDROID_BASE = 0;
export const ANDROID_NEED = 12;
export const ANDROID_TOP = 20;

export type Tester = { email: string; name: string; at: string };

export async function androidTesters(): Promise<Tester[]> {
  try {
    const row = await db.rowSetting.findUnique({ where: { challenge_key: { challenge: CHALLENGE, key: ANDROID_KEY } }, select: { value: true } });
    const l = row?.value ? (JSON.parse(row.value) as unknown) : [];
    return Array.isArray(l) ? (l as Tester[]).filter((t) => t && typeof t.email === "string") : [];
  } catch {
    return [];
  }
}

export async function saveAndroidTesters(list: Tester[]): Promise<void> {
  const value = JSON.stringify(list);
  await db.rowSetting.upsert({
    where: { challenge_key: { challenge: CHALLENGE, key: ANDROID_KEY } },
    create: { challenge: CHALLENGE, key: ANDROID_KEY, value, updatedBy: "android-page" },
    update: { value, updatedBy: "android-page" },
  });
}

/* "6 of 12", "11 of 13", "19 of 20", "23 of 23". */
export function testerCount(saved: number): { have: number; goal: number } {
  const have = ANDROID_BASE + saved;
  const goal = have >= ANDROID_TOP ? have : Math.min(ANDROID_TOP, Math.max(ANDROID_NEED, have + 2));
  return { have, goal };
}
