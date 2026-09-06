"use client";

import { useState } from "react";
import { MyRows, type MyRow } from "../../../MyRows";
import { ShareDialog } from "../../../ShareMenu";
import type { ShareData } from "../../../share/cards";

/* The rower's own log, without the form: the log form now sits behind the
 * LOG A ROW button up top (LogInPlace, the same as the front page — owner
 * call, 2026-09-05), so the ledger down here is just the editable rows and
 * the per-row share the ⋮ menu offers. Sharing a row lands the dialog on
 * the single-row card. */
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

  return (
    <>
      <MyRows
        rows={rows}
        canEdit={canEdit}
        onShare={(r) => {
          setShareRow({ day: r.day, meters: r.meters, seconds: r.seconds, title: r.title });
          setOpen(true);
        }}
      />
      <ShareDialog
        data={{ ...data, row: shareRow }}
        open={open}
        onClose={() => setOpen(false)}
        preferredCardId="rowtember-row"
      />
    </>
  );
}
