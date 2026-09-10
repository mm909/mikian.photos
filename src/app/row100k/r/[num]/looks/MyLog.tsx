"use client";

import { useMemo, useState } from "react";
import { fmtDay, fmtDuration, fmtMeters, fmtSplit } from "@/lib/row100k";
import { LogControls, SortHeader } from "../../../LogControls";
import { DEFAULT_LOG_VIEW, applyLogView, type LogView } from "../../../logSort";
import { MyRows, type MyRow } from "../../../MyRows";
import { ShareDialog } from "../../../ShareMenu";
import type { ShareData } from "../../../share/cards";

/* The rower's own log, without the form: the log form now sits behind the
 * LOG A ROW button up top (LogInPlace, the same as the front page — owner
 * call, 2026-09-05), so the ledger down here is just the editable rows and
 * the per-row share the ⋮ menu offers. Sharing a row lands the dialog on
 * the single-row card.
 *
 * Two shapes since 2026-09-10 (owner: "a table of all my rows where I can
 * sort by length / time / pace / date and filter to 5ks, 10ks — combine it
 * with the log"): LEDGER is the photo strips as they were, TABLE is the
 * same rows as a plain sortable table. The distance chips and the sort
 * (logSort.ts) apply to both — the ledger sorts by the small mono row
 * under the chips, the table by its column heads. Editing stays in the
 * ledger; the table shares. */
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
  const [mode, setMode] = useState<"ledger" | "table">("ledger");
  const [view, setView] = useState<LogView>(DEFAULT_LOG_VIEW);
  const shown = useMemo(() => applyLogView(rows, view), [rows, view]);

  const share = (r: MyRow) => {
    setShareRow({ day: r.day, meters: r.meters, seconds: r.seconds, title: r.title });
    setOpen(true);
  };

  return (
    <>
      <div className="tabs" role="group" aria-label="Log view">
        {(["ledger", "table"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={mode === m ? "on" : undefined}
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>

      <LogControls rows={rows} shown={shown} view={view} onView={setView} sortChips={mode === "ledger"} />

      {mode === "table" ? (
        shown.length === 0 ? (
          <p className="board-empty">NOTHING AT THAT DISTANCE YET.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="board">
              <thead>
                <tr>
                  <SortHeader k="day" view={view} onView={setView}>
                    Day
                  </SortHeader>
                  <SortHeader k="meters" view={view} onView={setView} right>
                    Meters
                  </SortHeader>
                  <SortHeader k="seconds" view={view} onView={setView} right>
                    Time
                  </SortHeader>
                  <SortHeader k="split" view={view} onView={setView} right>
                    /500m
                  </SortHeader>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {fmtDay(r.day)}
                      {r.title ? (
                        <div className="mono" style={{ fontSize: 11, color: "var(--gray)", marginTop: 2 }}>
                          {r.title}
                        </div>
                      ) : null}
                    </td>
                    <td className="num">{fmtMeters(r.meters)}</td>
                    <td className="num">{fmtDuration(r.seconds)}</td>
                    <td className="num" style={{ color: "var(--gray)" }}>
                      {fmtSplit(r.meters, r.seconds)}
                    </td>
                    <td className="num">
                      <button type="button" className="quiet-btn" onClick={() => share(r)}>
                        SHARE
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : shown.length === 0 ? (
        <p className="board-empty">NOTHING AT THAT DISTANCE YET.</p>
      ) : (
        <MyRows rows={shown} canEdit={canEdit} onShare={share} />
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
