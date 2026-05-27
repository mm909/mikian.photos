# MVP v0.2 — two parallel tracks

After v0.1 we have: locked production, real PayPal flow, real bib roster, empty
results screen waiting on photos. Next up are two tracks that can be built in
parallel.

---

## Track A — implementation: real race photos in the UI

### Goal
Get real photos into the runner-facing UI:
1. Source them from some storage place
2. Serve previews **fast** on results / lightbox
3. Serve full-resolution originals **only** after purchase
4. Build the interface so we *can* serve watermarked previews — actual
   watermarking isn't required for v0.2, just the affordance.

### Architecture — the seam

A `PhotoStore` interface that the UI talks to. Implementations swap behind it:

```ts
// src/lib/photoStore/types.ts
export type PhotoVariant = "preview" | "full";

export type StoredPhoto = {
  id: string;
  eventId: string;
  photographerId: string;
  bib: number | null;
  takenAt: string | null;
  gps: [number, number] | null;
  hidden: boolean;
};

export interface PhotoStore {
  list(eventId: string): Promise<StoredPhoto[]>;
  listByBib(eventId: string, bib: number): Promise<StoredPhoto[]>;
  variantUrl(photoId: string, variant: PhotoVariant, viewerToken?: string): string;
}
```

Two implementations to start:

**`LocalPhotoStore`** (v0.2 ship)
- Files: drop JPEGs under `public/photos/{eventId}/{photoId}.jpg`
- Catalog: a single JSON at `src/data/photos.{eventId}.json` with the metadata
- `variantUrl` returns `/photos/{eventId}/{photoId}.jpg` for both variants
  (preview = full for now; the watermarking layer slots in later without
  changing callers)
- Pros: zero infra, ships today, deploys with the repo
- Cons: photos live in git (bad for thousands of files), no per-purchase
  access control on file URLs

**`BlobPhotoStore`** (v0.3+)
- Files: Vercel Blob (or Cloudflare R2)
- Catalog: Vercel Postgres / Supabase row per photo
- `variantUrl` returns signed URLs with short TTL for `"full"`, public URLs for
  `"preview"` (a request goes through an image-transform worker that applies
  watermark + resize)
- This is what we'd switch to once photographer uploads start landing for
  real

### Purchase gate

A new server route serves the **full-resolution** download only to a buyer
with a valid order:

```
/api/photos/{photoId}/download?token=<order-jwt>
```

- `finalizeOrder()` in `RunnerProvider` mints a short-lived JWT with
  `{ orderId, photoIds, exp }`
- The route validates the JWT against the recorded `Order`
- For bundles, the JWT covers every photo in the event
- Returns a 302 to the signed Vercel-Blob URL (or, in LocalPhotoStore mode,
  reads the file and streams it back so we still don't expose the raw path)

Previews stay public-readable — no token check on `?variant=preview`.

### Watermark hook

`/api/photos/{photoId}/preview` is a server route too (instead of a static
file). When `WATERMARK_ENABLED=true`, it pipes the source through Sharp +
`watermark-tile.svg` (we already have the asset in `public/assets/`). When
the flag is off, it just redirects to the underlying URL. v0.2 ships with
the flag off but the plumbing in.

### What changes in the runner UI

- `RunnerProvider.runSearch({kind:"bib"})` calls `photoStore.listByBib`
- `Photo` type gains `previewUrl` + `fullUrl` (derived via
  `photoStore.variantUrl`)
- `PhotoThumb` switches from `photoBg(gradient)` to `<img src={previewUrl}>`
  when a real URL exists; keeps the gradient as the loading placeholder
- `Lightbox` and `SuccessScreen` use the same `variantUrl` calls; success
  swaps to the `"full"` variant after purchase
- `DEMO_PHOTOS` becomes the in-memory `LocalPhotoStore` for events without
  real photos yet (drives demos without polluting production)

### Concrete v0.2 deliverable

1. `PhotoStore` interface + `LocalPhotoStore` impl
2. `/api/photos/[id]/preview` + `/api/photos/[id]/download` routes
3. `RunnerProvider` rewired to call the store
4. `PhotoThumb` / `Lightbox` / `SuccessScreen` rendering real `<img>`
5. Drop ~10 real Lighthouse photos under `public/photos/lighthouse-half-2026/`
   + a hand-written `photos.lighthouse-half-2026.json` to prove the wiring
6. Open questions answered before merge:
   - Storage choice (Vercel Blob vs other) — defer to v0.3 if we go
     LocalPhotoStore for v0.2
   - Whether watermarking ships enabled or just plumbed

---

## Track B — UI/flow: photographer upload page

### Goal
A photographer signs in, sees their uploads, uploads a batch of files with
metadata, and reviews/edits/hides them. The runner UI doesn't see new
photos until the photographer marks them "live."

### Persona auth

We don't have real auth yet. For v0.2 I recommend the **URL-token bearer
key** pattern — same as the payment lock:
- Each photographer gets a generated key (env or per-row)
- Visiting `/photographer?key=<pg-key>` sets a cookie binding the browser
  to that photographer
- Cookie carries `photographerId` for subsequent calls
- Replace with real Google OAuth in v0.3+

This is much faster than wiring NextAuth right now and gets us to the
upload UI in the same week.

### Routes & screens

```
/photographer                       overview: my uploads, sales (later), payouts (later)
/photographer/upload                bulk uploader
/photographer/photos/[id]           edit a single photo's metadata
```

### `/photographer` layout
- Header strip: photographer name + 3 mono-stat tiles
  (Uploaded · Sold · Est payout)
- Tabs: `MY UPLOADS · SALES · PAYOUTS` (only Uploads built in v0.2)
- Grid: each tile is a `PhotoThumb` rendered watermark-free + hover actions:
  - Edit (→ `/photographer/photos/[id]`)
  - Hide / Unhide (toggle `hidden`)
  - View on course (later — map pin) 

### `/photographer/upload` flow
- Big drag-and-drop region
- For each dropped file, append a queue row containing:
  - 64×88 thumbnail (`URL.createObjectURL`)
  - Filename + size
  - EXIF readout (`exifr` lib): `takenAt`, `gps`
  - Bib input (text; auto-detect via OCR is v0.3+)
  - Mile / location (optional dropdown of course landmarks)
  - Status pill: `Queued → Uploading → Processing → Live` (color shifts)
  - Progress bar
  - Retry / Remove
- Bulk inputs above the queue:
  - "Credit all to: [me ▾]" (defaults to signed-in pg)
  - "Default event: [Lighthouse Half 2026]"
- Save All button — triggers concurrent uploads
- Per-photo POST `/api/photographer/photos` with:
  - The file (multipart)
  - Bib, mile, photographer, event
  - EXIF-derived gps + takenAt
- Server stores the file via `PhotoStore` (writes to `public/photos/` for v0.2)
  and appends to the catalog JSON

### Two-version model — keep it

Worth keeping the data model with both `previewUrl` and `fullUrl`, even when
v0.2 sets them to the same file. Why:
- **Performance:** results grid wants 200KB previews, not 5MB originals.
  Vercel Image Optimization handles this automatically once we move off
  LocalPhotoStore.
- **Anti-piracy:** clean full-res should never leave the server until a
  purchase clears. Previews can be watermarked.
- **Cost:** previews can be served from CDN edges; originals are private
  blob storage with signed URLs.

For v0.2 LocalPhotoStore: both URLs point at the same `public/photos/...`
file. We design the interface, defer the actual two-version pipeline.

### Cull / hide

- Photographers can flip `hidden` on any of their own photos
- Hidden photos:
  - don't appear in runner search results
  - DO appear in `/photographer` with a `HIDDEN` badge
  - are excluded from a bundle purchase
- An admin role (you) can hide any photographer's photo too (built behind
  the `admin` dev-panel toggle that already exists)

### Open questions / I'd like your input
- **Bib tagging**: photographer-manual now, auto-OCR later. Confirm?
- **Multiple events per photographer**: in v0.2 we have one event
  (Lighthouse Half 2026). Keep single-event for now, add an event picker
  in v0.3?
- **Real auth timeline**: faked sign-in via URL token for v0.2, real Google
  OAuth in v0.3 — or do you want OAuth now?

---

## Suggested branching

- `mvpv0.1-real-data` (open PR) — merge as is, contains the hide-the-chart fix
- `v0.2-photos-pipeline` — Track A
- `v0.2-photographer-flow` — Track B

Track A and Track B share the `PhotoStore` interface. They could be one
branch or two — slight preference for two so we can ship Track A first
(it unblocks any real photos showing up on the site at all), and Track B
later (depends on photographers actually existing).

---

## Three blocking questions before I start coding

1. **Storage for v0.2**: `LocalPhotoStore` (drop JPEGs into the repo's
   `public/photos/`, hand-write metadata JSON) or jump straight to Vercel
   Blob + a real DB?
2. **Photographer auth for v0.2**: URL-token bearer cookies (matches the
   payment-unlock pattern; ~30 min of work) or real Google OAuth via
   NextAuth (~3 hr, but production-grade)?
3. **Watermarking**: just plumb the interface for v0.2 (recommended), or
   actually wire Sharp + watermark-tile.svg as a real preview transform?
