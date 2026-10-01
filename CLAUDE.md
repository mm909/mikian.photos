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
