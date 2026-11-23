import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Prisma } from "@prisma/client";
import { rawDb } from "@/lib/db";
import { DEV_EMAIL, DEV_NUMBER, devIds, forgetDevIds } from "@/lib/devHide";
import { CHALLENGE, pacificDay } from "@/lib/row100k";

/* THE DEVELOPER ACCOUNT (owner, 2026-11-23): "We just need a single
 * reviewer/dev account. Give them rower 000 and name Developer. Give it a
 * copy of all my data (always just pulls data from my account 001) and make
 * any changes that it makes to its data reset the next day ... Or we can
 * have a reset button for the dev account in the settings ... We also just
 * need a password for it no username ... can we set one up w/o me being in
 * vercel?"
 *
 * One account, rower 000, "Developer". It opens with a password alone
 * (session route), which the owner types into the app's settings while
 * signed in as himself; only its scrypt digest is kept, in RowSetting.
 *
 * ITS DATA is a copy of rower 001's: the rows (their photos are the same
 * stored files, never copied and never deleted), the profile's words and
 * photo, the erg pieces, and who 001 follows. Whatever the Developer does
 * to it (a row logged, a photo swapped, a follow, a like) stands until the
 * first time the account is used on a later day (Pacific), when it is all
 * wiped and copied from 001 again; RESET in its own settings does the same
 * at once. Nobody else ever sees any of it (lib/devHide.ts).
 *
 * THE WIPE touches ONLY what belongs to rower 000, checked before anything
 * is removed: never rower 001, never anybody else, never a stored photo. */

const SOURCE_NUMBER = 1;
const NAME = "Developer";
const K_PASS = "dev.password";
const K_DAY = "dev.resetDay";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

/* ---------- the password ---------- */

export async function devPasswordSet(): Promise<boolean> {
  const row = await rawDb.rowSetting.findUnique({ where: { challenge_key: { challenge: CHALLENGE, key: K_PASS } }, select: { value: true } });
  return !!row?.value;
}

export async function setDevPassword(pass: string, by: string): Promise<void> {
  const salt = randomBytes(16);
  const hash = await scrypt(pass, salt, 32);
  const value = `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
  await rawDb.rowSetting.upsert({
    where: { challenge_key: { challenge: CHALLENGE, key: K_PASS } },
    create: { challenge: CHALLENGE, key: K_PASS, value, updatedBy: by },
    update: { value, updatedBy: by },
  });
}

export async function devPasswordMatches(pass: string): Promise<boolean> {
  const row = await rawDb.rowSetting.findUnique({ where: { challenge_key: { challenge: CHALLENGE, key: K_PASS } }, select: { value: true } });
  const [kind, saltHex, hashHex] = (row?.value ?? "").split("$");
  if (kind !== "scrypt" || !saltHex || !hashHex) return false;
  const want = Buffer.from(hashHex, "hex");
  const got = await scrypt(pass, Buffer.from(saltHex, "hex"), want.length);
  return got.length === want.length && timingSafeEqual(got, want);
}

/* ---------- the account ---------- */

/* The Developer's account and rower, made if they are not there; the copy
 * is made the first time. Returns the account id. */
export async function ensureDev(): Promise<string> {
  const who = await rawDb.photographer.upsert({
    where: { email: DEV_EMAIL },
    create: { email: DEV_EMAIL, name: NAME, roles: ["user"], isAdmin: false },
    update: { name: NAME },
    select: { id: true },
  });
  const have = await rawDb.rowParticipant.findUnique({ where: { challenge_userId: { challenge: CHALLENGE, userId: who.id } }, select: { id: true, rowerNumber: true } });
  if (have && have.rowerNumber !== DEV_NUMBER) throw new Error("The Developer account is a rower under another number; not touching it.");
  if (!have) {
    await rawDb.rowParticipant.create({ data: { challenge: CHALLENGE, userId: who.id, rowerNumber: DEV_NUMBER, displayName: NAME } });
    forgetDevIds();
    await resetDev();
  }
  return who.id;
}

/* Asked on every signed-in request, so answered from the ids kept a while
 * per server (lib/devHide.ts), not a read each time. */
export async function isDevAccount(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  return (await devIds(rawDb))?.userId === userId;
}

/* The first use on a new day (Pacific) wipes the day's changes and copies
 * rower 001 again. Claimed with one conditional write, so two requests at
 * the same moment do not both copy. */
export async function resetIfNewDay(): Promise<void> {
  const today = pacificDay(Date.now());
  const row = await rawDb.rowSetting.findUnique({ where: { challenge_key: { challenge: CHALLENGE, key: K_DAY } }, select: { value: true } });
  if (row?.value === today) return;
  if (!row) {
    await rawDb.rowSetting.create({ data: { challenge: CHALLENGE, key: K_DAY, value: "" } }).catch(() => null);
  }
  const claimed = await rawDb.rowSetting.updateMany({ where: { challenge: CHALLENGE, key: K_DAY, value: { not: today } }, data: { value: today, updatedBy: "daily reset" } });
  if (claimed.count === 1) await resetDev({ claimed: true });
}

/* WIPE AND COPY. Everything of rower 000's, then rower 001's again. */
export async function resetDev(opts: { claimed?: boolean } = {}): Promise<{ rows: number }> {
  const who = await rawDb.photographer.findUnique({ where: { email: DEV_EMAIL }, select: { id: true } });
  if (!who) throw new Error("No Developer account.");
  const dev = await rawDb.rowParticipant.findUnique({ where: { challenge_userId: { challenge: CHALLENGE, userId: who.id } } });
  /* The one check everything below stands on. */
  if (!dev || dev.rowerNumber !== DEV_NUMBER || dev.userId !== who.id) throw new Error("Rower 000 is not the Developer account; nothing wiped.");
  const src = await rawDb.rowParticipant.findUnique({ where: { challenge_rowerNumber: { challenge: CHALLENGE, rowerNumber: SOURCE_NUMBER } } });
  if (!src || src.id === dev.id) throw new Error("No rower 001 to copy.");
  const pid = dev.id;

  const [entries, telemetry, follows, social] = await Promise.all([
    rawDb.rowEntry.findMany({ where: { challenge: CHALLENGE, participantId: src.id }, orderBy: { createdAt: "asc" } }),
    rawDb.rowTelemetry.findMany({ where: { userId: src.userId } }),
    rawDb.rowFollow.findMany({ where: { followerId: src.id, status: "accepted" }, select: { challenge: true, followeeId: true } }),
    rawDb.rowSocialSetting.findUnique({ where: { participantId: src.id } }),
  ]);

  /* New ids made here, so an erg piece can point at its row's copy. */
  /* Shaped like the ids Prisma makes (a "c" and lowercase letters and
   * figures), so every check on a row's id passes them. */
  const newId = () => `c${randomBytes(12).toString("hex")}`;
  const entryMap = new Map(entries.map((e) => [e.id, newId()]));

  /* A row in progress shown to a live race (read by raw SQL only, and a
   * table some databases do not have yet): outside the copy, so its absence
   * cannot stop it. */
  await rawDb.$executeRaw`DELETE FROM "RowLive" WHERE "participantId" = ${pid}`.catch(() => null);

  await rawDb.$transaction(
    async (tx) => {
      /* WIPE: only rower 000's. */
      await tx.rowCommentLike.deleteMany({ where: { participantId: pid } });
      await tx.rowComment.deleteMany({ where: { participantId: pid } });
      await tx.rowLike.deleteMany({ where: { participantId: pid } });
      await tx.rowNotification.deleteMany({ where: { OR: [{ participantId: pid }, { actorId: pid }] } });
      await tx.rowFollow.deleteMany({ where: { OR: [{ followerId: pid }, { followeeId: pid }] } });
      await tx.rowMute.deleteMany({ where: { OR: [{ muterId: pid }, { mutedId: pid }] } });
      await tx.rowBlock.deleteMany({ where: { OR: [{ blockerId: pid }, { blockedId: pid }] } });
      await tx.rowTelemetry.deleteMany({ where: { userId: who.id } });
      await tx.rowEntry.deleteMany({ where: { participantId: pid } });

      /* COPY: the profile's words, under the Developer's own name. */
      await tx.rowParticipant.update({
        where: { id: pid },
        data: { displayName: NAME, instagram: "", division: src.division, birthday: src.birthday, heightCm: src.heightCm, weightKg: src.weightKg, bio: src.bio, homeGym: src.homeGym },
      });
      await tx.rowSocialSetting.upsert({
        where: { participantId: pid },
        create: { challenge: CHALLENGE, participantId: pid, avatarKey: social?.avatarKey ?? null },
        update: { isPrivate: false, notifyOff: [], notifyOn: [], avatarKey: social?.avatarKey ?? null },
      });
      if (entries.length) {
        await tx.rowEntry.createMany({
          data: entries.map((e) => ({ id: entryMap.get(e.id)!, challenge: e.challenge, participantId: pid, day: e.day, meters: e.meters, seconds: e.seconds, note: e.note, title: e.title, caption: e.caption, photos: e.photos, createdAt: e.createdAt })),
        });
      }
      if (telemetry.length) {
        await tx.rowTelemetry.createMany({
          data: telemetry.map((t) => ({
            challenge: t.challenge,
            participantId: null,
            rowerNumber: DEV_NUMBER,
            userId: who.id,
            device: t.device,
            simulated: t.simulated,
            startedAt: t.startedAt,
            endedAt: t.endedAt,
            meters: t.meters,
            tenths: t.tenths,
            strokes: t.strokes,
            avgPaceTenths: t.avgPaceTenths,
            avgWatts: t.avgWatts,
            avgSpm: t.avgSpm,
            avgHr: t.avgHr,
            dragFactor: t.dragFactor,
            title: t.title,
            entryId: t.entryId ? entryMap.get(t.entryId) ?? null : null,
            data: t.data as Prisma.InputJsonValue,
            createdAt: t.createdAt,
          })),
        });
      }
      if (follows.length) {
        await tx.rowFollow.createMany({ data: follows.filter((f) => f.followeeId !== pid).map((f) => ({ challenge: f.challenge, followerId: pid, followeeId: f.followeeId, status: "accepted", acceptedAt: new Date() })), skipDuplicates: true });
      }
      if (!opts.claimed) {
        await tx.rowSetting.upsert({
          where: { challenge_key: { challenge: CHALLENGE, key: K_DAY } },
          create: { challenge: CHALLENGE, key: K_DAY, value: pacificDay(Date.now()), updatedBy: "reset" },
          update: { value: pacificDay(Date.now()), updatedBy: "reset" },
        });
      }
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
  return { rows: entries.length };
}
