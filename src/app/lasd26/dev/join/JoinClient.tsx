"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { lasdPath } from "@/lib/lasd26/paths";

/**
 * The client half of the join page (lasdPath("/join"), lib/lasd26/paths.ts):
 * the sign-in button, the join form, and the change-role control for
 * someone already on the team. The server page decides which one renders;
 * these only talk to /api/lasd26/team/join, and every page address they
 * send the browser to comes from lasdPath so they stay inside the dev copy.
 */

type Role = "runner" | "crew";

const ROLES: { key: Role; label: string; hint: string }[] = [
  { key: "runner", label: "Runner", hint: "on the roster" },
  // Owner, 2026-10-15: "two crew members that are allowed to submit expense
  // reports but aren't running".
  { key: "crew", label: "Crew", hint: "not running, helping" },
];

/**
 * Google sign-in that lands back on this very link (token and all). The
 * callback is RELATIVE on purpose: next-auth's default redirect keeps a
 * relative URL on whatever host served the page, but swaps an absolute
 * one for NEXTAUTH_URL when the hosts differ (www.rowtember.com vs
 * mikianmusser.com, a preview) — and the token would go with it.
 */
export function SignInToJoin({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="tm-go wide"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void signIn("google", { callbackUrl: `${lasdPath("/join")}?t=${encodeURIComponent(token)}` });
      }}
    >
      {busy ? "Opening Google…" : "Sign in with Google to join →"}
    </button>
  );
}

async function postJoin(body: { token: string; role: Role; name: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/lasd26/team/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (res.ok && data.ok) return { ok: true };
    return { ok: false, error: data.error || "Something broke — try again." };
  } catch {
    return { ok: false, error: "Something broke — check your connection and try again." };
  }
}

/**
 * The join form (dark block, same look as the crew-call form): name
 * prefilled from the Google account, RUNNER / CREW, JOIN. On success the
 * browser goes to the expenses page — a full navigation so the server
 * re-reads the membership.
 */
export function JoinForm({ token, defaultName, email }: { token: string; defaultName: string; email: string }) {
  const [name, setName] = useState(defaultName);
  const [role, setRole] = useState<Role>("runner");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (busy) return;
    if (!name.trim()) {
      setError("ADD YOUR NAME FIRST.");
      return;
    }
    setBusy(true);
    setError("");
    const r = await postJoin({ token, role, name: name.trim() });
    if (r.ok) {
      window.location.assign(lasdPath("/expenses"));
      return;
    }
    setError(r.error.toUpperCase());
    setBusy(false);
  }

  return (
    <div className="jn-form">
      <label className="fl" htmlFor="j-name">
        Your name
      </label>
      <input
        type="text"
        id="j-name"
        autoComplete="name"
        value={name}
        disabled={busy}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
        }}
      />
      <p className="who">SIGNED IN AS {email.toUpperCase()}</p>
      <label className="fl">You are</label>
      <div className="pills">
        {ROLES.map((r) => (
          <label className="pill" key={r.key}>
            <input type="radio" name="role" value={r.key} checked={role === r.key} disabled={busy} onChange={() => setRole(r.key)} />
            <span>
              {r.label.toUpperCase()}
              <small>{r.hint}</small>
            </span>
          </label>
        ))}
      </div>
      <button type="button" className="send" onClick={() => void submit()} disabled={busy}>
        {busy ? "JOINING…" : "Join the team →"}
      </button>
      {error && <p className="jn-err">{error}</p>}
    </div>
  );
}

/**
 * Already on the team: show the role, link to expenses, and a CHANGE ROLE
 * control that re-posts through the same (still valid) link — joinTeam is
 * idempotent, so this only updates the row.
 */
export function ChangeRole({ token, current, name }: { token: string; current: Role; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save() {
    if (busy || role === current) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setError("");
    const r = await postJoin({ token, role, name });
    if (r.ok) {
      setSaved(true);
      setOpen(false);
      router.refresh();
    } else {
      setError(r.error);
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <div className="tm-actions">
        <a className="tm-btn fill" href={lasdPath("/expenses")}>
          Expenses →
        </a>
        <button type="button" className="tm-btn quiet" onClick={() => setOpen(true)}>
          Change role
        </button>
        {saved && <span className="tm-note tm-ok">SAVED</span>}
      </div>
    );
  }

  return (
    <div>
      <div className="pills">
        {ROLES.map((r) => (
          <label className="pill" key={r.key}>
            <input type="radio" name="role" value={r.key} checked={role === r.key} disabled={busy} onChange={() => setRole(r.key)} />
            <span>
              {r.label.toUpperCase()}
              <small>{r.hint}</small>
            </span>
          </label>
        ))}
      </div>
      <div className="tm-actions">
        <button type="button" className="tm-btn fill" onClick={() => void save()} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" className="tm-btn quiet" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
      </div>
      {error && <p className="tm-err">{error}</p>}
    </div>
  );
}
