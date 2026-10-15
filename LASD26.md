# LASD26 — the crew's site (`/lasd26`)

The No Shortcuts Time Trial relay, Santa Monica → San Diego, Fri 2026-10-23,
run with Just Friends LV. The landing is the old crew call (now closed); the
rest is the team's own pages: who is on the crew, what it costs, who paid.
Built 2026-10-15 from the owner's brief. Live tracking is the separate
tracker under `/track/lasd26` (see TRACKER.md).

| Page | Who | What |
|---|---|---|
| `/lasd26` | everyone | the landing: crew call is closed, the weekend, facts, the header with CREW CALL · LIVE · EXPENSES and the account button |
| `/lasd26/join?t=<token>` | anyone with the link | sign in with Google, pick RUNNER or CREW, join the team |
| `/lasd26/expenses` | team | every cost and its receipts; add a cost (title, amount, photos), attach receipts, edit/delete your own; the split and each person's share |
| `/lasd26/pay` | owner now; team once settling up is open | your share, PayPal / card, "paid" state |
| `/lasd26/team` | owner | the invite link (copy / rotate), members, mark paid by hand, split count, open settling up |
| `/lasd26/the-list` | owner (DEV) | the crew-call applications |

## How it works

- **Sign-in** is Google through next-auth, the same account table as the
  rest of the site. The owner (role `owner`) sees everything; a member is a
  `TeamMember` row (team `lasd26`, role runner|crew) created by the invite.
- **The invite link** is `/lasd26/join?t=<token>`; the owner makes it on
  `/lasd26/team` and drops it in the group chat. Making a new link retires
  the old one. Nothing else lets someone join.
- **Expenses** are `TeamExpense` rows in cents, seeded from the cost sheet
  by `scripts/lasd26-seed-expenses.ts` (race entry, hotel, Airbnb, two vans,
  gas and food as estimates). Receipts are uploaded straight to R2 with a
  presigned PUT, registered, thumbnailed with sharp, and served through a
  membership-checked redirect, so they are private to the team. The gas
  receipt is whoever filled up: any member can attach to any line, and
  remove what they attached; a line is edited or deleted by whoever added it
  or the owner.
- **The split** is a setting (18, the cost sheet's team size), not the
  member count, so the per-person number holds while people join. Each
  share is the total divided by it, rounded up to the cent.
- **Settling up**: the pay button is owner-only until the owner flips
  "Settle up open to everyone" on `/lasd26/team`. Payment is PayPal (card as
  a guest), the photo shop's connection; a capture below the share does not
  settle it. Cash or Venmo: the owner marks the member paid by hand.
- **Colours**: the Just Friends lime `#D0F858` is the fill and the accent on
  dark ground; on the cream paper, text and thin borders use the deep green
  `#3C7A0B` (`--safety` / `--safety-ink` in `src/app/lasd26/theme.ts`).

## Setting it up

1. Push the schema once (`npm run prisma:push`) — the `Team*` tables.
2. `npx dotenv -e .env.local -- tsx scripts/lasd26-seed-expenses.ts` — the
   seven cost-sheet lines and the split of 18 (idempotent).
3. Open `/lasd26/team`, make the invite link, send it.
4. Env: `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `PAYPAL_*` (already set for the
   shop) and the R2 keys (already set) are all it needs.

Code: `src/app/lasd26/**` (pages, `LasdPage`/`LasdBar`/`LasdAccount`,
`theme.ts`), `src/app/api/lasd26/{team,expenses,pay}/**`,
`src/lib/lasd26/{team,money,expenses,receipts,settle}.ts`, models at the end
of `prisma/schema.prisma`.
