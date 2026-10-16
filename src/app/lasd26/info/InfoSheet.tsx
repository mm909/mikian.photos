"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { lasdPath } from "@/lib/lasd26/paths";

/**
 * THE SHEET on /lasd26/info (owner, 2026-10-16: "make a info page where we
 * can fill out addresses for airbnb, start line, van pick up etc."). Each
 * line is a mono eyebrow (the label) over the value in body type, line
 * breaks kept, links / handles / phone numbers made clickable, and
 * "— not yet —" in grey where nothing has been typed. The OWNER gets an
 * EDIT pencil on every line that swaps the value for a textarea with SAVE
 * / CANCEL (PATCH /api/lasd26/info { key, value }); a member reads. The
 * hint (what goes here) is the owner's: the textarea's placeholder and a
 * grey line under an empty value — a member just sees "not yet".
 *
 * Rendered from the server page's list, so the first paint is complete;
 * a save updates the line in place and refreshes the server tree behind
 * it.
 */

export type WireItem = { key: string; label: string; value: string; hint: string };

export function InfoSheet({ items, canEdit }: { items: WireItem[]; canEdit: boolean }) {
  return (
    <dl className="if-list">
      {items.map((it) => (
        <InfoLine key={it.key} item={it} canEdit={canEdit} />
      ))}
    </dl>
  );
}

function InfoLine({ item, canEdit }: { item: WireItem; canEdit: boolean }) {
  const router = useRouter();
  // The saved value; the draft lives only while editing.
  const [value, setValue] = useState(item.value);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function start() {
    setDraft(value);
    setError("");
    setEditing(true);
  }
  function cancel() {
    if (busy) return;
    setEditing(false);
    setError("");
  }
  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/lasd26/info", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: item.key, value: draft }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; item?: { value?: string } };
      if (res.ok && data.ok) {
        setValue(typeof data.item?.value === "string" ? data.item.value : draft.trim());
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

  const empty = value.trim() === "";
  const rows = Math.min(14, Math.max(3, draft.split("\n").length + 1));

  return (
    <div className="if-item">
      <div className="if-head">
        <dt className="if-k mono">{item.label}</dt>
        {canEdit && !editing && (
          <button type="button" className="if-pencil mono" aria-label={`Edit ${item.label}`} onClick={start}>
            <span aria-hidden="true">✎</span> Edit
          </button>
        )}
      </div>
      <dd className="if-v">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <textarea
              className="if-ta"
              aria-label={item.label}
              value={draft}
              rows={rows}
              placeholder={item.hint || "—"}
              disabled={busy}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Escape backs out; Ctrl/Cmd+Enter saves — Enter alone is a new line.
                if (e.key === "Escape") cancel();
                else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void save();
                }
              }}
            />
            <div className="if-actions">
              <button type="submit" className="if-btn fill" disabled={busy}>
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
          <span className="if-text">{linkify(value)}</span>
        )}
      </dd>
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
