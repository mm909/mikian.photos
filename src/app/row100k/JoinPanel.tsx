"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import type { Division } from "@/lib/row100k";

const DIVISIONS: { value: Division; label: string }[] = [
  { value: "M", label: "MEN'S BOARD" },
  { value: "F", label: "WOMEN'S BOARD" },
];

/* The in-place signup: signed out → one Google button; signed in → the
 * two-field entry form. After a successful join the page refreshes and the
 * server swaps this panel for the dashboard. Also reused (joined=true) as
 * the "edit profile" form inside the dashboard. */
export function JoinPanel(props: {
  mode: "signedOut" | "form";
  joined?: boolean;
  signedInAs?: string;
  initialName?: string;
  initialInstagram?: string;
  initialDivision?: Division | null;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(props.initialName ?? "");
  const [instagram, setInstagram] = useState(props.initialInstagram ?? "");
  const [division, setDivision] = useState<Division | null>(props.initialDivision ?? null);
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);

  if (props.mode === "signedOut") {
    return (
      <div>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", maxWidth: "48ch" }}>
          Sign in, claim your rower number, and you&rsquo;re on the board. Your
          Google account just keeps your meters yours — nothing gets posted
          anywhere.
        </p>
        <button
          type="button"
          className="goog"
          onClick={() => signIn("google", { callbackUrl: "/row100k#join" })}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          Continue with Google
        </button>
      </div>
    );
  }

  const submit = async () => {
    setError(null);
    if (name.replace(/\s+/g, " ").trim().length < 2) {
      setError("Add the name you want on the board.");
      return;
    }
    if (!/^@?[a-zA-Z0-9._]{1,30}$/.test(instagram.trim())) {
      setError("Add your Instagram handle — letters, numbers, dots and underscores.");
      return;
    }
    if (!division) {
      setError("Pick which board you're competing on.");
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/row100k/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name.trim(), instagram: instagram.trim(), division }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        props.onSaved?.();
        router.refresh();
        return;
      }
      setError(data.error ?? "Something went wrong — try again.");
    } catch {
      setError("Something went wrong — try again.");
    }
    setStatus("idle");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="grid2">
        <div>
          <label className="fl" htmlFor="row-name">Name on the board</label>
          <input
            id="row-name"
            type="text"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </div>
        <div>
          <label className="fl" htmlFor="row-ig">Instagram</label>
          <input
            id="row-ig"
            type="text"
            value={instagram}
            maxLength={31}
            placeholder="@handle"
            onChange={(e) => setInstagram(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
          />
        </div>
      </div>
      <label className="fl">Compete on</label>
      <div className="pills" role="radiogroup" aria-label="Which board you compete on">
        {DIVISIONS.map((d) => (
          <label className="pill" key={d.value}>
            <input
              type="radio"
              name="division"
              checked={division === d.value}
              onChange={() => setDivision(d.value)}
            />
            <span>{d.label}</span>
          </label>
        ))}
      </div>
      <button className="send" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "…" : props.joined ? "Save changes" : "I'm in"}
      </button>
      {error && <p className="form-err">{error}</p>}
      {props.signedInAs && !props.joined && (
        <p className="signed-note">SIGNED IN AS {props.signedInAs.toUpperCase()}</p>
      )}
    </form>
  );
}
