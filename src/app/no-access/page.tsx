"use client";

import { signOut, useSession } from "next-auth/react";
import { Headline } from "@/components/runner/Headline";

/**
 * Where the site gate sends a visitor who IS signed in with Google but with an
 * account that isn't the one allowed in. Gives them a way to sign out and try
 * the right account. Allow-listed in `src/middleware.ts` so it renders even
 * while the gate is on.
 */
export default function NoAccessPage() {
  const { data: session } = useSession();
  const email = session?.user?.email;

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
          Private preview
        </div>
        <Headline
          as="h1"
          text="This site isn't open yet."
          accent="open yet."
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
          Mikian.Photos is still in private preview.
          {email ? (
            <>
              {" "}
              You&rsquo;re signed in as <strong>{email}</strong>, which isn&rsquo;t the
              account that has access.
            </>
          ) : null}
        </p>
        <button
          className="btn btn--primary btn--lg"
          style={{ marginTop: 28, padding: "14px 22px" }}
          onClick={() => signOut({ callbackUrl: "/photographer/sign-in" })}
        >
          Sign out and try another account
        </button>
      </div>
    </main>
  );
}
