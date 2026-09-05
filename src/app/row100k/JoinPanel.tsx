"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import type { Division } from "@/lib/row100k";
import { OptIn } from "./OptIn";

const DIVISIONS: { value: Division; label: string }[] = [
  { value: "M", label: "MEN'S BOARD" },
  { value: "F", label: "WOMEN'S BOARD" },
];

/* The in-place signup: signed out → OPT IN (the landing's button, signs in
 * with Google); signed in → the entry form. Vertical on purpose: name, then
 * Instagram, then the two board pills one per row, then OPT IN again as the
 * submit (owner call, 2026-09-05 — no "I'm in", no name-and-Instagram on one
 * line, no age). After a successful join the page refreshes and the server
 * swaps this panel for the rower's own front page. Also reused (joined=true)
 * as the profile settings form, where the button says Save changes. */
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
    // Sign-in lands back on #join, where the form is waiting.
    return <OptIn onClick={() => signIn("google", { callbackUrl: "/row100k#join" })}>Opt in</OptIn>;
  }

  const submit = async () => {
    if (status === "sending") return;
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
        // First join: leave a note for the rower's front page that's about
        // to replace this panel — it auto-opens the share dialog on the bib
        // card so the new rower can post their number straight away.
        if (!props.joined) {
          try {
            sessionStorage.setItem("row100k.justJoined", "1");
          } catch {
            /* storage blocked — they just miss the auto-open */
          }
        }
        router.refresh();
        // First join: stay in "sending" — the refresh swaps this panel out.
        // Editing (joined): the form stays mounted, so it has to land
        // somewhere or the button spins forever (the bug this fixes).
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
      className="join-v"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label className="fl" htmlFor="row-name">Name on the board</label>
      <input
        id="row-name"
        type="text"
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        autoComplete="name"
      />
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
      <label className="fl">Compete on</label>
      <div className="pills col" role="radiogroup" aria-label="Which board you compete on">
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
      {/* Enter in a field still submits: the visible button is OPT IN below,
       * which is not a submit button, and a form with two text fields and
       * no submit button swallows implicit submission. */}
      <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      {props.joined ? (
        <button className="send" type="submit" disabled={status === "sending"}>
          {status === "sending" ? "…" : "Save changes"}
        </button>
      ) : (
        <div className="join-go">
          <OptIn size="m" onClick={() => void submit()}>
            Opt in
          </OptIn>
        </div>
      )}
      {status === "sending" && !props.joined && <p className="signed-note">SAVING…</p>}
      {status === "saved" && <p className="form-ok">SAVED — THE BOARD&rsquo;S UPDATED.</p>}
      {error && <p className="form-err">{error}</p>}
      {props.signedInAs && !props.joined && (
        <p className="signed-note">SIGNED IN AS {props.signedInAs.toUpperCase()}</p>
      )}
    </form>
  );
}
