# QA pipeline harness (`scripts/qa-pipeline.ts`)

End-to-end smoke test of the REAL production pipeline — R2 upload + preview,
Postgres rows, Rekognition bib OCR + face indexing, bib search isolation,
`createPaidOrder` (real Order row + real receipt email) — using synthetic
photos in a throwaway `qa-smoke-<yyyymmdd-hhmm>` event, followed by full
cleanup and a zero-residue assertion.

It imports the exact lib functions the API routes use (`processUpload`,
`runDetection`, `createPaidOrder`, `orderTotalUsd`, `collectionIdFor`), so a
PASS means the production code path works, not a lookalike.

**It runs against the live services in `.env.local`.** That is the point —
but read the guardrails below before a big run.

## Commands

All commands run from the repo root. `NODE_OPTIONS="--conditions=react-server"`
is required (the libs import `server-only`; the flag selects its empty stub —
same convention as `scripts/backfill-faces.ts`).

Git Bash / macOS / Linux:

```bash
# Smoke (12 photos, ~15s, ~$0.02 Rekognition) — run before every event weekend
NODE_OPTIONS="--conditions=react-server" npx dotenv -e .env.local -- \
  npx tsx scripts/qa-pipeline.ts --count 12

# Medium run (500 photos, ~5 min, ~$1)
NODE_OPTIONS="--conditions=react-server" npx dotenv -e .env.local -- \
  npx tsx scripts/qa-pipeline.ts --count 500

# Full pre-event drill (10,000 photos)
NODE_OPTIONS="--conditions=react-server" npx dotenv -e .env.local -- \
  npx tsx scripts/qa-pipeline.ts --count 10000 --concurrency 4
```

PowerShell:

```powershell
$env:NODE_OPTIONS="--conditions=react-server"; npx dotenv -e .env.local -- npx tsx scripts/qa-pipeline.ts --count 12
```

Flags:

| flag | default | meaning |
|---|---|---|
| `--count N` | 12 | number of synthetic photos (bibs 9001..9000+N) |
| `--concurrency N` | 4 | ingest worker pool (matches the app's detection concurrency) |
| `--keep` | off | skip cleanup — leaves the QA event + manifest for inspection |
| `--cleanup <eventId>` | — | cleanup-only mode for a prior `qa-smoke-*` event, then exit |

## The 10k pre-event drill

- **Duration:** measured ingest+detect throughput is ~2.3s/photo of work on 4
  workers ≈ **~1.6 h** for 10k. Kick it off in the background and check the
  final summary table.
- **Cost:** 2 Rekognition calls per photo (DetectText + IndexFaces) at
  ~$0.001 each ≈ **~$20** for 10k faceless synthetics. Real photos with faces
  would add ~$0.001 per detected face for clustering (the harness's images
  deliberately contain no faces), so budget **$20–30**.
- **DB note:** 10k Photo/PhotoBib rows live in the production DB for the
  duration of the run, in a `status="draft"` event that no public surface
  lists or searches. Prefer running it on a quiet day, not during an event.
- The run ends with cleanup + a zero-residue assertion automatically. If the
  process dies mid-run, the manifest survives — see below.

## Crash recovery / standalone cleanup

Every created row id and R2 key is journaled to
`scripts/.qa-manifest-<eventId>.json` as it is created. If a run crashes or
you used `--keep`:

```bash
NODE_OPTIONS="--conditions=react-server" npx dotenv -e .env.local -- \
  npx tsx scripts/qa-pipeline.ts --cleanup qa-smoke-20260703-0724
```

Cleanup deletes, in dependency order: PhotoBib/PhotoFace/PhotoColorGroup →
Rekognition faces/collection → R2 originals+previews → Photo rows → Order
rows → the Event row, then asserts zero rows remain. Every delete is scoped
to the QA event id (it refuses to run on anything not starting with
`qa-smoke-`). Safe to re-run; it is idempotent.

## Manual refund test (NOT covered by the harness)

The harness's order carries a synthetic PayPal capture id, so hitting the
PayPal refund API with it would just fail. To verify refunds end-to-end:

1. Make **one real $4.99 purchase** on the live site with a real PayPal
   payment.
2. As owner, open `/admin/orders` and refund that order (this POSTs
   `/api/admin/orders/<MK-number>/refund`).
3. Confirm the refund shows in the PayPal dashboard and `refundedAt` is set
   on the order row.

## Known environment quirks the harness works around

- **`Photo.featured`/`featuredAt` are in the working-tree schema but not in
  the production DB** (uncommitted, not yet `prisma db push`ed). Two effects:
  1. `db.photo.create()` from the working-tree Prisma client fails (P2022) —
     the harness falls back to an explicit raw-SQL INSERT.
  2. `indexFacesForPhoto`'s final unscoped `db.photo.update()` fails, so
     `facesIndexedAt` never gets stamped by the lib — the harness stamps it
     itself and reports how many needed it. **This does not affect the
     deployed site** (Vercel's client is generated from the committed
     schema), only local scripts using the working-tree client. It resolves
     itself once `featured` is pushed.
- **The Rekognition IAM user lacks `rekognition:DeleteCollection`**, so the
  QA event's (empty) collection cannot be deleted — cleanup verifies it holds
  0 faces, warns, and leaves an empty orphan (stores nothing, costs nothing).
  Grant the action to `mikian-photos-rekognition` or delete
  `mikian-photos_qa-smoke-*` collections in the AWS console. Note this same
  gap means deleting a real event in the app also silently orphans its
  collection.

## What a run touches (and what it never touches)

Creates: one `draft` Event, N Photo rows + 2N R2 objects, N-ish PhotoBib
rows, one Rekognition collection, one Order, **one real receipt email to
mikianmusser@gmail.com** (BCC to the owner address — this is deliberate; it
proves Resend works). Reuses the owner's existing Photographer row (never
creates or deletes one).

Never: rows of any other event (all writes/deletes are scoped to the
`qa-smoke-*` id), schema changes, `prisma db push`, PayPal API calls.
