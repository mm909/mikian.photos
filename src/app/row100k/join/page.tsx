import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { JoinForm } from "./JoinForm";
import { nextRowerNumber } from "./data";
import { joinCss } from "./joinCss";
import { JOIN_PAGE_LIVE } from "./live";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: JOIN_PAGE_LIVE ? "Opt in — Rowtember" : "Opt in (dev) — Rowtember",
  /* A form behind a sign-in: nothing for a search engine either way. */
  robots: { index: false, follow: false },
};

/* THE SIGN-UP PAGE (owner, 2026-10-01: "When we sign in, or sign up, there
 * should be a sign in page. Right now what happens is that when we sign
 * in, we get thrown to the home page, and then there's a form down at the
 * bottom, below the stat page. It should really be: once you log in, it
 * brings you to a dedicated sign up page where you see the information
 * that we filled in, like your name and email address"). One ruled form in
 * three tiers — who you are, who you are on the board, the rest — and one
 * action, OPT IN, which makes the rower and puts them on this month's
 * board in one request (JoinForm.tsx, api/row100k/join). The head is the
 * number they will wear (owner, the same day, for the landing's last
 * words: "welcome, rower one twenty — choose to opt in").
 *
 * WHO SEES WHAT:
 *   signed out            → the sign-in page, and back here after it;
 *   signed in, no entry   → the form;
 *   already a rower       → the front page. There is nothing to sign up
 *                           for twice; their fields are in settings.
 *
 * IN DEVELOPMENT (CLAUDE.md; join/live.ts is the switch): admin-only in
 * production, a 404 for anyone else; open in local dev; "(dev)" in the
 * title; linked from the DEVELOPMENT group of the account menu. An admin
 * is a rower already and would only ever be sent away, so ?preview=1 shows
 * them the page as a new account gets it — their own name and email, the
 * next number — with an OPT IN that sends nothing. The preview is an
 * admin's (and anyone's in local dev); for every other account the query
 * is ignored.
 *
 * NOT IN SCOPE: the birthday and the board are NOT read from the Google
 * account. Google has both (birthday, gender) only behind sensitive OAuth
 * scopes, and asking for a sensitive scope puts an unverified-app warning
 * on the consent screen until Google has reviewed the app. The form asks. */

/* The front page, for the two ways out of here. On rowtember.com the bare
 * domain IS the Rowtember front (middleware.ts onRowtember); on any other
 * host — the old domain, a preview deployment, a laptop — / is the Mikian
 * Musser landing and the front is still /row100k. */
function frontHref(): string {
  try {
    const host = (headers().get("host") ?? "").toLowerCase().split(":")[0];
    return host === "rowtember.com" || host === "www.rowtember.com" ? "/" : "/";
  } catch {
    return "/";
  }
}

export default async function JoinPage({ searchParams }: { searchParams: { preview?: string | string[] } }) {
  const viewer = await resolveViewer();
  if (!JOIN_PAGE_LIVE && process.env.NODE_ENV === "production" && !viewer.isAdmin) notFound();

  if (!viewer.actor) redirect("/sign-in?callbackUrl=%2Fjoin");

  const asked = (Array.isArray(searchParams.preview) ? searchParams.preview[0] : searchParams.preview) === "1";
  const preview = asked && (viewer.isAdmin || process.env.NODE_ENV !== "production");
  const front = frontHref();
  if (viewer.me && !preview) redirect(front);

  const nextNumber = await nextRowerNumber();

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{joinCss}</style>

      {/* The bar a new account gets: signed in, no number yet (in the
       * preview too — the admin keeps their menu, not their chip). */}
      <RowBar signedIn rowerNumber={null} admin={viewer.isAdmin} />

      <section>
        <div className="wrap">
          <JoinForm
            accountName={viewer.actor.name}
            email={viewer.actor.email}
            nextNumber={nextNumber}
            front={front}
            preview={preview}
          />
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
