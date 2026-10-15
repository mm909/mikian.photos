"use client";

import { useCallback, useId, useState, type ChangeEvent } from "react";
import { signIn } from "next-auth/react";
import type { ExpenseView, ExpensesPayload } from "@/lib/lasd26/expenses";

/**
 * The invoice (owner, 2026-10-15: "kind of like an invoice … they can see
 * every cost and where it came from … the upload page can simply be
 * title, cost, and a picture"). Three pieces: the SUMMARY (total, split,
 * per person), the ADD form, the LIST of cards. Everything round-trips
 * through /api/lasd26/expenses and refreshes the whole payload after a
 * write, so two people in the van adding gas at once never see a stale
 * total for long.
 *
 * Receipts upload straight to R2: sign (presigned PUT) → PUT the file →
 * register. Per-file state shows under the card it belongs to. The picker
 * lists jpeg / png / webp / pdf explicitly — that is what makes an iPhone
 * hand over a JPEG for a HEIC photo (see lib/lasd26/receipts.ts).
 */

const API = "/api/lasd26/expenses";
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const ALLOWED = new Set(ACCEPT.split(","));
const MAX_BYTES = 15_000_000;

const usd = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const when = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" }).format(new Date(iso));

const json = (body: unknown, method = "POST"): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** fetch + the {ok,error} envelope every route speaks; throws the server's message. */
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string } & T;
  if (!res.ok || !data.ok) throw new Error(data.error || "Something broke — try again.");
  return data;
}

type UpState = "uploading" | "saving" | "done" | "failed";
type Up = { id: number; expenseId: string; name: string; state: UpState; error?: string };
let upSeq = 0;

/* ─── Notices (signed out / not on the team) ─────────────────────────────── */

export function SignInNotice() {
  return (
    <div className="xp-notice">
      <strong>Sign in</strong>
      This page is for the crew. Sign in with Google to see it.
      <br />
      Not on the team? You need the invite link from the group chat.
      <br />
      <button type="button" className="xp-btn" onClick={() => signIn("google", { callbackUrl: "/lasd26/expenses" })}>
        Sign in with Google →
      </button>
    </div>
  );
}

export function InviteNotice() {
  return (
    <div className="xp-notice">
      <strong>Not on the team yet</strong>
      You are signed in, but this account has not joined the LASD26 team.
      <br />
      You need the invite link from the group chat — open it, pick RUNNER or CREW, and this page unlocks.
    </div>
  );
}

/* ─── The page ───────────────────────────────────────────────────────────── */

export function Expenses({ initial }: { initial: ExpensesPayload }) {
  const [data, setData] = useState<ExpensesPayload>(initial);
  const [ups, setUps] = useState<Up[]>([]);
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    try {
      const fresh = await api<ExpensesPayload>(API);
      setData(fresh);
      // Finished uploads now show as thumbs; keep only the ones still moving or failed.
      setUps((list) => list.filter((u) => u.state !== "done"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not refresh.");
    }
  }, []);

  /** Sign → PUT → register, one file at a time so the progress reads top to bottom. */
  const uploadFiles = useCallback(
    async (expenseId: string, files: File[]) => {
      const patchUp = (id: number, patch: Partial<Up>) => setUps((list) => list.map((u) => (u.id === id ? { ...u, ...patch } : u)));
      // A retry on this card clears its old failures so the list reads fresh.
      setUps((list) => list.filter((u) => !(u.expenseId === expenseId && u.state === "failed")));
      for (const file of files) {
        const id = ++upSeq;
        setUps((list) => [...list, { id, expenseId, name: file.name, state: "uploading" }]);
        if (!ALLOWED.has(file.type)) {
          patchUp(id, { state: "failed", error: "jpeg, png, webp or pdf only" });
          continue;
        }
        if (file.size > MAX_BYTES) {
          patchUp(id, { state: "failed", error: "over 15 MB" });
          continue;
        }
        try {
          const sign = await api<{ uploadUrl: string; key: string; headers: Record<string, string> }>(
            `${API}/${expenseId}/receipts/sign`,
            json({ contentType: file.type, contentLength: file.size }),
          );
          const put = await fetch(sign.uploadUrl, { method: "PUT", headers: sign.headers, body: file });
          if (!put.ok) throw new Error("storage refused the file");
          patchUp(id, { state: "saving" });
          await api(`${API}/${expenseId}/receipts`, json({ key: sign.key, contentType: file.type, bytes: file.size }));
          patchUp(id, { state: "done" });
        } catch (e) {
          patchUp(id, { state: "failed", error: e instanceof Error ? e.message : "failed" });
        }
      }
      await refresh();
    },
    [refresh],
  );

  const joined = `${data.memberCount} of ${data.splitCount} joined`;
  return (
    <>
      <div className="xp-sum" aria-label="Summary">
        <div className="c">
          <div className="k">Total</div>
          <div className="v">{usd(data.totalCents)}</div>
        </div>
        <div className="c">
          <div className="k">Split</div>
          <div className="v">{data.splitCount} ways</div>
        </div>
        <div className="c per">
          <div className="k">Per person</div>
          <div className="v">{usd(data.perPersonCents)}</div>
          <small>{usd(data.totalCents)} ÷ {data.splitCount}, rounded up to the cent</small>
        </div>
      </div>
      <div className="xp-foot">
        {data.estimatedCents > 0 && <span className="est">includes {usd(data.estimatedCents)} of estimates</span>}
        <span>{joined}</span>
      </div>

      <AddForm onAdded={async (id, files) => (files.length ? uploadFiles(id, files) : refresh())} />
      {err && <p className="xp-err">{err.toUpperCase()}</p>}

      <div className="xp-list">
        {data.expenses.length === 0 && <p className="list-empty">NOTHING ON THE SHEET YET.</p>}
        {data.expenses.map((e) => (
          <ExpenseCard key={e.id} expense={e} ups={ups.filter((u) => u.expenseId === e.id)} onChanged={refresh} onFiles={(files) => uploadFiles(e.id, files)} />
        ))}
      </div>
    </>
  );
}

/* ─── Add ────────────────────────────────────────────────────────────────── */

function AddForm({ onAdded }: { onAdded: (id: string, files: File[]) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [estimate, setEstimate] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const reset = () => {
    setTitle("");
    setAmount("");
    setNote("");
    setEstimate(false);
    setFiles([]);
    setErr("");
  };

  async function submit() {
    if (busy) return;
    if (!title.trim()) return setErr("What was it for? Add a title.");
    if (!/^\$?\s*[\d,]+(\.\d{1,2})?$/.test(amount.trim())) return setErr("Add the amount in dollars, like 283 or 371.25.");
    setBusy(true);
    setErr("");
    try {
      const res = await api<{ expense: ExpenseView }>(API, json({ title: title.trim(), amount: amount.trim(), note: note.trim(), estimate }));
      await onAdded(res.expense.id, files);
      reset();
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something broke — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="xp-add-open" onClick={() => setOpen(true)}>
        + Add a cost <span className="mono">TITLE · AMOUNT · PICTURE</span>
      </button>
    );
  }
  return (
    <div className="xp-add">
      <div className="xp-row">
        <div>
          <label className="xp-l" htmlFor="xp-title">
            What
          </label>
          <input id="xp-title" className="xp-in" type="text" value={title} maxLength={80} disabled={busy} placeholder="Gas, Costco run, tolls…" onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="xp-l" htmlFor="xp-amount">
            Amount
          </label>
          <input id="xp-amount" className="xp-in amt" type="text" inputMode="decimal" value={amount} disabled={busy} placeholder="$0.00" onChange={(e) => setAmount(e.target.value)} />
        </div>
      </div>
      <label className="xp-l" htmlFor="xp-note">
        Note <span style={{ textTransform: "none", letterSpacing: 0 }}>(optional)</span>
      </label>
      <input id="xp-note" className="xp-in" type="text" value={note} maxLength={400} disabled={busy} placeholder="Where it came from, who paid" onChange={(e) => setNote(e.target.value)} />
      <label className="xp-check">
        <input type="checkbox" checked={estimate} disabled={busy} onChange={(e) => setEstimate(e.target.checked)} />
        ESTIMATE — a round number, no receipt yet
      </label>
      <FilePick files={files} disabled={busy} onPick={setFiles} label="Photos of the receipt" />
      <div className="acts">
        <button type="button" className="xp-btn" onClick={submit} disabled={busy}>
          {busy ? "Saving…" : "Add it →"}
        </button>
        <button
          type="button"
          className="xp-ghost"
          disabled={busy}
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          Cancel
        </button>
      </div>
      {err && <p className="xp-err">{err.toUpperCase()}</p>}
    </div>
  );
}

/** The picker: a dashed box that opens the camera roll; shows what is queued. */
function FilePick({ files, disabled, onPick, label }: { files: File[]; disabled: boolean; onPick: (f: File[]) => void; label: string }) {
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    onPick(Array.from(e.target.files ?? []));
  };
  return (
    <label className="xp-files">
      <input type="file" accept={ACCEPT} multiple disabled={disabled} onChange={onChange} />
      <span aria-hidden>+</span>
      {files.length === 0 ? <span>{label.toUpperCase()}</span> : <b>{files.length === 1 ? files[0].name : `${files.length} FILES`}</b>}
    </label>
  );
}

/* ─── One line ───────────────────────────────────────────────────────────── */

function ExpenseCard({ expense: e, ups, onChanged, onFiles }: { expense: ExpenseView; ups: Up[]; onChanged: () => Promise<void>; onFiles: (files: File[]) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      await fn();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Something broke — try again.");
    } finally {
      setBusy(false);
    }
  }

  const remove = () => {
    if (!window.confirm(`Remove "${e.title}" (${e.amount}) from the sheet?`)) return;
    void run(async () => {
      await api(`${API}/${e.id}`, { method: "DELETE" });
      await onChanged();
    });
  };
  const dropReceipt = (receiptId: string) => {
    if (!window.confirm("Remove this receipt?")) return;
    void run(async () => {
      await api(`${API}/${e.id}/receipts/${receiptId}`, { method: "DELETE" });
      await onChanged();
    });
  };
  const pick = (ev: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(ev.target.files ?? []);
    ev.target.value = "";
    if (files.length) void run(() => onFiles(files));
  };

  const busyUps = ups.some((u) => u.state === "uploading" || u.state === "saving");
  return (
    <article className="xp-card">
      {editing ? (
        <EditForm expense={e} onDone={async () => { setEditing(false); await onChanged(); }} onCancel={() => setEditing(false)} />
      ) : (
        <>
          <div className="xp-top">
            <h3 className="xp-title">
              {e.title}
              {e.estimate && <span className="xp-chip">Estimate</span>}
            </h3>
            <div className={`xp-amt${e.estimate ? " est" : ""}`}>{e.amount}</div>
          </div>
          <div className="xp-meta">
            {e.addedBy ? `ADDED BY ${e.addedBy.toUpperCase()}` : "FROM THE COST SHEET"} · {when(e.createdAt).toUpperCase()}
            {e.receipts.length > 0 && ` · ${e.receipts.length} RECEIPT${e.receipts.length === 1 ? "" : "S"}`}
          </div>
          {e.note && <p className="xp-note">{e.note}</p>}
        </>
      )}

      {e.receipts.length > 0 && (
        <div className="xp-rcpts">
          {e.receipts.map((r) => (
            <span className={`xp-rcpt${r.hasThumb ? "" : " pdf"}`} key={r.id}>
              <a href={`${API}/receipt/${r.id}`} target="_blank" rel="noopener noreferrer" title="Open the receipt">
                {r.hasThumb ? <img src={`${API}/receipt/${r.id}?thumb=1`} alt={`Receipt for ${e.title}`} loading="lazy" /> : r.contentType === "application/pdf" ? "PDF" : "FILE"}
              </a>
              {/* Whoever may edit the line, or whoever attached this receipt, may take it off (lib/lasd26/expenses canRemoveReceipt). */}
              {(e.canEdit || r.addedByMe) && (
                <button type="button" className="xp-rcpt-x" aria-label="Remove this receipt" disabled={busy} onClick={() => dropReceipt(r.id)}>
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {ups.length > 0 && (
        <div className="xp-up">
          {ups.map((u) => (
            <div key={u.id} className={u.state === "done" ? "ok" : u.state === "failed" ? "bad" : undefined}>
              {u.name} — {u.state === "uploading" ? "UPLOADING…" : u.state === "saving" ? "SAVING…" : u.state === "done" ? "DONE ✓" : `FAILED: ${(u.error ?? "").toUpperCase()}`}
            </div>
          ))}
        </div>
      )}

      {!editing && (
        <div className="xp-acts">
          <label className="xp-files">
            <input type="file" accept={ACCEPT} multiple disabled={busy || busyUps} onChange={pick} />
            <span>{busyUps ? "UPLOADING…" : "+ RECEIPT"}</span>
          </label>
          {e.canEdit && (
            <>
              <button type="button" className="xp-ghost" disabled={busy} onClick={() => setEditing(true)}>
                Edit
              </button>
              <button type="button" className="xp-ghost danger" disabled={busy} onClick={remove}>
                Delete
              </button>
            </>
          )}
        </div>
      )}
      {err && <p className="xp-err">{err.toUpperCase()}</p>}
    </article>
  );
}

function EditForm({ expense: e, onDone, onCancel }: { expense: ExpenseView; onDone: () => Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = useState(e.title);
  const [amount, setAmount] = useState((e.amountCents / 100).toFixed(2));
  const [note, setNote] = useState(e.note);
  const [estimate, setEstimate] = useState(e.estimate);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const uid = useId();

  async function save() {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      await api(`${API}/${e.id}`, json({ title: title.trim(), amount: amount.trim(), note: note.trim(), estimate }, "PATCH"));
      await onDone();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Something broke — try again.");
      setBusy(false);
    }
  }

  return (
    <div className="xp-edit">
      <div className="xp-row">
        <div>
          <label className="xp-l" htmlFor={`${uid}-t`}>
            What
          </label>
          <input id={`${uid}-t`} className="xp-in" type="text" value={title} maxLength={80} disabled={busy} onChange={(ev) => setTitle(ev.target.value)} />
        </div>
        <div>
          <label className="xp-l" htmlFor={`${uid}-a`}>
            Amount
          </label>
          <input id={`${uid}-a`} className="xp-in amt" type="text" inputMode="decimal" value={amount} disabled={busy} onChange={(ev) => setAmount(ev.target.value)} />
        </div>
      </div>
      <label className="xp-l" htmlFor={`${uid}-n`}>
        Note
      </label>
      <input id={`${uid}-n`} className="xp-in" type="text" value={note} maxLength={400} disabled={busy} onChange={(ev) => setNote(ev.target.value)} />
      <label className="xp-check">
        <input type="checkbox" checked={estimate} disabled={busy} onChange={(ev) => setEstimate(ev.target.checked)} />
        ESTIMATE
      </label>
      <div className="xp-acts">
        <button type="button" className="xp-btn" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" className="xp-ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
      {err && <p className="xp-err">{err.toUpperCase()}</p>}
    </div>
  );
}
