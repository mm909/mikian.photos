"use client";

import { useState } from "react";

const ROLES = ["Runner", "Wheels / crew", "Either"] as const;

type Status = "idle" | "sending" | "sent" | "error";

export function CrewForm() {
  const [name, setName] = useState("");
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
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/lasd26/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), role }),
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
        disabled={sent}
        onChange={(e) => setName(e.target.value)}
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
              disabled={sent}
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
        {sent ? "IN THE PILE ✓" : status === "sending" ? "SENDING…" : "Send it →"}
      </button>
      {sent && (
        <div className="sent">
          YOU&rsquo;RE IN THE PILE — MIKIAN JUST GOT AN EMAIL WITH YOUR NAME ON
          IT.
          <br />
          <a
            href="https://instagram.com/mikian_"
            target="_blank"
            rel="noopener noreferrer"
          >
            @MIKIAN_
          </a>{" "}
          WILL GET BACK TO YOU.
        </div>
      )}
      {status === "error" && <div className="sent">{error}</div>}
    </>
  );
}
