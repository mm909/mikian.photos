# Mikian.Photos — v0.4 (Pre-launch polish + integrations)

Status as of v0.3 ship (main @ `8a8bff4`):

- Face recognition end-to-end: indexed, clustered, runner-searchable
- "Is this you?" bib disambiguation
- Photographer dashboard reshaped as event-rollup table
- Library simplified (no pills, no tabs, no bulk OCR rerun)
- OCR Lab + Face Lab merged into one "Lab" with mode toggle
- Download options: ZIP, Dropbox Saver, Save-to-Photos (mobile share)
- Receipt email carries direct ZIP + order-page CTAs
- Working tree carries pre-built (uncommitted) Coverage screen, Roster
  screen, Runner profile — landed but not finished

v0.4 is the **pre-launch polish + missing-integration sweep**. We don't
ship new big surfaces here — we polish what exists, plug the OAuth
integrations we deferred, and exercise the buy flow end-to-end with
real money.

---

## How the two-agent split works

Two agents in parallel is the sweet spot for solo dev: enough throughput
to feel fast, not so much that you spend half your day merging.

### Rules of the road

1. **Each agent on its own branch off `main`.** No agent ever commits
   directly to `main`. Branches: `v0.4-A-<slug>` and `v0.4-B-<slug>`.
2. **Module ownership, not feature ownership.** Each agent owns a set
   of *files/areas* (see below). If you need to touch the other
   agent's file, queue the change in the chat and let them do it. This
   prevents stomp far better than "Agent A owns feature X."
3. **Daily-ish merge cadence.** When an agent finishes a slice: merge
   to main, the other agent rebases. Don't let either branch run more
   than ~2-3 commits ahead.
4. **Shared infra changes are exclusive.** Schema (`prisma/schema.prisma`),
   `lib/r2.ts`, `lib/permissions.ts`, `lib/db.ts`, `Nav.tsx`, and
   `RunnerProvider.tsx` — at most one agent touching at a time.
   If both agents need a schema change, sequence them: Agent A lands
   theirs, Agent B rebases.
5. **Plan-doc is the source of truth.** This file. Update the agent
   assignment in the checklist below as work moves around. If a task
   moves from one agent to another, edit the doc *first*, then act.

### Two-agent role split

The user (Mikian) is the bottleneck on anything that touches external
accounts (Google Cloud Console, Stripe dashboard, DNS, Apple/Google
test devices, real money). The split here is around that bottleneck:

**Agent A — "Integrations & ops"** (work that needs Mikian for setup)
- Anything requiring an OAuth app, DNS record, third-party dashboard
- Anything that needs Mikian to test on a physical device
- Anything that touches real money or production envs
- Pattern: Agent A does the *code*, then surfaces a precise checklist
  ("paste this into Google Cloud Console → OAuth screen → …") and
  *waits* for Mikian to confirm before moving on.

**Agent B — "Internal polish"** (zero-external-dep work)
- Pure code + database changes Mikian doesn't need to touch
- Server logic, UI polish, accessibility, refactors, tests
- Pattern: Agent B works heads-down. When something does need
  Mikian's eyes, it goes on a "review queue" in this doc — Agent B
  doesn't block on it, moves to the next ticket.

**How to start each session.** Open two terminals/IDE windows. In
window 1 say "you're Agent A, working off the v0.4 plan." In window 2
"you're Agent B, working off the v0.4 plan." Tell each which item
they're picking up; they read this doc and proceed. Cross-talk
through Mikian — agents don't share state directly.

---

## v0.4 changeset

Each item has: **owner**, status, what it covers, files touched (so
agents can see at a glance where they conflict), what (if anything)
needs Mikian.

### Agent A — Integrations & ops

#### A1. Resend domain verification ⏳ ops
- **Status:** unstarted
- **What:** Set `MAIL_FROM=Mikian.Photos <orders@mikianmusser.com>`,
  add Resend's SPF + DKIM records to Cloudflare DNS, verify via
  `POST /api/admin/receipt-preview` to a non-account email.
- **Files:** none (env + DNS only)
- **Needs Mikian:** add Resend records to Cloudflare DNS, set MAIL_FROM
  on Vercel. Agent A drafts the exact records + steps; Mikian executes.
- **Done when:** test send to a non-Resend-account email lands in inbox.

#### A2. Dropbox app key + production allowlist ⏳ ops
- **Status:** unstarted (button already coded; just needs the key)
- **What:** Register the Dropbox app at dropbox.com/developers/apps,
  set `NEXT_PUBLIC_DROPBOX_APP_KEY` on Vercel, add `mikianmusser.com`
  to the Chooser/Saver domain allowlist.
- **Files:** none
- **Needs Mikian:** Dropbox developer account login, app registration.
- **Done when:** Save to Dropbox button appears on a logged-in browser
  and successfully drops a real photo into Mikian's Dropbox.

#### A3. Save to Google Photos (real OAuth) 🆕 code+ops
- **Status:** unstarted; replaces share-sheet-only path on desktop
- **What:** OAuth 2.0 with Google, `photoslibrary.appendonly` scope,
  per-user refresh token storage (new `GooglePhotosToken` table?),
  server route that calls `mediaItems:batchCreate` with the order's
  hi-res URLs. Add a "Save to Google Photos" button on the order page
  next to Dropbox.
- **Files:** new — `prisma/schema.prisma` (token table), `lib/googlePhotos.ts`,
  `src/app/api/orders/[N]/google-photos/route.ts`,
  `src/app/api/auth/google-photos/...` (OAuth callbacks),
  edit — `src/components/runner/OrderPhotoGrid.tsx`,
  `src/app/orders/[orderNumber]/page.tsx`
- **Needs Mikian:** register OAuth app at console.cloud.google.com,
  add `photoslibrary.appendonly` scope, copy client id + secret into
  Vercel envs.
- **Done when:** signed-in buyer can save their order to Google Photos
  with one click on desktop Chrome.

#### A4. Apple Pay / Google Pay verification ⏳ test
- **Status:** unstarted
- **What:** PayPal Smart Buttons already include both in the JS SDK —
  this is a verify-it-renders task, not a build task. Confirm on iOS
  Safari + Android Chrome. If broken, dig into PayPal SDK config.
- **Files:** likely none, possibly `src/components/runner/CheckoutScreen.tsx`
- **Needs Mikian:** test on real iPhone + real Android phone (sandbox
  PayPal accounts).
- **Done when:** screenshots of Apple Pay + Google Pay buttons in the
  checkout flow on real devices.

#### A5. End-to-end real-money smoke test ⏳ test
- **Status:** unstarted (blocked by A1)
- **What:** Flip `PAYMENTS_OPEN=true`, buy with a fresh account from
  another browser/account, confirm: receipt arrives at real email,
  magic link works, ZIP downloads, Save-to-Photos renders on phone,
  Dropbox button works. Then lock back down and pin findings.
- **Files:** none (test only)
- **Needs Mikian:** flip the env, drive the buy.
- **Done when:** smoke-test notes attached to this section.

#### A6. Pic-time migration plan (NOT execution) 📋 doc
- **Status:** unstarted; deliberately scoped to *plan* only
- **What:** Document the migration steps to repoint
  `photos.mikianmusser.com` from pic-time to our app: DNS swap, data
  export from pic-time, customer-comm draft. Don't execute — that's
  post-launch.
- **Files:** new — `docs/pic-time-migration.md`
- **Needs Mikian:** review the plan, confirm timing.
- **Done when:** the doc is in main and Mikian has signed off on the
  draft.

### Agent B — Internal polish

#### B1. Finish the Coverage screen ✏️ code
- **Status:** in working tree, untouched by both agents since v0.3 wrap
- **What:** Pre-built admin/coverage page + API exist. Finish the
  `onDeleteBib` prop wiring (current TS error in CoverageClient.tsx
  line 386), polish the UI, verify the bib/face cross-link counts are
  correct against the live data.
- **Files:** `src/app/admin/coverage/page.tsx`,
  `src/components/admin/CoverageClient.tsx`,
  `src/app/api/admin/coverage/route.ts`
- **Needs Mikian:** nothing.
- **Done when:** `tsc --noEmit` clean, Coverage screen renders without
  warnings, counts match the runner-facing search results.

#### B2. Finish the Roster screen ✏️ code
- **Status:** in working tree, untouched
- **What:** Pre-built Roster + RunnerProfile components. Tighten the
  data shape, ensure Lighthouse roster joins by bib, link rows out to
  the runner profile.
- **Files:** `src/app/admin/roster/page.tsx`,
  `src/components/admin/RosterClient.tsx`,
  `src/components/admin/RunnerProfileClient.tsx`,
  `src/app/api/admin/roster/route.ts`
- **Needs Mikian:** nothing.
- **Done when:** owner can see all 1,200+ Lighthouse entrants with
  their photo + face counts, click into a runner, see all photos.

#### B3. Lightbox thumbnail strip auto-scroll ✏️ code
- **Status:** unstarted
- **What:** When the user arrow-keys through photos in the lightbox,
  the active thumb should `scrollIntoView({inline: "center"})` — same
  pattern OCR Lab already uses. Right now the highlight runs off the
  visible strip on long catalogs.
- **Files:** `src/components/runner/screens/Lightbox.tsx`
- **Needs Mikian:** nothing.
- **Done when:** arrow-key nav keeps the active thumb on-screen.

#### B4. Mobile responsiveness audit ✏️ code
- **Status:** unstarted
- **What:** Walk every runner-facing surface on iPhone Safari + Android
  Chrome (or DevTools device emulator if no devices): landing,
  results, lightbox, cart, checkout, order page. Fix anything that
  scrolls horizontally, has too-small touch targets, or wraps awkwardly.
- **Files:** various — `src/components/runner/**`,
  `src/app/orders/[orderNumber]/page.tsx`
- **Needs Mikian:** nothing (can use device emulator).
- **Done when:** screenshot pass attached, all flagged issues fixed.

#### B5. Email re-send tooling ✏️ code
- **Status:** unstarted
- **What:** Owner-only button on `/orders/[orderNumber]` that re-fires
  `sendReceiptEmail` (same payload as capture-order). For the case
  where a buyer's inbox eats the original or they ask for a re-send.
- **Files:** `src/app/orders/[orderNumber]/page.tsx`,
  new `src/app/api/orders/[orderNumber]/resend/route.ts`
- **Needs Mikian:** nothing.
- **Done when:** Mikian (as owner) can click "Resend receipt" on any
  order page and see the email arrive.

#### B6. Refund / revocation flow ✏️ code
- **Status:** unstarted (schema partly ready — Order can be deleted,
  which already 403s downloads via the existing chain)
- **What:** Add `Order.revokedAt` field. Owner-only button on order
  page to mark revoked → downloads start 403'ing with a friendly
  message ("This order has been refunded — reach out to support").
- **Files:** `prisma/schema.prisma` (schema change — sequence carefully
  with Agent A), `src/app/api/photos/[id]/download/route.ts`,
  `src/app/api/orders/[N]/zip/route.ts`,
  `src/app/orders/[orderNumber]/page.tsx`,
  `src/lib/orderAccess.ts`,
  new `src/app/api/orders/[N]/revoke/route.ts`
- **Needs Mikian:** nothing.
- **Done when:** revoked orders 403 every download path with the right
  message; revoked status visible on the order page for owner.

#### B7. Photographer payout tile ✏️ code
- **Status:** placeholder shown in earlier dashboard, removed in the
  reshape; bring back as a real number
- **What:** Per-photographer earnings tile on the dashboard. For each
  event row, count orders that include any of the photographer's
  photos, sum the photographer's split (50% per
  `PLAN_v0.3.md` convention). Already partly wired — see the
  optional `salesCount` + `splitUsd` fields on `EventRow`.
- **Files:** `src/app/api/photographer/events/route.ts`,
  `src/components/photographer/PhotographerDashboardClient.tsx`
- **Needs Mikian:** nothing.
- **Done when:** dashboard rows show real sales + split numbers; sum
  matches what's in the Orders table for each photographer.

#### B8. Admin TOC + console links ✏️ code
- **Status:** unstarted (Mikian asked for this back in v0.2)
- **What:** Left-rail table-of-contents on the admin pages so jumping
  between Users / Coverage / Roster / Photographers is one click.
  Plus a "Console links" widget pointing to: Vercel project, Neon DB,
  R2 bucket, AWS Rekognition collections, Resend dashboard.
- **Files:** new `src/components/admin/AdminShell.tsx` (wraps each
  admin page), edits to each admin page to use it
- **Needs Mikian:** nothing.
- **Done when:** every `/admin/*` page has the TOC; Console links
  resolve to the right dashboards.

#### B9. PLAN doc maintenance 📋 doc
- **Status:** ongoing
- **What:** As each item lands, Agent B updates its row here:
  in_progress → completed, append "shipped at <commit>". Also notice
  when this doc's content is contradicted by reality and fix it.
- **Files:** `PLAN_v0.4.md`
- **Needs Mikian:** nothing.
- **Done when:** each shipped item has a `✓ shipped (<commit>)` tag.

---

## Items deferred past v0.4

These are *known* and *desired* but explicitly not in v0.4. Calling
them out so we don't accidentally pick them up:

- Per-photo pricing (today: bundle-only)
- Photographer self-serve onboarding (today: owner-grants-role)
- Stripe alongside PayPal
- Manual bib tagging in PhotoDetailModal (deferred per Mikian — bring
  back if OCR keeps missing)
- Watermarking previews (explicitly declined; revisit if scraping is
  observed)
- Cron to delete originals 90 days after last download
- Push notifications when a face match shows up
- Multi-event support (one photographer covering multiple races)
- Per-event landing pages

---

## Working agreement reminders

- `PAYMENTS_OPEN=false` stays the launch gate; unlock-cookie keeps working
- No watermark, no USATF mentions, no fake mile markers
- Costs: keep Rekognition spend ≤ ~$5/event (caps already in code)
- `MAX_PHOTOS_PROD` env caps photo lists; keep it sane (~500)
