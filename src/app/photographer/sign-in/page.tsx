import { Headline } from "@/components/runner/Headline";
import { isSiteGateOn } from "@/lib/siteGate";
import { GoogleSignInButton } from "./GoogleSignInButton";

// Copy depends on the live gate state, so render per-request rather than
// baking the build-time value into static HTML.
export const dynamic = "force-dynamic";

/**
 * Sign-in screen. Wears two hats depending on the site gate (see siteGate.ts):
 *
 *   - Gate ON  (private preview): the door to the whole site. The one allowed
 *     account signs in here; everyone else is redirected here by middleware.
 *   - Gate OFF (public site): back to its original job — photographers sign in
 *     to upload.
 */
export default function SignInPage() {
  const gateOn = isSiteGateOn();

  const eyebrow = gateOn ? "Private preview" : "Photographer access";
  const headlineText = gateOn ? "In private preview." : "Sign in to upload.";
  const headlineAccent = gateOn ? "private preview." : "upload.";
  const blurb = gateOn
    ? "Mikian.Photos isn’t open to the public yet. Sign in to continue."
    : "Photographers shooting Mikian events use their Google account to upload, credit, and manage their photos.";

  return (
    <main className="screen" style={{ padding: "96px 24px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "var(--muted)",
            marginBottom: 14,
          }}
        >
          {eyebrow}
        </div>
        <Headline
          as="h1"
          text={headlineText}
          accent={headlineAccent}
          style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: 40,
            letterSpacing: "-.015em",
            lineHeight: 1.05,
            color: "var(--ink)",
          }}
        />
        <p style={{ color: "var(--muted)", fontSize: 15, marginTop: 16, lineHeight: 1.55 }}>
          {blurb}
        </p>
        <GoogleSignInButton />
        <p style={{ marginTop: 18, color: "var(--muted)", fontSize: 12 }}>
          By signing in you agree to our{" "}
          <a href="/terms">Terms</a> and <a href="/privacy">Privacy</a>.
        </p>
      </div>
    </main>
  );
}
