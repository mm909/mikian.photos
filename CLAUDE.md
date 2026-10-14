# Working rules for this repo

Owner rules that outlast any one task. Add to this list when the owner states a standing rule; quote the owner and date it, as the code comments do.

## New pages start in development

Owner, 2026-10-01: "By default, when there's a new page like that, put it in development unless I say so."

A new page under `/row100k` is not live until the owner says it is. In development means the same gate the other dev pages wear (`src/app/row100k/dev/*`, `shirts/page.tsx`):

- admin-only in production: `if (process.env.NODE_ENV === "production" && !viewer.isAdmin) notFound();` at the top of the page, open in local dev
- `robots: { index: false, follow: false }` in the metadata, and `(dev)` in the title
- linked only from the DEVELOPMENT group of the account menu (`BarAccount.tsx`), never from the rower group, the rail or the landing
- any API route that only that page writes through wears the same gate

When the owner says a page goes live, lift the gate, drop the `(dev)` tag and move the link.

## Two hosts: mikianmusser.com and rowtember.com

Owner, 2026-10-13: "remember that the base URL is mikianmusser.com, not mikian.photos"; "we separate: there's mikianmusser.com, there's also rowtember.com that hosts the Rowtember sites."

The production site is https://mikianmusser.com; Rowtember lives at https://www.rowtember.com, and the middleware sends every /row100k path on mikianmusser.com there. A Google session belongs to its host, so being signed in on one says nothing about the other. Give the owner addresses on the right host; `mikian.photos` is the repository's name, not the site's.

## Live means merged to main — never a Vercel preview

Owner, 2026-10-13: "Never send a Vercel preview. Always just make it live." Later the same day, on the Hyrox board: "let's just make it live so there's no more gated behind admin or anything like that."

When the owner says make it live, merge to `main` so it deploys to mikianmusser.com, lift the development gate, drop the `(dev)` tag and put the link where the public finds it. Do not hand him a Vercel preview URL: Google sign-in does not work on preview hosts. A new table reaches production through the build (`scripts/db-push-prod.mjs`: `prisma db push` on a production deploy only, never with `--accept-data-loss`); a change that would drop data fails that build on purpose and is the owner's to run by hand.

## Every sign-up emails the owner

Owner, 2026-10-13: "Give me an email every single time someone signs up."

A sign-up or entry route (Longhorn LMS, the Hyrox board, race day) calls `sendOwnerNotification` on every save — new and updated — and logs, never surfaces, a failed send.

## No address on a sticker

Owner, 2026-10-14: "Never put mikianmusser.com on any stickers unless I ask for it."

A sticker or shareable card (the Hyrox cards in `src/app/hyrox/[event]/stickerPaint.ts`, the roster pages, anything painted on a canvas to be posted) carries no site address, no handle and no URL unless the owner asks for one on that card. The page's own footer is not a sticker.
