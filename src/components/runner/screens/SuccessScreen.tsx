"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Headline } from "../Headline";
import { useRunner } from "../RunnerProvider";
import { currentEvent, photoBg, photos as ALL_PHOTOS, type Photo } from "@/lib/data";

type Method = "direct" | "gphotos" | "dropbox";

export function SuccessScreen() {
  const router = useRouter();
  const { order, resetAll } = useRunner();
  const [method, setMethod] = useState<Method>("direct");

  const items = order.items || [];
  const isBundle = items.some((i) => i.kind === "bundle");
  const purchasedIds = new Set(items.flatMap((i) => (i.kind === "single" ? [i.id] : [])));
  const downloadable: Photo[] = isBundle
    ? ALL_PHOTOS
    : ALL_PHOTOS.filter((p) => purchasedIds.has(p.id));
  const n = downloadable.length;

  const btnLabel =
    method === "direct"
      ? n === 1
        ? "Download photo"
        : `Download all (${n}) as zip`
      : `Send all (${n}) to ${method === "gphotos" ? "Google Photos" : "Dropbox"}`;

  if (!order.id) {
    return (
      <main className="screen" style={{ padding: "96px 32px", textAlign: "center" }}>
        <Headline as="h1" text="Order not found." accent="not found."
          style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: 44,
            letterSpacing: "-.015em",
          }} />
        <button className="btn btn--primary btn--lg" onClick={() => router.push("/")} style={{ marginTop: 28 }}>
          Go home →
        </button>
      </main>
    );
  }

  return (
    <main className="screen" style={{ padding: "64px 32px 96px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "var(--green)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 30,
            marginBottom: 24,
          }}
        >
          ✓
        </div>
        <Headline
          as="h1"
          text="You got your photos!"
          accent="your photos!"
          style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: 56,
            letterSpacing: "-.02em",
            lineHeight: 1,
          }}
        />
        <p style={{ marginTop: 18, color: "var(--muted)", fontSize: 16 }}>
          Your receipt and photos are on the way.
        </p>

        <div
          className="order-info"
          style={{
            marginTop: 32,
            background: "var(--cream)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: 22,
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 14,
            textAlign: "left",
          }}
        >
          {(
            [
              ["Order", order.id],
              ["Event", currentEvent.name.join(" ")],
              ["Photos", `${n}`],
              ["Paid", `$${order.amount.toFixed(2)}`],
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                }}
              >
                {k}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 14,
                  color: "var(--ink)",
                  marginTop: 4,
                }}
              >
                {v}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 32, textAlign: "left" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: 10,
            }}
          >
            Delivery method
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {(
              [
                ["direct", "Direct download"],
                ["gphotos", "Google Photos"],
                ["dropbox", "Dropbox"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setMethod(k)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  background: "#fff",
                  border: `1px solid ${method === k ? "var(--accent)" : "var(--line)"}`,
                  borderRadius: 6,
                  fontSize: 14,
                  color: "var(--ink)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    border: `1.5px solid ${method === k ? "var(--accent)" : "var(--line)"}`,
                    position: "relative",
                    background: "#fff",
                    flex: "0 0 auto",
                  }}
                >
                  {method === k && (
                    <span
                      style={{
                        position: "absolute",
                        inset: 3,
                        background: "var(--accent)",
                        borderRadius: "50%",
                      }}
                    />
                  )}
                </span>
                {label}
              </button>
            ))}
          </div>
        </div>

        <button
          className="btn btn--primary btn--lg"
          style={{ marginTop: 28, padding: "16px 28px", fontSize: 16 }}
        >
          ↓ {btnLabel}
        </button>

        <div
          style={{
            marginTop: 36,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: 10,
          }}
        >
          {downloadable.slice(0, 12).map((p) => (
            <div
              key={p.id}
              style={{
                position: "relative",
                aspectRatio: "2/3",
                borderRadius: 4,
                cursor: "pointer",
                background: photoBg(p),
              }}
              title="Click to download this photo"
            >
              <div
                style={{
                  position: "absolute",
                  bottom: 6,
                  right: 6,
                  width: 22,
                  height: 22,
                  background: "rgba(255,255,255,.92)",
                  borderRadius: 3,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  color: "var(--ink)",
                }}
              >
                ↓
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            resetAll();
            router.push("/");
          }}
          style={{
            marginTop: 48,
            background: "transparent",
            border: 0,
            color: "var(--muted)",
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            cursor: "pointer",
            textDecoration: "underline",
            textDecorationColor: "var(--line)",
            textUnderlineOffset: 3,
          }}
        >
          Start over (reset demo)
        </button>
      </div>
    </main>
  );
}
