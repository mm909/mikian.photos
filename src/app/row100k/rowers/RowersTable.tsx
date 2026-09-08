"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FIRST_DAY,
  LAST_DAY,
  TITLE_MAX,
  fmtDay,
  fmtDuration,
  fmtMeters,
  fmtRowerNumber,
  fmtSplit,
  parseDurationText,
} from "@/lib/row100k";
import { formatTimeDigits } from "../LogRow";

/* THE ROWERS (owner ask, 2026-09-08): the signups roster and the moderation
 * page folded into ONE admin table on /row100k/signups. Every rower on a
 * .board row — number, name, board, instagram, joined, meters rowed,
 * sessions — with a ... menu on the right end (rows, profile, instagram,
 * copy email, remove rower). Clicking a rower opens their log inside the
 * same table: day, title, meters, time, split, and EDIT / REMOVE on every
 * row, through the same PATCH / DELETE routes the ledger uses. Two-tap
 * confirms (SURE? / KEEP) for anything that deletes; no modal. Under 640px
 * instagram, joined and sessions leave the table (.rw-x) and the open
 * panel prints them on its head line, so a name keeps its line. The server
 * gates the page to challenge admins and re-checks every write, so nothing
 * here decides who may act. Real numbers always: this is the truth table,
 * never a blackout view. Errors print where the admin is looking: a row
 * error under that row (inside the editor, under SAVE), a rower error in a
 * spanning row under the rower. */

export type AdminRow = {
  id: string;
  day: string;
  meters: number;
  seconds: number;
  title: string;
};

export type AdminRower = {
  id: string;
  rowerNumber: number;
  name: string;
  instagram: string;
  division: string;
  /* "Sep 4" — preformatted server-side, the repo's Pacific convention. */
  joined: string;
  email: string | null;
  meters: number;
  sessions: number;
  seconds: number;
  /* Newest first. */
  rows: AdminRow[];
};

type Sort = "number" | "meters";

/* One write to the row routes, answered the way the table needs it. The
 * default is a real fetch; the dev preview (/row100k/dev/rowers) hands in
 * a stub so nothing leaves the page. */
export type Send = (url: string, init: RequestInit) => Promise<{ ok: boolean; error?: string }>;

const realSend: Send = async (url, init) => {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  return { ok: res.ok && data.ok === true, error: data.error };
};

const COLS = 8;

const boardOf = (division: string) => (division === "F" ? "W" : division);

export function RowersTable({
  rowers,
  openNumber,
  send = realSend,
}: {
  rowers: AdminRower[];
  /* ?r=<rowerNumber> — that rower starts open and scrolled to, so a link
   * to one rower can pass between admins (the old moderation URL). */
  openNumber?: number | null;
  send?: Send;
}) {
  const router = useRouter();
  const [sort, setSort] = useState<Sort>("number");
  const [find, setFind] = useState("");
  const [open, setOpen] = useState<Set<string>>(() => {
    const first = openNumber ? rowers.find((r) => r.rowerNumber === openNumber) : undefined;
    return new Set(first ? [first.id] : []);
  });
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirmRower, setConfirmRower] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ day: "", meters: "", time: "", title: "" });
  const [confirmRow, setConfirmRow] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /* One error at a time: `row` set means it belongs to that logged row
   * (printed under it), otherwise it is the rower's and spans under them. */
  const [error, setError] = useState<{ rower: string; row?: string; text: string } | null>(null);

  useEffect(() => {
    if (!openNumber) return;
    document.getElementById(`rw-${openNumber}`)?.scrollIntoView({ block: "center" });
  }, [openNumber]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1400);
    return () => clearTimeout(t);
  }, [copied]);

  const list = useMemo(() => {
    // Handles are stored without the @, so a typed @ is dropped.
    const q = find.trim().toLowerCase().replace(/^@/, "");
    const hit = (r: AdminRower) =>
      !q ||
      r.name.toLowerCase().includes(q) ||
      r.instagram.toLowerCase().includes(q) ||
      (r.email ?? "").toLowerCase().includes(q) ||
      String(r.rowerNumber) === q.replace(/^0+/, "") ||
      fmtRowerNumber(r.rowerNumber).startsWith(q);
    const out = rowers.filter(hit);
    if (sort === "meters") {
      out.sort((a, b) => b.meters - a.meters || a.rowerNumber - b.rowerNumber);
    } else {
      out.sort((a, b) => a.rowerNumber - b.rowerNumber);
    }
    return out;
  }, [rowers, find, sort]);

  const closeMenu = () => {
    setMenuFor(null);
    setConfirmRower(null);
  };

  const toggleOpen = (id: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyEmail = async (r: AdminRower) => {
    if (!r.email) return;
    try {
      await navigator.clipboard.writeText(r.email);
      setCopied(r.id);
    } catch {
      setError({ rower: r.id, text: `Couldn't copy — the address is ${r.email}.` });
      closeMenu();
    }
  };

  const removeRower = async (r: AdminRower) => {
    setBusy(r.id);
    setError(null);
    try {
      const out = await send(`/api/row100k/participants/${r.id}`, { method: "DELETE" });
      if (out.ok) {
        setOpen((prev) => {
          const next = new Set(prev);
          next.delete(r.id);
          return next;
        });
        router.refresh();
      } else {
        setError({ rower: r.id, text: out.error ?? "Couldn't remove them — try again." });
      }
    } catch {
      setError({ rower: r.id, text: "Couldn't remove them — try again." });
    } finally {
      setBusy(null);
      closeMenu();
    }
  };

  const startEdit = (row: AdminRow) => {
    setError(null);
    setConfirmRow(null);
    setEditing(row.id);
    setDraft({
      day: row.day,
      meters: String(row.meters),
      time: fmtDuration(row.seconds),
      title: row.title,
    });
  };

  const saveRow = async (r: AdminRower, row: AdminRow) => {
    setError(null);
    const meters = Math.round(Number(draft.meters.replace(/[,\s]/g, "")));
    const seconds = parseDurationText(draft.time);
    if (!Number.isFinite(meters) || meters <= 0) {
      setError({ rower: r.id, row: row.id, text: "How many meters?" });
      return;
    }
    if (!seconds) {
      setError({ rower: r.id, row: row.id, text: "Time looks off — use 20:41 or 1:02:15." });
      return;
    }
    setBusy(row.id);
    try {
      // The title goes as typed, blank included: the route lets an admin set
      // it verbatim, so clearing the box clears the stored title.
      const body = { day: draft.day, meters, seconds, title: draft.title.trim() };
      const out = await send(`/api/row100k/rows/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (out.ok) {
        setEditing((prev) => (prev === row.id ? null : prev));
        router.refresh();
      } else {
        setError({ rower: r.id, row: row.id, text: out.error ?? "Couldn't save that fix — try again." });
      }
    } catch {
      setError({ rower: r.id, row: row.id, text: "Couldn't save that fix — try again." });
    } finally {
      setBusy(null);
    }
  };

  const removeRow = async (r: AdminRower, row: AdminRow) => {
    setBusy(row.id);
    setError(null);
    try {
      const out = await send(`/api/row100k/rows/${row.id}`, { method: "DELETE" });
      if (out.ok) router.refresh();
      else setError({ rower: r.id, row: row.id, text: out.error ?? "Couldn't remove that row — try again." });
    } catch {
      setError({ rower: r.id, row: row.id, text: "Couldn't remove that row — try again." });
    } finally {
      setBusy(null);
      setConfirmRow(null);
    }
  };

  const draftSplit = () => {
    const m = Math.round(Number(draft.meters.replace(/[,\s]/g, "")));
    const s = parseDurationText(draft.time);
    return Number.isFinite(m) && m > 0 && s ? `${fmtSplit(m, s)} /500M` : "— /500M";
  };

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <>
      <div className="rw-tools">
        <div className="tabs" role="group" aria-label="Order">
          <button type="button" className={sort === "number" ? "on" : undefined} onClick={() => setSort("number")}>
            By number
          </button>
          <button type="button" className={sort === "meters" ? "on" : undefined} onClick={() => setSort("meters")}>
            By meters
          </button>
        </div>
        <input
          type="search"
          className="rw-find"
          aria-label="Find a rower"
          placeholder="Find"
          value={find}
          onChange={(e) => setFind(e.target.value)}
        />
      </div>

      {list.length === 0 ? (
        <p className="board-empty">{rowers.length === 0 ? "NOBODY HAS SIGNED UP YET." : "NO ROWER MATCHES THAT."}</p>
      ) : (
        <table className="board rw-t">
          <thead>
            <tr>
              <th className="rk">#</th>
              <th>Rower</th>
              <th>Board</th>
              <th className="rw-x">Instagram</th>
              <th className="rw-x">Joined</th>
              <th className="num">Meters rowed</th>
              <th className="num rw-x">Sessions</th>
              <th className="rw-c" aria-label="Options" />
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const isOpen = open.has(r.id);
              const menuOpen = menuFor === r.id;
              return (
                <Fragment key={r.id}>
                  <tr
                    id={`rw-${r.rowerNumber}`}
                    className={isOpen ? "rw-r on" : "rw-r"}
                    onClick={() => toggleOpen(r.id)}
                  >
                    <td className="rk">{fmtRowerNumber(r.rowerNumber)}</td>
                    <td className="who">
                      <button
                        type="button"
                        className="rw-name"
                        aria-expanded={isOpen}
                        onClick={(e) => {
                          stop(e);
                          toggleOpen(r.id);
                        }}
                      >
                        <span className="rw-caret" aria-hidden="true">
                          {isOpen ? "▾" : "▸"}
                        </span>
                        {r.name}
                      </button>
                    </td>
                    <td>{boardOf(r.division)}</td>
                    <td className="rw-x">
                      <a
                        href={`https://instagram.com/${r.instagram}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={stop}
                      >
                        @{r.instagram}
                      </a>
                    </td>
                    <td className="rw-x">{r.joined}</td>
                    <td className="num">{fmtMeters(r.meters)}</td>
                    <td className="num rw-x" style={{ color: "var(--gray)" }}>
                      {r.sessions}
                    </td>
                    <td className="rw-c" onClick={stop}>
                      <span className="rw-anchor">
                        <button
                          type="button"
                          className={menuOpen ? "rw-dots on" : "rw-dots"}
                          aria-haspopup="menu"
                          aria-expanded={menuOpen}
                          aria-label={`Options for ${r.name}`}
                          onClick={() => {
                            setConfirmRower(null);
                            setMenuFor((prev) => (prev === r.id ? null : r.id));
                          }}
                        >
                          ⋯
                        </button>
                        {menuOpen && (
                          <>
                            <span className="rw-overlay" onClick={closeMenu} aria-hidden="true" />
                            <span className="rw-menu" role="menu">
                              <button
                                type="button"
                                onClick={() => {
                                  closeMenu();
                                  toggleOpen(r.id);
                                }}
                              >
                                {isOpen ? "Hide rows" : "Show rows"}
                              </button>
                              <a href={`/row100k/r/${r.rowerNumber}`} onClick={closeMenu}>
                                Profile →
                              </a>
                              <a
                                href={`https://instagram.com/${r.instagram}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={closeMenu}
                              >
                                Instagram →
                              </a>
                              <button type="button" disabled={!r.email} onClick={() => void copyEmail(r)}>
                                {copied === r.id ? "Copied" : r.email ? "Copy email" : "No email"}
                              </button>
                              {confirmRower === r.id ? (
                                <>
                                  <button
                                    type="button"
                                    className="danger"
                                    disabled={busy === r.id}
                                    onClick={() => void removeRower(r)}
                                  >
                                    {busy === r.id ? "…" : "Sure? Remove"}
                                  </button>
                                  <button type="button" onClick={() => setConfirmRower(null)}>
                                    Keep
                                  </button>
                                </>
                              ) : (
                                <button type="button" className="danger" onClick={() => setConfirmRower(r.id)}>
                                  Remove rower
                                </button>
                              )}
                            </span>
                          </>
                        )}
                      </span>
                    </td>
                  </tr>

                  {error?.rower === r.id && !error.row && (
                    <tr className="rw-err">
                      <td colSpan={COLS}>
                        <p className="form-err">{error.text}</p>
                      </td>
                    </tr>
                  )}

                  {isOpen && (
                    <tr className="rw-open">
                      <td colSpan={COLS} className="rw-panel">
                        <p className="rw-head mono">
                          <b>@{r.instagram}</b> · {r.email ?? "NO EMAIL"} · JOINED {r.joined} · {r.sessions}{" "}
                          {r.sessions === 1 ? "SESSION" : "SESSIONS"} · {fmtDuration(r.seconds)} ON THE ERG
                        </p>
                        {r.rows.length === 0 ? (
                          <p className="board-empty">NOTHING LOGGED YET.</p>
                        ) : (
                          <table className="board rw-rows">
                            <thead>
                              <tr>
                                <th>Day</th>
                                <th className="rw-x">Title</th>
                                <th className="num">Meters</th>
                                <th className="num">Time</th>
                                <th className="num">Split</th>
                                <th className="rw-c" aria-label="Actions" />
                              </tr>
                            </thead>
                            <tbody>
                              {r.rows.map((row) =>
                                editing === row.id ? (
                                  <tr className="rw-edit" key={row.id}>
                                    <td colSpan={6}>
                                      <div className="rw-edit-line">
                                        <input
                                          type="date"
                                          aria-label="Day"
                                          value={draft.day}
                                          min={FIRST_DAY}
                                          max={LAST_DAY}
                                          onChange={(e) => setDraft((d) => ({ ...d, day: e.target.value }))}
                                        />
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          aria-label="Meters"
                                          placeholder="Meters"
                                          value={draft.meters}
                                          style={{ width: 90 }}
                                          onChange={(e) => setDraft((d) => ({ ...d, meters: e.target.value }))}
                                        />
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          aria-label="Time"
                                          placeholder="Time"
                                          value={draft.time}
                                          style={{ width: 90 }}
                                          onChange={(e) =>
                                            setDraft((d) => ({ ...d, time: formatTimeDigits(e.target.value) }))
                                          }
                                        />
                                        <span className="rw-edit-split">{draftSplit()}</span>
                                      </div>
                                      <input
                                        type="text"
                                        aria-label="Title"
                                        className="rw-edit-title"
                                        maxLength={TITLE_MAX}
                                        placeholder="Title"
                                        value={draft.title}
                                        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                                      />
                                      <div className="tabs">
                                        <button
                                          type="button"
                                          className="on"
                                          disabled={busy === row.id}
                                          onClick={() => void saveRow(r, row)}
                                        >
                                          {busy === row.id ? "…" : "Save"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditing(null);
                                            setError((e) => (e?.row === row.id ? null : e));
                                          }}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                      {error?.row === row.id && <p className="form-err">{error.text}</p>}
                                    </td>
                                  </tr>
                                ) : (
                                  <Fragment key={row.id}>
                                    <tr>
                                      <td>
                                        {fmtDay(row.day)}
                                        {row.title ? <span className="rw-ttl rw-m">{row.title}</span> : null}
                                      </td>
                                      <td className="rw-x rw-ttl">{row.title}</td>
                                      <td className="num">{fmtMeters(row.meters)}</td>
                                      <td className="num">{fmtDuration(row.seconds)}</td>
                                      <td className="num" style={{ color: "var(--gray)" }}>
                                        {fmtSplit(row.meters, row.seconds)}
                                      </td>
                                      <td className="rw-c">
                                        <span className="rw-acts">
                                          <button type="button" className="rw-act" onClick={() => startEdit(row)}>
                                            Edit
                                          </button>
                                          {confirmRow === row.id ? (
                                            <>
                                              <button
                                                type="button"
                                                className="rw-act danger"
                                                disabled={busy === row.id}
                                                onClick={() => void removeRow(r, row)}
                                              >
                                                {busy === row.id ? "…" : "Sure?"}
                                              </button>
                                              <button
                                                type="button"
                                                className="rw-act"
                                                onClick={() => setConfirmRow(null)}
                                              >
                                                Keep
                                              </button>
                                            </>
                                          ) : (
                                            <button
                                              type="button"
                                              className="rw-act danger"
                                              onClick={() => {
                                                setEditing((prev) => (prev === row.id ? null : prev));
                                                setConfirmRow(row.id);
                                              }}
                                            >
                                              Remove
                                            </button>
                                          )}
                                        </span>
                                      </td>
                                    </tr>
                                    {error?.row === row.id && (
                                      <tr className="rw-err">
                                        <td colSpan={6}>
                                          <p className="form-err">{error.text}</p>
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                ),
                              )}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
