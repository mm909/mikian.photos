import { PrismaClient } from "@prisma/client";
import { hideDev } from "./devHide";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Single shared client across hot reloads in dev. In prod each Lambda instance
// instantiates once. Logs only `error` so we don't blow stdout on every query.
const base: PrismaClient = global.__prisma ?? new PrismaClient({ log: ["error"] });
if (process.env.NODE_ENV !== "production") global.__prisma = base;

/* Every read through `db` leaves out the Developer account (rower 000)
 * unless it asks for it (lib/devHide.ts). Same type as before, so nothing
 * that imports it changes. */
export const db: PrismaClient = hideDev(base) as unknown as PrismaClient;

/* The client WITHOUT that rule, for the Developer's own copy and reset
 * (lib/devAccount.ts) and nothing else. */
export const rawDb: PrismaClient = base;
