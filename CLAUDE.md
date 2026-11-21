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

## The site is cream, in the Rowtember water blue, for every edition — never dark by default

Owner, 2026-11-14, of the erg saved-session page (cream paper, ink type, the big time in the water blue): "I really like the look of this page. It's good text size and font and blue color. Let's make Rowtember and Rowvember that color. We should keep it the same. Update the graphics and logos accordingly."

The default look is `paper` and the default palette is `paper-water` (`src/lib/rowSettings.ts`, `src/lib/rowPalette.ts`): `#0077B6` on cream, `#1A90D4` where the accent sits on ink. Every edition wears it, Rowvember included — the V of the Rowvember mark, the link card, the carousel cards and the reel graphics are that blue, and a new edition does not get a colour of its own unless the owner asks. History in one sentence: the owner pulled the site off the black look on 2026-10-30 ("Why is the site dark bro. Fix that.") and it wore a fall brown from that day until 2026-11-14; the brown stays a preset he can pick on the settings page. A look or palette row saved on the settings page before 2026-11-14 is ignored (`COSMETIC_EPOCH_MS`), never deleted. Do not make ink the default again unless the owner says so; he can still pick it on the settings page.

## A month with a name is an edition, and "reset" never deletes

Owner, 2026-10-30: "I need a rowvember new logo and kick off everything that is needed to reset the site (get ready for) ROWVEMBER"; "When I say reset I mean make sure we are prepared for next month. I obviously don't want any data deleted."

September is Rowtember and November is Rowvember (`src/lib/rowPeriod.ts` EDITIONS); the nameplate, the wordmark (`src/app/row100k/Mark.tsx`), the default row title and the mark on every share card read the edition off there, and a new one is a line in that table. Getting ready for a month means code and assets — never a delete, a truncate or a `--clear` against the live database. The Rowvember logo files live in `public/row100k/rowvember/`; the link card is `public/row100k/og-rowvember.png` (drawn by `scripts/og-rowvember.html`, rendered by `scripts/og-render.mjs`).

## Months wear their normal names; only shareables say ROW or ROWTEMBER

Owner, 2026-11-20: "Lets also move to just normal month names, the event/app is rowtember but the months can be just september, november."; "Month names can revert to the normal month spelling, except for shareables, they should be ROW or ROWTEMBER."

This replaces the naming half of the edition rule above: a month is September or November on the site and in the app, and ROWVEMBER is retired as a name. A shareable (a card, a poster, a reel) is signed ROW or ROWTEMBER; of the two, the owner picked ROW the same day ("Lets try it w/ just ROW"), and the share cards carry it (`MARK` in `src/app/row100k/share/cards.ts`). The "reset never deletes" half of that rule stands. As of 2026-11-20 the code still carries the Rowvember nameplate and assets; changing them is a task the owner has not yet started.

## The phone app follows the website, and is in development

Owner, 2026-11-20, of the phone app in `mobile/`: "I would strongly encourage you to review the current site for style guides and UI/UX ... those things we have already iterated on while designing the website can come over." And 2026-11-21, after an app screen grew a big blue callout the site's board does not have: "please reference the website before you try to redesign a UI."

Before building or changing an app screen, open the site's version of it and bring that over; add nothing the site's page does not have unless he asks. For the app's own frame (the bars, where a button lives) his reference is Instagram: "I really like how Instagram's app is set up" (plus top left, the mark in the middle, the bell top right, glyphs at the bottom). His decisions are kept in `mobile/DESIGN.md`; read it first and add to it.

The app is not live. Its web build (`public/row100k/app/`, rebuilt by `npm run export:web` in `mobile/`) is unlisted, and the routes only the app writes through answer admins only in production (`SOCIAL_LIVE` in `src/app/api/row100k/app/social.ts`). "Push it live" from him, of the app, means merge to main so he can open that build on his phone; it does not lift the gate.

### His installed build takes new code over the air; say when it needs a rebuild

Owner, 2026-11-21, asked whether every change needs `eas build` again: "lets do this and make sure to tell me if i need to re run".

The installed app fetches new code as it opens (`expo-updates`, `mobile/src/ota.ts`; the build's channel is its profile's name in `mobile/eas.json`, his phone wears `preview`). After a push that changes the app, publish it from `mobile/`: `npx eas-cli@latest update --channel preview --message "<the commit's subject>"`. That reaches only a build of the same runtime version, which is the `version` in `mobile/app.json`.

A change the bundle cannot carry needs a new build from him: a native module added, removed or upgraded (anything in `package.json` with native code), a plugin, permission, icon, scheme or anything else in `app.json`, an Expo SDK bump. When a batch has one, raise `version` in `app.json` in the same commit, so the old build does not take code it cannot run, and tell him in the closing message, in so many words, that he must run `npx eas-cli@latest build --profile preview --platform ios` and install the result. When a batch has none, say that no rebuild is needed.

## The logo is ROW, the O in the blue

Owner, 2026-11-14: "let's change our logo to row with the o in the Rowtemeber color."

The site signs itself ROW, the O in the accent (`Logo` in `src/app/row100k/Mark.tsx`): the bar and the footer, in every month. The edition's name (ROWTEMBER, ROWVEMBER; `Mark`, `MARK`) still names the month on the front nameplate and on the share cards. The logo files live in `public/row100k/row/` (drawn by `scripts/row-logo.html`); the phone app in `mobile/` wears the same mark and icon.
