"use client";

import { useEffect, useState, type KeyboardEvent as ReactKeyEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { lasdPath } from "@/lib/lasd26/paths";

/**
 * THE SHEET on /lasd26/info (owner, 2026-10-16: "make a info page where we
 * can fill out addresses for airbnb, start line, van pick up etc."). Each
 * line is a mono eyebrow (the label) over the value in body type, line
 * breaks kept — a blank line is a paragraph gap, a "•" or "1." line hangs
 * its bullet so the Airbnb's house rules and the pairs read as a list —
 * links / handles / phone numbers made clickable, and
 * "— not yet —" in grey where nothing has been typed. A member reads.
 *
 * THE OWNER (owner, 2026-10-16, that night: "Allow me to add / remove
 * notes on the info page") gets, on every line, the EDIT pencil — the
 * value becomes a textarea with SAVE / CANCEL (PATCH /api/lasd26/info
 * { key, value }) — and REMOVE, a quiet mono word that on the first tap
 * turns into "REMOVE THIS LINE? · YES · NO" so a thumb in the van cannot
 * strike a line by accident (DELETE { key }; the line leaves the sheet,
 * and the server keeps the row with removedAt set so it never comes back).
 * At the foot, "+ ADD A NOTE" opens the same kind of form with a LABEL
 * over the text (POST { label, value } → 201 and the note joins the end
 * of the list). A NOTE is a line he added — its key starts with "n-", the
 * server's rule — and only a note's label can be changed, so its EDIT
 * form carries the LABEL input too and PATCH sends { key, value, label };
 * a built-in line's name is fixed. The hint (what goes here) is the
 * owner's: the textarea's placeholder and a grey line under an empty
 * value — a member just sees "not yet".
 *
 * The list is state, seeded from the server page so the first paint is
 * complete: a save changes the line in place, a remove drops it, an add
 * appends it, and each one refreshes the server tree behind (the "N OF M
 * FILLED IN" eyebrow).
 */

export type WireItem = { key: string; label: string; value: string; hint: string };

/** A line the owner added on the page (the server keys them "n-" + slug); every built-in key is something else. */
export function isNote(key: string): boolean {
  return key.startsWith("n-");
}

const API = "/api/lasd26/info";
/** The server's limit on a note's label (1–60 characters after trim). */
const MAX_LABEL = 60;

type ApiItem = { key?: unknown; label?: unknown; value?: unknown; hint?: unknown };
type ApiReply = { ok?: boolean; error?: string; item?: ApiItem; key?: unknown };

async function call(method: "PATCH" | "POST" | "DELETE", body: unknown): Promise<{ res: Response; data: ApiReply }> {
  const res = await fetch(API, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as ApiReply;
  return { res, data };
}

/** The line as the server saved it, the fallback filling in whatever it left out. */
function toWire(it: ApiItem | undefined, fallback: WireItem): WireItem {
  return {
    key: typeof it?.key === "string" ? it.key : fallback.key,
    label: typeof it?.label === "string" ? it.label : fallback.label,
    value: typeof it?.value === "string" ? it.value : fallback.value,
    hint: typeof it?.hint === "string" ? it.hint : fallback.hint,
  };
}

export function InfoSheet({ items, canEdit }: { items: WireItem[]; canEdit: boolean }) {
  const [list, setList] = useState(items);

  // The server's list wins whenever it arrives (router.refresh() after an
  // action here, or a line added or removed from his other phone): the
  // sheet and the "N OF M" eyebrow never disagree (review, 2026-10-16).
  useEffect(() => {
    setList(items);
  }, [items]);

  function saved(item: WireItem) {
    setList((prev) => prev.map((it) => (it.key === item.key ? item : it)));
  }
  function removed(key: string) {
    setList((prev) => prev.filter((it) => it.key !== key));
  }
  function added(item: WireItem) {
    // Notes come after the built-in lines, newest last (the server's sortOrder says the same).
    setList((prev) => [...prev.filter((it) => it.key !== item.key), item]);
  }

  return (
    <>
      {list.length === 0 ? (
        <p className="list-empty">NOTHING ON THE SHEET YET.</p>
      ) : (
        <dl className="if-list">
          {list.map((it) => (
            <InfoLine key={it.key} item={it} canEdit={canEdit} onSaved={saved} onRemoved={removed} />
          ))}
        </dl>
      )}
      {canEdit && <AddNote onAdded={added} />}
    </>
  );
}

/* ─── One line ──────────────────────────────────────────────────────────── */

/**
 * Escape backs out; Ctrl/Cmd+Enter saves — Enter alone is a new line in
 * the textarea, and in the LABEL input it moves on to the textarea instead
 * of submitting the form (the phone keyboard's return key would otherwise
 * file an empty note; review, 2026-10-16).
 */
function editKeys(e: ReactKeyEvent<HTMLElement>, cancel: () => void, save: () => void) {
  if (e.key === "Escape") {
    e.preventDefault();
    cancel();
  } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    save();
  } else if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
    e.preventDefault();
    e.currentTarget.querySelector("textarea")?.focus();
  }
}

/** Tall enough for the Airbnb's house rules (two dozen lines) without a scrollbar. */
function rowsFor(text: string): number {
  return Math.min(30, Math.max(3, text.split("\n").length + 1));
}

function InfoLine({
  item,
  canEdit,
  onSaved,
  onRemoved,
}: {
  item: WireItem;
  canEdit: boolean;
  onSaved: (item: WireItem) => void;
  onRemoved: (key: string) => void;
}) {
  const router = useRouter();
  const note = isNote(item.key);
  // The drafts live only while editing; the saved line is the parent's.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [labelDraft, setLabelDraft] = useState("");
  // REMOVE's second step: "REMOVE THIS LINE? · YES · NO".
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Escape = NO wherever the focus went (a tap elsewhere on the phone moves it).
  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setConfirming(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirming]);

  function start() {
    setDraft(item.value);
    setLabelDraft(item.label);
    setError("");
    setConfirming(false);
    setEditing(true);
  }
  function cancel() {
    if (busy) return;
    setEditing(false);
    setError("");
  }
  function ask() {
    if (busy) return;
    setError("");
    setConfirming(true);
  }

  // A note needs a name (the server answers 400 for a blank one); a built-in line's name is fixed.
  const labelOk = !note || labelDraft.trim() !== "";

  async function save() {
    if (busy || !labelOk) return;
    setBusy(true);
    setError("");
    try {
      const { res, data } = await call("PATCH", note ? { key: item.key, value: draft, label: labelDraft } : { key: item.key, value: draft });
      if (res.ok && data.ok) {
        onSaved(toWire(data.item, { ...item, value: draft.trim(), label: note ? labelDraft.trim() : item.label }));
        setEditing(false);
        router.refresh();
      } else {
        setError(data.error || "Did not save — try again.");
      }
    } catch {
      setError("Did not save — check your connection and try again.");
    }
    setBusy(false);
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { res, data } = await call("DELETE", { key: item.key });
      if (res.ok && data.ok) {
        // The line leaves the list (this unmounts); the server tree follows.
        onRemoved(item.key);
        router.refresh();
        return;
      }
      setError(data.error || "Did not remove — try again.");
    } catch {
      setError("Did not remove — check your connection and try again.");
    }
    setBusy(false);
  }

  const empty = item.value.trim() === "";

  return (
    <div className="if-item">
      <div className="if-head">
        <dt className="if-k mono">{item.label}</dt>
        {canEdit &&
          !editing &&
          (confirming ? (
            <div className="if-confirm" role="group" aria-label={`Remove ${item.label}?`}>
              <span className="if-q mono">Remove this line?</span>
              <button type="button" className="if-btn ink" disabled={busy} onClick={() => void remove()}>
                {busy ? "Removing…" : "Yes"}
              </button>
              {/* NO takes the focus: a second Enter after REMOVE does nothing, Escape says no too. */}
              <button type="button" className="if-btn" disabled={busy} autoFocus onClick={() => setConfirming(false)}>
                No
              </button>
            </div>
          ) : (
            <div className="if-tools">
              <button type="button" className="if-pencil mono" aria-label={`Edit ${item.label}`} onClick={start}>
                <span aria-hidden="true">✎</span> Edit
              </button>
              <button type="button" className="if-pencil if-x mono" aria-label={`Remove ${item.label}`} onClick={ask}>
                Remove
              </button>
            </div>
          ))}
      </div>
      <dd className="if-v">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            onKeyDown={(e) => editKeys(e, cancel, () => void save())}
          >
            {/* Only a note's name is his to change; a built-in line keeps its eyebrow. */}
            {note && (
              <input
                className="if-lab"
                type="text"
                aria-label="Label"
                value={labelDraft}
                maxLength={MAX_LABEL}
                placeholder="the label"
                disabled={busy}
                autoFocus
                onChange={(e) => setLabelDraft(e.target.value)}
              />
            )}
            <textarea
              className="if-ta"
              aria-label={item.label}
              value={draft}
              rows={rowsFor(draft)}
              placeholder={item.hint || "—"}
              disabled={busy}
              autoFocus={!note}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="if-actions">
              <button type="submit" className="if-btn fill" disabled={busy || !labelOk}>
                {busy ? "Saving…" : "Save"}
              </button>
              <button type="button" className="if-btn" onClick={cancel} disabled={busy}>
                Cancel
              </button>
              {item.hint && <span className="if-hint">{item.hint}</span>}
            </div>
            {error && <p className="if-err">{error}</p>}
          </form>
        ) : empty ? (
          <span className="if-empty">
            — not yet —{canEdit && item.hint ? <small>{item.hint}</small> : null}
          </span>
        ) : (
          <Lines text={item.value} />
        )}
        {/* A remove that did not go through says so under the line. */}
        {!editing && error && <p className="if-err">{error}</p>}
      </dd>
    </div>
  );
}

/* ─── + ADD A NOTE (owner only) ─────────────────────────────────────────── */

/**
 * The band under the list (owner, 2026-10-16: "Allow me to add / remove
 * notes on the info page"): one outlined button, and when it is open the
 * same form as EDIT with a LABEL over the text. SAVE waits for a label;
 * Ctrl+Enter saves, Escape cancels. POST /api/lasd26/info { label, value }
 * → 201 { ok, item }: the note joins the end of the list, closed, and the
 * form is cleared for the next one.
 */
function AddNote({ onAdded }: { onAdded: (item: WireItem) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = label.trim() !== "";

  function show() {
    setError("");
    setOpen(true);
  }
  function cancel() {
    if (busy) return;
    setOpen(false);
    setLabel("");
    setValue("");
    setError("");
  }
  async function save() {
    if (busy || !ready) return;
    setBusy(true);
    setError("");
    try {
      const { res, data } = await call("POST", { label, value });
      if (res.ok && data.ok && typeof data.item?.key === "string") {
        onAdded(toWire(data.item, { key: data.item.key, label: label.trim(), value: value.trim(), hint: "" }));
        setLabel("");
        setValue("");
        setOpen(false);
        router.refresh();
      } else {
        setError(data.error || "Did not save — try again.");
      }
    } catch {
      setError("Did not save — check your connection and try again.");
    }
    setBusy(false);
  }

  return (
    <div className="if-add">
      {open ? (
        <form
          className="if-add-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          onKeyDown={(e) => editKeys(e, cancel, () => void save())}
        >
          <span className="if-k mono">New note</span>
          <input
            className="if-lab"
            type="text"
            aria-label="Label"
            value={label}
            maxLength={MAX_LABEL}
            placeholder="e.g. Wi-Fi at the Airbnb"
            disabled={busy}
            autoFocus
            onChange={(e) => setLabel(e.target.value)}
          />
          <textarea
            className="if-ta"
            aria-label="The note"
            value={value}
            rows={rowsFor(value)}
            placeholder="the note"
            disabled={busy}
            onChange={(e) => setValue(e.target.value)}
          />
          <div className="if-actions">
            <button type="submit" className="if-btn fill" disabled={busy || !ready}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button type="button" className="if-btn" onClick={cancel} disabled={busy}>
              Cancel
            </button>
          </div>
          {error && <p className="if-err">{error}</p>}
        </form>
      ) : (
        <button type="button" className="if-add-btn" onClick={show}>
          + Add a note
        </button>
      )}
    </div>
  );
}

/* ─── The value, line by line ───────────────────────────────────────────── */

/** A line that starts a list item: "• No pets.", "1. (Keith & Tasha) …", "- gas". */
const BULLET = /^(?:[•\-–]|\d{1,2}\.)\s/;

/**
 * The value as the owner typed it, kept readable at any length: the lines
 * split on "\n", a blank line closes a paragraph (a gap, not an empty
 * line), and a line that starts with a bullet or a number hangs it, so a
 * rule that wraps on a phone stays indented under its first word. Each
 * line goes through linkify(), so the Airbnb's maps link is a link.
 */
function Lines({ text }: { text: string }) {
  const paras: string[][] = [];
  let cur: string[] = [];
  for (const line of text.split("\n")) {
    if (line.trim() === "") {
      if (cur.length) paras.push(cur);
      cur = [];
    } else {
      cur.push(line);
    }
  }
  if (cur.length) paras.push(cur);
  return (
    <div className="if-text">
      {paras.map((lines, p) => (
        <div className="if-p" key={p}>
          {lines.map((line, i) => (
            <div className={BULLET.test(line) ? "if-line if-bullet" : "if-line"} key={i}>
              {linkify(line)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─── Links in the text ─────────────────────────────────────────────────── */

/** Trailing punctuation that belongs to the sentence, not the link. */
const TRAIL = /[.,;:!?)\]]+$/;

// One pass, four kinds: an email (first, so "a@b.com" is not read as the
// handle "@b.com"), a URL, an IG handle, a US phone number. Everything
// else is text as typed.
const TOKEN = /([\w.+-]+@[\w-]+\.[\w.-]+)|(https?:\/\/[^\s<>"']+)|(@[A-Za-z0-9_.]{2,30})|((?:\+1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4})/g;

/**
 * The value with URLs, @handles (Instagram, as the landing does), US phone
 * numbers (tel:) and emails (mailto:) made into links. Plain text
 * otherwise; the line breaks come through white-space: pre-wrap.
 */
export function linkify(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    const raw = m[0];
    // "@name." / "https://x.y)." — the punctuation stays text.
    const hit = raw.replace(TRAIL, "");
    const tail = raw.slice(hit.length);
    if (at > last) out.push(text.slice(last, at));
    if (m[1]) {
      out.push(
        <a key={n++} href={`mailto:${hit}`}>
          {hit}
        </a>,
      );
    } else if (m[2]) {
      out.push(
        <a key={n++} href={hit} target="_blank" rel="noopener noreferrer">
          {hit}
        </a>,
      );
    } else if (m[3]) {
      out.push(
        <a key={n++} href={`https://instagram.com/${hit.slice(1)}`} target="_blank" rel="noopener noreferrer">
          {hit}
        </a>,
      );
    } else {
      out.push(
        <a key={n++} href={`tel:${hit.replace(/[^\d+]/g, "")}`}>
          {hit}
        </a>,
      );
    }
    if (tail) out.push(tail);
    last = at + raw.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/* ─── Signed out / not on the team ─────────────────────────────────────── */

export function InfoSignIn() {
  return (
    <div className="if-notice">
      <strong>Sign in</strong>
      This page is for the crew. Sign in with Google to see it.
      <br />
      Not on the team? You need the invite link from the group chat.
      <br />
      {/* Back to this page after Google (lasdPath, lib/lasd26/paths.ts). */}
      <button type="button" className="if-go" onClick={() => signIn("google", { callbackUrl: lasdPath("/info") })}>
        Sign in with Google →
      </button>
    </div>
  );
}

export function InfoInvite() {
  return (
    <div className="if-notice">
      <strong>Not on the team yet</strong>
      You are signed in, but this account has not joined the LASD26 team.
      <br />
      You need the invite link from the group chat — open it, pick RUNNER or CREW, and this page unlocks.
    </div>
  );
}
