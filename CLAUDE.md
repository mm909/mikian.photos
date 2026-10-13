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

## The site is mikianmusser.com

Owner, 2026-10-13: "remember that the base URL is mikianmusser.com, not mikian.photos."

The production site is https://mikianmusser.com (Rowtember is https://www.rowtember.com). Give the owner addresses on that host; `mikian.photos` is the repository's name, not the site's.

## Live means on main, gated — never a Vercel preview

Owner, 2026-10-13: "Never send a Vercel preview. Always just make it live, gated behind the admin login."

When the owner says make it live, merge to `main` so it deploys to mikianmusser.com, with the page still wearing the development gate above (admin-only in production). Do not hand him a Vercel preview URL: Google sign-in does not work on preview hosts and the gate 404s him there. A new table still needs `prisma db push` against production, which only the owner can run (`npx dotenv -e .env.proddb.local -- prisma db push`); say so plainly.

## Every sign-up emails the owner

Owner, 2026-10-13: "Give me an email every single time someone signs up."

A sign-up or entry route (Longhorn LMS, the Hyrox board, race day) calls `sendOwnerNotification` on every save — new and updated — and logs, never surfaces, a failed send.
