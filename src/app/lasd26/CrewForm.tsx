"use client";

import { useState } from "react";

const ROLES = ["Runner", "Wheels / crew", "Either"] as const;

type Status = "idle" | "sending" | "sent" | "error";

export function CrewForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("Runner");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function submit() {
    if (status === "sending" || status === "sent") return;
    if (!name.trim()) {
      setStatus("error");
      setError("ADD YOUR NAME FIRST.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setStatus("error");
      setError("ADD AN EMAIL SO WE CAN REACH YOU.");
      return;
    }
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/lasd26/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), role }),
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
      {sent && (
        <div className="sent">
          {name.trim().toUpperCase()} · {role.toUpperCase()}
          <br />
          {email.trim()}
          <br />
          THANK YOU FOR YOUR INTEREST — WE&rsquo;LL BE IN TOUCH.
          <br />
          THE VAN ONLY SEATS 10, SO WE&rsquo;LL CONFIRM SPOTS PERSONALLY.
        </div>
      )}
      {status === "error" && <div className="sent">{error}</div>}
    </>
  );
}
