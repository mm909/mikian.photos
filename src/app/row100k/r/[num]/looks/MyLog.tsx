"use client";

import { useMemo, useState } from "react";
import { LogControls } from "../../../LogControls";
import { DEFAULT_LOG_VIEW, applyLogView, type LogView } from "../../../logSort";
import { MyRows, type MyRow } from "../../../MyRows";
import { ShareDialog } from "../../../ShareMenu";
import type { ShareData } from "../../../share/cards";

/* The rower's own log, without the form: the log form sits behind the
 * LOG A ROW button up top (LogInPlace, the same as the front page — owner
 * call, 2026-09-05), so this is the rows and what can be done to them.
 *
 * ONE LOG since 2026-09-24 (owner: "Combine the ledger and the table on
 * the profile: one log, keep the table view, show the photos on the
 * table"): the LEDGER / TABLE tabs of 2026-09-10 are gone. What is left is
 * the table (MyRows) — sortable by its column heads, the photo pair as a
 * strip under the day, SHARE / EDIT / DELETE in the ⋮ menu on every row —
 * under the distance chips (LogControls, logSort.ts). Sharing a row lands
 * the dialog on the single-row card. */
export function MyLog({
  data,
  rows,
  canEdit,
}: {
  data: ShareData;
  rows: MyRow[];
  canEdit: boolean;
}) {
  const [shareRow, setShareRow] = useState<ShareData["row"]>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<LogView>(DEFAULT_LOG_VIEW);
  const shown = useMemo(() => applyLogView(rows, view), [rows, view]);

  const share = (r: MyRow) => {
    setShareRow({ day: r.day, meters: r.meters, seconds: r.seconds, title: r.title });
    setOpen(true);
  };

  return (
    <>
      <LogControls rows={rows} shown={shown} view={view} onView={setView} />

      {shown.length === 0 ? (
        <p className="board-empty">NOTHING AT THAT DISTANCE YET.</p>
      ) : (
        <MyRows rows={shown} canEdit={canEdit} onShare={share} view={view} onView={setView} />
      )}

      <ShareDialog
        data={{ ...data, row: shareRow }}
        open={open}
        onClose={() => setOpen(false)}
        preferredCardId="rowtember-row"
      />
    </>
  );
}
