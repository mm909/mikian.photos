"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HandoffDto, HandoffRequest } from "@/lib/tracker/types";
import type { ClientShell, ShellEntry, ShellParticipant } from "@/lib/tracker/eventData";
import { fmtAgo, fmtClock, fmtIn } from "@/lib/tracker/format";
import { useOfflineQueue, useOnline, uuid, type SendItem } from "../../offlineQueue";
import { useServiceWorker } from "../../useServiceWorker";
import {
  HttpError,
  OnlinePill,
  Toast,
  TrackHeader,
  apiUrl,
  fetchJson,
  keyedStatusMessage,
  slotInfoOf,
  slotNameOf,
  useStoredChoice,
  useTick,
  useVisiblePoll,
  type SlotInfoByEntry,
  type ToastState,
} from "./ui";

/**
 * The crew page (TRACKER_SPEC.md §11 Crew, §8 rules 5–6). One large button
 * per runner; a tap IS the handoff — no confirm step (speed), a 2 s Undo
 * toast instead, and an Undo on the newest row of the list.
 *
 * Every tap is written to the offline queue before anything is sent, with
 * the client's timestamp and a UUID, and stays there until the server
 * acknowledges it by client_event_id. Undo works offline the same way: a
 * tap no send has read yet is taken back out of the queue, one that may be
 * mid-send stays until acknowledged — and EITHER WAY a void is queued (see
 * `undo`). The list below the buttons merges the server's view (polled
 * every 20 s while visible) with what is still waiting on this phone, so
 * what the crew sees is always what they did, not only what has reached
 * the server.
 *
 * PAIRS (owner, 2026-10-15: "we are running two by two … it's just the
 * current runner … we just have the roster"): an entry with slots > 1 gets
 * a SLOT PICKER at the top — one big pill per slot ("A" / "B"), remembered
 * on this phone like the team, each showing who holds it now — and a tap
 * records a handoff INTO the picked slot (HandoffRequest.slot). Who is on
 * course is then one runner per slot, Undo is offered on each slot's
 * newest tap, and every row carries its slot chip. The queue, the send and
 * the undo are untouched: a pairs tap is the same tap with one more field.
 * With one slot nothing changes and the request carries no `slot` at all.
 */

type QueuedTap = { kind: "handoff"; req: HandoffRequest };
type QueuedVoid = { kind: "void"; client_event_id: string };
type Queued = QueuedTap | QueuedVoid;

interface Row {
  client_event_id: string;
  participant_id: string;
  time: string;
  voided: boolean;
  /** sent = on the server; waiting = still on this phone; voiding = undo not yet on the server. */
  state: "sent" | "waiting" | "voiding";
  /** 1-based slot the tap went into; 1 for a classic relay. */
  slot: number;
}

const TOAST_MS = 2000;
const POLL_MS = 20_000;

/** The slot a server row carries; 1 when an older server has not learned the field yet. */
function slotOfDto(h: HandoffDto): number {
  const s = (h as { slot?: unknown }).slot;
  return typeof s === "number" && Number.isFinite(s) && s >= 1 ? Math.floor(s) : 1;
}

export function CrewApp({ shell, crewKey, admin, slotInfo }: { shell: ClientShell; crewKey: string; admin: boolean; slotInfo: SlotInfoByEntry }) {
  const slug = shell.id;
  const online = useOnline();
  const sw = useServiceWorker();
  const now = useTick(1000);

  /* 1. Which team — remembered per device. One entry → no question. */
  const [teamId, setTeamId, teamLoaded] = useStoredChoice(`trk:crew:team:${slug}`);
  const team: ShellEntry | null = useMemo(() => {
    if (shell.entries.length === 1) return shell.entries[0];
    return shell.entries.find((e) => e.id === teamId) ?? null;
  }, [shell.entries, teamId]);

  /* 1b. Which slot — pairs only, remembered per device too. No pick stored
   * (first open, or the event changed its slots) → no tap goes anywhere
   * until the crew picks: a tap into the wrong slot would bump the wrong
   * runner off. A classic relay is always "slot 1" and shows no picker. */
  const info = useMemo(() => slotInfoOf(slotInfo, team?.id), [slotInfo, team]);
  const slots = info.slots;
  const pairs = slots > 1;
  const slotNos = useMemo(() => Array.from({ length: slots }, (_, i) => i + 1), [slots]);
  const slotName = useCallback((s: number) => slotNameOf(info, s), [info]);
  const [slotStored, setSlotStored] = useStoredChoice(`trk:crew:slot:${slug}`);
  const pickedSlot: number | null = useMemo(() => {
    if (!pairs) return 1;
    const n = Number(slotStored);
    return Number.isInteger(n) && n >= 1 && n <= slots ? n : null;
  }, [pairs, slots, slotStored]);

  /* The server's list (last 50, newest first, voided included). */
  const [server, setServer] = useState<HandoffDto[]>([]);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  /* Undos applied on this phone before the server has confirmed them. */
  const [localVoids, setLocalVoids] = useState<Set<string>>(() => new Set());
  const [rejected, setRejected] = useState<string | null>(null);

  const mergeServer = useCallback((dtos: HandoffDto[]) => {
    if (!dtos.length) return;
    setServer((prev) => {
      const map = new Map(prev.map((h) => [h.client_event_id, h]));
      for (const d of dtos) map.set(d.client_event_id, d);
      return Array.from(map.values());
    });
  }, []);

  useVisiblePoll(async () => {
    try {
      const data = await fetchJson<{ handoffs: HandoffDto[] }>(apiUrl(slug, "handoffs", crewKey));
      setServer(data.handoffs ?? []);
      setSyncedAt(Date.now());
      setSyncError(null);
      // Server agrees a handoff is voided → the local marker is no longer needed.
      setLocalVoids((s) => {
        if (s.size === 0) return s;
        const next = new Set(s);
        for (const h of data.handoffs ?? []) if (h.voided) next.delete(h.client_event_id);
        return next.size === s.size ? s : next;
      });
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Could not reach the server");
    }
  }, POLL_MS);

  /* 2. The queue: taps and voids, sent in that order. */
  const postJson = useCallback(
    async (path: string, body: unknown, signal: AbortSignal) =>
      fetch(apiUrl(slug, path, crewKey), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        // The queue's 15 s timeout and its resend-on-force both end the
        // request through this signal (offlineQueue.ts).
        signal,
      }),
    [slug, crewKey],
  );

  const send = useCallback(
    async (items: SendItem<Queued>[], signal: AbortSignal): Promise<string[]> => {
      const done: string[] = [];
      const taps = items.filter((i): i is SendItem<QueuedTap> => i.item.kind === "handoff");
      const voids = items.filter((i): i is SendItem<QueuedVoid> => i.item.kind === "void");

      if (taps.length) {
        // client_now is the clock at SEND time (spec §8 rule 6), not at the tap.
        const stamp = () => new Date().toISOString();
        const res = await postJson("handoffs", { handoffs: taps.map((t) => ({ ...t.item.req, client_now: stamp() })) }, signal);
        if (res.ok) {
          const data = (await res.json()) as { handoffs?: HandoffDto[] };
          const acked = new Set((data.handoffs ?? []).map((h) => h.client_event_id));
          for (const t of taps) if (acked.has(t.id)) done.push(t.id);
          mergeServer(data.handoffs ?? []);
        } else if (res.status === 400 || res.status === 409 || res.status === 422) {
          // One bad tap must not hold the rest hostage: send them one by
          // one and drop the ones the server rejects, saying so on screen.
          // A 409 is a refusal, not an outage: "<name> is already on course
          // in A" (handoffs.ts) will not change by retrying, so it is
          // dropped the same way and its message shown.
          for (const t of taps) {
            const r = await postJson("handoffs", { ...t.item.req, client_now: stamp() }, signal);
            if (r.ok) {
              const data = (await r.json()) as { handoffs?: HandoffDto[] };
              mergeServer(data.handoffs ?? []);
              done.push(t.id);
            } else if (r.status === 400 || r.status === 409 || r.status === 422) {
              let why = `HTTP ${r.status}`;
              try {
                const j = (await r.json()) as { error?: string; reason?: string };
                why = j.error ?? j.reason ?? why;
              } catch {
                /* no body */
              }
              setRejected(`A tap was refused by the server and dropped (${why}).`);
              done.push(t.id);
            } else {
              throw new HttpError(r.status, keyedStatusMessage(r.status));
            }
          }
        } else {
          throw new HttpError(res.status, keyedStatusMessage(res.status));
        }
      }

      for (const v of voids) {
        const res = await postJson("handoffs/void", { client_event_id: v.item.client_event_id }, signal);
        if (res.ok) {
          try {
            const body = (await res.json()) as { handoff?: HandoffDto } | HandoffDto;
            const dto = "handoff" in body && body.handoff ? body.handoff : (body as HandoffDto);
            if (dto && dto.client_event_id) mergeServer([dto]);
          } catch {
            /* fine */
          }
          done.push(v.id);
        } else if (res.status === 400 || res.status === 404 || res.status === 422) {
          // Nothing on the server to void: the tap was taken back before
          // any send read it (`undo`), so the server never saw it and
          // voidHandoff answers 404. That is the undo done.
          done.push(v.id);
        } else {
          throw new HttpError(res.status, keyedStatusMessage(res.status));
        }
      }
      return done;
    },
    [postJson, mergeServer],
  );

  const q = useOfflineQueue<Queued>(`handoffs:${slug}`, send, { batchMax: 50 });

  /* 3. The merged view for this team. */
  const rows: Row[] = useMemo(() => {
    if (!team) return [];
    const map = new Map<string, Row>();
    for (const h of server) {
      if (h.entry_id !== team.id) continue;
      map.set(h.client_event_id, {
        client_event_id: h.client_event_id,
        participant_id: h.participant_id,
        time: h.time,
        voided: h.voided || localVoids.has(h.client_event_id),
        state: h.voided || !localVoids.has(h.client_event_id) ? "sent" : "voiding",
        slot: slotOfDto(h),
      });
    }
    for (const p of q.pending) {
      if (p.item.kind === "handoff") {
        const r = p.item.req;
        if (r.entry_id !== team.id || map.has(r.client_event_id)) continue;
        map.set(r.client_event_id, {
          client_event_id: r.client_event_id,
          participant_id: r.participant_id,
          time: r.time,
          voided: false,
          state: "waiting",
          slot: r.slot ?? 1,
        });
      } else {
        const r = map.get(p.item.client_event_id);
        if (r) {
          r.voided = true;
          r.state = "voiding";
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
  }, [server, q.pending, team, localVoids]);

  /* Who holds each slot: the newest non-voided tap for it. A classic relay
   * has one slot and every tap is in it, whatever `slot` a row carries. */
  const currentBySlot = useMemo(() => {
    const m = new Map<number, Row>();
    for (const s of slotNos) {
      const r = rows.find((x) => !x.voided && (!pairs || x.slot === s));
      if (r) m.set(s, r);
    }
    return m;
  }, [rows, slotNos, pairs]);
  /* participant id → the slot they hold right now. */
  const heldBy = useMemo(() => {
    const m = new Map<string, number>();
    currentBySlot.forEach((r, s) => {
      if (!m.has(r.participant_id)) m.set(r.participant_id, s);
    });
    return m;
  }, [currentBySlot]);

  /* The picked slot's runner (the one a tap replaces) and who is up next. */
  const current = pickedSlot !== null ? currentBySlot.get(pickedSlot) ?? null : null;
  const currentP = current ? team?.participants.find((p) => p.id === current.participant_id) ?? null : null;
  const nextP: ShellParticipant | null = useMemo(() => {
    if (!team || !current || team.participants.length < 2) return null;
    const idx = team.participants.findIndex((p) => p.id === current.participant_id);
    if (idx < 0) return null;
    // Roster order after the current runner, skipping anyone on course in
    // another slot (a classic relay has nobody else on course).
    for (let k = 1; k < team.participants.length; k++) {
      const cand = team.participants[(idx + k) % team.participants.length];
      if (!heldBy.has(cand.id)) return cand;
    }
    return null;
  }, [team, current, heldBy]);

  /* 4. Toast with Undo, 2 s. */
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((text: string, action?: ToastState["action"]) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast({ key: Date.now(), text, action });
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS);
  }, []);
  useEffect(() => () => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
  }, []);

  const undo = useCallback(
    async (clientEventId: string) => {
      setToast(null);
      // Take the tap back if no send has read it yet; if one has (it may be
      // landing right now) it stays queued until the server acknowledges
      // it. Then ALWAYS queue a void. The review found the old rule — void
      // only when `q.state === "sending"` — read a stale state from the
      // render before the tap, so "pressing Undo while the POST is in
      // flight removes the tap from the local queue, queues NO void, and
      // the server keeps the handoff". Now every timing ends the same way:
      //  - taken back, never sent  → the void gets 404, the sender drops it;
      //  - mid-send or sent        → the tap lands first (taps go before
      //    voids in `send`, or were acknowledged already), the void finds it.
      await q.retract(clientEventId);
      setLocalVoids((s) => new Set(s).add(clientEventId));
      await q.enqueue({ kind: "void", client_event_id: clientEventId }, `void:${clientEventId}`);
      showToast("Undone");
    },
    [q, showToast],
  );
  // The toast's Undo is created at tap time; go through a ref so it always
  // runs the current `undo`, never the closure of an earlier render.
  const undoRef = useRef(undo);
  undoRef.current = undo;

  const tap = useCallback(
    async (p: ShellParticipant) => {
      if (!team) return;
      // Pairs: the tap goes into the picked slot; without a pick it goes
      // nowhere — the toast says what to do.
      const slot = pairs ? pickedSlot : 1;
      if (slot === null) {
        showToast(`Pick ${slotNos.map(slotName).join(" or ")} first`);
        return;
      }
      const held = heldBy.get(p.id);
      if (held !== undefined) {
        showToast(`${p.name} is already on course${pairs ? ` in ${slotName(held)}` : ""}`);
        return;
      }
      const id = uuid();
      const t = new Date().toISOString();
      // A classic relay sends the same request as before (no `slot` key);
      // a pairs tap names its slot (HandoffRequest.slot, 1-based).
      const req: HandoffRequest = {
        client_event_id: id,
        entry_id: team.id,
        participant_id: p.id,
        time: t,
        client_now: t,
        source: "crew",
        ...(pairs ? { slot } : {}),
      };
      try {
        navigator.vibrate?.(25);
      } catch {
        /* no haptics */
      }
      await q.enqueue({ kind: "handoff", req }, id);
      showToast(`${p.name} on course${pairs ? ` in ${slotName(slot)}` : ""}`, { label: "Undo", onClick: () => void undoRef.current(id) });
    },
    [team, pairs, pickedSlot, slotNos, slotName, heldBy, q, showToast],
  );

  const pendingTaps = q.pending.filter((p) => p.item.kind === "handoff").length;
  const pendingVoids = q.pending.length - pendingTaps;
  const retryIn = q.nextRetryAt && now ? Math.max(0, Math.round((q.nextRetryAt - now) / 1000)) : null;

  const entryStyle = team ? ({ "--entry": team.color } as React.CSSProperties) : undefined;

  /** The runner holding a slot and their row, for the picker and the on-course card. */
  const holderOf = (s: number): { r: Row; p: ShellParticipant | null } | null => {
    const r = currentBySlot.get(s);
    if (!r) return null;
    return { r, p: team?.participants.find((x) => x.id === r.participant_id) ?? null };
  };

  return (
    <div className="c-page" style={entryStyle}>
      <TrackHeader
        kicker="Crew · handoffs"
        title={shell.name}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "none" }}>
            {team && shell.entries.length > 1 && (
              <span className="c-teamchip">
                <span className="tag">{team.shortName}</span>
              </span>
            )}
            {team && pairs && pickedSlot !== null && (
              <span className="c-teamchip" title={`Marking slot ${slotName(pickedSlot)}`}>
                <span className="tag">{slotName(pickedSlot)}</span>
              </span>
            )}
            <OnlinePill />
          </div>
        }
      />

      <main className="c-main">
        {!teamLoaded ? (
          <div className="c-section c-sub">…</div>
        ) : shell.kind === "solo" ? (
          <div className="c-section">
            <p className="c-lead">Solo event — legs are split by checkpoints, not handoffs.</p>
            <p className="c-sub">There is nothing to tap here. The van page and the runner setup page still apply.</p>
          </div>
        ) : !team ? (
          <section className="c-section">
            <p className="c-lead">Which team are you crewing?</p>
            <div className="c-teams">
              {shell.entries.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className="c-team"
                  style={{ "--entry": e.color } as React.CSSProperties}
                  onClick={() => setTeamId(e.id)}
                >
                  <span className="dot">{e.shortName}</span>
                  <span>
                    {e.name}
                    <small>
                      {e.participants.length} runner{e.participants.length === 1 ? "" : "s"}
                    </small>
                  </span>
                </button>
              ))}
            </div>
            <p className="c-sub" style={{ marginTop: 14 }}>
              Remembered on this phone. You can change it later.
            </p>
          </section>
        ) : (
          <>
            {/* Pairs: which slot the next tap is for */}
            {pairs && (
              <section className="c-section">
                <div className="c-h">
                  <span className="mono">Which runner are you swapping?</span>
                  <span className="mono">{pickedSlot === null ? "pick one" : `marking ${slotName(pickedSlot)}`}</span>
                </div>
                <div className="c-slots" role="radiogroup" aria-label="Slot">
                  {slotNos.map((s) => {
                    const h = holderOf(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={pickedSlot === s}
                        className="c-slot"
                        onClick={() => setSlotStored(String(s))}
                      >
                        <span className="big">{slotName(s)}</span>
                        <span className="holder">
                          {h ? (
                            <>
                              <b>{h.p?.name ?? "Unknown runner"}</b>
                              {now > 0 && <> · {fmtAgo((now - Date.parse(h.r.time)) / 1000)}</>}
                            </>
                          ) : (
                            "nobody marked yet"
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="c-sub" style={{ marginTop: 10 }}>
                  Running in pairs: pick the slot the new runner is taking, then tap the runner. Remembered on this phone.
                </p>
              </section>
            )}

            {/* Who is on course now */}
            <section className="c-section">
              <div className="c-h">
                <span className="mono">On course now</span>
                {shell.entries.length > 1 && (
                  <button type="button" className="c-link" onClick={() => setTeamId(null)}>
                    Change team
                  </button>
                )}
              </div>
              {pairs ? (
                <div className="c-now is-pairs">
                  {slotNos.map((s) => {
                    const h = holderOf(s);
                    return (
                      <div className="line" key={s}>
                        <span className="c-slotchip" aria-label={`Slot ${slotName(s)}`}>
                          {slotName(s)}
                        </span>
                        {h ? (
                          <>
                            <span className="chip">{h.p?.initials ?? "?"}</span>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div className="who">{h.p?.name ?? "Unknown runner"}</div>
                              <div className="since">
                                since {fmtClock(h.r.time, shell.timezone)}
                                {now > 0 && <> · {fmtAgo((now - Date.parse(h.r.time)) / 1000)}</>}
                                {h.r.state === "waiting" && <> · waiting to send</>}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="c-sub" style={{ flex: 1, minWidth: 0 }}>
                            Nobody marked in {slotName(s)} yet.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : currentP && current ? (
                <div className="c-now">
                  <span className="chip">{currentP.initials}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="who">{currentP.name}</div>
                    <div className="since">
                      since {fmtClock(current.time, shell.timezone)}
                      {now > 0 && <> · {fmtAgo((now - Date.parse(current.time)) / 1000)}</>}
                      {current.state === "waiting" && <> · waiting to send</>}
                    </div>
                  </div>
                  {nextP && (
                    <div style={{ textAlign: "right", flex: "none" }}>
                      <span className="mono">Next</span>
                      <div style={{ fontWeight: 600, fontSize: 17 }}>{nextP.initials}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="c-now">
                  <div className="c-sub">
                    Nobody marked on course yet for {team.name}. Tap the runner who is starting.
                  </div>
                </div>
              )}
            </section>

            {/* The buttons */}
            <section className="c-section">
              <div className="c-h">
                <span className="mono">
                  {!pairs
                    ? "Tap the runner taking over"
                    : pickedSlot === null
                      ? "Pick a slot above, then tap the runner"
                      : `Tap the runner taking over in ${slotName(pickedSlot)}`}
                </span>
                <span className="mono">{team.name}</span>
              </div>
              <div className={`c-runners${pairs && pickedSlot === null ? " is-unpicked" : ""}`}>
                {team.participants.map((p) => {
                  const held = heldBy.get(p.id);
                  const on = held !== undefined;
                  const next = !on && nextP?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`c-runner${on ? " on" : ""}${next ? " next" : ""}`}
                      onClick={() => void tap(p)}
                      aria-label={`Handoff to ${p.name}`}
                    >
                      <span className="chip" aria-hidden="true">
                        {p.initials}
                      </span>
                      <span className="name">{p.name}</span>
                      {on && <span className="lbl">On course{pairs && held !== undefined ? ` · ${slotName(held)}` : ""}</span>}
                      {next && <span className="lbl">Next</span>}
                    </button>
                  );
                })}
              </div>

              {q.pending.length > 0 && (
                <div className={`c-queue${q.lastError && q.attempt > 0 ? " err" : ""}`} role="status" aria-live="polite">
                  <div>
                    {pendingTaps > 0 && (
                      <>
                        {pendingTaps} tap{pendingTaps === 1 ? "" : "s"} waiting to send
                      </>
                    )}
                    {pendingTaps > 0 && pendingVoids > 0 && " · "}
                    {pendingVoids > 0 && (
                      <>
                        {pendingVoids} undo{pendingVoids === 1 ? "" : "s"} waiting
                      </>
                    )}
                    <small>
                      {q.state === "sending"
                        ? "Sending…"
                        : !online
                          ? "No signal — they go the moment it is back"
                          : q.lastError
                            ? `${q.lastError}${retryIn !== null ? ` · retry ${fmtIn(retryIn)}` : ""}`
                            : retryIn !== null
                              ? `Retry ${fmtIn(retryIn)}`
                              : "Waiting"}
                    </small>
                  </div>
                  <button type="button" onClick={() => void q.flush()} disabled={q.state === "sending"}>
                    Send now
                  </button>
                </div>
              )}
              {rejected && (
                <div className="c-queue err" role="alert">
                  <div>{rejected}</div>
                  <button type="button" onClick={() => setRejected(null)}>
                    OK
                  </button>
                </div>
              )}
            </section>

            {/* The last 5 */}
            <section className="c-section">
              <div className="c-h">
                <span className="mono">Last handoffs</span>
                <span className="mono">
                  {syncError ? <span className="bad">Sync: {syncError}</span> : syncedAt && now ? `synced ${fmtAgo((now - syncedAt) / 1000)}` : "syncing…"}
                </span>
              </div>
              <div className="c-list">
                {rows.length === 0 ? (
                  <div className="c-empty">No handoffs yet.</div>
                ) : (
                  rows.slice(0, 5).map((r) => {
                    const p = team.participants.find((x) => x.id === r.participant_id);
                    // Undo is offered on each slot's newest live tap (the
                    // one tap for a classic relay): voiding it reinstates
                    // that slot's previous runner.
                    const undoable = !r.voided && currentBySlot.get(pairs ? r.slot : 1)?.client_event_id === r.client_event_id;
                    return (
                      <div key={r.client_event_id} className={`c-hand${r.voided ? " voided" : ""}`}>
                        <span className="t">{fmtClock(r.time, shell.timezone)}</span>
                        {/* Pairs: the slot chip takes the initials tag's place — the
                         * name is right beside it, and a 375 px row has no room for both. */}
                        {pairs ? (
                          <span className="c-slotchip sm" aria-label={`Slot ${slotName(r.slot)}`}>
                            {slotName(r.slot)}
                          </span>
                        ) : (
                          <span className="tag" aria-hidden="true">
                            {p?.initials ?? "?"}
                          </span>
                        )}
                        <span className="who">{p?.name ?? "Unknown runner"}</span>
                        <span className={`st${r.state === "waiting" || r.state === "voiding" ? " wait" : ""}`}>
                          {r.voided ? (r.state === "voiding" ? "undo waiting" : "undone") : r.state === "waiting" ? "waiting" : "sent"}
                        </span>
                        {undoable && (
                          <button type="button" className="undo" onClick={() => void undo(r.client_event_id)}>
                            Undo
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </>
        )}

        <footer className="c-foot">
          Taps are saved on this phone first and sent when there is signal — nothing is lost in a dead zone.
          {sw === "ready" && " This page also opens without signal."}
          {q.backend === "memory" && " (Private browsing: the queue lives only while this tab is open.)"}
          {admin && (
            <>
              {" "}
              <a href={`/track/${encodeURIComponent(slug)}`}>Public page →</a>
            </>
          )}
        </footer>
      </main>

      <Toast toast={toast} />
    </div>
  );
}
