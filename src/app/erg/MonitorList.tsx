"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fmtElapsedHundredths, fmtMeters, fmtPace, fmtTenths, isEnded, workoutStateWord } from "@/lib/pm5/pm5";
import { fmtTenthsClock, type TelemetryDoc, type TelemetrySavedRow } from "@/lib/pm5/session";
import { ErgDetail } from "./ErgDetail";
import { GoalControl, expectedFinish, goalMismatch, goalWord } from "./ErgGoal";
import {
  ERG_API,
  LINK_WORD,
  addErg,
  addSimErg,
  addSourceErg,
  anyUnsaved,
  bluetoothAvailable,
  bluetoothSupported,
  disconnect,
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
 * ROWS, NOT CARDS (owner, same day, after using it: "I want them to be more
 * horizontal than cards — horizontally stacked rather than side by side
 * like a card"). One full-width row per erg, stacked down the page: the erg
 * on the left, then the four numbers he asked to see from across a gym —
 * ELAPSED, DISTANCE, PACE and the EXPECTED FINISH at the goal — then the
 * goal itself, then a dot menu holding SAVE, DISCONNECT and REMOVE. Six
 * ergs read as six lines rather than a wall of tiles.
 *
 * WHAT THE LEFT OF A ROW SAYS (review, 2026-09-17): the name the owner gave
 * this erg when he has given it one, because three PM5s in a gym all
 * advertise the same thing; under it the link, what the monitor is DOING,
 * whether the recording is UNSAVED or SAVED, and then the advertised name
 * and the serial. Under 760px the goal folds into the dot menu behind one
 * button, so the row stays a name, four numbers and one 44px band.
 *
 * THE WHOLE ROW IS A LINK into that erg console, so it opens in a tab like
 * any other link. A plain click does NOT navigate: it swaps this view in
 * place, because the hub is a module singleton and a view swap cannot drop
 * a connection or remount anything holding one. BACK TO MONITORS is free
 * and five ergs mid-piece stay mid-piece while the sixth is on screen. The
 * dot menu sits outside the link so a press on it goes nowhere.
 *
 * PLAY BACK A SAVED ROW opens the account's own sessions, and picking one
 * adds a row fed by playback.ts — the saved document turned back into byte
 * packets. From the list it is an erg like any other; inside, the transport
 * strip says PLAYBACK across the top. /erg?play=SOMEID does the same on
 * load, so a session screen can hand a row straight to the console.
 *
 * WHAT EXPLAINS IS AT THE FOOT (owner, same day: "whenever we have text
 * that explains something, let us put it on the bottom of the page rather
 * than the top" — the same thing he asked of the blackout console). The top
 * of this page is the title, the state and the controls. What blocks the
 * reader right now — no Web Bluetooth here, the adapter switched off —
 * stays where the eye is.
 *
 * NO HEART RATE anywhere on this page (owner, 2026-09-17: no belt this
 * month). It is still decoded and still saved — see hub.ts.
 *
 * This component owns no telemetry. It subscribes to the hub and paints
 * what it is handed; every button is one hub call. */

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

/* One live number on the row: the key, the number, and the quiet line under
 * it the expected finish uses for its band. HINT is the long version of
 * that line — what the band is and where it came from — held on the element
 * rather than printed, so the band itself always fits the column (review,
 * 2026-09-17: it was being ellipsised away at 9px). */
function Num({ k, v, s, hint }: { k: string; v: string; s?: string; hint?: string | null }) {
  return (
    <span className="eg-r-n" title={hint ?? undefined}>
      <span className="k">{k}</span>
      <span className="v">{v}</span>
      <span className="s">{s ?? ""}</span>
    </span>
  );
}

/* WHAT THE OWNER CALLED THIS ERG, or null while it is still the name the
 * monitor advertises. Three PM5s in a gym all advertise PM5 4xxxxxxxx, so
 * the row heading is the typed name when there is one (review, 2026-09-17)
 * and the advertised name moves down to the sub line beside the serial. The
 * same field is still the title the piece is saved under: naming a lane and
 * titling its piece are one gesture. */
function typedName(e: Erg): string | null {
  const t = e.save.title === null ? "" : e.save.title.trim();
  return t ? t : null;
}

/* SAVED or UNSAVED on the row itself (review, 2026-09-17: nothing on the
 * list said which of three ergs had already been filed, so the dot menu had
 * to be opened three times to find out). Null when there is nothing to
 * file: a playback is already in the database, and a slot that has recorded
 * nothing has nothing to lose. */
function recWord(e: Erg): "SAVED" | "UNSAVED" | null {
  if (e.source === "playback") return null;
  if (e.rec.saved) return "SAVED";
  return e.rec.packets.length ? "UNSAVED" : null;
}

/* The monitor has stopped: WORKOUT END, TERMINATE or WORKOUT LOGGED. A row
 * in one of these states is not advancing, so it stops printing a
 * prediction (review, 2026-09-17: a finished piece sat there with a green
 * LIVE dot and an expected finish beside four frozen numbers). */
function pieceEnded(e: Erg): boolean {
  const g = e.model.general;
  return g ? isEnded(g.workoutState) : false;
}

/* THE DOT MENU (owner, 2026-09-17: "the save, remove, disconnect options
 * should be like in a dot dot dot menu"). It holds everything that acts on
 * this erg and nothing that reads it, so the row stays numbers.
 *
 * A real button with a real panel: ESCAPE closes it and hands focus back,
 * a press anywhere else closes it, and every control in it is reachable by
 * keyboard. SAVE is still per erg — its own name, its own button, its own
 * word — and the confirm before discarding an unsaved recording still
 * runs.
 *
 * ON A PHONE THE GOAL COMES IN HERE TOO (review, 2026-09-17: a label, three
 * 44px chips and a 44px box on every row roughly doubled its height, and
 * three ergs ran to three screens — on the screen whose whole point is that
 * six ergs read as six lines). Under 760px the row collapses that control
 * to the one button beside the dots, reading GOAL 5,000 M, which opens this
 * same panel with the chips and the box inside it. Both copies are always
 * rendered and the sheet displays exactly one of them, so the goal is one
 * tap away at any width. */
function RowMenu({ erg, onChanged, signedIn }: { erg: Erg; onChanged: () => void; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onDown = (ev: Event) => {
      const node = ev.target as Node | null;
      if (node && wrap.current && wrap.current.contains(node)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const playback = erg.source === "playback";
  const savedWord = erg.rec.saved ? "SAVED" : erg.rec.packets.length ? "UNSAVED" : "NOTHING RECORDED YET";

  const save = async () => {
    setBusy(true);
    await saveErg(erg.id, ergTitle(erg));
    setBusy(false);
    onChanged();
  };

  const remove = () => {
    if (ergUnsaved(erg) && !window.confirm(`Remove ${typedName(erg) ?? erg.name}? ${erg.rec.packets.length.toLocaleString("en-US")} recorded packets go with it — SAVE first to keep them.`)) return;
    forgetPlayback(erg.id);
    removeErg(erg.id);
  };

  return (
    <div className="eg-menu-wrap" ref={wrap}>
      {/* The phone-width goal button. It lives inside this wrapper so it
       * shares the panel, the ESCAPE key and the press-anywhere-else that
       * closes it; the sheet hides it above 760px. */}
      <button type="button" className="eg-goal-mini" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        Goal {goalWord(erg.goalM)}
      </button>

      <button
        type="button"
        className="eg-dots"
        ref={button}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`More for ${typedName(erg) ?? erg.name}`}
        onClick={() => setOpen((v) => !v)}
      >
        •••
      </button>

      {open ? (
        <div className="eg-menu" role="group" aria-label={`Actions for ${typedName(erg) ?? erg.name}`}>
          {/* Displayed only under 760px, where the row itself has none. */}
          <div className="eg-menu-goal">
            <GoalControl ergId={erg.id} goalM={erg.goalM} scope="menu" />
          </div>

          {playback ? (
            <p className="eg-note">Playing back a saved row · nothing to save</p>
          ) : (
            <>
              {/* ONE FIELD, TWO JOBS (review, 2026-09-17: it was labelled
               * as the save title, so the one thing that could tell lane 1
               * from lane 3 looked like it did something else). What is
               * typed here is the row heading AND the title the piece is
               * saved under. */}
              <label className="eg-away" htmlFor={`title-${erg.id}`}>
                Name this erg
              </label>
              <input id={`title-${erg.id}`} value={ergTitle(erg)} onChange={(ev) => setErgTitle(erg.id, ev.target.value)} placeholder="Name this erg" />
              {/* Saving is the one thing on this page that needs an
               * account, so a signed-out viewer is told by the button
               * itself, not by a 401 at the end of the piece. */}
              <button
                type="button"
                className="eg-btn"
                onClick={save}
                disabled={busy || erg.save.busy || !erg.rec.packets.length || !signedIn}
                title={signedIn ? undefined : "Saving needs an account — sign in first"}
              >
                {busy || erg.save.busy ? "Saving…" : "Save"}
              </button>
              <p className={erg.save.note && !erg.save.note.ok ? "eg-note eg-bad" : "eg-note"}>
                {!signedIn ? "SIGN IN TO SAVE" : erg.save.note ? erg.save.note.text : savedWord}
              </p>
            </>
          )}

          {erg.source === "live" && erg.link === "live" ? (
            <button type="button" className="eg-btn eg-btn-quiet" onClick={() => disconnect(erg.id)}>
              Disconnect
            </button>
          ) : null}
          {erg.source === "live" && erg.link !== "live" ? (
            <button type="button" className="eg-btn eg-btn-quiet" onClick={() => void reconnect(erg.id)}>
              Reconnect
            </button>
          ) : null}
          <button type="button" className="eg-btn eg-btn-quiet" onClick={remove}>
            Remove
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ErgRow({ erg, onOpen, onChanged, signedIn }: { erg: Erg; onOpen: () => void; onChanged: () => void; signedIn: boolean }) {
  const g = erg.model.general;
  const a1 = erg.model.a1;
  const finish = expectedFinish(erg);
  const mismatch = goalMismatch(erg);
  const named = typedName(erg);
  const rec = recWord(erg);
  const ended = pieceEnded(erg);

  /* The sub line: what the monitor is DOING as well as whether the radio is
   * up (review, 2026-09-17: the row carried the Bluetooth link and nothing
   * else, so a piece that had finished still read LIVE). Then the
   * advertised name when the owner has given this erg one of his own, the
   * serial, where the packets come from, and OPEN. */
  const bits = [
    g ? workoutStateWord(g.workoutState) : null,
    named ? erg.name : null,
    erg.serial || null,
    erg.sourceLabel ?? (erg.source === "live" ? "BLUETOOTH" : erg.source.toUpperCase()),
    "OPEN",
  ].filter((b): b is string => Boolean(b));

  /* A real href, so the row opens in a tab, is copyable and reads as a
   * link — but a plain click stays on this page and swaps the view, which
   * is what keeps every other connection up. */
  const follow = (ev: React.MouseEvent<HTMLAnchorElement>) => {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    ev.preventDefault();
    onOpen();
  };

  return (
    <article className="eg-r">
      <a className="eg-r-open" href={`/erg?erg=${encodeURIComponent(erg.id)}`} onClick={follow}>
        <span className="eg-r-who">
          <span className="eg-r-name">{named ?? erg.name}</span>
          <span className="eg-r-sub">
            <span className="eg-link-state">
              <span className={dotClass(erg)} aria-hidden="true" />
              {LINK_WORD[erg.link]}
            </span>
            {rec ? <span className={rec === "UNSAVED" ? "eg-pip eg-pip-on" : "eg-pip"}>{rec}</span> : null}
            <span>{bits.join(" · ")}</span>
          </span>
        </span>

        {/* THE FOUR NUMBERS HE ASKED FOR (owner, 2026-09-17: "on the monitor
         * screen I want to see the current elapsed time, pace and distance.
         * And expected five K finish time"). Once the piece has ended the
         * fourth stops predicting and prints what was actually rowed. */}
        <span className="eg-r-nums">
          <Num k="Elapsed" v={g ? fmtElapsedHundredths(g.elapsedHundredths) : "—"} />
          <Num k="Distance" v={g ? fmtMeters(g.distanceM) : "—"} />
          <Num k="Pace /500m" v={a1 && a1.currentPaceS > 0 ? fmtPace(a1.currentPaceS) : "—"} />
          {ended ? (
            <Num k="Finish" v={g ? fmtElapsedHundredths(g.elapsedHundredths) : "—"} s={g ? `${fmtMeters(g.distanceM)} rowed` : ""} />
          ) : (
            <Num k={`Expected ${goalWord(erg.goalM)} finish`} v={finish.value} s={finish.under} hint={finish.hint} />
          )}
        </span>
      </a>

      {/* Outside the link: a control inside an anchor is not a control. The
       * goal control here is the wide-screen copy; under 760px the sheet
       * hides it and the dot menu carries the phone copy instead. */}
      <div className="eg-r-side">
        <span className="eg-r-goal">
          <GoalControl ergId={erg.id} goalM={erg.goalM} scope="row" />
        </span>
        <RowMenu erg={erg} onChanged={onChanged} signedIn={signedIn} />
      </div>

      {/* The monitor is on a different fixed distance. Said once, quietly;
       * neither number overrides the other. */}
      {mismatch ? <p className="eg-r-note">{mismatch}</p> : null}
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

export function MonitorList({ playId, ergId, signedIn = false }: { playId?: string | null; ergId?: string | null; signedIn?: boolean }) {
  const [ergs, setErgs] = useState<Erg[]>([]);
  const [support, setSupport] = useState<"unknown" | "yes" | "no">("unknown");
  const [btOff, setBtOff] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(ergId ?? null);
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
      const ergSlot = addSourceErg({
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
      rememberPlayback(ergSlot, driver);
      markLoaded(ergSlot, { id: j.row.id, title: name });
      setPicking(false);
      setOpen(ergSlot);
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
   * from another tab of this view — or the row was opened in a NEW tab,
   * where this hub has never seen that id — fall back to the list. */
  const openErg = open ? getErg(open) : null;
  if (open && openErg) return <ErgDetail erg={openErg} onBack={() => setOpen(null)} signedIn={signedIn} />;

  return (
    <div>
      <div className="eg-head">
        <h1>Monitors</h1>
        <span className="eg-eyebrow">One row per erg · open one to watch it</span>
      </div>

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
        {/* THE PLAYBACK PICKER. A saved row becomes a row fed by the same
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

      {/* A REFUSAL STAYS WHERE THE EYE IS. The paragraphs that explain this
       * page moved to the foot; these two say the page cannot do the thing
       * the reader is about to try, and belong here. */}
      {support === "no" ? (
        <div className="eg-block">
          <b>This browser has no Web Bluetooth.</b> Chrome or Edge on a laptop or Android, or Bluefy on an
          iPhone — not Safari, and not an in-app browser. The page has to be on https or localhost. Everything
          else here works without it: SIMULATE and playback both feed a row the same packets a monitor would.
        </div>
      ) : null}
      {support === "yes" && btOff ? (
        <div className="eg-block">
          <b>Bluetooth looks switched off on this device.</b> Turn the adapter on, then ADD AN ERG.
        </div>
      ) : null}

      {ergs.length ? (
        <div className="eg-rows">
          {ergs.map((e) => (
            <ErgRow key={e.id} erg={e} onOpen={() => setOpen(e.id)} onChanged={bump} signedIn={signedIn} />
          ))}
        </div>
      ) : (
        <div className="eg-empty">No ergs yet — ADD AN ERG to pair a monitor, SIMULATE to see the screens with no erg in the room, or PLAY BACK A SAVED ROW.</div>
      )}

      {/* ---- WHAT EXPLAINS, AT THE FOOT (owner, 2026-09-17) ---- */}
      <div className="eg-tail">
        <p>
          <b>Pair as many ergs as there are monitors in the room.</b> Each one gets a row with its own link, its
          own recording and its own SAVE — saving one says nothing about the others. Open a row to watch that erg
          on its own screen; come back and the link is still up. The goal on each row is what the EXPECTED FINISH
          is measured against: 5,000 m unless you change it, whatever the monitor itself is set to. On a phone
          the goal is the GOAL button beside the •••, which opens the same chips inside the menu.
        </p>
        <p>
          <b>The expected finish is a prediction, and it says so:</b> a ~ in front of the clock, and the band
          under it — ± 12 s — is how far out it could be. The band starts wide and closes as the piece does. Every
          other number on the row is measured, not predicted, which is why only that one wears the twiddle. When
          the piece ends the row stops predicting and prints what was rowed.
        </p>
        <p>
          <b>On each monitor:</b> set the piece up, then Main Menu, More Options, <b>Turn Wireless ON</b>, and
          leave it on the workout screen. <b>One app per monitor:</b> if ErgData on a phone is linked to that erg,
          this page cannot see it. Do not pair the PM5 in the laptop Bluetooth settings — ADD AN ERG does it.
        </p>
        <p>
          <b>The recording lives in this tab only</b> until SAVE: a reload or a closed tab takes it with it, and
          the browser asks first while anything is unsaved. {signedIn ? "SAVE files the piece under your account." : "You are signed out, so SAVE will not work — pairing, SIMULATE and playback all run without an account; keeping a piece does not."}
        </p>
        <p>
          <b>Everything that acts on an erg is in the ••• menu</b> at the end of its row: the name, SAVE,
          DISCONNECT or RECONNECT, and REMOVE. The row itself is a link — click it to open the console here,
          or open it in a tab.
        </p>
        <p>
          <b>Name each erg in its ••• menu</b> — LANE 1, LANE 2 — and the row heading becomes that instead of the
          PM5 4xxxxxxxx every monitor advertises, with the advertised name and the serial moving down to the line
          under it. The same name is the title the piece is saved under. Beside the link word, each row says
          UNSAVED or SAVED, so nothing has to be opened to find out which pieces are already filed.
        </p>
      </div>
    </div>
  );
}
