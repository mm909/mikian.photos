import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { r2, r2Bucket, r2Configured } from "@/lib/r2";

/* Database backups — logical dumps of every table, restorable with nothing
 * but this file, the Prisma schema and (when set) BACKUP_KEY.
 *
 *   backups/db/<id>/<Table>.ndjson.gz       one JSON object per row (row_to_json)
 *   backups/db/<id>/<Table>.ndjson.gz.enc   the same, sealed with BACKUP_KEY
 *   backups/db/<id>/manifest.json           written LAST — its presence means
 *                                           the backup is complete
 *
 * They live in their OWN bucket (R2_BACKUP_BUCKET), never the photo bucket:
 * R2_BUCKET is served publicly through R2_PUBLIC_URL and R2 public access is
 * bucket-wide, so a dump of download tokens, secret links and e-mails under a
 * guessable key there would be readable by anyone. backupBucket() refuses to
 * run without a separate bucket, and with BACKUP_KEY set every table file is
 * AES-256-GCM encrypted as well, so even a bucket made public by mistake
 * leaks nothing.
 *
 * Every table is read inside one REPEATABLE READ transaction, so a backup is
 * a single consistent snapshot (a row and its parent never disagree). Rows
 * come out of Postgres as JSON and go back in through
 * json_populate_recordset with an explicit column list (the live columns the
 * backup has keys for), so a backup restores into a schema that has since
 * gained columns (they take their defaults) or lost columns without any
 * translation, and the row shapes are plain enough to read by eye or load
 * anywhere else. The manifest records which database the rows came from;
 * restores and pruning refuse to mix databases.
 *
 * The daily cron (src/app/api/cron/backup-db) writes to R2; the scripts
 * (scripts/db-backup.ts, scripts/db-restore.ts) do the same from a laptop,
 * to R2 or a local folder. Retention lives in pruneBackups(). Restores go
 * through restoreBackup(), which can load into a scratch schema (to prove a
 * backup is good) or replace the live tables.
 *
 * This is the second line of defence; the first is Neon's own history /
 * point-in-time restore on the database branch. See BACKUPS.md. */

export const BACKUP_PREFIX = "backups/db/";
/* The only id shape this code creates (see backupId). Retention never touches
 * a folder whose name does not match — a hand-named backup is kept forever. */
export const BACKUP_ID_RE = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/;
const EXPORT_BATCH = 5000;
const RESTORE_BATCH = 1000;

export type TableManifest = {
  table: string;
  rows: number;
  /* Uncompressed NDJSON bytes / gzip bytes / sha256 of the file AS STORED
   * (the sealed bytes when the backup is encrypted). */
  bytes: number;
  gzipBytes: number;
  sha256: string;
  file: string;
};

/* Where the rows came from: hostname + database name, never credentials. */
export type BackupSource = { host: string; database: string };

export type BackupManifest = {
  version: 1;
  id: string;
  createdAt: string;
  postgres: string;
  source?: BackupSource;
  /* Table files are sealed with BACKUP_KEY (see seal()); the manifest itself
   * — names, counts, hashes, no rows — is always plain. */
  encrypted?: boolean;
  tables: TableManifest[];
  totalRows: number;
  totalGzipBytes: number;
  note?: string;
};

export type BackupDest = { kind: "r2" } | { kind: "local"; dir: string };

/* Backup id: "2026-09-04T10-00-05Z" — the instant, sortable, safe in a key. */
export function backupId(at = new Date()): string {
  return at.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/:/g, "-");
}

const q = (ident: string) => `"${ident.replace(/"/g, '""')}"`;

/* ------------------------------------------------------ which database */

/* Identity of the database behind a connection string: hostname + db name
 * only. Neon's "-pooler" host suffix is stripped so the pooled and direct
 * URLs of one database compare equal. */
export function dbIdentity(url = process.env.POSTGRES_URL ?? ""): BackupSource {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error("POSTGRES_URL is not a parseable URL — cannot tell which database this is");
  }
  if (!u.hostname) throw new Error("POSTGRES_URL has no host — cannot tell which database this is");
  return { host: u.hostname.replace(/-pooler(?=\.)/, ""), database: u.pathname.replace(/^\//, "") };
}

/* ------------------------------------------------------------ the bucket */

/* Backups live in their OWN bucket. The photo bucket (R2_BUCKET) is public
 * via R2_PUBLIC_URL and R2 has no per-prefix access control, so this refuses
 * to write anywhere but a bucket set aside for backups. Create it with public
 * access OFF and no custom domain, then set R2_BACKUP_BUCKET. */
export function backupBucket(): string {
  const b = process.env.R2_BACKUP_BUCKET?.trim();
  if (!b) {
    throw new Error("R2_BACKUP_BUCKET is not set — backups must not go into the public photo bucket");
  }
  if (b === r2Bucket()) {
    throw new Error("R2_BACKUP_BUCKET must differ from R2_BUCKET (that bucket is public via R2_PUBLIC_URL)");
  }
  return b;
}

/* Can backups be written to / read from R2 at all? (credentials + a
 * separate bucket) — the cron and the scripts fail closed on false. */
export function backupConfigured(): boolean {
  if (!r2Configured()) return false;
  try {
    backupBucket();
    return true;
  } catch {
    return false;
  }
}

/* The generic helpers in src/lib/r2.ts are bound to R2_BUCKET; these are the
 * same four operations against the backup bucket. */
async function bucketPut(key: string, body: Buffer, contentType: string): Promise<void> {
  await r2().send(
    new PutObjectCommand({ Bucket: backupBucket(), Key: key, Body: body, ContentType: contentType }),
  );
}

async function bucketGet(key: string): Promise<Buffer> {
  const out = await r2().send(new GetObjectCommand({ Bucket: backupBucket(), Key: key }));
  if (!out.Body) throw new Error(`empty body for ${key}`);
  return Buffer.from(await out.Body.transformToByteArray());
}

async function bucketList(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const page = await r2().send(
      new ListObjectsV2Command({ Bucket: backupBucket(), Prefix: prefix, ContinuationToken: token }),
    );
    for (const o of page.Contents ?? []) if (o.Key) keys.push(o.Key);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function bucketDelete(keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += 500) {
    await r2().send(
      new DeleteObjectsCommand({
        Bucket: backupBucket(),
        Delete: { Objects: keys.slice(i, i + 500).map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }
}

/* --------------------------------------------------------- encryption */

/* Optional encryption at rest. With BACKUP_KEY set (32 bytes: 64 hex chars
 * or 44 base64 chars) every table file is sealed with AES-256-GCM before it
 * is written, so a bucket that is ever exposed still gives away nothing.
 * Layout: 12-byte iv | 16-byte auth tag | ciphertext. Keep the key somewhere
 * other than Vercel as well — without it an encrypted backup is noise. */
const IV_BYTES = 12;
const TAG_BYTES = 16;

export function backupKey(): Buffer | null {
  const raw = process.env.BACKUP_KEY?.trim();
  if (!raw) return null;
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("BACKUP_KEY must be 32 bytes: 64 hex characters or 44 base64 characters");
  }
  return key;
}

export function seal(plain: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

export function unseal(sealed: Buffer, key: Buffer): Buffer {
  if (sealed.length < IV_BYTES + TAG_BYTES) throw new Error("sealed file is too short to be one");
  const decipher = createDecipheriv("aes-256-gcm", key, sealed.subarray(0, IV_BYTES));
  decipher.setAuthTag(sealed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  return Buffer.concat([decipher.update(sealed.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]);
}

/* ------------------------------------------------------------ reading */

type TableInfo = { table: string; pk: string[] };

/* WHAT GETS BACKED UP.
 *
 * Rowtember only (owner call, day 4). The challenge is the irreplaceable
 * part: 200-odd rowers and their thousand-plus logged sessions exist nowhere
 * else, and a wrong delete cannot be reconstructed. Everything else in the
 * database — photos, orders, events — is either regenerable from R2 and
 * PayPal or not in active use, so it stays out rather than being carried
 * around in every dump.
 *
 * It also keeps the dumps boring: names, Instagram handles, meters and times,
 * all of it already public on the board. No emails, no download tokens, no
 * secret links, no password hashes. ShareEvent rides along because it is
 * challenge telemetry and is nothing but card ids and counts.
 *
 * To back the whole database up again, drop the filter in listTables(). */
export const ROWTEMBER_TABLES = ["RowParticipant", "RowEntry", "ShareEvent", "RowBlackout", "RowLinkClick"];

/* The Rowtember tables, with their primary-key columns (the export pages
 * through a table in key order so batches never overlap or skip). */
async function listTables(tx: Prisma.TransactionClient): Promise<TableInfo[]> {
  const rows = await tx.$queryRawUnsafe<{ table: string; pk: string[] | null }[]>(`
    select c.relname as "table",
           coalesce((
             select array_agg(a.attname::text order by array_position(i.indkey::smallint[], a.attnum))
               from pg_index i
               join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey::smallint[])
              where i.indrelid = c.oid and i.indisprimary
           ), '{}') as pk
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and c.relname <> '_prisma_migrations'
     order by c.relname`);
  return rows
    .filter((r) => ROWTEMBER_TABLES.includes(r.table))
    .map((r) => ({ table: r.table, pk: r.pk ?? [] }));
}

/* Every column of every ordinary table in public, in table order. */
async function listColumns(): Promise<Map<string, string[]>> {
  const rows = await db.$queryRawUnsafe<{ table: string; column: string }[]>(`
    select c.relname as "table", a.attname as "column"
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
     order by c.relname, a.attnum`);
  const out = new Map<string, string[]>();
  for (const r of rows) out.set(r.table, [...(out.get(r.table) ?? []), r.column]);
  return out;
}

async function exportTable(tx: Prisma.TransactionClient, t: TableInfo): Promise<string[]> {
  const from = `FROM "public".${q(t.table)} t`;
  if (t.pk.length === 0) {
    // No key to page by: one read, still inside the snapshot.
    const rows = await tx.$queryRawUnsafe<{ j: string }[]>(
      `SELECT row_to_json(t)::text AS j ${from}`,
    );
    return rows.map((r) => r.j);
  }
  const order = `ORDER BY ${t.pk.map(q).join(", ")}`;
  const lines: string[] = [];
  for (let offset = 0; ; offset += EXPORT_BATCH) {
    const rows = await tx.$queryRawUnsafe<{ j: string }[]>(
      `SELECT row_to_json(t)::text AS j ${from} ${order} LIMIT ${EXPORT_BATCH} OFFSET ${offset}`,
    );
    for (const r of rows) lines.push(r.j);
    if (rows.length < EXPORT_BATCH) break;
  }
  return lines;
}

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

/* ------------------------------------------------------------- writing */

async function putObject(dest: BackupDest, key: string, body: Buffer, contentType: string) {
  if (dest.kind === "r2") {
    await bucketPut(key, body, contentType);
    return;
  }
  const file = path.join(dest.dir, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

export type BackupResult = {
  manifest: BackupManifest;
  dest: BackupDest;
  pruned?: { kept: string[]; deleted: string[] };
  ms: number;
};

/* Take a backup. Reads every table in one snapshot, gzips (and, with
 * BACKUP_KEY, seals) each, uploads the tables and then the manifest. With
 * prune=true (the cron), old backups beyond the retention policy are deleted
 * afterwards — never before, so a failed run can only leave us with MORE
 * backups, not fewer. */
export async function runBackup(
  opts: { dest?: BackupDest; prune?: boolean; note?: string; log?: (s: string) => void } = {},
): Promise<BackupResult> {
  const dest = opts.dest ?? { kind: "r2" };
  const log = opts.log ?? (() => {});
  if (dest.kind === "r2") {
    if (!r2Configured()) {
      throw new Error("R2 is not configured — set R2_* env or back up to a local folder");
    }
    backupBucket(); // throws unless a separate, private bucket is configured
  }
  const key = backupKey();
  const source = dbIdentity();
  const started = Date.now();
  const id = backupId(new Date(started));
  log(
    `source ${source.host}/${source.database} → ${dest.kind === "r2" ? `r2 bucket ${backupBucket()}` : dest.dir}` +
      `, ${key ? "encrypted with BACKUP_KEY" : "NOT encrypted (set BACKUP_KEY)"}`,
  );

  // One consistent snapshot of every table.
  const snapshot = await db.$transaction(
    async (tx) => {
      const [{ version }] = await tx.$queryRawUnsafe<{ version: string }[]>(`select version()`);
      const tables = await listTables(tx);
      const dump: { table: string; lines: string[] }[] = [];
      for (const t of tables) {
        const lines = await exportTable(tx, t);
        log(`read ${t.table}: ${lines.length} rows`);
        dump.push({ table: t.table, lines });
      }
      return { version, dump };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: 10_000,
      timeout: 50_000,
    },
  );

  const tables: TableManifest[] = [];
  for (const { table, lines } of snapshot.dump) {
    const raw = Buffer.from(lines.length ? lines.join("\n") + "\n" : "", "utf8");
    const gz = gzipSync(raw, { level: 6 });
    const stored = key ? seal(gz, key) : gz;
    const file = `${table}.ndjson.gz${key ? ".enc" : ""}`;
    await putObject(dest, `${BACKUP_PREFIX}${id}/${file}`, stored, "application/octet-stream");
    tables.push({
      table,
      rows: lines.length,
      bytes: raw.length,
      gzipBytes: gz.length,
      sha256: sha256(stored),
      file,
    });
    log(`wrote ${file}: ${stored.length} bytes`);
  }

  const manifest: BackupManifest = {
    version: 1,
    id,
    createdAt: new Date(started).toISOString(),
    postgres: snapshot.version,
    source,
    encrypted: Boolean(key),
    tables,
    totalRows: tables.reduce((s, t) => s + t.rows, 0),
    totalGzipBytes: tables.reduce((s, t) => s + t.gzipBytes, 0),
    ...(opts.note ? { note: opts.note } : {}),
  };
  await putObject(
    dest,
    `${BACKUP_PREFIX}${id}/manifest.json`,
    Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
    "application/json",
  );

  const result: BackupResult = { manifest, dest, ms: Date.now() - started };
  if (opts.prune && dest.kind === "r2") {
    result.pruned = await pruneBackups({ log });
  }
  return result;
}

/* ----------------------------------------------------------- listing */

/* Complete backups (manifest present), newest first. */
export async function listBackupIds(src: BackupDest = { kind: "r2" }): Promise<string[]> {
  const ids = new Set<string>();
  if (src.kind === "r2") {
    for (const key of await bucketList(BACKUP_PREFIX)) {
      const m = key.match(/^backups\/db\/([^/]+)\/manifest\.json$/);
      if (m) ids.add(m[1]);
    }
  } else {
    const root = path.join(src.dir, BACKUP_PREFIX);
    let entries: string[] = [];
    try {
      entries = await readdir(root);
    } catch {
      entries = [];
    }
    for (const e of entries) {
      try {
        await readFile(path.join(root, e, "manifest.json"));
        ids.add(e);
      } catch {
        /* incomplete backup folder — not listed */
      }
    }
  }
  return [...ids].sort().reverse();
}

async function getObject(src: BackupDest, key: string): Promise<Buffer> {
  if (src.kind === "local") return readFile(path.join(src.dir, key));
  return bucketGet(key);
}

export async function readManifest(id: string, src: BackupDest = { kind: "r2" }): Promise<BackupManifest> {
  const buf = await getObject(src, `${BACKUP_PREFIX}${id}/manifest.json`);
  return JSON.parse(buf.toString("utf8")) as BackupManifest;
}

/* The rows of one table from a backup: checksum-verified, unsealed when the
 * backup is encrypted, row count checked against the manifest. */
export async function readTable(
  manifest: BackupManifest,
  t: TableManifest,
  src: BackupDest = { kind: "r2" },
): Promise<string[]> {
  const stored = await getObject(src, `${BACKUP_PREFIX}${manifest.id}/${t.file}`);
  const digest = sha256(stored);
  if (digest !== t.sha256) {
    throw new Error(`${t.file}: checksum mismatch (manifest ${t.sha256}, file ${digest})`);
  }
  let gz = stored;
  if (manifest.encrypted) {
    const key = backupKey();
    if (!key) throw new Error(`${t.file}: backup ${manifest.id} is encrypted — set BACKUP_KEY to read it`);
    try {
      gz = unseal(stored, key);
    } catch {
      throw new Error(`${t.file}: cannot decrypt — wrong BACKUP_KEY, or the file was altered`);
    }
  }
  const text = gunzipSync(gz).toString("utf8");
  const lines = text.split("\n").filter((l) => l.length > 0);
  if (lines.length !== t.rows) {
    throw new Error(`${t.file}: expected ${t.rows} rows, found ${lines.length}`);
  }
  return lines;
}

/* --------------------------------------------------------- retention */

/* What to keep, from a sorted list of ids (newest first) and a "now":
 *   - the newest KEEP_MIN regardless of age (a stalled cron never empties us)
 *   - everything from the last 14 days
 *   - the newest backup of each ISO week for 90 days
 *   - the newest backup of each month for 400 days
 *   - anything that is not a backupId() at all (a hand-named folder such as
 *     "before-migration-2024" is never aged — V8's Date parser would happily
 *     turn it into 2024-01-01 and drop it)
 * Pure, so it can be tested without R2. */
export const RETENTION = { keepMin: 3, dailyDays: 14, weeklyDays: 90, monthlyDays: 400 };

export function selectRetained(ids: string[], now = new Date()): { keep: string[]; drop: string[] } {
  const sorted = [...ids].sort().reverse();
  const at = (id: string) => new Date(id.replace(/T(\d{2})-(\d{2})-(\d{2})Z$/, "T$1:$2:$3Z"));
  const age = (id: string) => (now.getTime() - at(id).getTime()) / 86_400_000;
  const isoWeek = (d: Date) => {
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const jan1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return `${t.getUTCFullYear()}-W${Math.ceil(((t.getTime() - jan1.getTime()) / 86_400_000 + 1) / 7)}`;
  };
  const month = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;

  const keep = new Set<string>();
  const weeks = new Set<string>();
  const months = new Set<string>();
  sorted.forEach((id, i) => {
    if (!BACKUP_ID_RE.test(id)) {
      keep.add(id); // not one of ours — never delete what we don't understand
      return;
    }
    const d = at(id);
    if (Number.isNaN(d.getTime())) {
      keep.add(id); // shaped like an id but not a real instant — same rule
      return;
    }
    const a = age(id);
    if (i < RETENTION.keepMin || a <= RETENTION.dailyDays) keep.add(id);
    if (a <= RETENTION.weeklyDays) {
      const w = isoWeek(d);
      if (!weeks.has(w)) {
        weeks.add(w);
        keep.add(id);
      }
    }
    if (a <= RETENTION.monthlyDays) {
      const m = month(d);
      if (!months.has(m)) {
        months.add(m);
        keep.add(id);
      }
    }
  });
  return { keep: sorted.filter((id) => keep.has(id)), drop: sorted.filter((id) => !keep.has(id)) };
}

/* Apply the policy to R2: delete every object of every dropped backup.
 *
 * Only backups of THIS database (manifest.source matches POSTGRES_URL) are
 * subject to the policy. A laptop's dump of the dev database shares the
 * prefix with the prod cron's; it must neither take a prod backup's weekly
 * slot nor be deleted by the prod cron — and vice versa. Backups from
 * elsewhere, or whose manifest cannot be read, are left exactly as they are. */
export async function pruneBackups(
  opts: { now?: Date; log?: (s: string) => void } = {},
): Promise<{ kept: string[]; deleted: string[] }> {
  const log = opts.log ?? (() => {});
  const me = dbIdentity();
  const ids = await listBackupIds({ kind: "r2" });
  const owned = await Promise.all(
    ids.map(async (id) => {
      try {
        const m = await readManifest(id, { kind: "r2" });
        return m.source?.host === me.host;
      } catch {
        return false;
      }
    }),
  );
  const mine = ids.filter((_, i) => owned[i]);
  const others = ids.filter((_, i) => !owned[i]);
  if (others.length) log(`left alone (another database, or no readable manifest): ${others.join(", ")}`);

  const { keep, drop } = selectRetained(mine, opts.now);
  if (drop.length > 0) {
    const all = await bucketList(BACKUP_PREFIX);
    const doomed = all.filter((k) => drop.some((id) => k.startsWith(`${BACKUP_PREFIX}${id}/`)));
    // Manifests first, so a backup half-deleted by a crash is already
    // invisible to the listing (no manifest = not a backup).
    doomed.sort((a, b) => Number(b.endsWith("manifest.json")) - Number(a.endsWith("manifest.json")));
    await bucketDelete(doomed);
    log(`pruned ${drop.length} backup(s), ${doomed.length} object(s)`);
  }
  return { kept: keep, deleted: drop };
}

/* --------------------------------------------------------- restoring */

export type RestoreOptions = {
  id: string;
  src?: BackupDest;
  /* Target schema. "public" replaces the live tables (replace must be true);
   * anything else is created as a scratch copy of public's tables (same
   * columns, keys and indexes, no foreign keys) and loaded there. */
  schema?: string;
  replace?: boolean;
  /* Replacing public with a backup taken from ANOTHER database is refused
   * unless this is set (moving data to a new Neon project, say). */
  fromOtherDb?: boolean;
  /* Drop the scratch schema again when done (verification runs). */
  dropAfter?: boolean;
  log?: (s: string) => void;
};

export type RestoreResult = {
  id: string;
  schema: string;
  tables: { table: string; expected: number; loaded: number }[];
  skipped: string[];
  ms: number;
};

async function fkConstraints(): Promise<{ table: string; name: string }[]> {
  return db.$queryRawUnsafe<{ table: string; name: string }[]>(`
    select c.relname as "table", con.conname as name
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and con.contype = 'f'`);
}

/* Load a backup into the database.
 *
 * Rows go in through json_populate_recordset with an EXPLICIT column list —
 * the live columns the backup has keys for. A column added since the backup
 * is left out of the INSERT and takes its default; a column the backup has
 * that no longer exists is ignored. (Without the list, json_populate_recordset
 * hands INSERT an explicit NULL for every absent column and a NOT NULL
 * column with a default — this project's usual `prisma db push` — refuses
 * the load.) Only NOT NULL without a default still refuses.
 *
 * Scratch schema: tables are created with LIKE (columns, defaults, primary
 * and unique keys, indexes — LIKE never copies foreign keys), so tables can
 * load in any order and nothing in public is touched. Used to prove a
 * backup restores, and to inspect old data side by side with live.
 *
 * public: every foreign key is made DEFERRABLE, then in ONE transaction the
 * live tables are truncated, every table is loaded, every serial sequence is
 * moved past the restored data, and the constraints are checked at commit —
 * so load order does not matter and the Event ⇄ Photographer cycle in the
 * schema is fine. Any failure rolls the whole thing back, leaving the live
 * data as it was. Constraints are set back to NOT DEFERRABLE afterwards
 * (what Prisma creates). */
export async function restoreBackup(opts: RestoreOptions): Promise<RestoreResult> {
  const src = opts.src ?? { kind: "r2" };
  const schema = opts.schema ?? "public";
  const log = opts.log ?? (() => {});
  const started = Date.now();
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error(`bad schema name: ${schema}`);
  if (schema === "public" && !opts.replace) {
    throw new Error("restoring into public replaces the live tables — pass replace: true");
  }

  const manifest = await readManifest(opts.id, src);
  if (schema === "public" && manifest.source && !opts.fromOtherDb) {
    const me = dbIdentity();
    if (manifest.source.host !== me.host) {
      throw new Error(
        `backup ${opts.id} was taken from ${manifest.source.host}/${manifest.source.database}, ` +
          `this database is ${me.host}/${me.database} — pass fromOtherDb: true if that is intended`,
      );
    }
  }
  const live = await db.$transaction((tx) => listTables(tx));
  const liveNames = new Set(live.map((t) => t.table));
  const liveColumns = await listColumns();
  const wanted = manifest.tables.filter((t) => liveNames.has(t.table));
  const skipped = manifest.tables.filter((t) => !liveNames.has(t.table)).map((t) => t.table);
  for (const s of skipped) log(`skip ${s}: no such table in the current schema`);

  // Pull and verify every file BEFORE touching the database.
  const data = new Map<string, string[]>();
  for (const t of wanted) {
    data.set(t.table, await readTable(manifest, t, src));
    log(`read ${t.file}: ${t.rows} rows ok`);
  }

  const S = q(schema);
  const loadInto = async (
    tx: Prisma.TransactionClient,
    table: string,
    lines: string[],
  ): Promise<number> => {
    const T = `${S}.${q(table)}`;
    if (lines.length > 0) {
      // row_to_json emits every column for every row: the first line's keys
      // are the backup's column set. Scratch tables are LIKE public, so the
      // same list is valid for both targets.
      const keys = new Set(Object.keys(JSON.parse(lines[0]) as object));
      const all = liveColumns.get(table) ?? [];
      const cols = all.filter((c) => keys.has(c));
      const missing = all.filter((c) => !keys.has(c));
      const extra = [...keys].filter((k) => !all.includes(k));
      if (cols.length === 0) throw new Error(`${table}: no column of the backup exists in the live table`);
      if (missing.length) log(`${table}: not in backup, taking column defaults: ${missing.join(", ")}`);
      if (extra.length) log(`${table}: in backup, no longer in the table, ignored: ${extra.join(", ")}`);
      const list = cols.map(q).join(", ");
      for (let i = 0; i < lines.length; i += RESTORE_BATCH) {
        const chunk = `[${lines.slice(i, i + RESTORE_BATCH).join(",")}]`;
        await tx.$executeRawUnsafe(
          `INSERT INTO ${T} (${list}) SELECT ${list} FROM json_populate_recordset(NULL::${T}, $1::json)`,
          chunk,
        );
      }
    }
    const [{ n }] = await tx.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*)::bigint AS n FROM ${T}`);
    return Number(n);
  };

  const tables: RestoreResult["tables"] = [];

  if (schema !== "public") {
    await db.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS ${S}`);
    for (const t of wanted) {
      await db.$executeRawUnsafe(`DROP TABLE IF EXISTS ${S}.${q(t.table)}`);
      await db.$executeRawUnsafe(
        `CREATE TABLE ${S}.${q(t.table)} (LIKE "public".${q(t.table)} INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)`,
      );
    }
    for (const t of wanted) {
      const loaded = await db.$transaction((tx) => loadInto(tx, t.table, data.get(t.table) ?? []), {
        timeout: 600_000,
        maxWait: 10_000,
      });
      tables.push({ table: t.table, expected: t.rows, loaded });
      log(`loaded ${schema}.${t.table}: ${loaded}/${t.rows}`);
    }
    // No sequence handling here on purpose: LIKE … INCLUDING DEFAULTS copies
    // the nextval() default that points at PUBLIC's sequence, and the backup
    // always supplies serial columns explicitly.
    if (opts.dropAfter) {
      await db.$executeRawUnsafe(`DROP SCHEMA ${S} CASCADE`);
      log(`dropped schema ${schema}`);
    }
  } else {
    const fks = await fkConstraints();
    for (const c of fks) {
      await db.$executeRawUnsafe(
        `ALTER TABLE "public".${q(c.table)} ALTER CONSTRAINT ${q(c.name)} DEFERRABLE INITIALLY IMMEDIATE`,
      );
    }
    try {
      await db.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe(`SET CONSTRAINTS ALL DEFERRED`);
          const names = live.map((t) => `"public".${q(t.table)}`).join(", ");
          await tx.$executeRawUnsafe(`TRUNCATE ${names}`);
          for (const t of wanted) {
            const loaded = await loadInto(tx, t.table, data.get(t.table) ?? []);
            tables.push({ table: t.table, expected: t.rows, loaded });
            log(`loaded public.${t.table}: ${loaded}/${t.rows}`);
          }
          // TRUNCATE leaves sequences alone and a fresh database starts them
          // at 1 — Order.orderNumber is serial, and the first checkout after a
          // restore into a new project would collide with a restored number.
          // Put every serial column's sequence just past the restored data.
          const serials = await tx.$queryRawUnsafe<{ table: string; column: string; seq: string }[]>(`
            select c.relname as "table", a.attname as "column",
                   pg_get_serial_sequence(quote_ident(n.nspname) || '.' || quote_ident(c.relname), a.attname) as seq
              from pg_attribute a
              join pg_class c on c.oid = a.attrelid
              join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
               and pg_get_serial_sequence(quote_ident(n.nspname) || '.' || quote_ident(c.relname), a.attname) is not null`);
          for (const s of serials) {
            // pg_get_serial_sequence returns a schema-qualified, already-quoted
            // name; `false` makes the next nextval() return exactly max + 1.
            await tx.$queryRawUnsafe(
              `SELECT setval('${s.seq.replace(/'/g, "''")}', coalesce((SELECT max(${q(s.column)}) FROM "public".${q(s.table)}), 0) + 1, false)`,
            );
            log(`sequence ${s.seq}: next value follows max(${s.table}.${s.column})`);
          }
        },
        { timeout: 600_000, maxWait: 10_000 },
      );
    } finally {
      for (const c of fks) {
        await db.$executeRawUnsafe(
          `ALTER TABLE "public".${q(c.table)} ALTER CONSTRAINT ${q(c.name)} NOT DEFERRABLE`,
        );
      }
    }
  }

  const bad = tables.filter((t) => t.loaded !== t.expected);
  if (bad.length) {
    throw new Error(
      `row counts differ after load: ${bad.map((b) => `${b.table} ${b.loaded}/${b.expected}`).join(", ")}`,
    );
  }
  return { id: opts.id, schema, tables, skipped, ms: Date.now() - started };
}
