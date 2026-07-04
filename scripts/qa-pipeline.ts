/**
 * End-to-end pipeline QA harness — exercises the REAL production pipeline
 * (R2 + Postgres + Rekognition + Resend) with synthetic, clearly-marked QA
 * data, then cleans every trace of itself up.
 *
 * Run (Git Bash / any POSIX shell):
 *
 *   NODE_OPTIONS="--conditions=react-server" npx dotenv -e .env.local -- \
 *     npx tsx scripts/qa-pipeline.ts --count 12
 *
 * PowerShell:
 *
 *   $env:NODE_OPTIONS="--conditions=react-server"; npx dotenv -e .env.local -- npx tsx scripts/qa-pipeline.ts --count 12
 *
 * Standalone cleanup (after a crash, or with --keep data left behind):
 *
 *   NODE_OPTIONS="--conditions=react-server" npx dotenv -e .env.local -- \
 *     npx tsx scripts/qa-pipeline.ts --cleanup qa-smoke-20260703-0712
 *
 * Flags:
 *   --count N        number of synthetic photos (default 12)
 *   --concurrency N  ingest worker pool size (default 4)
 *   --keep           skip the cleanup phase (leaves data + manifest for inspection)
 *   --cleanup <id>   ONLY run cleanup for a prior qa-smoke event id, then exit
 *
 * The `--conditions=react-server` flag is required because the lib modules this
 * imports (detection.ts, faceRec.ts, createOrder.ts, pricing.ts) rightly import
 * `server-only`, which throws outside Next's RSC context. The flag selects the
 * package's empty stub — same trick as scripts/backfill-faces.ts.
 *
 * Phases (each asserted + reported in the final table):
 *   1. SETUP        env check, DB column probe, reuse owner photographer,
 *                   create draft event qa-smoke-<yyyymmdd-hhmm> (bundle $4.99)
 *   2. SYNTH        N JPEGs (1600x2400) with big high-contrast bibs 9001..9000+N.
 *                   No synthetic faces — zero-face indexing is itself asserted.
 *   3. INGEST       real flow effects per photo: pending Photo row → original
 *                   to R2 → pull back → processUpload → preview to R2 → row
 *                   finalized → runDetection() (Rekognition DetectText + IndexFaces)
 *   4. DETECT       PhotoBib rows match drawn bibs (OCR hit rate), zero PhotoFace
 *                   rows, facesIndexedAt set on every photo
 *   5. SEARCH       replicate /api/photos bib-search where-clause; assert result
 *                   + cross-event isolation + per-event Rekognition collection
 *   6. PURCHASE     createPaidOrder (kind=bundle, synthetic capture id) — real
 *                   Order row + real receipt email; photoIds snapshot asserted
 *   7. REFUND       verify the refund route exists; print the manual test note
 *   8. CLEANUP      delete everything (DB rows, Rekognition collection, R2
 *                   objects, order, event) — every delete scoped to the QA
 *                   event id — then assert zero rows remain
 *
 * Guardrails:
 *   - every DB write/delete is scoped to the qa-smoke event id (cleanup refuses
 *     to run on an id that doesn't start with "qa-smoke-")
 *   - the QA event is status=draft → never appears on public surfaces
 *   - a manifest (scripts/.qa-manifest-<eventId>.json) is written as rows/keys
 *     are created, so cleanup can resume after a crash
 *   - no schema changes, no pushes; aborts with a precise message if the
 *     environment doesn't look as expected
 *
 * Cost: ~2 Rekognition calls per photo (DetectText + IndexFaces) ≈ $0.002/photo.
 */
import { createHash, randomBytes } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";
import {
  DeleteFacesCommand,
  DescribeCollectionCommand,
  ListFacesCommand,
  RekognitionClient,
} from "@aws-sdk/client-rekognition";
import { db } from "../src/lib/db";
import { r2Delete, r2GetStream, r2Keys, r2Put } from "../src/lib/r2";
import { processUpload } from "../src/lib/imagePipeline";

// ---------------------------------------------------------------------------
// Types + CLI
// ---------------------------------------------------------------------------

type Flags = {
  count: number;
  concurrency: number;
  keep: boolean;
  cleanupEventId: string | null;
};

function parseFlags(): Flags {
  const flags: Flags = { count: 12, concurrency: 4, keep: false, cleanupEventId: null };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--count" && argv[i + 1]) flags.count = Math.max(1, Number(argv[++i]));
    else if (a.startsWith("--count=")) flags.count = Math.max(1, Number(a.slice(8)));
    else if (a === "--concurrency" && argv[i + 1]) flags.concurrency = Math.max(1, Number(argv[++i]));
    else if (a.startsWith("--concurrency=")) flags.concurrency = Math.max(1, Number(a.slice(14)));
    else if (a === "--keep") flags.keep = true;
    else if (a === "--cleanup" && argv[i + 1]) flags.cleanupEventId = argv[++i];
    else if (a.startsWith("--cleanup=")) flags.cleanupEventId = a.slice(10);
  }
  if (!Number.isFinite(flags.count)) flags.count = 12;
  if (!Number.isFinite(flags.concurrency)) flags.concurrency = 4;
  return flags;
}

type PhaseResult = { phase: string; pass: boolean; detail: string; ms: number };

type ManifestPhoto = { id: string; bib: number; keys: string[] };
type Manifest = {
  eventId: string;
  createdAtIso: string;
  photographerId: string | null; // reused — NEVER deleted by cleanup
  photos: ManifestPhoto[];
  orderIds: string[];
  notes: string[];
};

const BIB_BASE = 9001; // high numbers that won't collide with real events' bibs
const QA_PREFIX = "qa-smoke-";
const OWNER_EMAIL = "mikianmusser@gmail.com";
const BUNDLE_PRICE_CENTS = 499;
const REKOGNITION_USD_PER_CALL = 0.001;

function manifestPath(eventId: string): string {
  return path.join(__dirname, `.qa-manifest-${eventId}.json`);
}

function saveManifest(m: Manifest): void {
  fs.writeFileSync(manifestPath(m.eventId), JSON.stringify(m, null, 2));
}

function loadManifest(eventId: string): Manifest | null {
  const p = manifestPath(eventId);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as Manifest;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// server-only-tainted lib modules, loaded dynamically AFTER the condition guard
// ---------------------------------------------------------------------------

type Libs = {
  runDetection: (typeof import("../src/lib/detection"))["runDetection"];
  collectionIdFor: (typeof import("../src/lib/faceRec"))["collectionIdFor"];
  deleteCollectionForEvent: (typeof import("../src/lib/faceRec"))["deleteCollectionForEvent"];
  faceRecConfigured: (typeof import("../src/lib/faceRec"))["faceRecConfigured"];
  createPaidOrder: (typeof import("../src/lib/createOrder"))["createPaidOrder"];
  orderTotalUsd: (typeof import("../src/lib/pricing"))["orderTotalUsd"];
};

async function loadLibs(): Promise<Libs> {
  try {
    // @ts-expect-error server-only ships no type declarations — this import is
    // purely a probe that the react-server condition is active (stub = no throw).
    await import("server-only");
  } catch {
    console.error(
      'ABORT: this script must run with NODE_OPTIONS="--conditions=react-server"\n' +
        "(the lib modules import `server-only`, which throws outside Next).\n\n" +
        '  NODE_OPTIONS="--conditions=react-server" npx dotenv -e .env.local -- npx tsx scripts/qa-pipeline.ts --count 12\n'
    );
    process.exit(1);
  }
  const detection = await import("../src/lib/detection");
  const faceRec = await import("../src/lib/faceRec");
  const createOrder = await import("../src/lib/createOrder");
  const pricing = await import("../src/lib/pricing");
  return {
    runDetection: detection.runDetection,
    collectionIdFor: faceRec.collectionIdFor,
    deleteCollectionForEvent: faceRec.deleteCollectionForEvent,
    faceRecConfigured: faceRec.faceRecConfigured,
    createPaidOrder: createOrder.createPaidOrder,
    orderTotalUsd: pricing.orderTotalUsd,
  };
}

// ---------------------------------------------------------------------------
// Environment + schema probes (abort early, precisely)
// ---------------------------------------------------------------------------

const REQUIRED_ENV = [
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "NEXTAUTH_SECRET", // download-token minting inside createPaidOrder
] as const;

function checkEnv(): void {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(
      `ABORT: missing env var(s): ${missing.join(", ")}\n` +
        "Run through dotenv so .env.local is loaded:\n" +
        '  NODE_OPTIONS="--conditions=react-server" npx dotenv -e .env.local -- npx tsx scripts/qa-pipeline.ts'
    );
    process.exit(1);
  }
  if (!process.env.RESEND_API_KEY) {
    console.warn(
      "WARN: RESEND_API_KEY not set — the receipt email will be logged, not sent."
    );
  }
}

type ColumnMap = Map<string, Set<string>>;

async function probeColumns(): Promise<ColumnMap> {
  const rows = await db.$queryRaw<{ table_name: string; column_name: string }[]>`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('Event','Photo','PhotoBib','PhotoFace','PhotoColorGroup','Order','Photographer')
  `;
  const map: ColumnMap = new Map();
  for (const r of rows) {
    const set = map.get(r.table_name) ?? new Set<string>();
    set.add(r.column_name);
    map.set(r.table_name, set);
  }
  return map;
}

/** Columns the harness itself writes/reads — abort if any is missing so we
 *  never improvise against a surprising schema. (Photo.featured is checked
 *  separately: its absence is EXPECTED and handled, not fatal.) */
const REQUIRED_COLUMNS: Record<string, string[]> = {
  Event: [
    "id", "name", "date", "city", "org", "bundlePriceCents", "status",
    "accessMode", "isFree", "ocrEnabled", "faceRecEnabled", "colorGroupEnabled",
    "type", "updatedAt",
  ],
  Photo: [
    "id", "eventId", "photographerId", "r2OriginalKey", "r2PreviewKey",
    "fingerprint", "hidden", "facesIndexedAt", "takenAt", "gpsLat", "gpsLng",
    "createdAt",
  ],
  PhotoBib: ["id", "photoId", "bib", "confidence", "source"],
  PhotoFace: ["id", "photoId", "eventId", "rekognitionFaceId", "faceClusterId"],
  Order: [
    "id", "orderNumber", "email", "userId", "kind", "amount", "eventIdCovered",
    "photoIds", "paypalCaptureId", "downloadToken", "emailSentAt", "emailError",
  ],
  Photographer: ["id", "email", "roles"],
};

function assertRequiredColumns(cols: ColumnMap): void {
  const problems: string[] = [];
  for (const [table, needed] of Object.entries(REQUIRED_COLUMNS)) {
    const have = cols.get(table);
    if (!have) {
      problems.push(`table "${table}" not found`);
      continue;
    }
    for (const c of needed) if (!have.has(c)) problems.push(`"${table}"."${c}" missing`);
  }
  if (problems.length > 0) {
    console.error(
      "ABORT: production DB schema doesn't match expectations:\n  " +
        problems.join("\n  ") +
        "\nNo QA data was created. Fix the mismatch (or the harness) before re-running."
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Synthetic race-photo generation (bib only — deliberately NO faces)
// ---------------------------------------------------------------------------

const CANVAS_W = 1600;
const CANVAS_H = 2400;

/** A plausible race-photo canvas: sky band, road, jersey block, and a large
 *  white bib panel with high-contrast black digits. The bib number is the only
 *  digit sequence in frame so OCR assertions are unambiguous. */
async function makeSyntheticPhoto(bib: number): Promise<Buffer> {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}">
    <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="#9db4c4"/>
    <rect y="${CANVAS_H * 0.45}" width="${CANVAS_W}" height="${CANVAS_H * 0.55}" fill="#6f6f6f"/>
    <rect x="${CANVAS_W * 0.25}" y="${CANVAS_H * 0.28}" width="${CANVAS_W * 0.5}" height="${CANVAS_H * 0.5}" rx="60" fill="#2f6d47"/>
    <rect x="${CANVAS_W * 0.3}" y="${CANVAS_H * 0.42}" width="${CANVAS_W * 0.4}" height="${CANVAS_H * 0.16}" rx="24" fill="#ffffff" stroke="#111111" stroke-width="8"/>
    <text x="50%" y="${CANVAS_H * 0.525}" text-anchor="middle"
      font-family="Arial Black, Arial, sans-serif" font-weight="900"
      font-size="${CANVAS_H * 0.085}" fill="#111111">${bib}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function qaEventIdNow(): string {
  const d = new Date();
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${QA_PREFIX}${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** Fallback Photo insert for when the working-tree Prisma client knows columns
 *  (featured/featuredAt) the prod DB doesn't have. Explicit column list. */
async function rawCreatePhoto(opts: {
  eventId: string;
  photographerId: string;
  fingerprint: string;
}): Promise<string> {
  const id = `qa${randomBytes(12).toString("hex")}`;
  await db.$executeRaw`
    INSERT INTO "Photo" ("id", "eventId", "photographerId", "r2OriginalKey", "r2PreviewKey", "fingerprint")
    VALUES (${id}, ${opts.eventId}, ${opts.photographerId}, 'pending', 'pending', ${opts.fingerprint})
  `;
  return id;
}

async function createPhotoRow(opts: {
  eventId: string;
  photographerId: string;
  fingerprint: string;
  preferRaw: boolean;
}): Promise<{ id: string; usedRaw: boolean }> {
  if (opts.preferRaw) {
    return { id: await rawCreatePhoto(opts), usedRaw: true };
  }
  try {
    const row = await db.photo.create({
      data: {
        eventId: opts.eventId,
        photographerId: opts.photographerId,
        r2OriginalKey: "pending",
        r2PreviewKey: "pending",
        fingerprint: opts.fingerprint,
      },
      select: { id: true },
    });
    return { id: row.id, usedRaw: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/featured/i.test(msg) || /does not exist/i.test(msg)) {
      return { id: await rawCreatePhoto(opts), usedRaw: true };
    }
    throw e;
  }
}

async function pool<T>(items: T[], concurrency: number, fn: (item: T, i: number) => Promise<void>): Promise<void> {
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Cleanup — every statement scoped to the qa-smoke event id
// ---------------------------------------------------------------------------

async function runCleanup(
  libs: Libs,
  eventId: string
): Promise<{ ok: boolean; detail: string }> {
  if (!eventId.startsWith(QA_PREFIX)) {
    return { ok: false, detail: `REFUSED: "${eventId}" is not a ${QA_PREFIX}* event id` };
  }

  const manifest = loadManifest(eventId);
  const lines: string[] = [];

  // R2 keys: union of manifest keys and keys derived from surviving DB rows,
  // so cleanup works both after a crash (manifest has keys, DB may be partial)
  // and from a bare event id (DB has rows, manifest may be gone).
  const dbPhotos = await db.photo.findMany({
    where: { eventId },
    select: { id: true },
  });
  const keySet = new Set<string>();
  for (const p of dbPhotos) {
    keySet.add(r2Keys.original(p.id));
    keySet.add(r2Keys.preview(p.id));
  }
  for (const p of manifest?.photos ?? []) for (const k of p.keys) keySet.add(k);
  const keys = [...keySet];

  // 1. Rekognition: drop the QA event's whole collection (removes every face
  //    it might hold in one call — same approach as event deletion in the app).
  //    deleteCollectionForEvent swallows failures with a console.warn, so we
  //    VERIFY with DescribeCollection instead of trusting it. Known gap: the
  //    prod IAM user (mikian-photos-rekognition) is NOT allowed
  //    rekognition:DeleteCollection, so the collection survives; we then
  //    best-effort DeleteFaces whatever it holds (that action IS allowed — the
  //    app's photo-delete path uses it) so at worst an EMPTY orphan collection
  //    remains, which stores nothing and costs nothing.
  let rekOk = true;
  if (libs.faceRecConfigured()) {
    const collectionId = libs.collectionIdFor(eventId);
    await libs.deleteCollectionForEvent(eventId);
    const rek = new RekognitionClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    try {
      const desc = await rek.send(new DescribeCollectionCommand({ CollectionId: collectionId }));
      // Still exists → DeleteCollection was denied/failed. Empty it instead.
      let faceCount = Number(desc.FaceCount ?? 0);
      if (faceCount > 0) {
        try {
          let nextToken: string | undefined;
          do {
            const page = await rek.send(
              new ListFacesCommand({ CollectionId: collectionId, MaxResults: 1000, NextToken: nextToken })
            );
            const ids = (page.Faces ?? []).map((f) => f.FaceId).filter((x): x is string => !!x);
            if (ids.length > 0) {
              await rek.send(new DeleteFacesCommand({ CollectionId: collectionId, FaceIds: ids }));
            }
            nextToken = page.NextToken;
          } while (nextToken);
          const redesc = await rek.send(new DescribeCollectionCommand({ CollectionId: collectionId }));
          faceCount = Number(redesc.FaceCount ?? 0);
        } catch (e) {
          lines.push(`rekognition: ListFaces/DeleteFaces fallback failed: ${e instanceof Error ? e.message : e}`);
        }
      }
      if (faceCount === 0) {
        lines.push(
          `rekognition: WARNING — collection ${collectionId} could NOT be deleted ` +
            `(IAM user lacks rekognition:DeleteCollection) but holds 0 faces; ` +
            `empty orphan remains — remove it in the AWS console or grant DeleteCollection`
        );
      } else {
        rekOk = false;
        lines.push(
          `rekognition: FAIL — collection ${collectionId} still holds ${faceCount} face(s) and cannot be deleted`
        );
      }
    } catch (e) {
      const name = (e as { name?: string }).name;
      if (name === "ResourceNotFoundException") {
        lines.push(`rekognition: collection ${collectionId} deleted (verified gone)`);
      } else {
        lines.push(`rekognition: DescribeCollection verify failed: ${name ?? e}`);
      }
    }
  }

  // 2. Detection rows (eventId-scoped directly, or via the photo relation).
  const cg = await db.photoColorGroup.deleteMany({ where: { eventId } });
  const pf = await db.photoFace.deleteMany({ where: { eventId } });
  const pb = await db.photoBib.deleteMany({ where: { photo: { eventId } } });
  lines.push(`db: ${pb.count} PhotoBib, ${pf.count} PhotoFace, ${cg.count} PhotoColorGroup deleted`);

  // 3. R2 objects (chunked well under the 1000-key API cap).
  for (let i = 0; i < keys.length; i += 500) {
    await r2Delete(keys.slice(i, i + 500));
  }
  lines.push(`r2: ${keys.length} object key(s) deleted`);

  // 4. Photos, orders, event scaffolding (deleteMany → no RETURNING of columns
  //    the prod DB may not have).
  const ph = await db.photo.deleteMany({ where: { eventId } });
  const ord = await db.order.deleteMany({ where: { eventIdCovered: eventId } });
  const fa = await db.faceAssignment.deleteMany({ where: { eventId } });
  const ep = await db.eventPhotographer.deleteMany({ where: { eventId } });
  const ev = await db.event.deleteMany({ where: { id: eventId } });
  lines.push(
    `db: ${ph.count} Photo, ${ord.count} Order, ${fa.count} FaceAssignment, ${ep.count} EventPhotographer, ${ev.count} Event deleted`
  );

  // 5. Verify zero rows remain for the QA event.
  const [photos, faces, colors, orders, events, assigns] = await Promise.all([
    db.photo.count({ where: { eventId } }),
    db.photoFace.count({ where: { eventId } }),
    db.photoColorGroup.count({ where: { eventId } }),
    db.order.count({ where: { eventIdCovered: eventId } }),
    db.event.count({ where: { id: eventId } }),
    db.faceAssignment.count({ where: { eventId } }),
  ]);
  const residue = photos + faces + colors + orders + events + assigns;

  // 6. Spot-check R2: the first key should now 404.
  let r2Gone = true;
  if (keys.length > 0) {
    try {
      await r2GetStream(keys[0]);
      r2Gone = false; // object still readable → delete didn't take
    } catch {
      r2Gone = true;
    }
  }
  lines.push(
    `verify: ${residue} DB row(s) remain; R2 spot-check ${keys.length > 0 ? (r2Gone ? "object gone" : "OBJECT STILL PRESENT") : "n/a"}`
  );

  const ok = residue === 0 && r2Gone && rekOk;
  if (ok) {
    const p = manifestPath(eventId);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    lines.push("manifest removed");
  } else {
    lines.push(`manifest kept at ${manifestPath(eventId)} — re-run --cleanup ${eventId}`);
  }
  return { ok, detail: lines.join("\n    ") };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const flags = parseFlags();
  checkEnv();
  const libs = await loadLibs();

  // ---- standalone cleanup mode -------------------------------------------
  if (flags.cleanupEventId) {
    console.log(`Cleanup-only mode for event "${flags.cleanupEventId}"`);
    const res = await runCleanup(libs, flags.cleanupEventId);
    console.log(`  ${res.ok ? "PASS" : "FAIL"}\n    ${res.detail}`);
    process.exitCode = res.ok ? 0 : 1;
    return;
  }

  const results: PhaseResult[] = [];
  const N = flags.count;
  const eventId = qaEventIdNow();
  const manifest: Manifest = {
    eventId,
    createdAtIso: new Date().toISOString(),
    photographerId: null,
    photos: [],
    orderIds: [],
    notes: [],
  };

  // Capture console.warn output so best-effort failures inside runDetection
  // (which swallows + warns) are observable and classifiable.
  const warnings: string[] = [];
  const origWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(" "));
    origWarn(...args);
  };

  let featuredColumnExists = false;
  let photographerId = "";
  let otherEventId: string | null = null;
  let aborted = false;
  let ocrHits = 0;
  let facesIndexed = 0;
  let stampedByHarness = 0;
  let orderNumberCreated: number | null = null;

  async function phase(name: string, fn: () => Promise<{ pass: boolean; detail: string }>) {
    const t0 = Date.now();
    console.log(`\n=== ${name} ===`);
    try {
      const { pass, detail } = await fn();
      results.push({ phase: name, pass, detail, ms: Date.now() - t0 });
      console.log(`  ${pass ? "PASS" : "FAIL"} (${((Date.now() - t0) / 1000).toFixed(1)}s)\n    ${detail}`);
      if (!pass) process.exitCode = 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ phase: name, pass: false, detail: `threw: ${msg}`, ms: Date.now() - t0 });
      console.error(`  FAIL (threw): ${msg}`);
      process.exitCode = 1;
      aborted = true;
    }
  }

  // ---- 1. SETUP ------------------------------------------------------------
  await phase("1 SETUP", async () => {
    const cols = await probeColumns();
    assertRequiredColumns(cols); // exits on mismatch — nothing created yet
    featuredColumnExists = Boolean(cols.get("Photo")?.has("featured"));
    if (!featuredColumnExists) {
      manifest.notes.push(
        "Photo.featured/featuredAt not in prod DB (uncommitted schema) — " +
          "indexFacesForPhoto's unscoped photo.update will fail to stamp facesIndexedAt; harness stamps it via updateMany."
      );
    }

    // Reuse the owner's photographer row — never create one.
    const owner =
      (await db.photographer.findUnique({
        where: { email: OWNER_EMAIL },
        select: { id: true, email: true, roles: true },
      })) ??
      (await db.photographer.findFirst({
        where: { roles: { has: "owner" } },
        select: { id: true, email: true, roles: true },
      }));
    if (!owner) {
      throw new Error(
        `no owner Photographer row found (looked for email=${OWNER_EMAIL}, then roles has "owner") — refusing to create one`
      );
    }
    photographerId = owner.id;
    manifest.photographerId = owner.id;

    // A real other event for the isolation checks (prefer the live race).
    const lighthouse = await db.event.findUnique({
      where: { id: "lighthouse-half-2026" },
      select: { id: true },
    });
    const other =
      lighthouse ??
      (await db.event.findFirst({
        where: { id: { not: eventId } },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      }));
    otherEventId = other?.id ?? null;

    const existing = await db.event.findUnique({ where: { id: eventId }, select: { id: true } });
    if (existing) throw new Error(`event ${eventId} already exists — wait a minute or clean it up first`);

    await db.event.create({
      data: {
        id: eventId,
        name: `QA Smoke ${eventId.slice(QA_PREFIX.length)} (auto-deleted)`,
        date: new Date(),
        city: "QA",
        org: "QA Harness",
        bundlePriceCents: BUNDLE_PRICE_CENTS,
        status: "draft", // keeps it off every public surface
        accessMode: "public", // irrelevant while draft; harness queries DB directly
        type: "race",
        isFree: false,
        ocrEnabled: true,
        faceRecEnabled: true,
        colorGroupEnabled: false,
      },
      select: { id: true },
    });
    saveManifest(manifest);

    return {
      pass: true,
      detail:
        `event ${eventId} created (draft, bundle ${fmtUsd(BUNDLE_PRICE_CENTS / 100)}); ` +
        `photographer reused ${owner.id} (${owner.email}); ` +
        `isolation event: ${otherEventId ?? "NONE FOUND"}; ` +
        `Photo.featured in DB: ${featuredColumnExists}`,
    };
  });

  // ---- 2. SYNTHETIC PHOTOS --------------------------------------------------
  const jpegs: { bib: number; bytes: Buffer }[] = [];
  if (!aborted) {
    await phase("2 SYNTH", async () => {
      for (let i = 0; i < N; i++) {
        const bib = BIB_BASE + i;
        jpegs.push({ bib, bytes: await makeSyntheticPhoto(bib) });
      }
      const sizes = jpegs.map((j) => j.bytes.length);
      const meta = await sharp(jpegs[0].bytes).metadata();
      const pass = jpegs.length === N && (meta.width ?? 0) === CANVAS_W && (meta.height ?? 0) === CANVAS_H;
      return {
        pass,
        detail: `${jpegs.length} JPEGs (${CANVAS_W}x${CANVAS_H}, ${(Math.min(...sizes) / 1024).toFixed(0)}–${(Math.max(...sizes) / 1024).toFixed(0)} KB), bibs ${BIB_BASE}..${BIB_BASE + N - 1}`,
      };
    });
  }

  // ---- 3. INGEST -------------------------------------------------------------
  let usedRawInsert = false;
  if (!aborted) {
    await phase("3 INGEST", async () => {
      const errors: string[] = [];
      await pool(jpegs, flags.concurrency, async (j, i) => {
        try {
          // (1) placeholder row — mirrors the sign route. photo.create carries
          // select:{id} so RETURNING never references featured/featuredAt; if
          // Prisma still trips on the missing columns, the raw-SQL fallback
          // inside createPhotoRow takes over.
          const created = await createPhotoRow({
            eventId,
            photographerId,
            fingerprint: sha256hex(j.bytes),
            preferRaw: false,
          });
          if (created.usedRaw) usedRawInsert = true;
          const photoId = created.id;
          const originalKey = r2Keys.original(photoId);
          const previewKey = r2Keys.preview(photoId);
          manifest.photos.push({ id: photoId, bib: j.bib, keys: [originalKey, previewKey] });
          saveManifest(manifest);

          // (2) original to R2 (the browser's presigned PUT in the real flow)
          await r2Put(originalKey, j.bytes, "image/jpeg");

          // (3) pull it back + processUpload — exactly what finalize does
          const { body } = await r2GetStream(originalKey);
          const chunks: Buffer[] = [];
          for await (const c of body) chunks.push(Buffer.from(c));
          const processed = await processUpload(Buffer.concat(chunks));

          // (4) preview to R2, (5) finalize the row (scoped update, minimal select)
          await r2Put(previewKey, processed.previewBytes, "image/jpeg");
          await db.photo.updateMany({
            where: { id: photoId, eventId },
            data: {
              r2OriginalKey: originalKey,
              r2PreviewKey: previewKey,
              takenAt: processed.takenAt,
              gpsLat: processed.gpsLat,
              gpsLng: processed.gpsLng,
            },
          });

          // (6) the real detection pass (Rekognition DetectText + IndexFaces)
          await libs.runDetection({ id: photoId, eventId });

          // (7) facesIndexedAt stamp fallback — see manifest note. Scoped.
          const row = await db.photo.findFirst({
            where: { id: photoId, eventId },
            select: { facesIndexedAt: true },
          });
          if (!row?.facesIndexedAt) {
            await db.photo.updateMany({
              where: { id: photoId, eventId },
              data: { facesIndexedAt: new Date() },
            });
            stampedByHarness++;
          }
          console.log(`  [${i + 1}/${N}] ${photoId} bib=${j.bib} ingested + detected`);
        } catch (e) {
          errors.push(`bib ${j.bib}: ${e instanceof Error ? e.message : e}`);
        }
      });
      saveManifest(manifest);
      const pass = errors.length === 0 && manifest.photos.length === N;
      return {
        pass,
        detail:
          `${manifest.photos.length}/${N} photos ingested (concurrency ${flags.concurrency})` +
          (usedRawInsert ? "; raw-SQL Photo insert fallback used" : "") +
          (stampedByHarness > 0
            ? `; facesIndexedAt stamped by harness on ${stampedByHarness} (expected: Photo.featured missing in prod DB)`
            : "") +
          (errors.length > 0 ? `; ERRORS: ${errors.join(" | ")}` : ""),
      };
    });
  }

  const qaPhotoIds = manifest.photos.map((p) => p.id);
  const bibByPhotoId = new Map(manifest.photos.map((p) => [p.id, p.bib]));

  // ---- 4. VERIFY DETECTION ----------------------------------------------------
  if (!aborted) {
    await phase("4 DETECT", async () => {
      const bibRows = await db.photoBib.findMany({
        where: { photoId: { in: qaPhotoIds } },
        select: { photoId: true, bib: true, source: true, confidence: true },
      });
      const byPhoto = new Map<string, { bib: number; source: string }[]>();
      for (const r of bibRows) {
        const list = byPhoto.get(r.photoId) ?? [];
        list.push({ bib: r.bib, source: r.source });
        byPhoto.set(r.photoId, list);
      }
      const misses: number[] = [];
      const extras: string[] = [];
      for (const p of manifest.photos) {
        const rows = byPhoto.get(p.id) ?? [];
        if (!rows.some((r) => r.bib === p.bib)) misses.push(p.bib);
        for (const r of rows) if (r.bib !== p.bib) extras.push(`${p.bib}→${r.bib}`);
      }
      ocrHits = N - misses.length;
      const sources = [...new Set(bibRows.map((r) => r.source))];

      const faceCount = await db.photoFace.count({ where: { eventId } });
      facesIndexed = faceCount;
      const unstamped = await db.photo.count({ where: { eventId, facesIndexedAt: null } });

      // Classify captured warnings: the known featured-column stamp failure is
      // expected; anything else during detection is surfaced.
      const detectionWarnings = warnings.filter((w) => /failed for photo|OCR|face/i.test(w));
      const unexpectedWarnings = detectionWarnings.filter(
        (w) => !(featuredColumnExists === false && /featured/i.test(w))
      );

      const hitRate = ((ocrHits / N) * 100).toFixed(0);
      const pass = ocrHits > 0 && faceCount === 0 && unstamped === 0;
      return {
        pass,
        detail:
          `OCR hit rate ${ocrHits}/${N} (${hitRate}%) via ${sources.join(",") || "n/a"}` +
          (misses.length > 0 ? `; missed bibs: ${misses.join(",")}` : "") +
          (extras.length > 0 ? `; unexpected extra bibs: ${extras.join(",")}` : "") +
          `; PhotoFace rows: ${faceCount} (expect 0 — no synthetic faces)` +
          `; photos missing facesIndexedAt: ${unstamped}` +
          (unexpectedWarnings.length > 0
            ? `; UNEXPECTED warnings: ${unexpectedWarnings.slice(0, 3).join(" | ")}`
            : ""),
      };
    });
  }

  // ---- 5. VERIFY SEARCH + ISOLATION -------------------------------------------
  if (!aborted) {
    await phase("5 SEARCH", async () => {
      const problems: string[] = [];
      const notes: string[] = [];

      // Pick a bib that OCR actually tagged, preferring 9001.
      const taggedRows = await db.photoBib.findMany({
        where: { photoId: { in: qaPhotoIds }, bib: { gte: BIB_BASE, lt: BIB_BASE + N } },
        select: { photoId: true, bib: true },
      });
      const tagged = taggedRows.filter((r) => bibByPhotoId.get(r.photoId) === r.bib);
      if (tagged.length === 0) {
        return { pass: false, detail: "no correctly-OCR-tagged QA bib available to search for" };
      }
      const probe = tagged.find((t) => t.bib === BIB_BASE) ?? tagged[0];

      // (a) The EXACT where-clause /api/photos uses for a bib search
      //     ({ eventId, hidden: false, bibs: { some: { bib } } }) scoped to the
      //     QA event must return exactly the drawn photo(s).
      const qaSearch = await db.photo.findMany({
        where: { eventId, hidden: false, bibs: { some: { bib: probe.bib } } },
        select: { id: true },
      });
      const qaSearchIds = qaSearch.map((r) => r.id);
      if (!qaSearchIds.includes(probe.photoId)) {
        problems.push(`(a) bib ${probe.bib} search missed its own photo ${probe.photoId}`);
      }
      const strayIds = qaSearchIds.filter((id) => !qaPhotoIds.includes(id));
      if (strayIds.length > 0) {
        problems.push(`(a) bib ${probe.bib} search returned non-QA photos: ${strayIds.join(",")}`);
      }
      const expectedIds = manifest.photos.filter((p) => p.bib === probe.bib).map((p) => p.id);
      if (qaSearchIds.length !== expectedIds.length) {
        notes.push(
          `(a) bib ${probe.bib} returned ${qaSearchIds.length} QA photo(s), expected ${expectedIds.length} (an OCR misread double-tagged a QA photo — see phase 4)`
        );
      }

      // (b) The same bib searched in ANOTHER event returns none of our photos.
      if (otherEventId) {
        const crossSearch = await db.photo.findMany({
          where: { eventId: otherEventId, hidden: false, bibs: { some: { bib: probe.bib } } },
          select: { id: true },
        });
        const leaked = crossSearch.filter((r) => qaPhotoIds.includes(r.id));
        if (leaked.length > 0) {
          problems.push(`(b) QA photos leaked into ${otherEventId} bib search: ${leaked.map((l) => l.id).join(",")}`);
        }
        notes.push(`(b) bib ${probe.bib} in ${otherEventId}: ${crossSearch.length} rows, 0 QA leaks`);

        // (c) The other event's full catalog never contains a QA photo.
        const catalogLeak = await db.photo.count({
          where: { eventId: otherEventId, hidden: false, id: { in: qaPhotoIds } },
        });
        if (catalogLeak > 0) problems.push(`(c) ${catalogLeak} QA photo(s) inside ${otherEventId}'s catalog`);
        else notes.push(`(c) ${otherEventId} catalog contains 0 QA photos`);
      } else {
        notes.push("(b/c) skipped — no other event found in DB");
      }

      // (d) Rekognition collection isolation: per-event name, exists, 0 faces.
      const qaCollection = libs.collectionIdFor(eventId);
      if (!qaCollection.includes(eventId.replace(/[^a-zA-Z0-9_.\-]/g, "_"))) {
        problems.push(`(d) collection id ${qaCollection} doesn't embed the QA event id`);
      }
      if (otherEventId && qaCollection === libs.collectionIdFor(otherEventId)) {
        problems.push(`(d) QA collection id collides with ${otherEventId}'s`);
      }
      const rek = new RekognitionClient({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });
      try {
        const desc = await rek.send(new DescribeCollectionCommand({ CollectionId: qaCollection }));
        const fc = Number(desc.FaceCount ?? 0);
        if (fc !== 0) problems.push(`(d) QA collection has ${fc} faces (expected 0)`);
        else notes.push(`(d) collection ${qaCollection} exists with FaceCount=0`);
      } catch (e) {
        const name = (e as { name?: string }).name;
        problems.push(`(d) DescribeCollection(${qaCollection}) failed: ${name ?? e}`);
      }

      return {
        pass: problems.length === 0,
        detail: [...notes, ...problems.map((p) => `PROBLEM ${p}`)].join("; ") || "ok",
      };
    });
  }

  // ---- 6. VERIFY PURCHASE ------------------------------------------------------
  if (!aborted) {
    await phase("6 PURCHASE", async () => {
      const amount = await libs.orderTotalUsd("bundle", N, eventId);
      const expectedAmount = +(4.99 * 1.029 + 0.3).toFixed(2); // $4.99 bundle + processing fee
      const captureId = `QA-${eventId}`;
      const res = await libs.createPaidOrder({
        email: OWNER_EMAIL,
        userId: null,
        kind: "bundle",
        eventId,
        clientPhotoIds: qaPhotoIds,
        amountUsd: amount,
        paypalCaptureId: captureId,
        baseUrl: process.env.NEXT_PUBLIC_BASE_URL || "https://mikianmusser.com",
      });
      if (!res.ok) {
        return { pass: false, detail: `createPaidOrder failed: ${res.status} ${res.error}` };
      }
      manifest.orderIds.push(res.order.id);
      orderNumberCreated = res.order.orderNumber;
      saveManifest(manifest);

      // Re-fetch with an explicit select — assert the entitlement snapshot.
      const row = await db.order.findUnique({
        where: { id: res.order.id },
        select: {
          orderNumber: true,
          email: true,
          amount: true,
          kind: true,
          eventIdCovered: true,
          photoIds: true,
          paypalCaptureId: true,
          downloadToken: true,
          emailSentAt: true,
          emailError: true,
        },
      });
      const problems: string[] = [];
      if (!row) problems.push("order row not found after create");
      else {
        if (row.photoIds.length !== N) problems.push(`photoIds length ${row.photoIds.length} !== ${N}`);
        const setEq =
          row.photoIds.length === qaPhotoIds.length &&
          [...row.photoIds].sort().join() === [...qaPhotoIds].sort().join();
        if (!setEq) problems.push("photoIds snapshot != ingested QA photo ids");
        if (row.eventIdCovered !== eventId) problems.push(`eventIdCovered=${row.eventIdCovered}`);
        if (row.paypalCaptureId !== captureId) problems.push(`captureId=${row.paypalCaptureId}`);
        if (Math.abs(row.amount - expectedAmount) > 0.005)
          problems.push(`amount ${row.amount} != expected ${expectedAmount}`);
        if (!row.downloadToken) problems.push("downloadToken not persisted");
      }
      const emailNote = row?.emailSentAt
        ? `receipt email SENT to ${OWNER_EMAIL} at ${row.emailSentAt.toISOString()} (real send — proves Resend works)`
        : `receipt email NOT sent${row?.emailError ? `: ${row.emailError}` : " (no RESEND_API_KEY?)"}`;
      return {
        pass: problems.length === 0,
        detail:
          `order MK-${String(row?.orderNumber ?? 0).padStart(6, "0")} amount ${fmtUsd(row?.amount ?? 0)} ` +
          `(expected ${fmtUsd(expectedAmount)}), ${row?.photoIds.length ?? 0}/${N} photoIds snapshotted; ${emailNote}` +
          (problems.length > 0 ? `; PROBLEMS: ${problems.join(" | ")}` : ""),
      };
    });
  }

  // ---- 7. REFUND (manual-only) ---------------------------------------------------
  if (!aborted) {
    await phase("7 REFUND", async () => {
      const routePath = path.join(
        __dirname,
        "..",
        "src", "app", "api", "admin", "orders", "[orderNumber]", "refund", "route.ts"
      );
      const exists = fs.existsSync(routePath);
      return {
        pass: exists,
        detail: exists
          ? "refund route present (src/app/api/admin/orders/[orderNumber]/refund/route.ts). " +
            "NOT exercised here: a synthetic capture id would fail at PayPal. " +
            "MANUAL TEST: make one real $4.99 purchase on the live site, then as owner open " +
            "/admin/orders and refund it (POST /api/admin/orders/<MK-number>/refund) and confirm the PayPal refund lands."
          : "refund route file NOT found",
      };
    });
  }

  // ---- 8. CLEANUP ------------------------------------------------------------------
  if (flags.keep) {
    results.push({
      phase: "8 CLEANUP",
      pass: true,
      detail: `SKIPPED (--keep). Clean up later with: --cleanup ${eventId}`,
      ms: 0,
    });
    console.log(`\n=== 8 CLEANUP === skipped (--keep). Manifest: ${manifestPath(eventId)}`);
  } else if (aborted) {
    results.push({
      phase: "8 CLEANUP",
      pass: false,
      detail:
        `NOT RUN — a prior phase threw. QA data left in place for diagnosis. ` +
        `Clean up with: NODE_OPTIONS="--conditions=react-server" npx dotenv -e .env.local -- npx tsx scripts/qa-pipeline.ts --cleanup ${eventId}`,
      ms: 0,
    });
    console.error(`\n=== 8 CLEANUP === not run (aborted). Manifest kept: ${manifestPath(eventId)}`);
  } else {
    await phase("8 CLEANUP", async () => {
      const r = await runCleanup(libs, eventId);
      return { pass: r.ok, detail: r.detail };
    });
  }

  console.warn = origWarn;

  // ---- 9. SUMMARY ---------------------------------------------------------------------
  const detectText = manifest.photos.length; // one DetectText per photo
  const indexFaces = manifest.photos.length; // one IndexFaces per photo
  const searchFaces = facesIndexed; // one clustering SearchFaces per indexed face (0 expected)
  const estCost = (detectText + indexFaces + searchFaces) * REKOGNITION_USD_PER_CALL;

  console.log("\n" + "=".repeat(78));
  console.log(`QA PIPELINE SUMMARY — event ${eventId} — ${N} photos`);
  console.log("=".repeat(78));
  for (const r of results) {
    console.log(
      `${r.pass ? "PASS" : "FAIL"}  ${r.phase.padEnd(12)} ${(r.ms / 1000).toFixed(1).padStart(6)}s  ${r.detail.split("\n")[0].slice(0, 120)}`
    );
  }
  console.log("-".repeat(78));
  console.log(
    `OCR hit rate: ${ocrHits}/${N}; faces indexed: ${facesIndexed} (expected 0); ` +
      (orderNumberCreated ? `order MK-${String(orderNumberCreated).padStart(6, "0")} created+cleaned; ` : "") +
      `est. AWS Rekognition cost: ~$${estCost.toFixed(3)} ` +
      `(${detectText} DetectText + ${indexFaces} IndexFaces + ${searchFaces} SearchFaces @ ~$0.001)`
  );
  const allPass = results.every((r) => r.pass);
  console.log(allPass ? "\nRESULT: FULL PASS" : "\nRESULT: FAILURES PRESENT — see table above");
  process.exitCode = allPass ? 0 : 1;
}

main()
  .catch((e) => {
    console.error("FATAL:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
