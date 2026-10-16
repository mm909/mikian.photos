# LASD26 — the crew's site (`/lasd26`, LIVE)

The No Shortcuts Time Trial relay, Santa Monica → San Diego, Fri 2026-10-23,
run with Just Friends LV. The landing is the old crew call (now closed); the
rest is the team's own pages: who is on the crew, what it costs, who paid.
Built 2026-10-15 from the owner's brief, reviewed as a dev copy under
`/lasd26/dev`, and moved up over the old crew-call page on 2026-10-16
(owner: "we are going to make some of this live now"). Live tracking is the
separate tracker under `/track/lasd26` (see TRACKER.md).

**Where it is right now.** LIVE at `/lasd26`. The dev gate, the "(dev)"
title tags and the DEV pill are gone; the landing is indexable, the team
pages stay noindex. Each page keeps its own rule — nothing private opens
because the site did:

| Page | Who | What |
|---|---|---|
| `/lasd26` | everyone | the landing: crew call is closed, the weekend, facts, the countdown; the bar with CREW CALL · EXPENSES and the account button; signed out, one ON THE TEAM → SIGN IN line at the foot; signed in, nothing there |
| `/lasd26/join?t=<token>` | anyone with the link | sign in with Google, pick RUNNER or CREW, join the team |
| `/lasd26/expenses` | the team | every cost and its receipts; add a cost, attach receipts, edit/delete your own; the split and each person's share |
| `/lasd26/pay` | the team once settling up is open (owner before) | your share, card, "paid" state |
| `/lasd26/team` | owner | the invite link (copy / rotate), members, mark paid by hand, split count, open settling up |
| `/lasd26/the-list` | owner | the crew-call applications — the DEVELOPMENT item in the account menu, 404 to anyone else |
| `/lasd26/info` | the team — IN DEVELOPMENT (owner only in production) | the info sheet: addresses, times, who to call; the owner fills it in, members read |
| `/lasd26/route` | the team — IN DEVELOPMENT (owner only in production) | the route, the race's Google My Maps embedded in the site's colours |

**LIVE is hidden** (owner, 2026-10-16: "Let's hide the 'live' page for
now. It's not ready."). The bar has two doors, CREW CALL and EXPENSES; the
tracker (`/track/lasd26`, the runner setup, the crew & van links) is
reachable only from the owner's DEVELOPMENT group in the account menu
(`LasdAccount.tsx`). When the tracker is ready, the third door goes back
into `LasdBar.tsx`.

**The crew call is closed.** `POST /api/lasd26/apply` answers 410 ("Crew
call is closed."); the owner's `DELETE` (the clear button on the list)
still works. Nothing renders the old form.

**The invite link** is `lasdPath("/join")?t=<token>` — `/lasd26/join?t=…`.
The owner makes it on `/lasd26/team` (copy / rotate) and drops it in the
group chat; the token is the only key to the team, and making a new link
retires the old one.

## In development: the info sheet and the route

Both built 2026-10-16 from the owner's notes and NOT live (owner: "put it
behind the dev gate", "again put it behind a dev gate for now"). They wear
the standing rule in CLAUDE.md through `gateLasdDev()` in
`src/lib/lasd26/devGate.ts` — admin-only in production (anyone else gets
the 404 a missing page gives), open on a laptop — `devTitle("…")` puts
"(dev)" in the title, the metadata says noindex, and the only doors are
"Route (dev) →" and "Info sheet (dev) →" in the owner's DEVELOPMENT group of
the account menu (`LasdAccount.tsx`). When the owner says a page is live:
swap the gate for `getTeamViewer()`/`ensureOwnerMember()`, drop the "(dev)"
tag, move the link to the member pages (or a door in `LasdBar.tsx`), and
on the info sheet take the production check off `GET /api/lasd26/info`.

- **The info sheet** (`/lasd26/info`; owner, 2026-10-16: "make a info page
  where we can fill out addresses for airbnb, start line, van pick up etc.
  if you already know any of that please fill it in. I can give the rest.
  What other info would the runners need."). One line per thing a runner
  needs, a `TeamInfoItem` row each (team + key slug, label, value, hint,
  sortOrder). THE LIST IS CODE — `DEFAULT_ITEMS` in `src/lib/lasd26/info.ts`,
  in page order: Race, Race day, Start line, Finish, The weekend, Van
  pick-up, Airbnb, Hotel Friday, Group chat, Crew phones, What to bring,
  Food plan, Phone tracking, Pairs & rotation, Parking at the start,
  Emergency, then three the runners will ask about — Leaving Vegas,
  Exchange points, Money. What the site already knew is typed in (the race,
  the day and start time, Santa Monica Pier, the Thu–Sat plan, a packing
  list, Traccar Client, where the money is); every empty line carries a
  hint. `ensureInfoItems()` seeds the MISSING keys on first read and never
  touches a value, so the owner's text survives any change to the list. The
  page: a mono eyebrow over each value in body type, line breaks kept,
  URLs / @handles / phone numbers / emails made into links, "— not yet —"
  in grey where nothing is typed; the OWNER gets an EDIT pencil per line
  (textarea, SAVE / CANCEL, Ctrl+Enter saves, Escape backs out), a member
  reads. API `/api/lasd26/info`: `GET` (team) the sheet in order; `PATCH`
  (owner) `{ key, value }`, 404 for a key not on the sheet, 4000 characters
  at most. Needs `npm run prisma:push` once for the `TeamInfoItem` table
  (the page shows an empty sheet, not a crash, until then).
- **The route** (`/lasd26/route`; owner, 2026-10-16: "I've attached a
  google maps with the route, embed this route into the site, make it the
  same color scheem at the rest of the site"). The race's Google My Maps
  (`mid=1vsgSOGVJdwgvlBo3dPvUKCsPG6CL998`) embedded on the paper inside the
  site's frame and colours; the official map is the race's and its pins
  (START, the hospitals) are theirs, so the embed is the source of truth
  and the page only frames it.

## How it works

- **Where the site lives** is one constant, `LASD_BASE` in
  `src/lib/lasd26/paths.ts` (`"/lasd26"`). Every link, redirect, sign-in
  callback and the invite link goes through `lasdPath()`, so the site moves
  in one edit. `LASD_ASSETS` names the static files in `public/lasd26`,
  which never move.
- **Sign-in** is Google through next-auth, the same account table as the
  rest of the site. Every page resolves the viewer once with
  `getTeamViewer()` (`src/lib/lasd26/team.ts`). The owner (role `owner`)
  sees everything; a member is a `TeamMember` row (team `lasd26`, role
  runner|crew) created by the invite.
- **Expenses** are `TeamExpense` rows in cents, seeded from the cost sheet
  by `scripts/lasd26-seed-expenses.ts` (race entry, hotel, Airbnb, two vans,
  gas and food as estimates). Receipts are uploaded straight to R2 with a
  presigned PUT, registered, thumbnailed with sharp, and served through a
  membership-checked redirect, so they are private to the team. The gas
  receipt is whoever filled up: any member can attach to any line, and
  remove only what they attached themselves (owner, 2026-10-16: "it's okay
  for them to delete their own but not other people's"); an estimate takes
  no receipts — they go on the real costs under it; a line is edited or
  deleted by whoever added it
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
  `TOTAL_SELECT` (id + parentId + paidById) or it double counts. On the page
  the bucket card lists what is in it and carries "+ ADD A COST"; the
  ESTIMATE chip, the "estimate stands" line and the estimate checkbox are
  the owner's alone (owner, 2026-10-16: "we don't need the estimate line
  visible to the other users, keep that for me") — members see a plain
  category card. Deleting a bucket detaches its live children, which carry
  on as their own lines.
- **Paid by** (owner, 2026-10-16: "instead of having a note just make it a
  'paid by' and auto fill the name of the user logged in"): every real line
  carries `paidById`, the member who fronted it — the add form's PAID BY
  select defaults to the signed-in member; the seeded lines are the
  owner's. Estimates have no payer.
- **The split** is a setting (18, the cost sheet's team size), not the
  member count, so the per-person number holds while people join. Each
  share is the total divided by it.
- **Settling up** (owner, 2026-10-16: "if someone pays for something like
  gas … deduct that from their total … everyone pays their fair share …
  I would have paid x but I already spent y so now I owe z … prevent me
  from having to reimburse someone for them to just pay it back"). Per
  member: share = total ÷ split; fronted = the real lines they paid for;
  net = share − fronted. net > 0: they OWE it; net < 0: the pool OWES them
  and the owner pays them out after the race, then marks them SETTLED;
  net = 0: square (`settlement()` in `money.ts`, `dueFor()` in
  `settle.ts`). Once the owner flips "Settle up open to everyone" on
  `/lasd26/team`, estimates count for nothing and only real costs divide
  (owner: "when I make settle up go live replace the estimate costs with
  the real cost"); until then the pay page is the owner's alone. The pay
  page says it in three rows — YOUR SHARE, YOU FRONTED, YOU OWE / WE OWE
  YOU / ALL SQUARE — and takes a card only (PayPal's card button, the
  photo shop's connection) for the net, never the full share; a capture
  below the net does not settle it. The team console shows SHARE · FRONTED
  · OWES/OWED · PAID per member with Mark paid / Mark settled / Unmark.
- **Colours**: the Just Friends lime `#D0F858` is the fill and the accent on
  dark ground; on the cream paper, text and thin borders use the deep green
  `#3C7A0B` (`--safety` / `--safety-ink` in `src/app/lasd26/theme.ts`). The
  LASD26 chip in the mikianmusser.com bar wears the same lime (`--jf` in
  `src/components/home/theme.ts`).

## Setting it up

1. Push the schema once (`npm run prisma:push`) — the `Team*` tables.
2. `npx dotenv -e .env.local -- tsx scripts/lasd26-seed-expenses.ts` — the
   seven cost-sheet lines and the split of 18 (idempotent).
3. Open `/lasd26/team`, make the invite link, send it.
4. Env: `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `PAYPAL_*` (already set for the
   shop) and the R2 keys (already set) are all it needs.

Code: `src/app/lasd26/**` (pages, `LasdPage`/`LasdBar`/`LasdAccount`,
`SignInLine`, `theme.ts`, the `*Css.ts` files), `src/app/api/lasd26/**`,
`src/lib/lasd26/{paths,team,money,expenses,receipts,settle,info,devGate}.ts`,
models at the end of `prisma/schema.prisma`.
