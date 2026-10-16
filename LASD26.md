# LASD26 — the crew's site (`/lasd26/dev`, in development)

The No Shortcuts Time Trial relay, Santa Monica → San Diego, Fri 2026-10-23,
run with Just Friends LV. The landing is the old crew call (now closed); the
rest is the team's own pages: who is on the crew, what it costs, who paid.
Built 2026-10-15 from the owner's brief. Live tracking is the separate
tracker under `/track/lasd26` (see TRACKER.md).

**Where it is right now.** The rebuilt site is the DEV COPY under
`/lasd26/dev` (owner, 2026-10-15: "make this live, but behind that slash
dev, just like we did with Hyrox. I just need to be able to view it"). The
live crew-call page at `/lasd26` (and `/lasd26/the-list`) is the old one
from main, untouched. Per the standing rule in CLAUDE.md, every page under
`/lasd26/dev` is admin-only in production — `gateLasdDev()` in
`src/lib/lasd26/devGate.ts` answers 404 to anyone but the owner — carries
"(dev)" in its title, is noindex, and wears a DEV pill beside the wordmark.
On a laptop (`NODE_ENV !== "production"`) the pages are open to any
account. Until the gate lifts the invite link works for the owner alone, so
the crew cannot join yet.

| Page | Who | What |
|---|---|---|
| `/lasd26/dev` | owner in prod; everyone locally | the landing: crew call is closed, the weekend, facts, the header with CREW CALL · LIVE · EXPENSES and the account button |
| `/lasd26/dev/join?t=<token>` | owner in prod; anyone with the link locally | sign in with Google, pick RUNNER or CREW, join the team |
| `/lasd26/dev/expenses` | owner in prod; team locally | every cost and its receipts; add a cost (title, amount, photos), attach receipts, edit/delete your own; the split and each person's share |
| `/lasd26/dev/pay` | owner now; team once settling up is open (and the gate lifts) | your share, PayPal / card, "paid" state |
| `/lasd26/dev/team` | owner | the invite link (copy / rotate), members, mark paid by hand, split count, open settling up |
| `/lasd26/dev/the-list` | owner (DEV) | the crew-call applications |
| `/lasd26`, `/lasd26/the-list` | everyone / owner | the LIVE crew-call page from main — not part of the dev tree |

## Going live

Every link, redirect, sign-in callback and the invite link inside the dev
tree goes through `lasdPath()` in `src/lib/lasd26/paths.ts`, so the move is
small. When the owner says the new site replaces `/lasd26`:

1. Flip `LASD_BASE` in `src/lib/lasd26/paths.ts` from `"/lasd26/dev"` to
   `"/lasd26"`.
2. Move `src/app/lasd26/dev/*` up over `src/app/lasd26/*` — `page.tsx`,
   `theme.ts`, `the-list/`, and the `expenses/`, `join/`, `pay/`, `team/`
   folders plus `LasdPage`/`LasdBar`/`LasdAccount` and the `*Css.ts` files.
   The old `CrewForm.tsx` and the orange `theme.ts` go; `ClearPile.tsx` and
   `Countdown.tsx` are shared and stay where they are.
3. Drop the `gateLasdDev()` calls (back to `getTeamViewer()`), the "(dev)"
   title tags and the DEV pill in `LasdBar.tsx`; `the-list` and `team` keep
   their own owner-only `notFound()`.
4. The API routes (`/api/lasd26/*`) and the files in `public/lasd26` never
   move; `LASD_ASSETS` in paths.ts names the latter.

## How it works

- **Sign-in** is Google through next-auth, the same account table as the
  rest of the site. The owner (role `owner`) sees everything; a member is a
  `TeamMember` row (team `lasd26`, role runner|crew) created by the invite.
- **The invite link** is `lasdPath("/join")?t=<token>` — today
  `/lasd26/dev/join?t=…`; the owner makes it on `/lasd26/dev/team` and
  drops it in the group chat. Making a new link retires the old one.
  Nothing else lets someone join.
- **Expenses** are `TeamExpense` rows in cents, seeded from the cost sheet
  by `scripts/lasd26-seed-expenses.ts` (race entry, hotel, Airbnb, two vans,
  gas and food as estimates). Receipts are uploaded straight to R2 with a
  presigned PUT, registered, thumbnailed with sharp, and served through a
  membership-checked redirect, so they are private to the team. The gas
  receipt is whoever filled up: any member can attach to any line, and
  remove what they attached; a line is edited or deleted by whoever added it
  or the owner.
- **Buckets** (owner, 2026-10-16: "How do I let people add real expenses to
  the food/gas estimates"). An estimate line is a bucket real costs are
  filed under: `TeamExpense.parentId` points "Chevron $62" at "Gas $600".
  Only a live, top-level estimate can be a parent; a child is never an
  estimate and never a parent (`checkBucket()` in
  `src/lib/lasd26/expenses.ts`; the API answers 400). A bucket counts
  max(its estimate, the sum of its live children) — the estimate stands
  until the real costs pass it, so one early gas receipt does not drop
  everyone's share — and "includes $X of estimates" is only the part the
  real costs have not covered (`totalCents()` in `money.ts`, checked by
  `npx tsx src/lib/lasd26/money.test.ts`). Every reader of the sums selects
  `TOTAL_SELECT` (id + parentId) or it double counts. On the page the
  bucket card lists what is in it and carries "+ ADD A REAL COST"; the
  top-level add form has a PART OF select. Deleting a bucket detaches its
  live children, which carry on as their own lines.
- **The split** is a setting (18, the cost sheet's team size), not the
  member count, so the per-person number holds while people join. Each
  share is the total divided by it, rounded up to the cent.
- **Settling up**: the pay button is owner-only until the owner flips
  "Settle up open to everyone" on `/lasd26/dev/team`. Payment is PayPal
  (card as a guest), the photo shop's connection; a capture below the share
  does not settle it. Cash or Venmo: the owner marks the member paid by
  hand.
- **Colours**: the Just Friends lime `#D0F858` is the fill and the accent on
  dark ground; on the cream paper, text and thin borders use the deep green
  `#3C7A0B` (`--safety` / `--safety-ink` in `src/app/lasd26/dev/theme.ts`).

## Setting it up

1. Push the schema once (`npm run prisma:push`) — the `Team*` tables.
2. `npx dotenv -e .env.local -- tsx scripts/lasd26-seed-expenses.ts` — the
   seven cost-sheet lines and the split of 18 (idempotent).
3. Open `/lasd26/dev/team`, make the invite link, send it (it opens for the
   owner only until the gate lifts — see "Going live").
4. Env: `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `PAYPAL_*` (already set for the
   shop) and the R2 keys (already set) are all it needs.

Code: `src/app/lasd26/dev/**` (pages, `LasdPage`/`LasdBar`/`LasdAccount`,
`theme.ts`), `src/app/api/lasd26/{team,expenses,pay}/**`,
`src/lib/lasd26/{paths,devGate,team,money,expenses,receipts,settle}.ts`,
models at the end of `prisma/schema.prisma`.
