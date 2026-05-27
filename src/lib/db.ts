import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Single shared client across hot reloads in dev. In prod each Lambda instance
// instantiates once. Logs only `error` so we don't blow stdout on every query.
export const db: PrismaClient =
  global.__prisma ?? new PrismaClient({ log: ["error"] });

if (process.env.NODE_ENV !== "production") global.__prisma = db;
