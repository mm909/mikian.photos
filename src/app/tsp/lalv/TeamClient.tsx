"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { teamPath, tspApi, tspPath } from "@/lib/tsp/paths";
import { ROUTES } from "./course";

/**
 * The client halves of the hub, the join page and the team page: sign in,
 * make a team, join one, and the captain's console (the invite link, the
 * roster, the settings). The server pages decide which renders; these only
 * talk to /api/tsp. After a write the browser does a full navigation or a
 * reload so the server re-reads who is who.
 */

type Role = "runner" | "crew";

async function send(url: string, method: string, body?: unknown): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok && data.ok) return { ok: true, data };
    return { ok: false, error: typeof data.error === "string" ? data.error : "Something broke — try again." };
  } catch {
    return { ok: false, error: "Something broke — check your connection and try again." };
  }
}

/** Google, then straight back to `callback` (relative, so the host stays the one that served the page). */
export function SignInButton({ callback, label = "Sign in with Google →" }: { callback: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="tm-go"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void signIn("google", { callbackUrl: callback });
      }}
    >
      {busy ? "Opening Google…" : label}
    </button>
  );
}

function RolePills({ value, onChange, disabled }: { value: Role; onChange: (r: Role) => void; disabled: boolean }) {
  return (
    <div className="tsp-pills" role="radiogroup" aria-label="Runner or crew">
      {(
        [
          ["runner", "Runner", "running legs"],
          ["crew", "Crew", "driving, helping"],
        ] as const
      ).map(([key, label, hint]) => (
        <label className="tsp-pill" key={key}>
          <input type="radio" name="tsp-role" checked={value === key} disabled={disabled} onChange={() => onChange(key)} />
          <span>
            {label}
            <small>{hint}</small>
          </span>
        </label>
      ))}
    </div>
  );
}

/* ─── Make a team ────────────────────────────────────────────────────────── */

export function NewTeamForm({ defaultName }: { defaultName: string }) {
  const [name, setName] = useState("");
  const [you, setYou] = useState(defaultName);
  const [secrets, setSecrets] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (busy) return;
    if (name.trim().length < 2) return setErr("Give the team a name.");
    setBusy(true);
    setErr("");
    const r = await send("/api/tsp/teams", "POST", { name, yourName: you, secrets });
    if (!r.ok) {
      setErr(r.error);
      setBusy(false);
      return;
    }
    window.location.assign(teamPath(String(r.data.slug), "/team"));
  }

  return (
    <div className="tsp-form">
      <div>
        <label className="k" htmlFor="tsp-new-name">
          Team name
        </label>
        <input id="tsp-new-name" className="tsp-in" type="text" maxLength={60} value={name} disabled={busy} placeholder="Just Friends LV" onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="k" htmlFor="tsp-new-you">
          Your name on the roster
        </label>
        <input id="tsp-new-you" className="tsp-in" type="text" maxLength={80} value={you} disabled={busy} onChange={(e) => setYou(e.target.value)} />
      </div>
      <label className="tm-toggle">
        <input type="checkbox" checked={secrets} disabled={busy} onChange={(e) => setSecrets(e.target.checked)} />
        <span className="sw" aria-hidden />
        <span className="t">
          Secrets team
          <small>the course runs through the checkpoints</small>
        </span>
      </label>
      <div>
        <button type="button" className="tm-go" style={{ marginTop: 0 }} disabled={busy} onClick={() => void submit()}>
          {busy ? "Making it…" : "Make the team →"}
        </button>
        {err && <p className="tm-err">{err}</p>}
        <p className="tm-note">You become its captain and get the link to send your team.</p>
      </div>
    </div>
  );
}

/* ─── Join ───────────────────────────────────────────────────────────────── */

export function JoinForm({ slug, token, defaultName, current }: { slug: string; token: string; defaultName: string; current?: Role }) {
  const [name, setName] = useState(defaultName);
  const [role, setRole] = useState<Role>(current ?? "runner");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (busy) return;
    if (!name.trim()) return setErr("Add your name first.");
    setBusy(true);
    setErr("");
    const r = await send(tspApi(slug, "/join"), "POST", { token, role, name });
    if (!r.ok) {
      setErr(r.error);
      setBusy(false);
      return;
    }
    window.location.assign(teamPath(slug, ""));
  }

  return (
    <div className="tsp-form">
      <div>
        <label className="k" htmlFor="tsp-join-name">
          Your name
        </label>
        <input id="tsp-join-name" className="tsp-in" type="text" maxLength={80} value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <span className="tsp-k">You are</span>
        <RolePills value={role} onChange={setRole} disabled={busy} />
      </div>
      <div>
        <button type="button" className="tm-go" style={{ marginTop: 0 }} disabled={busy} onClick={() => void submit()}>
          {busy ? "Saving…" : current ? "Save →" : "Join the team →"}
        </button>
        {err && <p className="tm-err">{err}</p>}
      </div>
    </div>
  );
}

/* ─── The captain's console ──────────────────────────────────────────────── */

export function InviteBox({ slug, url, uses }: { slug: string; url: string | null; uses: number }) {
  const [link, setLink] = useState(url);
  const [n, setN] = useState(uses);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function rotate() {
    if (busy) return;
    if (link && !window.confirm("Make a new link? The old one stops working for anyone who has not joined yet.")) return;
    setBusy(true);
    const r = await send(tspApi(slug, "/invite"), "POST");
    setBusy(false);
    if (!r.ok) return setNote(r.error);
    setLink(String(r.data.url));
    setN(0);
    setNote("New link made.");
  }
  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setNote("Copied — paste it in the group chat.");
    } catch {
      setNote("Could not copy — press and hold the link instead.");
    }
  }

  return (
    <div className="tm-card">
      {link ? <input className="tm-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="The invite link" /> : <p className="tm-note">No link yet.</p>}
      <div className="tm-actions">
        {link && (
          <button type="button" className="tm-btn fill" onClick={() => void copy()}>
            Copy the link
          </button>
        )}
        <button type="button" className="tm-btn" disabled={busy} onClick={() => void rotate()}>
          {link ? "Make a new link" : "Make the link"}
        </button>
      </div>
      <p className="tm-note">
        {link ? `${n} joined through this link. ` : ""}Anyone with the link signs in with Google, picks runner or crew, and is on the team.{note && <strong className="tm-ok"> {note}</strong>}
      </p>
    </div>
  );
}

export function MemberActions({ slug, id, name, captain, role, self }: { slug: string; id: string; name: string; captain: boolean; role: Role; self: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function run(method: string, body?: unknown, ask?: string) {
    if (busy) return;
    if (ask && !window.confirm(ask)) return;
    setBusy(true);
    setErr("");
    const r = await send(tspApi(slug, `/members/${id}`), method, body);
    if (!r.ok) {
      setErr(r.error);
      setBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <div className="acts">
      <button type="button" className="rt-mini" disabled={busy} onClick={() => void run("PATCH", { captain: !captain }, captain ? `Take captain off ${name}?` : `Make ${name} a captain? Captains can edit the team, the info sheet and every expense.`)}>
        {captain ? "Unmake captain" : "Make captain"}
      </button>
      <button type="button" className="rt-mini" disabled={busy} onClick={() => void run("PATCH", { role: role === "runner" ? "crew" : "runner" })}>
        {role === "runner" ? "To crew" : "To runner"}
      </button>
      {!self && (
        <button type="button" className="rt-mini" disabled={busy} onClick={() => void run("DELETE", undefined, `Take ${name} off the team? Their expenses stay on the sheet; their legs go back to nobody.`)}>
          Remove
        </button>
      )}
      {err && <p className="tm-err" style={{ flexBasis: "100%" }}>{err}</p>}
    </div>
  );
}

/** <input type="datetime-local"> wants "YYYY-MM-DDTHH:MM" in the phone's own zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const paceText = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
function paceSec(text: string): number | null {
  const m = /^\s*(\d{1,2})(?::([0-5]\d))?\s*$/.exec(text);
  return m ? Number(m[1]) * 60 + Number(m[2] ?? 0) : null;
}

export type SettingsInitial = { route: string; name: string; secrets: boolean; shareVan: boolean; startAt: string | null; planPaceSec: number; splitCount: number };

export function TeamSettingsForm({ slug, initial }: { slug: string; initial: SettingsInitial }) {
  const [name, setName] = useState(initial.name);
  const [secrets, setSecrets] = useState(initial.secrets);
  const [route, setRoute] = useState(initial.route);
  const [shareVan, setShareVan] = useState(initial.shareVan);
  const [start, setStart] = useState(toLocalInput(initial.startAt));
  const [pace, setPace] = useState(paceText(initial.planPaceSec));
  const [split, setSplit] = useState(String(initial.splitCount));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  async function save() {
    if (busy) return;
    const sec = paceSec(pace);
    if (sec === null) return setErr("Write the pace as minutes:seconds a mile, like 9:00.");
    setBusy(true);
    setErr("");
    setNote("");
    const r = await send(tspApi(slug, "/settings"), "PATCH", {
      name,
      route,
      secrets,
      shareVan,
      startAt: start ? new Date(start).toISOString() : null,
      planPaceSec: sec,
      splitCount: Number(split),
    });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setNote("Saved.");
  }

  return (
    <div className="tsp-form">
      <div>
        <label className="k" htmlFor="tsp-set-name">
          Team name
        </label>
        <input id="tsp-set-name" className="tsp-in" type="text" maxLength={60} value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <span className="tsp-k">The route</span>
        <div className="tsp-pills tsp-routes" role="radiogroup" aria-label="The route">
          {ROUTES.map((r) => (
            <label className="tsp-pill" key={r.id}>
              <input type="radio" name="tsp-route" checked={route === r.id} disabled={busy} onChange={() => setRoute(r.id)} />
              <span>
                {r.label}
                <small>{r.blurb}</small>
              </span>
            </label>
          ))}
        </div>
        {route !== initial.route && <p className="tm-note">Mile numbers differ between routes after Baker (mile 213): check the legs past there once you save.</p>}
      </div>
      <div>
        <label className="k" htmlFor="tsp-set-start">
          Start (this phone&rsquo;s clock)
        </label>
        <input id="tsp-set-start" className="tsp-in" type="datetime-local" value={start} disabled={busy} onChange={(e) => setStart(e.target.value)} />
      </div>
      <div className="tm-inline">
        <div>
          <label className="k" htmlFor="tsp-set-pace">
            Planned pace / mi
          </label>
          <input id="tsp-set-pace" className="tm-num" type="text" inputMode="numeric" value={pace} disabled={busy} onChange={(e) => setPace(e.target.value)} />
        </div>
        <div>
          <label className="k" htmlFor="tsp-set-split">
            Expenses split
          </label>
          <input id="tsp-set-split" className="tm-num" type="number" min={1} max={60} value={split} disabled={busy} onChange={(e) => setSplit(e.target.value)} />
        </div>
      </div>
      <label className="tm-toggle">
        <input type="checkbox" checked={shareVan} disabled={busy} onChange={(e) => setShareVan(e.target.checked)} />
        <span className="sw" aria-hidden />
        <span className="t">
          Show our van to the other teams
          <small>only the van, only to people on a TSP team here</small>
        </span>
      </label>
      <label className="tm-toggle">
        <input type="checkbox" checked={secrets} disabled={busy} onChange={(e) => setSecrets(e.target.checked)} />
        <span className="sw" aria-hidden />
        <span className="t">
          Secrets team
          <small>the course runs through the checkpoints</small>
        </span>
      </label>
      <div>
        <button type="button" className="tm-btn fill" disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save"}
        </button>
        {note && <span className="tm-note tm-ok"> {note}</span>}
        {err && <p className="tm-err">{err}</p>}
      </div>
    </div>
  );
}

/** The hub's two doors for a signed-in visitor with no team. */
export const NEW_TEAM_PATH = tspPath("/new");
