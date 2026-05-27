# MVP v0.2 — real photos pipeline + photographer flow

Decisions locked 2026-05-27:

| Question | Answer |
|---|---|
| Storage | **Final-version storage** — no LocalPhotoStore intermediate. Pick the bucket once, build against it. |
| Photographer auth | **Google OAuth via NextAuth** |
| Watermarking | **Real Sharp + `watermark-tile.svg`** preview transform |
| Dev cost guardrail | **Hard-cap photo lists at 10** while we're iterating, behind a `MAX_PHOTOS_DEV` env var |

---

## Why these choices in cost terms

A photo marketplace's variable cost is **egress bandwidth** (every preview view downloads bytes). Storage is cheap; eyeballs aren't.

| Backend | Storage | Egress | First $30 you charge nets you… |
|---|---|---|---|
| Cloudflare R2 | $0.015 / GB-mo | **$0** | ~$28 after PayPal fee |
| Vercel Blob | $0.15 / GB-mo | $0.30 / GB | $25–27 depending on traffic |
| AWS S3 | $0.023 / GB-mo | $0.09 / GB | $26–27 |
| Cloudinary | included free up to 25 "credits/mo" → $99/mo paid tier | included | hard cliff at the paid tier |

**Recommendation: Cloudflare R2.**
- Free tier: 10 GB storage + 1M Class-A ops/mo + **unlimited egress**
- S3-compatible — drop-in libraries work
- Fronts naturally with the Cloudflare CDN for preview caching
- Worst case at 1000 photos × 3 MB = 3 GB stored, 5 GB egress / month → **$0**

Database for metadata: **Vercel Postgres (Neon)** — free tier covers our scale (1 GB / 100 hours compute / month) and it shows up in the same dashboard as the deploy. Prisma as the ORM.

---

## Architecture (final shape)

```
┌─────────────────────────┐         ┌──────────────────────────┐
│  Photographer browser    │         │  Runner browser           │
│  /photographer/upload    │         │  /, /results, /lightbox   │
└────────┬─────────────────┘         └────────┬─────────────────┘
         │ multipart POST + cookie            │ GET (no auth)
         ▼                                    ▼
┌─────────────────────────┐         ┌──────────────────────────┐
│  /api/photographer/photos│         │  /api/photos (list, ≤10)  │
│  - NextAuth check        │         │  /api/photos/[id]/preview │
│  - Sharp:                │         │   (Sharp + watermark)    │
│      EXIF → metadata     │         │  /api/photos/[id]/download│
│      preview JPEG        │         │   (JWT-gated, signed URL)│
│  - Upload both to R2     │         └────────┬─────────────────┘
│  - INSERT row in Postgres│                  │
└────────┬─────────────────┘                  │
         │                                    │
         └──────────┬─────────────────────────┘
                    ▼
         ┌──────────────────────┐
         │  Cloudflare R2        │
         │   originals/          │
         │   previews/           │
         └──────────────────────┘
         ┌──────────────────────┐
         │  Vercel Postgres      │
         │   photos, photographers│
         │   events, orders      │
         └──────────────────────┘
```

### Photo data model (Prisma)

```prisma
model Event {
  id            String   @id
  name          String
  date          DateTime
  city          String
  photoCount    Int      @default(0)
  photos        Photo[]
}

model Photographer {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String
  // populated by NextAuth on first sign-in
  googleSubject String?  @unique
  photos        Photo[]
  createdAt     DateTime @default(now())
}

model Photo {
  id              String   @id @default(cuid())
  eventId         String
  photographerId  String
  bib             Int?
  mile            Int?
  gpsLat          Float?
  gpsLng          Float?
  takenAt         DateTime?
  // R2 object keys (NOT full URLs — we sign at request time)
  r2OriginalKey   String
  r2PreviewKey    String
  hidden          Boolean  @default(false)
  createdAt       DateTime @default(now())
  event           Event    @relation(fields: [eventId], references: [id])
  photographer    Photographer @relation(fields: [photographerId], references: [id])
  @@index([eventId, bib])
  @@index([eventId, hidden])
}

model Order {
  id              String   @id   // matches PayPal capture id
  userEmail       String
  total           Float
  paidAt          DateTime
  // photo coverage: bundle for the whole event, or specific photo ids
  eventIdCovered  String?
  // signed download token (JWT) bound to this order
  downloadToken   String   @unique
  createdAt       DateTime @default(now())
}
```

### Image pipeline (Sharp)

**On upload:**
```
photographer POST → /api/photographer/photos
  ├─ parse multipart
  ├─ sharp(original)
  │    ├─ read EXIF: gpsLat, gpsLng, takenAt
  │    ├─ resize → 1600px long-edge, JPEG q=75 → previewBuffer
  │    └─ composite watermark-tile.svg at 22% opacity, rotated -22°
  ├─ R2 PUT originals/{photoId}.jpg          (original bytes)
  ├─ R2 PUT previews/{photoId}.jpg           (watermarked preview)
  └─ Postgres INSERT
```

**On view (runner):**
```
GET /api/photos/[id]/preview
  ├─ Postgres SELECT photo
  ├─ if hidden → 404
  ├─ R2 GET previews/{photoId}.jpg
  ├─ Cache-Control: public, max-age=31536000, immutable
  └─ stream bytes back
```

Cache header means after the first hit, the browser + Cloudflare CDN cache forever. We pay R2 once per photo per CDN node. **Egress on R2 is free anyway**, so cache misses are cheap.

**On download (after purchase):**
```
GET /api/photos/[id]/download?token=<jwt>
  ├─ verify JWT: orderId, photoIds, exp
  ├─ Postgres SELECT order → confirm photoId in eventIdCovered set
  ├─ mint a presigned R2 URL for originals/{photoId}.jpg (15-min TTL)
  └─ 302 redirect to that URL
```

---

## Dev cost guardrail

`/api/photos` list route:
```ts
const MAX = process.env.NODE_ENV === "production"
  ? Number(process.env.MAX_PHOTOS_PROD ?? 200)
  : Number(process.env.MAX_PHOTOS_DEV ?? 10);
return photos.slice(0, MAX);
```

So during dev / staging: **max 10 photo rows ever return per request**, no matter how many you upload. Plenty to validate the flow, zero risk of bill surprise.

Preview route is also rate-limited per IP (e.g. 60 req/min) via a simple in-memory limiter — protects against scraping.

---

## v0.2 implementation — vertical slice first

Three PRs in order. Each merges to main only after end-to-end works.

### PR1 — Infra + one photo end-to-end
**Goal:** prove the whole pipeline by hand-uploading exactly one photo.
- Prisma schema + migration
- R2 client wrapper (`src/lib/r2.ts`)
- NextAuth scaffold with Google provider
- Sharp helper (`src/lib/imagePipeline.ts`) — `processOriginal()` returns `{ original, preview, exif }`
- `/api/photos/[id]/preview` route (R2 stream + cache)
- `/api/photos/[id]/download` route (JWT-gated, signed URL)
- `/api/photos` list route (capped at 10)
- Runner UI: `PhotoThumb` renders `<img src={previewUrl}>` instead of gradient
- A one-off `scripts/seedPhoto.ts` that uploads one test JPEG to R2 + creates the Postgres row
- Walk it end-to-end: bib `288` → results screen shows real photo → buy → download original

### PR2 — Photographer upload UI
**Goal:** photographers can upload, runners see the photos automatically.
- `/photographer` overview (header + uploads grid)
- `/photographer/upload` dropzone + queue + per-row EXIF readout + bib input
- `/api/photographer/photos` POST (multipart → Sharp → R2 → Postgres)
- Hide / edit / delete on a photo
- "Save All" with concurrent uploads + progress

### PR3 — Polish + admin
**Goal:** Mikian can run the event.
- Admin role flips on `hidden` for any photo
- Bulk operations (hide all from photographer X, etc.)
- Photographer payout estimate on the overview
- Real Google OAuth gating instead of dev-panel role toggles

---

## Setup you need to do before I write PR1

Six steps, ~30–45 minutes total.

### 1. Cloudflare R2 bucket (~10 min)
- Sign up / log in to https://dash.cloudflare.com
- R2 → Create Bucket → name it `mikian-photos` (or your pick)
- Settings → **Bucket Settings → Public Access** → leave **disabled** (we sign URLs server-side)
- R2 → Manage R2 API Tokens → **Create API Token** → permissions: Object Read + Write on this bucket
- Save the **Access Key ID**, **Secret Access Key**, and the **Account ID** (visible top-right)

Drop into `.env.local`:
```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=mikian-photos
```

### 2. Vercel Postgres (~5 min)
- Vercel dashboard → your project → Storage tab → **Create Database → Postgres** → name it, region near Vercel's default
- It auto-populates `POSTGRES_URL` etc. in your Vercel env vars
- Hit **`.env.local`** tab there → "Copy snippet" → paste into your local `.env.local`

You'll get:
```
POSTGRES_URL=postgres://...
POSTGRES_URL_NON_POOLING=postgres://...
POSTGRES_USER=...
POSTGRES_HOST=...
POSTGRES_PASSWORD=...
POSTGRES_DATABASE=...
```

### 3. Google OAuth app (~10 min)
- https://console.cloud.google.com → create project "Mikian.Photos"
- APIs & Services → OAuth consent screen → External → fill in app name, support email
  - Scopes: just `email`, `profile`, `openid` for now
  - Add yourself + 1-2 test emails under "Test users"
- Credentials → Create Credentials → **OAuth client ID** → Web application
  - Authorized JavaScript origins: `https://www.mikianmusser.com`, `http://localhost:3000`
  - Authorized redirect URIs:
    - `https://www.mikianmusser.com/api/auth/callback/google`
    - `http://localhost:3000/api/auth/callback/google`
- Save the **Client ID** + **Client Secret**

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_SECRET=<generate: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000   # local dev
# Vercel sets NEXTAUTH_URL automatically in prod
```

### 4. Mirror env vars to Vercel
Settings → Environment Variables → add R2_*, GOOGLE_*, NEXTAUTH_* to **Production, Preview, Development**. (POSTGRES_* was added automatically in step 2.)

### 5. Dev cost guardrail vars
```
MAX_PHOTOS_DEV=10
MAX_PHOTOS_PROD=200
```
(Tune as you go.)

### 6. Tell me when done
Ping me with "infra is ready" and I'll start PR1.

---

## Open questions

1. **Bucket region** — R2 is global by default; do you want to pin it to a specific region (`wnam` for West NA cuts a few ms for Long Beach traffic)?
2. **Initial photographer list** — who's uploading for Lighthouse? Just you for now, or do we seed a couple of test photographer rows?
3. **Bib OCR timeline** — for v0.2 the photographer types bibs manually. Auto-OCR via something like AWS Rekognition or Vision API is v0.3+. Confirm?

---

## What stays the same regardless

- `PAYMENTS_OPEN=false` lock remains — production is gated.
- The `/api/unlock?key=...` bypass works the same way.
- The bundle price stays at `$1` until you bump it for launch.
- `mvpv0.1-real-data` PR merges first; v0.2 work branches off `main` after that.
