"use client";

import { useState } from "react";

const ROLES = ["Runner", "Wheels / crew", "Either"] as const;

export function CrewForm() {
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("Runner");
  const [sent, setSent] = useState(false);

  const subject = `LASD26 crew — ${name.trim() || "(no name)"}`;
  const body = `Name: ${name.trim()}\nRole: ${role}\n\n(sent from the LASD26 crew call page)`;
  const href = `mailto:mikianmusser@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

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
        onChange={(e) => setName(e.target.value)}
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
              onChange={() => setRole(r)}
            />
            <span>{r.toUpperCase()}</span>
          </label>
        ))}
      </div>
      <a className="send" href={href} onClick={() => setSent(true)}>
        Send it →
      </a>
      {sent && (
        <div className="sent">
          YOUR MAIL APP JUST OPENED WITH THE DETAILS —
          <br />
          HIT SEND THERE AND YOU&rsquo;RE IN THE PILE.
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
    </>
  );
}
