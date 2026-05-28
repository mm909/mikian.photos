# Mikian.Photos — Roadmap (v0.3 onward)

Status as of v0.2 ship: working OCR + image delivery + receipt flow. Site
is env-locked (`PAYMENTS_OPEN=false`); first real $ already settled
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

### 1. Face recognition end-to-end
- AWS Rekognition collection per event (or one global, decide cost-wise)
- Upload finalize step: `IndexFaces` against the original; store `(photoId, faceId, boundingBox, confidence)` in a new `PhotoFace` table
- Runner face-search input: file picker → `SearchFacesByImage` → photoIds → existing results screen
- Wire the `NoBibMatchPrompt` "try face search" CTA to the real flow
- Cost guardrail: cap faces-per-image so a crowd shot doesn't burn the budget

### 2. Bib ↔ face cross-link
- When the same photo has both a bib OCR hit and an indexed face, record the association
- Downstream: searching by bib for runner #288 returns face matches across other photos that share that face (even if the bib isn't visible)
- This is the multiplier that makes results feel magical — and the reason face rec belongs *before* bulk download

### 3. Bulk ZIP download
- `/api/orders/[orderNumber]/zip?key=...` streams a server-built ZIP of all entitled originals
- Use the `archiver` package; pipe R2 stream → ZIP → response, no temp files
- Fall back to the current "sequential download" path on browsers that block the response (keep it as the secondary button, ZIP as primary)
- Cap byte count + show progress so the UX doesn't feel broken on large orders

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
