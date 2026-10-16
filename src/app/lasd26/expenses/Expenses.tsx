"use client";

import { useCallback, useId, useState, type ChangeEvent } from "react";
import { signIn } from "next-auth/react";
import type { ExpenseView, ExpensesPayload, PayerView, ReceiptView } from "@/lib/lasd26/expenses";
import { lasdPath } from "@/lib/lasd26/paths";
import { ReceiptLightbox } from "./ReceiptLightbox";

/**
 * The invoice (owner, 2026-10-15: "kind of like an invoice … they can see
 * every cost and where it came from … the upload page can simply be
 * title, cost, and a picture"). Three pieces: the SUMMARY (total, split,
 * per person), the ADD form, the LIST of cards. Everything round-trips
 * through /api/lasd26/expenses and refreshes the whole payload after a
 * write, so two people in the van adding gas at once never see a stale
 * total for long.
 *
 * PAID BY (owner, 2026-10-16: "Instead of having a note just make it a
 * 'paid by' and auto fill the name of the user logged in"). The note
 * field is gone; in its place a select of the roster, already on the
 * signed-in member. Who fronted a line comes off their share when they
 * settle up, so the card says PAID BY NAME where it said "added by".
 *
 * BUCKETS (owner, 2026-10-16: "How do I let people add real expenses to
 * the food/gas estimates"). An estimate line is a bucket: its card lists
 * the real costs filed under it (each with its own receipts, edit and
 * delete) and carries an "+ ADD A COST" door that opens the add form
 * already pointed at it — the only way into a bucket (owner: "We also
 * don't need the part of line b/c we have the add a real cost button").
 * The estimate itself is the owner's (owner: "We don't need the estimate
 * line visible to the other users (keep that for me)"): the ESTIMATE chip,
 * the "real so far / the estimate stands" line and the ESTIMATE checkbox
 * render for him alone; a member sees a plain category card with the
 * counted amount. Once settling up is open the bucket counts its real
 * costs only and the owner's line says the estimate has been replaced
 * (owner: "When I make settle up go live replace the estimate costs w/
 * the real cost").
 *
 * Receipts upload straight to R2: sign (presigned PUT) → PUT the file →
 * register. Per-file state shows under the card it belongs to. The picker
 * lists jpeg / png / webp / pdf explicitly — that is what makes an iPhone
 * hand over a JPEG for a HEIC photo (see lib/lasd26/receipts.ts).
 *
 * RECEIPTS, three rules of 2026-10-16 (owner). "Since the estimates are
 * more like categories, we don't need a receipt button for that category,
 * just for the items added under it": a bucket card has no "+ RECEIPT"
 * picker and no receipt list — its children keep theirs; the add form
 * hides the photo box while ESTIMATE is ticked, and the sign / register
 * routes answer 400 on an estimate anyway. "Make sure other people can't
 * delete my receipts; it's okay for them to delete their own but not
 * other people's": the × on a receipt shows for the owner and for whoever
 * attached it — not for the line's author just because it is their line
 * (lib/lasd26/expenses canRemoveReceipt says the same on the server).
 * "When I click on the receipt it opens in another page; it should open
 * in a preview like other images during Rowtember": an image thumbnail is
 * a button that opens ReceiptLightbox over the page, stepping through
 * that line's image receipts; a pdf stays a chip that opens in a new tab.
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

/** What every card and form needs to know about the viewer and the sheet. */
type Ctx = { members: PayerView[]; meId: string | null; owner: boolean; settleOpen: boolean };

/** A receipt the lightbox can show: an image, with or without its thumb (a pdf is a chip in a new tab). */
const isImage = (r: ReceiptView) => r.contentType.startsWith("image/");

/* ─── Notices (signed out / not on the team) ─────────────────────────────── */

export function SignInNotice() {
  return (
    <div className="xp-notice">
      <strong>Sign in</strong>
      This page is for the crew. Sign in with Google to see it.
      <br />
      Not on the team? You need the invite link from the group chat.
      <br />
      {/* Back to this page after Google (lasdPath, lib/lasd26/paths.ts). */}
      <button type="button" className="xp-btn" onClick={() => signIn("google", { callbackUrl: lasdPath("/expenses") })}>
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

  const onAdded = useCallback(async (id: string, files: File[]) => (files.length ? uploadFiles(id, files) : refresh()), [uploadFiles, refresh]);

  const ctx: Ctx = { members: data.members, meId: data.meId, owner: data.owner, settleOpen: data.settleOpen };
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
          <small>
            {usd(data.totalCents)} ÷ {data.splitCount}
          </small>
        </div>
      </div>
      <div className="xp-foot">
        {/* The estimates are the owner's business (see the header): only he
         * reads how much of the total is still a round number, and once
         * settling up is open there is none — the real costs replaced them. */}
        {data.owner && !data.settleOpen && data.estimatedCents > 0 && <span className="est">includes {usd(data.estimatedCents)} of estimates</span>}
        {data.settleOpen && <span className="est">settling up is open · real costs only</span>}
        <span>{joined}</span>
      </div>

      <AddForm ctx={ctx} onAdded={onAdded} />
      {err && <p className="xp-err">{err.toUpperCase()}</p>}

      <div className="xp-list">
        {data.expenses.length === 0 && <p className="list-empty">NOTHING ON THE SHEET YET.</p>}
        {data.expenses.map((e) => (
          <ExpenseCard key={e.id} expense={e} ctx={ctx} ups={ups} onChanged={refresh} onFiles={uploadFiles} onAdded={onAdded} />
        ))}
      </div>
    </>
  );
}

/* ─── Add ────────────────────────────────────────────────────────────────── */

/**
 * The add form. Top-level (no `parent`): a collapsed door, then title /
 * amount / PAID BY / (owner) ESTIMATE / photos. Inside a bucket (`parent`
 * set, opened by the "+ ADD A COST" door): already open, pointed at that
 * bucket, no ESTIMATE — what goes in a bucket is a real cost
 * (lib/lasd26/expenses checkBucket says so on the server too). PAID BY
 * and the photo box start on / for the signed-in member and hide while
 * ESTIMATE is ticked: a round number has not been paid by anyone and
 * takes no receipt (owner, 2026-10-16: receipts go on "the items added
 * under" a category).
 */
function AddForm({ ctx, parent, onAdded, onClose }: { ctx: Ctx; parent?: { id: string; title: string }; onAdded: (id: string, files: File[]) => Promise<void>; onClose?: () => void }) {
  const [open, setOpen] = useState(parent !== undefined);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [paidById, setPaidById] = useState(ctx.meId ?? "");
  const [estimate, setEstimate] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const uid = useId();

  const reset = () => {
    setTitle("");
    setAmount("");
    setPaidById(ctx.meId ?? "");
    setEstimate(false);
    setFiles([]);
    setErr("");
  };
  const close = () => {
    reset();
    setOpen(false);
    onClose?.();
  };

  async function submit() {
    if (busy) return;
    if (!title.trim()) return setErr("What was it for? Add a title.");
    if (!/^\$?\s*[\d,]+(\.\d{1,2})?$/.test(amount.trim())) return setErr("Add the amount in dollars, like 283 or 371.25.");
    setBusy(true);
    setErr("");
    try {
      const res = await api<{ expense: ExpenseView }>(
        API,
        json({ title: title.trim(), amount: amount.trim(), paidById: estimate ? null : paidById || null, estimate: parent ? false : estimate, parentId: parent?.id ?? null }),
      );
      // A file picked before ESTIMATE was ticked stays behind: the sign route would refuse it.
      await onAdded(res.expense.id, estimate ? [] : files);
      close();
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
    <div className={`xp-add${parent ? " in-bucket" : ""}`}>
      {parent && <div className="under">Cost under {parent.title}</div>}
      <div className="xp-row">
        <div>
          <label className="xp-l" htmlFor={`${uid}-t`}>
            What
          </label>
          <input
            id={`${uid}-t`}
            className="xp-in"
            type="text"
            value={title}
            maxLength={80}
            disabled={busy}
            placeholder={parent ? "Chevron, Costco run…" : "Gas, Costco run, tolls…"}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="xp-l" htmlFor={`${uid}-a`}>
            Amount
          </label>
          <input id={`${uid}-a`} className="xp-in amt" type="text" inputMode="decimal" value={amount} disabled={busy} placeholder="$0.00" onChange={(e) => setAmount(e.target.value)} />
        </div>
      </div>
      {!estimate && <PaidBy id={`${uid}-p`} value={paidById} members={ctx.members} disabled={busy} onChange={setPaidById} />}
      {!parent && ctx.owner && (
        <label className="xp-check">
          <input type="checkbox" checked={estimate} disabled={busy} onChange={(e) => setEstimate(e.target.checked)} />
          ESTIMATE — a round number, no receipt yet
        </label>
      )}
      {!estimate && <FilePick files={files} disabled={busy} onPick={setFiles} label="Photos of the receipt" />}
      <div className="acts">
        <button type="button" className="xp-btn" onClick={submit} disabled={busy}>
          {busy ? "Saving…" : "Add it →"}
        </button>
        <button type="button" className="xp-ghost" disabled={busy} onClick={close}>
          Cancel
        </button>
      </div>
      {err && <p className="xp-err">{err.toUpperCase()}</p>}
    </div>
  );
}

/**
 * PAID BY: the roster, on the signed-in member by default. A line nobody
 * has claimed yet (a seeded one) shows "— not set —" until someone is
 * picked; the option is gone once a name is in.
 */
function PaidBy({ id, value, members, disabled, onChange }: { id: string; value: string; members: PayerView[]; disabled: boolean; onChange: (v: string) => void }) {
  const known = members.some((m) => m.id === value);
  return (
    <>
      <label className="xp-l" htmlFor={id}>
        Paid by
      </label>
      <div className="xp-selw">
        <select id={id} className="xp-sel" value={known ? value : ""} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          {!known && <option value="">— not set —</option>}
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
    </>
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

/**
 * The owner's muted line under a bucket: where the real costs stand
 * against the estimate — or, once settling up is open, that the estimate
 * has been replaced by them (greyed, the round number struck through).
 */
function BucketLine({ e, settleOpen }: { e: ExpenseView; settleOpen: boolean }) {
  const b = e.bucket;
  if (!b) return null;
  if (settleOpen) {
    return (
      <p className="xp-bucket-line off">
        Estimate <s>{e.amount}</s> — replaced by the real costs
      </p>
    );
  }
  if (b.realCents === 0) {
    return <p className="xp-bucket-line">No real costs filed yet · the estimate stands until the real costs pass it</p>;
  }
  if (b.realCents < e.amountCents) {
    return (
      <p className="xp-bucket-line">
        <b>{b.real}</b> in real costs so far · the estimate stands until the real costs pass it
      </p>
    );
  }
  return (
    <p className="xp-bucket-line">
      <b>{b.real}</b> in real costs — past the {e.amount} estimate, so that is what counts
    </p>
  );
}

function ExpenseCard({
  expense: e,
  ctx,
  ups,
  onChanged,
  onFiles,
  onAdded,
}: {
  expense: ExpenseView;
  ctx: Ctx;
  ups: Up[];
  onChanged: () => Promise<void>;
  onFiles: (expenseId: string, files: File[]) => Promise<void>;
  onAdded: (id: string, files: File[]) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // The lightbox: which of this line's IMAGE receipts is up, or none.
  const [lb, setLb] = useState<number | null>(null);
  const mine = ups.filter((u) => u.expenseId === e.id);
  const isBucket = e.bucket !== null;
  const images = e.receipts.filter(isImage);

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
    const n = e.children.length;
    // Deleting a bucket detaches what is in it (the API's soft delete sets parentId null on the live children).
    const tail = n > 0 ? ` Its ${n} cost${n === 1 ? "" : "s"} stay${n === 1 ? "s" : ""} on the sheet as ${n === 1 ? "its" : "their"} own line${n === 1 ? "" : "s"}.` : "";
    if (!window.confirm(`Remove "${e.title}" (${e.amount}) from the sheet?${tail}`)) return;
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
    if (files.length) void run(() => onFiles(e.id, files));
  };

  const busyUps = mine.some((u) => u.state === "uploading" || u.state === "saving");
  // What the big number shows: a bucket's counted amount (the estimate
  // until the real costs pass it, the real sum once they do or once
  // settling up is open). Green while it is still the estimate — the
  // owner's signal; a member just sees the number.
  const shown = e.bucket ? e.bucket.counted : e.amount;
  const stillEstimate = ctx.owner && e.estimate && !ctx.settleOpen && (!e.bucket || e.bucket.realCents < e.amountCents);
  const kids = e.children.length;
  // The line under the title. A real cost: who fronted it. A bucket: the
  // owner reads ESTIMATE, a member reads it as a category (see the header).
  const meta = isBucket
    ? ctx.owner
      ? `ESTIMATE · ${when(e.createdAt).toUpperCase()}`
      : `CATEGORY · ${kids} COST${kids === 1 ? "" : "S"}`
    : `PAID BY ${(e.paidBy?.name ?? "—").toUpperCase()} · ${when(e.createdAt).toUpperCase()}`;
  return (
    <article className={`xp-card${isBucket ? " xp-bucket" : ""}${e.parentId ? " xp-kid" : ""}`}>
      {editing ? (
        <EditForm expense={e} ctx={ctx} onDone={async () => { setEditing(false); await onChanged(); }} onCancel={() => setEditing(false)} />
      ) : (
        <>
          <div className="xp-top">
            <h3 className="xp-title">
              {e.title}
              {ctx.owner && e.estimate && <span className="xp-chip">Estimate</span>}
            </h3>
            <div className={`xp-amt${stillEstimate ? " est" : ""}`}>{shown}</div>
          </div>
          <div className="xp-meta">
            {meta}
            {!isBucket && e.receipts.length > 0 && ` · ${e.receipts.length} RECEIPT${e.receipts.length === 1 ? "" : "S"}`}
          </div>
          {ctx.owner && <BucketLine e={e} settleOpen={ctx.settleOpen} />}
        </>
      )}

      {/* A bucket is a category and shows no receipts of its own — the real costs under it carry them (owner, 2026-10-16). */}
      {!isBucket && e.receipts.length > 0 && (
        <div className="xp-rcpts">
          {e.receipts.map((r) => {
            const at = images.findIndex((i) => i.id === r.id);
            return (
              <span className={`xp-rcpt${r.hasThumb ? "" : " chip"}`} key={r.id}>
                {at >= 0 ? (
                  // An image opens the lightbox over the page (owner, 2026-10-16: "a preview like other images during Rowtember").
                  <button type="button" className="xp-rcpt-open" title="Look at the receipt" aria-label={`Look at receipt ${at + 1} of ${images.length} for ${e.title}`} onClick={() => setLb(at)}>
                    {r.hasThumb ? <img src={`${API}/receipt/${r.id}?thumb=1`} alt="" loading="lazy" /> : "IMAGE"}
                  </button>
                ) : (
                  <a href={`${API}/receipt/${r.id}`} target="_blank" rel="noopener noreferrer" title="Open the receipt in a new tab">
                    {r.contentType === "application/pdf" ? "PDF" : "FILE"}
                  </a>
                )}
                {/* The owner, or whoever attached this receipt, may take it off — not the line's author (lib/lasd26/expenses canRemoveReceipt; owner, 2026-10-16). */}
                {(ctx.owner || r.addedByMe) && (
                  <button type="button" className="xp-rcpt-x" aria-label="Remove this receipt" disabled={busy} onClick={() => dropReceipt(r.id)}>
                    ×
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}
      {lb !== null && images[lb] && (
        <ReceiptLightbox
          title={e.title}
          receipts={images.map((r, i) => ({ id: r.id, src: `${API}/receipt/${r.id}`, alt: `Receipt ${i + 1} of ${images.length} for ${e.title}` }))}
          index={lb}
          onIndex={setLb}
          onClose={() => setLb(null)}
        />
      )}

      {mine.length > 0 && (
        <div className="xp-up">
          {mine.map((u) => (
            <div key={u.id} className={u.state === "done" ? "ok" : u.state === "failed" ? "bad" : undefined}>
              {u.name} — {u.state === "uploading" ? "UPLOADING…" : u.state === "saving" ? "SAVING…" : u.state === "done" ? "DONE ✓" : `FAILED: ${(u.error ?? "").toUpperCase()}`}
            </div>
          ))}
        </div>
      )}

      {/* No "+ RECEIPT" on a bucket (owner, 2026-10-16: "we don't need a receipt button for that category, just for the items added under it"). */}
      {!editing && (!isBucket || e.canEdit) && (
        <div className="xp-acts">
          {!isBucket && (
            <label className="xp-files">
              <input type="file" accept={ACCEPT} multiple disabled={busy || busyUps} onChange={pick} />
              <span>{busyUps ? "UPLOADING…" : "+ RECEIPT"}</span>
            </label>
          )}
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

      {/* The real costs filed under this bucket, and the door to add one. Any member may file one — it is their receipt. */}
      {isBucket && (
        <div className="xp-kids">
          {e.children.map((c) => (
            <ExpenseCard key={c.id} expense={c} ctx={ctx} ups={ups} onChanged={onChanged} onFiles={onFiles} onAdded={onAdded} />
          ))}
          {adding ? (
            <AddForm ctx={ctx} parent={{ id: e.id, title: e.title }} onAdded={onAdded} onClose={() => setAdding(false)} />
          ) : (
            <button type="button" className="xp-kid-add" onClick={() => setAdding(true)}>
              + Add a cost <span className="mono">UNDER {e.title.toUpperCase()}</span>
            </button>
          )}
        </div>
      )}
    </article>
  );
}

/**
 * Edit: title / amount / PAID BY / (owner) ESTIMATE. No PART OF — a line
 * stays where it is (the API still takes parentId if the owner ever needs
 * to detach one by hand). A bucket with real costs inside stays an
 * estimate, and a real cost with receipts on it stays a real cost (an
 * estimate shows no receipts, so the flip would hide them) — the API
 * refuses both changes, so the checkbox gives way to a hint.
 */
function EditForm({ expense: e, ctx, onDone, onCancel }: { expense: ExpenseView; ctx: Ctx; onDone: () => Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = useState(e.title);
  const [amount, setAmount] = useState((e.amountCents / 100).toFixed(2));
  const [paidById, setPaidById] = useState(e.paidBy?.id ?? "");
  const [estimate, setEstimate] = useState(e.estimate);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const uid = useId();

  const holds = e.children.length;

  async function save() {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      await api(`${API}/${e.id}`, json({ title: title.trim(), amount: amount.trim(), paidById: estimate ? null : paidById || null, estimate }, "PATCH"));
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
      {!estimate && <PaidBy id={`${uid}-p`} value={paidById} members={ctx.members} disabled={busy} onChange={setPaidById} />}
      {ctx.owner &&
        !e.parentId &&
        (holds > 0 ? (
          <p className="xp-hint">
            ESTIMATE · holds {holds} cost{holds === 1 ? "" : "s"}, so it stays one
          </p>
        ) : !e.estimate && e.receipts.length > 0 ? (
          <p className="xp-hint">
            REAL COST · has {e.receipts.length} receipt{e.receipts.length === 1 ? "" : "s"} on it, so it stays one
          </p>
        ) : (
          <label className="xp-check">
            <input type="checkbox" checked={estimate} disabled={busy} onChange={(ev) => setEstimate(ev.target.checked)} />
            ESTIMATE
          </label>
        ))}
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
