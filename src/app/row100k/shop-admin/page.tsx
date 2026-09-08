import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { boxLine, shirtCounts } from "../shirt";
import { listShirtOrders, type ShirtOrderRow } from "../shirtOrders";
import { OrdersPanel } from "./OrdersPanel";
import { SettlePanel } from "./SettlePanel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop administration — 100K September",
  robots: { index: false, follow: false },
};

/* SHOP ADMINISTRATION — admin only (owner, 2026-09-08: "the orders and
 * settle-the-month should be moved to their own page — shop administration.
 * The shirts page is just what users see"). The shelf as the boxes compute
 * it, every shirt on the books with MARK DELIVERED, and the month-end
 * settlement. The rest of the world gets a 404, the same gate as the other
 * admin pages; the buy page is /row100k/dev/shirts. Real numbers always —
 * this is the owner's ledger, so the blackout never touches it. */
export default async function ShopAdminPage() {
  const viewer = await resolveViewer();
  if (!viewer.actor || !viewer.isAdmin) notFound();

  let orders: ShirtOrderRow[] = [];
  let unreadable = false;
  try {
    orders = await listShirtOrders();
  } catch (err) {
    console.error("row100k/shop-admin: failed to load the orders (table pushed?)", err);
    unreadable = true;
  }

  const live = orders.filter((o) => o.status !== "cancelled");
  const counts = shirtCounts(live);
  const onShelf = live.filter((o) => o.kind === "stock").length;
  const preorders = live.length - onShelf;

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <RowBar {...barProps(viewer)} />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>Shop administration</h2>
            <span className="mono">
              ADMIN ONLY — {live.length} {live.length === 1 ? "SHIRT" : "SHIRTS"} · {onShelf} ON THE SHELF · {preorders} PRE-ORDERED
            </span>
          </div>

          {unreadable ? (
            <p className="board-empty">THE ORDERS COULD NOT BE READ JUST NOW — RELOAD IN A MOMENT.</p>
          ) : (
            <>
              <table className="board">
                <thead>
                  <tr>
                    <th>Size</th>
                    <th className="num" style={{ textAlign: "right" }}>
                      Shelf
                    </th>
                    <th className="num" style={{ textAlign: "right" }}>
                      Taken
                    </th>
                    <th className="num" style={{ textAlign: "right" }}>
                      Left
                    </th>
                    <th className="num" style={{ textAlign: "right" }}>
                      Pre-ordered
                    </th>
                    <th>The box says</th>
                  </tr>
                </thead>
                <tbody>
                  {counts.map((c) => (
                    <tr key={c.size}>
                      <td className="who">{c.size}</td>
                      <td className="num">{c.stock}</td>
                      <td className="num">{c.taken}</td>
                      <td className="num">{c.left}</td>
                      <td className="num">{c.preorders}</td>
                      <td className="mono" style={{ fontSize: 11, color: c.left > 0 ? "var(--gray)" : "var(--water)" }}>
                        {boxLine(c)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <OrdersPanel orders={orders} />
              <SettlePanel inProduction={process.env.NODE_ENV === "production"} />
            </>
          )}
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
