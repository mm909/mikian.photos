"use client";

import { useState } from "react";

const ROLES = ["Runner", "Crew", "Either"] as const;

type Status = "idle" | "sending" | "sent" | "error";

/** "@handle", "handle", or a pasted profile URL → bare handle. */
function igHandle(raw: string): string {
  let h = raw.trim();
  const m = h.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (m) h = m[1];
  return h.replace(/^@+/, "").slice(0, 64);
}

/** `simulate` (owner-only, decided server-side) adds a dry-run button that
 *  shows the confirmation screen without hitting the API. */
export function CrewForm({ simulate = false }: { simulate?: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [role, setRole] = useState<string>("Runner");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [simulated, setSimulated] = useState(false);

  function validate(): boolean {
    if (!name.trim()) {
      setStatus("error");
      setError("ADD YOUR NAME FIRST.");
      return false;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setStatus("error");
      setError("ADD AN EMAIL SO WE CAN REACH YOU.");
      return false;
    }
    return true;
  }

  async function submit() {
    if (status === "sending" || status === "sent") return;
    if (!validate()) return;
    setSimulated(false);
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/lasd26/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          instagram: igHandle(instagram),
          role,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (res.ok && data.ok) {
        setStatus("sent");
      } else {
        setStatus("error");
        setError((data.error || "Something broke — try again.").toUpperCase());
      }
    } catch {
      setStatus("error");
      setError("SOMETHING BROKE — CHECK YOUR CONNECTION AND TRY AGAIN.");
    }
  }

  function simulateSend() {
    if (status === "sending" || status === "sent") return;
    if (!validate()) return;
    setError("");
    setSimulated(true);
    setStatus("sent");
  }

  function resetSimulation() {
    setSimulated(false);
    setStatus("idle");
    setError("");
  }

  const sent = status === "sent";
  const locked = sent || status === "sending";

  return (
    <>
      <label className="fl" htmlFor="a-name">
        Full name
      </label>
      <input
        type="text"
        id="a-name"
        autoComplete="name"
        value={name}
        disabled={locked}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
      />
      <label className="fl" htmlFor="a-email">
        Email
      </label>
      <input
        type="email"
        id="a-email"
        autoComplete="email"
        inputMode="email"
        value={email}
        disabled={locked}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
      />
      <label className="fl" htmlFor="a-ig">
        Instagram
      </label>
      <input
        type="text"
        id="a-ig"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={instagram}
        disabled={locked}
        onChange={(e) => setInstagram(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
      />
      <label className="fl">Role</label>
      <div className="pills">
        {ROLES.map((r) => (
          <label className="pill" key={r}>
            <input
              type="radio"
              name="role"
              value={r}
              checked={role === r}
              disabled={locked}
              onChange={() => setRole(r)}
            />
            <span>{r.toUpperCase()}</span>
          </label>
        ))}
      </div>
      <button
        type="button"
        className="send"
        onClick={submit}
        disabled={status === "sending" || sent}
      >
        {sent ? "RECEIVED ✓" : status === "sending" ? "SENDING…" : "Send it →"}
      </button>
      {simulate && !sent && (
        <button
          type="button"
          className="sim-btn mono"
          onClick={simulateSend}
          disabled={status === "sending"}
        >
          SIMULATE — TEST THE END SCREEN, NOTHING SENT
        </button>
      )}
      {sent && (
        <div className="sent">
          {name.trim().toUpperCase()} · {role.toUpperCase()}
          <br />
          {email.trim()}
          {igHandle(instagram) ? ` · @${igHandle(instagram)}` : ""}
          <br />
          THANK YOU FOR YOUR INTEREST — WE&rsquo;LL BE IN TOUCH.
        </div>
      )}
      {sent && simulated && (
        <p className="sim-note mono">
          TEST ONLY — NOTHING WAS SENT ·{" "}
          <button type="button" onClick={resetSimulation}>
            RESET →
          </button>
        </p>
      )}
      {status === "error" && <div className="sent">{error}</div>}
    </>
  );
}
