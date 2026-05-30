import { Headline } from "@/components/runner/Headline";
import { isSiteGateOn } from "@/lib/siteGate";
import { GoogleSignInButton } from "./GoogleSignInButton";

// Copy depends on the live gate state, so render per-request rather than
// baking the build-time value into static HTML.
export const dynamic = "force-dynamic";

/**
 * Sign-in screen, two modes depending on the site gate (see siteGate.ts):
 *
 *   - Gate ON  (private preview): Mikian is the only account allowed in, so the
 *     page is just the "Continue with Google" button — no explanatory copy.
 *   - Gate OFF (public site): the photographer sign-in, with onboarding copy.
 */
export default function SignInPage() {
  const gateOn = isSiteGateOn();

  return (
    <main className="screen" style={{ padding: "96px 24px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
        {gateOn ? (
          <GoogleSignInButton />
        ) : (
          <>
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
              Photographer access
            </div>
            <Headline
              as="h1"
              text="Sign in to upload."
              accent="upload."
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
              Photographers shooting Mikian events use their Google account to upload, credit,
              and manage their photos.
            </p>
            <GoogleSignInButton />
            <p style={{ marginTop: 18, color: "var(--muted)", fontSize: 12 }}>
              By signing in you agree to our{" "}
              <a href="/terms">Terms</a> and <a href="/privacy">Privacy</a>.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
