import type { PrismaClient } from "@prisma/client";
import { bearerOf, verifyAppToken } from "./appToken";

/* THE DEVELOPER ACCOUNT IS NOBODY ELSE'S BUSINESS (owner, 2026-11-23: "We
 * just need a single reviewer/dev account. Give them rower 000 and name
 * Developer. Give it a copy of all my data"). Rower 000 carries a copy of
 * rower 001's rows (lib/devAccount.ts), so if anybody else could see it the
 * owner's meters would count twice: on the board, in every total, in the
 * stats. So rower 000 is hidden here, under every read the site and the app
 * make, by one rule:
 *
 *   ROWER 000 IS THERE ONLY FOR A READ THAT ASKS FOR IT.
 *
 * A read that names the Developer (its participant id, its account id) sees
 * it, and so does a read of rower number 0 made while the Developer is the
 * one asking. Every other read (a board, a total, a feed, a list of
 * followers, a count) gets `rowerNumber <> 0` or `participantId <> it`
 * added. Writes are never touched.
 *
 * WHY HERE AND NOT IN EACH QUERY: there are about a hundred reads of rowers
 * and rows across the site, the app, the emails and the crons. One missed
 * would put the copy on the board. Here none can be missed; the raw SQL
 * reads (app/live, of RowLive) carry the same rule by hand.
 *
 * WHAT CAN BE CACHED for everybody (a board, a total) is always read with
 * the rule on, whoever asks: the Developer never sees itself on a board,
 * and a board it caused to be built never has it in. Only its own social
 * marks (likes, comments, follows) are shown back to it, which no shared
 * cache holds. */

const READS = new Set(["findMany", "findFirst", "findFirstOrThrow", "findUnique", "findUniqueOrThrow", "count", "aggregate", "groupBy"]);

/* WHO IS ASKING: the account the request's bearer token names (the
 * phone app signs every request so). Read off the request itself, so it
 * holds however deep the read; outside a request it is nobody, and the
 * rule stays on. Read from Next's own store of the request and NOT through
 * headers(), which would turn a page that happened to read here from
 * static to dynamic. Only the social tables and a read of rower 0 ask,
 * and nothing cached for everybody reads either (2026-11-23). Tokens seen
 * are remembered a while. */
const tokenWho = new Map<string, string | null>();
async function askerId(): Promise<string | null> {
  let auth: string | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requestAsyncStorage } = require("next/dist/client/components/request-async-storage.external") as { requestAsyncStorage: { getStore(): { headers: Headers } | undefined } };
    auth = requestAsyncStorage.getStore()?.headers.get("authorization") ?? null;
  } catch {
    return null;
  }
  if (!auth) return null;
  const known = tokenWho.get(auth);
  if (known !== undefined) return known;
  const token = bearerOf(auth);
  const who = token ? await verifyAppToken(token).catch(() => null) : null;
  if (tokenWho.size > 500) tokenWho.clear();
  tokenWho.set(auth, who);
  return who;
}
const devAsking = async (id: Ids | null) => !!id && (await askerId()) === id.userId;

/* The Developer's two ids, looked up once a while per server. The rule for
 * rower NUMBER 0 needs neither, so a fresh account is hidden from the
 * moment its participant row exists, on every server. */
export const DEV_EMAIL = "appreview@rowtember.com";
export const DEV_NUMBER = 0;
type Ids = { userId: string; pid: string };
let ids: Ids | null = null;
let idsAt = 0;
let idsLoading: Promise<Ids | null> | null = null;

export function forgetDevIds(): void {
  ids = null;
  idsAt = 0;
}

export async function devIds(base: PrismaClient): Promise<Ids | null> {
  const fresh = ids ? 10 * 60_000 : 15_000;
  if (Date.now() - idsAt < fresh) return ids;
  if (!idsLoading) {
    idsLoading = (async () => {
      try {
        const who = await base.photographer.findUnique({ where: { email: DEV_EMAIL }, select: { id: true } });
        const p = who ? await base.rowParticipant.findFirst({ where: { userId: who.id, rowerNumber: DEV_NUMBER }, select: { id: true } }) : null;
        ids = who && p ? { userId: who.id, pid: p.id } : null;
      } catch {
        /* A table not there (a fresh database) or a hiccup: no Developer. */
        ids = null;
      }
      idsAt = Date.now();
      idsLoading = null;
      return ids;
    })();
  }
  return idsLoading;
}

type Where = Record<string, unknown> | undefined;
/* Adds a condition to a where, beside whatever unique keys it already has
 * (a findUnique keeps them at the top). */
function and(where: Where, extra: Record<string, unknown>): Record<string, unknown> {
  const w = where ?? {};
  const had = w.AND === undefined ? [] : Array.isArray(w.AND) ? w.AND : [w.AND];
  return { ...w, AND: [...had, extra] };
}

const names = (args: unknown, id: Ids | null) => {
  if (!id) return false;
  const s = JSON.stringify(args ?? {});
  return s.includes(id.pid) || s.includes(id.userId);
};
const namesNumberZero = (args: unknown) => /"rowerNumber":0[,}]/.test(JSON.stringify(args ?? {}));

export function hideDev(base: PrismaClient) {
  /* One hook per kind of table: what to add to a read that does not ask
   * for the Developer. `social` tables show the Developer its own marks. */
  const hook = (extra: (id: Ids | null) => Record<string, unknown> | null, opts: { social?: boolean; byNumber?: boolean } = {}) =>
    async function ({ operation, args, query }: { operation: string; args: unknown; query: (a: unknown) => Promise<unknown> }) {
      if (!READS.has(operation)) return query(args);
      const id = await devIds(base);
      if (names(args, id)) return query(args);
      if (opts.byNumber && namesNumberZero(args) && (await devAsking(id))) return query(args);
      if (opts.social && (await devAsking(id))) return query(args);
      const add = extra(id);
      if (!add) return query(args);
      const a = (args ?? {}) as Record<string, unknown>;
      return query({ ...a, where: and(a.where as Where, add) });
    };

  return base.$extends({
    name: "hide-developer",
    query: {
      rowParticipant: { $allOperations: hook(() => ({ rowerNumber: { not: DEV_NUMBER } }), { byNumber: true }) },
      rowEntry: { $allOperations: hook(() => ({ participant: { rowerNumber: { not: DEV_NUMBER } } })) },
      /* The Developer's copies of the owner's erg pieces: by account, and
       * marked rower 0 so they are hidden before the ids are known. */
      rowTelemetry: {
        $allOperations: hook((id) => ({
          AND: [{ OR: [{ rowerNumber: null }, { rowerNumber: { not: DEV_NUMBER } }] }, ...(id ? [{ OR: [{ userId: null }, { userId: { not: id.userId } }] }] : [])],
        })),
      },
      rowFollow: { $allOperations: hook((id) => (id ? { followerId: { not: id.pid }, followeeId: { not: id.pid } } : null), { social: true }) },
      rowLike: { $allOperations: hook((id) => (id ? { participantId: { not: id.pid } } : null), { social: true }) },
      rowComment: { $allOperations: hook((id) => (id ? { participantId: { not: id.pid } } : null), { social: true }) },
      rowCommentLike: { $allOperations: hook((id) => (id ? { participantId: { not: id.pid } } : null), { social: true }) },
      rowNotification: { $allOperations: hook((id) => (id ? { OR: [{ actorId: null }, { actorId: { not: id.pid } }] } : null), { social: true }) },
      rowMute: { $allOperations: hook((id) => (id ? { muterId: { not: id.pid }, mutedId: { not: id.pid } } : null), { social: true }) },
      rowBlock: { $allOperations: hook((id) => (id ? { blockerId: { not: id.pid }, blockedId: { not: id.pid } } : null), { social: true }) },
    },
  });
}
