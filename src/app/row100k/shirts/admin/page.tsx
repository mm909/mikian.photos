import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fmtRowerNumber } from "@/lib/row100k";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";
import { COLORS, COLOR_LABEL, SIZES, preorderCounts } from "../../shirtPreorder";
import { listPreorders, type PreorderRow } from "../../shirtPreorders";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shirt pre-orders — Rowtember",
  robots: { index: false, follow: false },
};

/* THE PRE-ORDERS, the owner's list (2026-09-30): every live reservation
 * with who, the rower number, the shirt, the size and when, newest first,
 * and the CSV the shirts get ordered from. Admin only — the rest of the
 * world gets a 404, the same gate as shop-admin. The totals per size ride
 * in the head line. */
const WHEN = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
});

/* THE WHEN: its own column on a desk, where it stays on one line; on a
 * phone five columns run off the edge, so the column goes and the same
 * words sit under the name, with the email. Rendered as the text child of
 * a style tag, so no quotes or angle brackets in here (see theme.ts). */
const adminCss = `
.row100k table.board td.spa-when-col{font-size:11px;color:var(--gray);white-space:nowrap}
.row100k .spa-when-line{display:none;font-size:10px;font-weight:400;color:var(--gray)}
@media(max-width:559px){
  .row100k table.board .spa-when-col{display:none}
  .row100k .spa-when-line{display:block}
}
`;

export default async function ShirtPreordersAdminPage() {
  const viewer = await resolveViewer();
  if (!viewer.actor || !viewer.isAdmin) notFound();

  let rows: PreorderRow[] = [];
  let unreadable = false;
  try {
    rows = await listPreorders();
  } catch (err) {
    console.error("row100k/shirts/admin: failed to load the pre-orders (table pushed?)", err);
    unreadable = true;
  }
  const counts = preorderCounts(rows.map((r) => ({ color: r.color, size: r.size, cancelledAt: null })));

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{adminCss}</style>
      <RowBar {...barProps(viewer)} />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>Pre-orders</h2>
            <span className="mono">
              ADMIN ONLY — {counts.black.total} BLACK · {counts.cream.total} CREAM ·{" "}
              <a href="/api/row100k/shirts/csv">CSV</a>
            </span>
          </div>

          {unreadable ? (
            <p className="board-empty">THE LIST COULD NOT BE READ JUST NOW — RELOAD IN A MOMENT.</p>
          ) : (
            <>
              {/* Per size, the two shirts across. */}
              <table className="board" style={{ maxWidth: 360 }}>
                <thead>
                  <tr>
                    <th>Size</th>
                    {COLORS.map((c) => (
                      <th className="num" style={{ textAlign: "right" }} key={c}>
                        {COLOR_LABEL[c]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SIZES.map((s) => (
                    <tr key={s}>
                      <td className="who">{s}</td>
                      {COLORS.map((c) => (
                        <td className="num" key={c}>
                          {counts[c].bySize[s]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              {rows.length === 0 ? (
                <p className="board-empty">NOTHING RESERVED YET.</p>
              ) : (
                <table className="board" style={{ marginTop: 28 }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Rower</th>
                      <th>Shirt</th>
                      <th>Size</th>
                      <th className="spa-when-col">Reserved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td className="rk">{fmtRowerNumber(r.rowerNumber)}</td>
                        <td className="who">
                          <a href={`/row100k/r/${r.rowerNumber}`}>{r.name}</a>
                          {r.email && (
                            <div className="mono" style={{ fontSize: 10, color: "var(--gray)", fontWeight: 400 }}>
                              {r.email}
                            </div>
                          )}
                          {/* The when, under the name, on a phone only (see adminCss). */}
                          <div className="mono spa-when-line">{WHEN.format(new Date(r.createdAt))}</div>
                        </td>
                        <td>{COLOR_LABEL[r.color as "black" | "cream"] ?? r.color}</td>
                        <td>{r.size}</td>
                        <td className="mono spa-when-col">{WHEN.format(new Date(r.createdAt))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
