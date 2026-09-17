"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fmtElapsedHundredths, fmtMeters, fmtPace, fmtTenths } from "@/lib/pm5/pm5";
import { fmtTenthsClock, type TelemetryDoc, type TelemetrySavedRow } from "@/lib/pm5/session";
import { ErgDetail } from "./ErgDetail";
import {
  ERG_API,
  LINK_WORD,
  addErg,
  addSimErg,
  addSourceErg,
  anyUnsaved,
  bluetoothAvailable,
  bluetoothSupported,
  ergTitle,
  ergUnsaved,
  getErg,
  listErgs,
  markLoaded,
  reconnect,
  removeErg,
  saveErg,
  setErgTitle,
  subscribe,
  type Erg,
} from "./hub";
import { createPlayback, forgetPlayback, rememberPlayback } from "./playback";

/* THE MONITORS PAGE (owner, 2026-09-17: "add an erg, add it to a list,
 * click on that erg and see the telemetry for that person, go back to a
 * page and add another erg and monitor that one. Save them independently of
 * each other").
 *
 * Every erg in the room is a card: what it is, whether it is linked, the
 * four numbers worth watching from across a gym, and its own SAVE. Opening
 * a card SWAPS THIS VIEW rather than following a link — the hub is a module
 * singleton, so a route change would not drop a connection either, but a
 * view swap cannot: there is no navigation, no remount of anything that
 * holds a link, and BACK TO MONITORS is free. Five ergs mid-piece stay mid-
 * piece while the sixth is on screen.
 *
 * PLAY BACK A SAVED ROW opens the account's own sessions, and picking one
 * adds a card fed by playback.ts — the saved document turned back into byte
 * packets. From the list it is an erg like any other; inside, the transport
 * strip says PLAYBACK across the top. /erg?play=SOMEID does the same on
 * load, so a session screen can hand a row straight to the console.
 *
 * NO HEART RATE anywhere on this page (owner, 2026-09-17: no belt this
 * month). It is still decoded and still saved — see hub.ts.
 *
 * This component owns no telemetry. It subscribes to the hub and paints
 * what it is handed; every button is one hub call. */

const dash = (v: string | null | undefined) => v ?? "—";

/* The four that matter live. Elapsed and distance come off 0x31, the split
 * and the rate off 0x32; all four read a dash until the first packet. */
function tiles(e: Erg) {
  const g = e.model.general;
  const a1 = e.model.a1;
  return [
    { k: "ELAPSED", v: g ? fmtElapsedHundredths(g.elapsedHundredths) : null },
    { k: "DISTANCE", v: g ? fmtMeters(g.distanceM) : null },
    { k: "SPLIT /500M", v: a1 && a1.currentPaceS > 0 ? fmtPace(a1.currentPaceS) : null },
    { k: "RATE S/M", v: a1 ? String(a1.strokeRate) : null },
  ];
}

function dotClass(e: Erg): string {
  if (e.link === "live") return "eg-dot eg-dot-live";
  if (e.link === "connecting") return "eg-dot eg-dot-wait";
  if (e.link === "dropped") return "eg-dot eg-dot-gone";
  return "eg-dot";
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function ErgCard({ erg, onOpen, onChanged, signedIn }: { erg: Erg; onOpen: () => void; onChanged: () => void; signedIn: boolean }) {
  const [busy, setBusy] = useState(false);
  const playback = erg.source === "playback";
  const savedWord = erg.rec.saved ? "SAVED" : erg.rec.packets.length ? "UNSAVED" : "NOTHING RECORDED YET";

  const save = async () => {
    setBusy(true);
    await saveErg(erg.id, ergTitle(erg));
    setBusy(false);
    onChanged();
  };

  const remove = () => {
    if (ergUnsaved(erg) && !window.confirm(`Remove ${erg.name}? ${erg.rec.packets.length.toLocaleString("en-US")} recorded packets go with it — SAVE first to keep them.`)) return;
    forgetPlayback(erg.id);
    removeErg(erg.id);
  };

  return (
    <article className="eg-card">
      {/* The whole head opens this erg screen. A button, not a link: the
       * view swaps in place so nothing that holds a connection remounts. */}
      <button type="button" className="eg-card-open" onClick={onOpen}>
        <span className="eg-card-name">{erg.name}</span>
        <span className="eg-card-sub">
          {erg.serial ? `SERIAL ${erg.serial}` : "NO SERIAL"} · {erg.sourceLabel ?? (erg.source === "live" ? "BLUETOOTH" : erg.source.toUpperCase())} · OPEN
        </span>
      </button>

      <div className="eg-card-body">
        <div className="eg-row-actions">
          <span className="eg-link-state">
            <span className={dotClass(erg)} aria-hidden="true" />
            {LINK_WORD[erg.link]}
            {erg.via ? ` · ${erg.via.toUpperCase()}` : ""}
          </span>
          <span className="eg-note">{erg.pps ? `${erg.pps}/S` : ""}</span>
        </div>

        <div className="eg-tiles">
          {tiles(erg).map((t) => (
            <div className="eg-tile" key={t.k}>
              <span className="k">{t.k}</span>
              <span className="v">{dash(t.v)}</span>
            </div>
          ))}
        </div>

        {/* SAVE is per erg: its own title, its own button, its own word.
         * Saving one says nothing about any other card on this page. A
         * playback has no SAVE — the row it is playing is already saved. */}
        {playback ? (
          <p className="eg-note">Playing back a saved row · nothing to save</p>
        ) : (
          <div className="eg-save">
            <label className="eg-note" htmlFor={`title-${erg.id}`} style={{ position: "absolute", left: -10000 }}>
              Title for this session
            </label>
            <input id={`title-${erg.id}`} value={ergTitle(erg)} onChange={(ev) => setErgTitle(erg.id, ev.target.value)} placeholder="Title for this session" />
            {/* Saving is the one thing on this page that needs an account,
             * so a signed-out viewer is told by the button itself, not by
             * a 401 at the end of the piece. */}
            <button
              type="button"
              className="eg-btn"
              onClick={save}
              disabled={busy || erg.save.busy || !erg.rec.packets.length || !signedIn}
              title={signedIn ? undefined : "Saving needs an account — sign in first"}
            >
              {busy || erg.save.busy ? "Saving…" : "Save"}
            </button>
          </div>
        )}

        <div className="eg-row-actions">
          <span className={erg.save.note && !erg.save.note.ok ? "eg-note eg-bad" : "eg-note"}>
            {playback ? (erg.loaded?.title ?? "PLAYBACK") : !signedIn ? "SIGN IN TO SAVE" : erg.save.note ? erg.save.note.text : savedWord}
          </span>
          <span style={{ display: "flex", gap: 10 }}>
            {erg.source === "live" && erg.link !== "live" ? (
              <button type="button" className="eg-btn eg-btn-quiet" onClick={() => void reconnect(erg.id)}>
                Reconnect
              </button>
            ) : null}
            <button type="button" className="eg-btn eg-btn-quiet" onClick={remove}>
              Remove
            </button>
          </span>
        </div>
      </div>
    </article>
  );
}

/* THE PICKER: the account's saved sessions, and the one control that
 * matters on each — PLAY. When, which erg, how far, how long, what split.
 * Enough to recognise a row; the whole of it is the sessions screen. */
function PlayPicker({ onPlay, busyId }: { onPlay: (row: TelemetrySavedRow) => void; busyId: string | null }) {
  const [rows, setRows] = useState<TelemetrySavedRow[] | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const res = await fetch(ERG_API, { headers: { Accept: "application/json" } });
        const j = (await res.json()) as { ok?: boolean; rows?: TelemetrySavedRow[]; error?: string };
        if (!live) return;
        if (!res.ok || !j.ok || !j.rows) setNote(j.error ?? `The server answered ${res.status}.`);
        else setRows(j.rows);
      } catch {
        if (live) setNote("Couldn't reach the server — try again.");
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  if (note) return <p className="eg-note eg-bad">{note}</p>;
  if (!rows) return <p className="eg-note">Reading your saved sessions…</p>;
  if (!rows.length) return <div className="eg-empty">No saved sessions yet — row a piece and SAVE it, or SIMULATE one and save that.</div>;

  return (
    <div className="eg-scroll">
      <table className="eg-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Erg</th>
            <th>Distance</th>
            <th>Time</th>
            <th>Avg split</th>
            <th>Title</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{fmtWhen(r.startedAt)}</td>
              <td>
                {r.device}
                {r.simulated ? " · SIM" : ""}
              </td>
              <td>{r.meters.toLocaleString("en-US")} m</td>
              <td>{fmtTenthsClock(r.tenths)}</td>
              <td>{r.avgPaceTenths ? fmtTenths(r.avgPaceTenths) : "—"}</td>
              <td className="tt">{r.title}</td>
              <td>
                <button type="button" className="eg-btn eg-btn-quiet" onClick={() => onPlay(r)} disabled={busyId !== null}>
                  {busyId === r.id ? "Loading…" : "Play"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MonitorList({ playId, signedIn = false }: { playId?: string | null; signedIn?: boolean }) {
  const [ergs, setErgs] = useState<Erg[]>([]);
  const [support, setSupport] = useState<"unknown" | "yes" | "no">("unknown");
  const [btOff, setBtOff] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [loadingRow, setLoadingRow] = useState<string | null>(null);
  const bump = useCallback(() => setErgs(listErgs()), []);

  /* The hub is a module singleton, so the first paint after a client-side
   * hop already has every erg that was connected before it. */
  useEffect(() => {
    setErgs(listErgs());
    return subscribe(setErgs);
  }, []);

  useEffect(() => {
    setSupport(bluetoothSupported() ? "yes" : "no");
    void bluetoothAvailable().then((ok) => setBtOff(!ok));
  }, []);

  /* One guard for the whole hub: a reload takes every link and every
   * unsaved recording with it. */
  useEffect(() => {
    const guard = (ev: BeforeUnloadEvent) => {
      if (!anyUnsaved()) return;
      ev.preventDefault();
      ev.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);

  /* THE ONE PLACE A PLAYBACK IS BUILT. Read the document, turn it into a
   * driver, hand the driver a slot, and open it. */
  const playRow = useCallback(async (id: string, title?: string) => {
    setNote(null);
    setLoadingRow(id);
    try {
      const res = await fetch(`${ERG_API}/${encodeURIComponent(id)}`, { headers: { Accept: "application/json" } });
      const j = (await res.json()) as { ok?: boolean; row?: TelemetrySavedRow; doc?: TelemetryDoc; error?: string };
      if (!res.ok || !j.ok || !j.doc || !j.row) {
        setNote(j.error ?? `The server answered ${res.status}.`);
        return;
      }
      const name = title ?? j.row.title;
      const driver = createPlayback(j.doc, name);
      const ergId = addSourceErg({
        source: "playback",
        driver,
        device: {
          name: j.doc.device.name,
          serial: j.doc.device.serial,
          model: j.doc.device.model ?? null,
          firmware: j.doc.device.firmware ?? null,
          hardware: j.doc.device.hardware ?? null,
          simulated: j.doc.device.simulated,
        },
      });
      rememberPlayback(ergId, driver);
      markLoaded(ergId, { id: j.row.id, title: name });
      setPicking(false);
      setOpen(ergId);
      bump();
    } catch {
      setNote("Couldn't reach the server — try again.");
    } finally {
      setLoadingRow(null);
    }
  }, [bump]);

  /* /erg?play=SOMEID — the same thing the picker does, once, on load. */
  const deepLinked = useRef(false);
  useEffect(() => {
    if (!playId || deepLinked.current) return;
    deepLinked.current = true;
    void playRow(playId);
  }, [playId, playRow]);

  const add = async () => {
    setNote(null);
    setAdding(true);
    const res = await addErg();
    setAdding(false);
    if ("error" in res) setNote(res.error);
    else if ("cancelled" in res) setNote("The picker closed without a monitor.");
    else setOpen(res.id);
    bump();
  };

  /* THE DETAIL VIEW. The record is read fresh out of the hub every paint,
   * so it is the same object the list would show; if the erg was removed
   * from another tab of this view, fall back to the list. */
  const openErg = open ? getErg(open) : null;
  if (open && openErg) return <ErgDetail erg={openErg} onBack={() => setOpen(null)} signedIn={signedIn} />;

  return (
    <div>
      <div className="eg-head">
        <h1>Monitors</h1>
        <span className="eg-eyebrow">One card per erg · open one to watch it</span>
      </div>

      {/* What this is, and the three things that have to be true before a
       * monitor shows up. The menu path is from the Concept2 spec; newer
       * firmware may say Menu then Connect. */}
      <p className="eg-copy">
        <b>Pair as many ergs as there are monitors in the room.</b> Each one gets a card with its own link, its
        own recording and its own SAVE — saving one says nothing about the others. Open a card to watch that erg
        on its own screen; come back and the link is still up.
      </p>
      <p className="eg-copy">
        <b>On each monitor:</b> set the piece up, then Main Menu, More Options, <b>Turn Wireless ON</b>, and
        leave it on the workout screen. <b>One app per monitor:</b> if ErgData on a phone is linked to that erg,
        this page cannot see it. Do not pair the PM5 in the laptop Bluetooth settings — ADD AN ERG does it.{" "}
        <b>The recording lives in this tab only</b> until SAVE: a reload or a closed tab takes it with it, and
        the browser asks first while anything is unsaved.
      </p>
      {/* The gym path opens this page signed out, and everything on it
       * works that way except the one thing that keeps a piece. Better said
       * before the row than discovered after it. */}
      {signedIn ? null : (
        <p className="eg-copy">
          <b>You are signed out, so SAVE will not work.</b> Pairing, SIMULATE and playback all run without an
          account — keeping a piece does not. Sign in before you row, or the recording ends with the tab.
        </p>
      )}

      <div className="eg-btns">
        <button type="button" className="eg-btn" onClick={add} disabled={support === "no" || adding}>
          {adding ? "Pairing…" : "Add an erg"}
        </button>
        <button
          type="button"
          className="eg-btn eg-btn-quiet"
          onClick={() => {
            const id = addSimErg();
            setOpen(id);
            bump();
          }}
        >
          Simulate
        </button>
        {/* THE PLAYBACK PICKER. A saved row becomes a card fed by the same
         * byte packets a monitor would send (playback.ts), so the console
         * cannot tell the two apart. */}
        <button type="button" className="eg-btn eg-btn-quiet" onClick={() => setPicking((v) => !v)} aria-expanded={picking}>
          {picking ? "Close saved rows" : "Play back a saved row"}
        </button>
        <Link className="eg-btn eg-btn-quiet" href="/erg/sessions">
          Sessions
        </Link>
      </div>

      {note ? <p className="eg-note eg-bad">{note}</p> : null}

      {picking ? (
        <div className="eg-picker">
          <div className="eg-sec-head">
            <h3>Play back a saved row</h3>
            <span className="eg-note">It arrives as an erg · the transport is inside</span>
          </div>
          <PlayPicker onPlay={(r) => void playRow(r.id, r.title)} busyId={loadingRow} />
        </div>
      ) : null}

      {support === "no" ? (
        <div className="eg-block">
          <b>This browser has no Web Bluetooth.</b> Chrome or Edge on a laptop or Android, or Bluefy on an
          iPhone — not Safari, and not an in-app browser. The page has to be on https or localhost. Everything
          else here works without it: SIMULATE and playback both feed a card the same packets a monitor would.
        </div>
      ) : null}
      {support === "yes" && btOff ? (
        <div className="eg-block">
          <b>Bluetooth looks switched off on this device.</b> Turn the adapter on, then ADD AN ERG.
        </div>
      ) : null}

      {ergs.length ? (
        <div className="eg-cards">
          {ergs.map((e) => (
            <ErgCard key={e.id} erg={e} onOpen={() => setOpen(e.id)} onChanged={bump} signedIn={signedIn} />
          ))}
        </div>
      ) : (
        <div className="eg-empty">No ergs yet — ADD AN ERG to pair a monitor, SIMULATE to see the screens with no erg in the room, or PLAY BACK A SAVED ROW.</div>
      )}
    </div>
  );
}
