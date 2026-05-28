# Mikian.Photos — Roadmap (v0.3 onward)

Status as of v0.3 in-progress: face recognition end-to-end is live on the
`v0.3-face-rec` branch; bib↔face cross-link landed in the same branch.
Site is still env-locked (`PAYMENTS_OPEN=false`); first real $ settled
2026-05-27 in a one-off test, so the payment path itself is proven.

This doc is the running list. Edit it freely — the order is the order I'll
work in unless you say otherwise.

---

## What just shipped in v0.2

- Cloudflare R2 (custom domain `cdn.mikianmusser.com`) + Postgres + Sharp pipeline
- Photographer upload UX: presigned PUT, SHA-256 fingerprinting, duplicate detection, pause/ETA, "Ingest" terminology
- OCR: pluggable Tesseract + AWS Rekognition; OCR Lab page for live tuning; metadata sidebar; arrow-key nav; zoom
- Library + Dashboard: pages-based pagination with real totals, search by bib (exact int match)
- Runner flow: real photos in lightbox/cart/checkout, loading state on results, face-prompt fallback when no bib hits
- Receipt + retrieval: PayPal capture → `Order` row → magic-link JWT → receipt email (Resend, log-only fallback) → `/orders/[orderNumber]` page → `/runner` dashboard
- Auth: roles[] on Photographer, owner-by-email auto-grant, owner bypasses unlock cookie everywhere
- Admin: users table with role editor; `/api/admin/receipt-preview` smoke-test route

---

## v0.3 — MVP blockers (the relaunch list)

These are the things between "test capture" and "people who don't know me can actually buy and use the product."

### 1. Face recognition end-to-end ✓ shipped (v0.3-face-rec)
- Per-event Rekognition collection (one per `eventId`, created lazily)
- Upload finalize step calls `IndexFaces` on the preview after OCR, writes `PhotoFace` rows (photoId, eventId, rekognitionFaceId, normalized bbox, confidence) plus `Photo.facesIndexedAt`
- `POST /api/photos/face-search` — multipart selfie endpoint, returns same Photo shape as `/api/photos` plus `faceSimilarity`
- Runner UI: `runFaceSearch(file)` in `RunnerProvider` replaces the old no-op; LandingScreen "Scan My Face" and ResultsScreen `NoBibMatchPrompt` both wired
- Photo delete cascades to Rekognition via `DeleteFaces`
- `POST /api/photographer/photos/[id]/rerun-faces` re-indexes one photo
- `scripts/backfill-faces.ts` for existing photos
- IAM smoke-tested ✓ (8/8 actions); backfill ran ✓ (231 faces across 172 photos)

### 2. Bib ↔ face cross-link ✓ shipped (v0.3-face-rec)
- New faces clustered at index time via `SearchFaces` (threshold 92%, max 50 neighbors); `faceClusterId` = lexicographically-smallest of (self + matched neighbors), with merge of conflicting clusters
- `/api/photos?bib=N` expands the bib-tagged set with photos sharing the bib's runner's face clusters. Cluster qualifies as "the runner" when it appears in ≥2 bib-tagged photos (or, when only 1 bib photo exists, every cluster from it qualifies)
- Each photo carries `matchedVia: "bib" | "face" | "both"` for future UI differentiation
- `RunnerProvider.runSearch` issues the server fetch on bib search (after instant client-side filter for snappy UI); flashes "+N found via face match" toast when expansion lands

### 3. Download options + integrations ✓ (mostly) shipped (v0.3-face-rec)

What landed:
- **ZIP download** — `GET /api/orders/[N]/zip?key=` streams every entitled
  original through `archiver` (`store: true` since JPEGs are already
  compressed) into the response body. Token-gated via the existing
  `getOrderForViewer`. 500-photo cap to stay inside Vercel's 60s function
  budget.
- **Dropbox Saver** — JS widget loaded on demand from
  `dropbox.com/static/api/2/dropins.js`. Requires
  `NEXT_PUBLIC_DROPBOX_APP_KEY` on Vercel; button hides itself when
  unset. User confirms in Dropbox's popup; their servers fetch each
  `/api/photos/[id]/download?token=` URL.
- **Save to Photos (mobile)** — `navigator.share({files})` triggers the
  native share sheet, which surfaces "Save to Photos" on iOS and the
  Google Photos / Drive / Dropbox targets on Android. Capped at 6 files
  per share (iOS rejects larger batches); UI explains the cap and
  points to ZIP for the full set. Feature-detected via `canShare` so
  desktop hides the button.
- **Receipt email** — now ships a two-button row in the "Your photos"
  card: "View & pick photos →" (the order page) and "Download ZIP (N)"
  (direct ZIP endpoint). Plaintext fallback mirrors both URLs.
  Plus a one-liner pointing mobile buyers at the Save-to-Photos /
  Dropbox affordances on the order page.

Still open as v0.4 follow-up:
- **Save to Google Photos** as a desktop-friendly first-class button.
  The Web Share API surfaces Google Photos on Android; iOS Safari does
  not. For a real "save to Google Photos" from a desktop browser we'd
  need an OAuth flow + the Photos Library API (mediaItems:batchCreate).
  Day-or-two project: register the OAuth client with Google, store
  per-user refresh tokens (Photographer.googleRefreshToken?), build a
  small server route that batchCreates with the buyer's hi-res URLs.
  Worth doing once Apple Photos / Dropbox usage tells us the share-
  sheet path is leaving people behind.

### 4. Resend domain verification (ops, not code)
- Add Resend's SPF + DKIM records to Cloudflare DNS
- Set `MAIL_FROM="Mikian.Photos <orders@mikianmusser.com>"` on Vercel
- Verify via `POST /api/admin/receipt-preview` to a non-account email
- Delete the leftover SendGrid `em8446` / `s1._domainkey` / `s2._domainkey` CNAMEs once nothing else uses them

### 5. End-to-end real-money smoke test
- Flip `PAYMENTS_OPEN=true` briefly
- Buy with a different account from a different browser, confirm: receipt arrives, magic link works, downloads land with `MK-…-<photoId>.jpg` filename
- Lock back down; pin findings

### 6. (Maybe) Apple Pay / Google Pay
- PayPal Smart Buttons already include both in the JS SDK — confirm they render on iOS Safari and Android Chrome
- If not: skip until launch+1, not a blocker

---

## v0.4 — Pre-launch polish

Things that aren't blockers but will embarrass us at launch if they ship as-is.

- **Coverage screen** (designed not built): owner-only bib/face coverage table per event — "of N expected bibs, we have photos for M; here are the gaps"
- **Lightbox thumbnail strip**: scrollable, highlighted-thumb auto-scrolls into view (mirrors what OCR Lab already does)
- **Mobile responsiveness audit**: results screen, lightbox, cart, checkout — verify on real devices, not just dev tools
- **Admin page**: left-rail TOC, search on users table, links out to AWS console + Vercel DB + R2 bucket
- **Email re-send tooling**: button on `/orders/[orderNumber]` that re-fires `sendReceiptEmail` (owner-only) for the case where a buyer's inbox ate the original
- **Refund / revocation flow**: owner action that flips `Order.revoked` → existing download endpoint already 403s; just need the UI
- **Photographer payout view**: dashboard tile showing "you've earned $X from N orders this month" — accuracy matters less than visibility

---

## Post-launch / nice-to-have

In rough priority, but anything here can wait for the second weekend of real traffic to inform.

- Per-photo pricing on top of bundle-only
- Photographer multi-event support (right now an event scopes one photographer's batch upload session)
- Stripe alongside PayPal (broader card acceptance, Apple Pay native)
- Manual bib tagging in PhotoDetailModal (deferred per earlier call — bring back if OCR keeps missing)
- Watermarking previews — explicitly declined for now; revisit only if we see scraping
- Migration of `photos.mikianmusser.com` off pic-time onto our own surface
- Cron job to delete originals 90 days after last download (storage hygiene)
- Per-event landing pages (vs the current single results route)
- Photographer onboarding self-serve (today it's owner-grants-role)
- Push notifications when a face matches new uploads ("3 new photos of you from Long Beach Half")

---

## Working agreement

- One branch per slice: `v0.3-face-rec`, `v0.3-bulk-zip`, etc.
- PRs into `main`; Vercel auto-deploys main on merge
- `PAYMENTS_OPEN=false` stays the launch gate; unlock-cookie keeps working for me
- No watermark, no USATF mentions, no fake mile markers
- Costs: keep Rekognition spend ≤ ~$5/event by capping faces-per-image and skipping re-runs (`force` toggle in the Lab)
