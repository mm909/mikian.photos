"use client";

import { RowersTable, type AdminRower, type Send } from "../../rowers/RowersTable";

/* The rowers table on mock data with a stub in place of the row routes:
 * every SAVE / REMOVE answers ok after a beat and nothing leaves the page
 * (the real routes would 401 signed out — or, on a signed-in dev session,
 * reach the live database). router.refresh then re-renders the same mock. */
const fakeSend: Send = () => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 350));

export function RowersMock({ rowers, openNumber }: { rowers: AdminRower[]; openNumber: number | null }) {
  return <RowersTable rowers={rowers} openNumber={openNumber} send={fakeSend} />;
}
