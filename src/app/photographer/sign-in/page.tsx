"use client";

import { signIn } from "next-auth/react";
import { Headline } from "@/components/runner/Headline";

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
          and manage their photos. Runners don&rsquo;t need an account.
        </p>
        <button
          className="btn btn--primary btn--lg"
          style={{ marginTop: 28, padding: "14px 22px" }}
          onClick={() => signIn("google", { callbackUrl: "/photographer" })}
        >
          Continue with Google
        </button>
        <p style={{ marginTop: 18, color: "var(--muted)", fontSize: 12 }}>
          By signing in you agree to our{" "}
          <a href="/terms">Terms</a> and <a href="/privacy">Privacy</a>.
        </p>
      </div>
    </main>
  );
}
