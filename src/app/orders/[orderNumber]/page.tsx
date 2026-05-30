import Link from "next/link";
import { db } from "@/lib/db";
import { getOrderForViewer } from "@/lib/orderAccess";
import { formatOrderNumber } from "@/lib/orderId";
import { Headline } from "@/components/runner/Headline";
import { OrderPhotoGrid } from "@/components/runner/OrderPhotoGrid";
import { prices } from "@/lib/data";

/**
 * /orders/[orderNumber]
 *
 * Three ways to reach this page:
 *   - Signed-in user whose email matches the order — main entry from /runner.
 *   - Owner — for support.
 *   - Anyone with the ?key=<downloadToken> from the receipt email.
 *
 * Server-rendered: we resolve access on the server so the page either
 * displays the full receipt + photo grid, or a friendly "sign in / no access"
 * message. No client-side flash of unauthorized content.
 */
export default async function OrderPage({
  params,
  searchParams,
}: {
  params: { orderNumber: string };
  searchParams: { key?: string };
}) {
  const access = await getOrderForViewer(params.orderNumber, searchParams.key ?? null);

  if (!access.ok) {
    return <OrderUnavailable reason={access.reason} />;
  }

  const order = access.order;
  const downloadToken = order.downloadToken ?? "";

  // Pull event + photos for display.
  const [event, photos] = await Promise.all([
    order.eventIdCovered
      ? db.event.findUnique({
          where: { id: order.eventIdCovered },
          select: { id: true, name: true, city: true, date: true },
        })
      : Promise.resolve(null),
    db.photo.findMany({
      where: { id: { in: order.photoIds } },
      select: { id: true, mile: true, takenAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const eventName = event?.name ?? "Mikian.Photos order";
  const subtotal = +(order.amount - (order.amount * prices.stripeRate + prices.stripeFlat)).toFixed(2);
  const processingFee = +(order.amount - Math.max(subtotal, 0)).toFixed(2);

  return (
    <main className="screen" style={{ padding: "48px 24px 96px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: 6,
            }}
          >
            Order {formatOrderNumber(order.orderNumber)} ·{" "}
            {access.via === "owner"
              ? "Viewing as owner"
              : access.via === "token"
                ? "Magic link"
                : "Signed in"}
          </div>
          <Headline
            as="h1"
            text="Your photos are ready."
            accent="ready."
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              fontSize: 44,
              letterSpacing: "-.018em",
            }}
          />
        </div>

        {/* Receipt summary card */}
        <section
          aria-label="Receipt"
          style={{
            background: "var(--cream)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: 28,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: 14,
            }}
          >
            Receipt
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 18,
              marginBottom: 22,
            }}
          >
            <KV label="Order" value={formatOrderNumber(order.orderNumber)} />
            <KV label="Date" value={fmtDate(order.paidAt)} />
            <KV label="Email" value={order.email} muted />
            <KV label="Event" value={eventName} />
            <KV label="Photos" value={`${order.photoIds.length} included`} />
            <KV label="Total paid" value={`$${order.amount.toFixed(2)}`} strong />
          </div>

          {/* Line items */}
          <div
            style={{
              borderTop: "1px solid var(--line)",
              paddingTop: 14,
              fontSize: 14,
              color: "var(--ink)",
            }}
          >
            <SumRow
              label={`All photos bundle · ${eventName}`}
              value={`$${Math.max(subtotal, 0).toFixed(2)}`}
            />
            <SumRow
              label="Processing fee"
              value={`$${Math.max(processingFee, 0).toFixed(2)}`}
              muted
            />
            <SumRow label="Total paid" value={`$${order.amount.toFixed(2)}`} strong />
          </div>
        </section>

        {/* Photo grid + download */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 18,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              fontSize: 24,
              color: "var(--ink)",
            }}
          >
            Your {order.photoIds.length} photos
          </h2>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            Click a photo to download · full resolution
          </div>
        </div>

        {photos.length === 0 ? (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              background: "var(--cream)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              color: "var(--muted)",
            }}
          >
            No photos found for this order. Something looks wrong — reply to
            your receipt email and we&rsquo;ll sort it.
          </div>
        ) : (
          <OrderPhotoGrid
            photos={photos.map((p) => ({ id: p.id }))}
            downloadToken={downloadToken}
            orderNumber={order.orderNumber}
            dropboxAppKey={process.env.NEXT_PUBLIC_DROPBOX_APP_KEY}
          />
        )}

        {/* Footer link out */}
        <div style={{ marginTop: 48, fontSize: 13, color: "var(--muted)" }}>
          Something off?{" "}
          <a
            href="mailto:mikian.photos@gmail.com"
            style={{ color: "var(--ink)", textDecoration: "underline" }}
          >
            mikian.photos@gmail.com
          </a>
          {access.via !== "token" && (
            <>
              {" "}
              ·{" "}
              <Link href="/runner" style={{ color: "var(--ink)" }}>
                ← All your orders
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function OrderUnavailable({ reason }: { reason: "not-found" | "forbidden" }) {
  const isForbidden = reason === "forbidden";
  return (
    <main className="screen" style={{ padding: "96px 24px" }}>
      <div style={{ maxWidth: 540, margin: "0 auto", textAlign: "center" }}>
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
          {isForbidden ? "Sign-in required" : "Order not found"}
        </div>
        <Headline
          as="h1"
          text={
            isForbidden ? "We can't show this order." : "That order doesn't exist."
          }
          accent={isForbidden ? "can't" : "doesn't exist."}
          style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: 36,
            letterSpacing: "-.015em",
          }}
        />
        <p style={{ color: "var(--muted)", fontSize: 15, marginTop: 18 }}>
          {isForbidden
            ? "This order belongs to a different account, or your magic link has expired. Sign in with the email you used at checkout, or look up the link in your receipt email."
            : "Double-check the order number from your receipt email. If it still doesn't load, reply to the email and we'll sort it out."}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 26 }}>
          <Link href="/" className="btn btn--ghost">
            Back to home
          </Link>
          <a
            href="mailto:mikian.photos@gmail.com"
            className="btn btn--primary"
            style={{ textDecoration: "none" }}
          >
            Email support
          </a>
        </div>
      </div>
    </main>
  );
}

function KV({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--muted)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: strong ? "var(--font-serif)" : "var(--font-sans)",
          fontSize: strong ? 22 : 15,
          fontWeight: strong ? 500 : 400,
          color: muted ? "var(--muted)" : "var(--ink)",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SumRow({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "8px 0",
        color: muted ? "var(--muted)" : "var(--ink)",
        fontFamily: strong ? "var(--font-serif)" : "inherit",
        fontSize: strong ? 18 : 14,
        fontWeight: strong ? 500 : 400,
        borderTop: strong ? "1px solid var(--line)" : "none",
        marginTop: strong ? 6 : 0,
      }}
    >
      <span>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

function fmtDate(d: Date): string {
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
