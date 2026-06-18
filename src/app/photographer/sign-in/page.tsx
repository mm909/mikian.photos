import { Headline } from "@/components/runner/Headline";
import { GoogleSignInButton } from "./GoogleSignInButton";

/**
 * Generic sign-in screen. (v2.1: the whole-site gate is gone, so there's a
 * single mode — anyone can sign in with Google to manage orders or, if granted,
 * to upload.)
 */
export default function SignInPage() {
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
          Sign in
        </div>
        <Headline
          as="h1"
          text="Sign in to Mikian.Photos."
          accent="Mikian.Photos."
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
          Use your Google account to find your orders — and, if you&rsquo;re a photographer on
          an event, to upload and manage your photos.
        </p>
        <GoogleSignInButton />
        <p style={{ marginTop: 18, color: "var(--muted)", fontSize: 12 }}>
          By signing in you agree to our <a href="/terms">Terms</a> and{" "}
          <a href="/privacy">Privacy</a>.
        </p>
      </div>
    </main>
  );
}
