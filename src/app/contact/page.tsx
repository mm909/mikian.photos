"use client";

import { useState } from "react";
import { Headline } from "@/components/runner/Headline";

/**
 * Simple contact / "work with us" landing (v2.1) — replaces the unfinished
 * race-director page. For photographers, race directors, or anyone who wants to
 * sell their photos through Mikian.Photos. Posts to /api/contact (emails owner).
 */
export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const field: React.CSSProperties = {
    display: "block",
    width: "100%",
    padding: "10px 12px",
    border: "1px solid var(--line)",
    borderRadius: 8,
    fontSize: 15,
    color: "var(--ink)",
    background: "var(--paper, #fff)",
  };

  async function submit() {
    if (!message.trim()) {
      setError("Please include a message.");
      return;
    }
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || `HTTP ${res.status}`);
      }
      setState("sent");
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <main className="screen" style={{ padding: "72px 24px 120px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: ".16em",
            textTransform: "uppercase",
            color: "var(--muted)",
            marginBottom: 16,
          }}
        >
          Work with us
        </div>
        <Headline
          as="h1"
          text="Sell your photos with Mikian.Photos."
          accent="Mikian.Photos."
          style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: "clamp(32px, 4.5vw, 48px)",
            lineHeight: 1.05,
            letterSpacing: "-.018em",
            color: "var(--ink)",
          }}
        />
        <p style={{ color: "var(--muted)", fontSize: 16, lineHeight: 1.6, marginTop: 16 }}>
          Shooting a race, a wedding, a camp, a club, or a product line? We host your gallery,
          handle search and delivery, and you keep selling. Tell us about your event and we&rsquo;ll
          be in touch.
        </p>

        {state === "sent" ? (
          <div
            style={{
              marginTop: 28,
              padding: 20,
              border: "1px solid var(--line)",
              borderRadius: 10,
              background: "var(--cream)",
              color: "var(--ink)",
            }}
          >
            Thanks — your message is on its way. We&rsquo;ll get back to you soon.
          </div>
        ) : (
          <div style={{ marginTop: 28, display: "grid", gap: 14 }}>
            <input
              style={field}
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              style={field}
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <textarea
              style={{ ...field, minHeight: 140, resize: "vertical" }}
              placeholder="Tell us about your event…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            {error && <div style={{ color: "var(--accent)", fontSize: 13 }}>{error}</div>}
            <div>
              <button
                className="btn btn--primary btn--lg"
                disabled={state === "sending"}
                onClick={() => void submit()}
              >
                {state === "sending" ? "Sending…" : "Send message"}
              </button>
            </div>
            <p style={{ color: "var(--muted)", fontSize: 13 }}>
              Or email us directly at{" "}
              <a href="mailto:mikian.photos@gmail.com">mikian.photos@gmail.com</a>.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
