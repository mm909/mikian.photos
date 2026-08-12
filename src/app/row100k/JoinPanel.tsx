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
  onSaved?: (values: { displayName: string; instagram: string; division: Division }) => void;
  /* Dev preview only: skip the network — validate locally, then hand the
   * values to onSaved as if the join succeeded. */
  simulate?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(props.initialName ?? "");
  const [instagram, setInstagram] = useState(props.initialInstagram ?? "");
  const [division, setDivision] = useState<Division | null>(props.initialDivision ?? null);
  const [status, setStatus] = useState<"idle" | "sending" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  if (props.mode === "signedOut") {
    return (
      <button
        type="button"
        className="cc-mark btn-mark"
        style={{ border: "none", cursor: "pointer" }}
        onClick={() => signIn("google", { callbackUrl: "/row100k#join" })}
      >
        I&rsquo;m in → sign in with Google
      </button>
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
    const values = {
      displayName: name.replace(/\s+/g, " ").trim(),
      instagram: instagram.trim().replace(/^@+/, ""),
      division,
    };
    if (props.simulate) {
      props.onSaved?.(values);
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/row100k/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: values.displayName, instagram: values.instagram, division }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        props.onSaved?.(values);
        // First join: leave a note for the dashboard that's about to replace
        // this panel — it auto-opens the share dialog on the bib card so the
        // new rower can post their number straight away.
        if (!props.joined) {
          try {
            sessionStorage.setItem("row100k.justJoined", "1");
          } catch {
            /* storage blocked — they just miss the auto-open */
          }
        }
        router.refresh();
        // First join: stay in "sending" — the refresh swaps this panel for
        // the dashboard. Editing (joined): the form stays mounted, so it has
        // to land somewhere or the button spins forever (the bug this fixes).
        if (props.joined) {
          setStatus("saved");
          setTimeout(() => setStatus("idle"), 4000);
        }
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
      {status === "saved" && <p className="form-ok">SAVED — THE BOARD&rsquo;S UPDATED.</p>}
      {error && <p className="form-err">{error}</p>}
      {props.signedInAs && !props.joined && (
        <p className="signed-note">SIGNED IN AS {props.signedInAs.toUpperCase()}</p>
      )}
    </form>
  );
}
