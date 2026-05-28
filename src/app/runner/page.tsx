import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { formatOrderNumber } from "@/lib/orderId";
import { Headline } from "@/components/runner/Headline";

/**
 * /runner — signed-in runner dashboard.
 *
 * Mirrors /photographer (server gate → server-rendered overview). Lists
 * orders linked to this account by either:
 *   - `userId` match (linked at capture time when the buyer was signed-in)
 *   - email match (catches the case where someone bought as guest then
 *     signed in later with the same email)
 *
 * Not signed in → /api/auth/signin with callback back here.
 */
export default async function RunnerDashboardPage() {
  const actor = await getEffectiveActor();
  if (!actor) {
    redirect("/api/auth/signin?callbackUrl=" + encodeURIComponent("/runner"));
  }

  const email = actor.email.toLowerCase();
  const orders = await db.order.findMany({
    where: {
      OR: [{ userId: actor.photographerId }, { email: { equals: email, mode: "insensitive" } }],
    },
    orderBy: { paidAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      paidAt: true,
      amount: true,
      kind: true,
      eventIdCovered: true,
      photoIds: true,
      downloadToken: true,
    },
  });

  // Hydrate event names in one query so the table doesn't N+1.
  const eventIds = Array.from(
    new Set(orders.map((o) => o.eventIdCovered).filter((x): x is string => !!x))
  );
  const events =
    eventIds.length > 0
      ? await db.event.findMany({
          where: { id: { in: eventIds } },
          select: { id: true, name: true },
        })
      : [];
  const eventNameById = new Map(events.map((e) => [e.id, e.name]));

  const firstName = actor.name.split(" ")[0] || actor.name;

  return (
    <main className="screen" style={{ padding: "48px 24px 96px" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 18,
            flexWrap: "wrap",
            marginBottom: 32,
          }}
        >
          <div>
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
              Runner · {actor.email}
            </div>
            <Headline
              as="h1"
              text={`Hi, ${firstName}.`}
              accent={firstName}
              style={{
                margin: 0,
                fontFamily: "var(--font-serif)",
                fontWeight: 500,
                fontSize: 44,
                letterSpacing: "-.018em",
              }}
            />
          </div>
          <Link href="/" className="btn btn--ghost">
            Browse races →
          </Link>
        </div>

        <h2
          style={{
            margin: "0 0 14px",
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: 24,
            color: "var(--ink)",
          }}
        >
          Your orders
        </h2>

        {orders.length === 0 ? (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              background: "var(--cream)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              color: "var(--muted)",
              fontSize: 15,
            }}
          >
            <p style={{ margin: "0 0 14px", color: "var(--muted)" }}>
              No orders yet. When you buy photos from one of your races they
              show up here.
            </p>
            <Link href="/" className="btn btn--primary">
              Find your photos →
            </Link>
          </div>
        ) : (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "140px 1fr 100px 110px 120px",
                gap: 12,
                padding: "14px 18px",
                background: "var(--cream)",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--muted)",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <span>Order</span>
              <span>Event</span>
              <span style={{ textAlign: "right" }}>Photos</span>
              <span style={{ textAlign: "right" }}>Amount</span>
              <span style={{ textAlign: "right" }}>Date</span>
            </div>
            {orders.map((o) => {
              const orderStr = formatOrderNumber(o.orderNumber);
              const href = `/orders/${orderStr}`;
              const eventName = o.eventIdCovered
                ? eventNameById.get(o.eventIdCovered) ?? "—"
                : "—";
              return (
                <Link
                  key={o.id}
                  href={href}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "140px 1fr 100px 110px 120px",
                    gap: 12,
                    padding: "14px 18px",
                    borderBottom: "1px solid var(--line)",
                    textDecoration: "none",
                    color: "var(--ink)",
                    fontSize: 14,
                    transition: "background 0.12s",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      letterSpacing: ".06em",
                    }}
                  >
                    {orderStr}
                  </span>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {eventName}
                  </span>
                  <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--muted)" }}>
                    {o.photoIds.length}
                  </span>
                  <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    ${o.amount.toFixed(2)}
                  </span>
                  <span style={{ textAlign: "right", color: "var(--muted)", fontSize: 13 }}>
                    {o.paidAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

