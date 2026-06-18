import Link from "next/link";
import type { Metadata } from "next";
import { listEvents } from "@/lib/events";

/**
 * Marketing homepage. With v2 multi-event, "/" is a branded hub: a short hero
 * plus a directory of the current PUBLIC events (each linking to /e/[slug]).
 * Secure-link, account-only, and draft events are never listed here.
 *
 * (Pre-v2 this route was the single-event runner flow; that now lives at
 * /e/[slug].)
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mikian.Photos",
  description: "Find your photos. Search by bib, scan your face, or browse the gallery.",
};

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const LABEL: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: ".16em",
  textTransform: "uppercase",
  color: "var(--muted)",
};

export default async function HomePage() {
  const events = await listEvents({ publicOnly: true });

  return (
    <main className="screen" style={{ padding: "80px 24px 120px" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ ...LABEL, marginBottom: 18 }}>Mikian.Photos</div>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              fontSize: "clamp(40px, 6vw, 72px)",
              lineHeight: 1.02,
              letterSpacing: "-.02em",
              color: "var(--ink)",
              textWrap: "balance" as React.CSSProperties["textWrap"],
            }}
          >
            Find your photos.
          </h1>
          <p
            style={{
              color: "var(--muted)",
              fontSize: 18,
              lineHeight: 1.55,
              maxWidth: 560,
              margin: "20px auto 0",
            }}
          >
            Search by bib, scan your face, or browse the gallery — your
            full-resolution photos, ready to download.
          </p>
        </div>

        {/* Event directory */}
        {events.length > 0 ? (
          <>
            <div style={{ ...LABEL, marginBottom: 18 }}>
              {events.length === 1 ? "Current event" : "Current events"}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 16,
              }}
            >
              {events.map((ev) => (
                <Link
                  key={ev.id}
                  href={`/e/${ev.id}`}
                  style={{
                    display: "block",
                    background: "var(--cream)",
                    border: "1px solid var(--line)",
                    borderRadius: 12,
                    padding: 24,
                    textDecoration: "none",
                    color: "var(--ink)",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontWeight: 500,
                      fontSize: 24,
                      letterSpacing: "-.01em",
                      lineHeight: 1.1,
                    }}
                  >
                    {ev.name}
                  </div>
                  <div style={{ ...LABEL, marginTop: 12, letterSpacing: ".1em" }}>
                    {fmtDate(ev.date)} · {ev.city}
                  </div>
                  <div
                    style={{
                      marginTop: 18,
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      letterSpacing: ".08em",
                      textTransform: "uppercase",
                      color: "var(--accent)",
                    }}
                  >
                    Find your photos →
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div
            style={{
              textAlign: "center",
              color: "var(--muted)",
              fontSize: 16,
              padding: "40px 0",
            }}
          >
            No public events yet — check back soon.
          </div>
        )}

        {/* Race-director CTA */}
        <div style={{ textAlign: "center", marginTop: 64 }}>
          <Link
            href="/contact"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            Sell your photos? Work with us →
          </Link>
        </div>
      </div>
    </main>
  );
}
