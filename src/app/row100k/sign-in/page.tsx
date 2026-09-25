import type { Metadata } from "next";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { SignInControl } from "./SignInControl";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in — Rowtember",
  robots: { index: false, follow: false },
};

/* Rowtember's own sign-in page. next-auth sends every failed or cancelled
 * Google sign-in to pages.signIn (src/lib/auth.ts), which used to be the
 * race-photo page — owner, 2026-09-25: "A failed or cancelled Google
 * sign-in strands the stranger on a race-photo page ... It looks like the
 * wrong website. Give Rowtember its own sign-in/error page and print the
 * error as 'Google sign-in didn't finish — try again.'" One headline, one
 * mono line, one control; the error code in ?error= is never printed, only
 * that quiet line. */

const signInCss = `
.row100k .si{max-width:560px;margin:0 auto;padding:40px 0 70px}
.row100k .si-line{margin-top:12px;font-family:var(--row-mono),monospace;font-size:12px;letter-spacing:.1em;line-height:1.5;text-transform:uppercase;color:var(--gray)}
.row100k .si-err{margin-top:28px;padding:10px 0;border-top:1px dotted var(--line);border-bottom:1px dotted var(--line);font-family:var(--row-mono),monospace;font-size:12px;letter-spacing:.06em;line-height:1.5;text-transform:uppercase;color:var(--ink)}
.row100k .si-go{display:inline-block;margin-top:30px;background:none;border:none;padding:0;cursor:pointer;font-family:var(--row-archivo-black),sans-serif;font-size:clamp(22px,5vw,34px);line-height:1;letter-spacing:-.01em;text-transform:uppercase;color:var(--ink);text-decoration:underline dotted;text-decoration-color:var(--water);text-decoration-thickness:.08em;text-underline-offset:.14em;text-decoration-skip-ink:none;transition:color 160ms ease}
.row100k .si-go:hover{color:var(--water)}
`;

/* Only a same-site path may be the destination: anything else (a full URL,
 * a protocol-relative one) falls back to the front page. */
function safeCallback(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v || !v.startsWith("/") || v.startsWith("//")) return "/row100k";
  return v;
}

export default function SignInPage({
  searchParams,
}: {
  searchParams: { error?: string | string[]; callbackUrl?: string | string[] };
}) {
  const callbackUrl = safeCallback(searchParams.callbackUrl);
  const failed = Boolean(Array.isArray(searchParams.error) ? searchParams.error[0] : searchParams.error);

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{signInCss}</style>

      <RowBar />

      <section>
        <div className="wrap">
          <div className="si">
            <div className="sec-head">
              <h2>Sign in</h2>
            </div>
            <p className="si-line">With your Google account · free · one minute</p>
            {failed ? <p className="si-err">Google sign-in didn&rsquo;t finish — try again.</p> : null}
            <SignInControl callbackUrl={callbackUrl} />
          </div>
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
