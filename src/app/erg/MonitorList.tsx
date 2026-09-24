"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fmtElapsedHundredths, fmtMeters, fmtPace, fmtTenths } from "@/lib/pm5/pm5";
import { fmtTenthsClock, type TelemetryDoc, type TelemetrySavedRow } from "@/lib/pm5/session";
import { ErgDetail } from "./ErgDetail";
import { RaceBoard } from "./RaceBoard";
import { parseTvLook, RaceBoardTv, type TvLook } from "./RaceBoardTv";
import { expectedFinish, goalOf, goalWord, pieceEnded, typedErgName } from "./ErgGoal";
import { RowerPick, type Roster } from "./RowerPick";
import {
  ERG_API,
  LINK_WORD,
  addErg,
  addSimErg,
  setAutoSave,
  setRacePost,
  addSourceErg,
  anyUnsaved,
  bluetoothAvailable,
  bluetoothSupported,
  disconnect,
  ergUnsaved,
  getErg,
  listErgs,
  markLoaded,
  reconnect,
  removeErg,
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
 * on the left, then the four numbers he asked to see from across a gym, in
 * the order he reads them — DISTANCE, PACE, the EXPECTED FINISH at the goal
 * and only then ELAPSED — and then one quiet dot button. Six ergs read as
 * six lines rather than a wall of tiles.
 *
 * NOTHING ON THE ROW SETS ANYTHING (owner, 2026-09-17: "on the monitor
 * screen I do not need the goal buttons here, it is too much going on").
 * The goal control was three chips, a label and a number box on every row,
 * 337px of a 1440px screen, and it was crowding the expected finish so hard
 * that the clock beside it was being clipped mid-digit. A row is four
 * numbers now. Everything that CHANGES this erg is behind the dots.
 *
 * WHAT THE LEFT OF A ROW SAYS (review, 2026-09-17): the name the owner gave
 * this erg when he has given it one, because three PM5s in a gym all
 * advertise the same thing; under it the link and whether the recording is
 * UNSAVED or SAVED, and nothing else (owner, 2026-09-23) — the state, the
 * serial and the source are in the console head.
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

const typedName = typedErgName;

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

/* THE DOT MENU (owner, 2026-09-17: "the save, remove, disconnect options
 * should be like in a dot dot dot menu"; and 2026-09-23: "keep the … menu
 * just for disconnect/remove"). Two things that act on the link and the
 * slot, and nothing that reads or sets the erg: the goal is the monitor's
 * now (ErgGoal.ts goalOf), the rower is the search box beside the dots
 * (RowerPick.tsx), the name and SAVE are in the console head, and a
 * finished programmed piece saves itself (hub.ts).
 *
 * A real button with a real panel: ESCAPE closes it and hands focus back,
 * a press anywhere else closes it. The confirm before discarding an
 * unsaved recording still runs. */
function RowMenu({ erg }: { erg: Erg }) {
  const [open, setOpen] = useState(false);
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

  const remove = () => {
    if (ergUnsaved(erg) && !window.confirm(`Remove ${typedName(erg) ?? erg.name}? ${erg.rec.packets.length.toLocaleString("en-US")} recorded packets go with it — SAVE first to keep them.`)) return;
    forgetPlayback(erg.id);
    removeErg(erg.id);
  };

  return (
    <div className="eg-menu-wrap" ref={wrap}>
      {/* THE DOTS ARE QUIET (owner, 2026-09-17: "the three dots button is a
       * little large, can be a little more discreet"). A small glyph and no
       * border until it is hovered, focused or open — and still a 44px
       * target under a finger, which the sheet gives it back on a coarse
       * pointer. */}
      <button
        type="button"
        className="eg-dots"
        ref={button}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`More for ${typedName(erg) ?? erg.name} — disconnect, remove`}
        title="Disconnect · remove"
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">•••</span>
      </button>

      {open ? (
        <div className="eg-menu" role="group" aria-label={`Actions for ${typedName(erg) ?? erg.name}`}>
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

function ErgRow({ erg, onOpen, onChanged, signedIn, roster }: { erg: Erg; onOpen: () => void; onChanged: () => void; signedIn: boolean; roster: Roster | null }) {
  const g = erg.model.general;
  const a1 = erg.model.a1;
  const finish = expectedFinish(erg);
  const named = typedName(erg);
  const rec = recWord(erg);
  const ended = pieceEnded(erg);

  /* THE SUB LINE IS THE LINK AND THE PIP, NOTHING ELSE (owner, 2026-09-23:
   * "remove the text below the live status — workout logged, bluetooth,
   * etc"). The state, the serial and where the packets come from are all
   * in the console head, one click away. */

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
      <a className="eg-r-open" href={`/erg?erg=${encodeURIComponent(erg.id)}`} onClick={follow} data-inplace="">
        <span className="eg-r-who">
          <span className="eg-r-name">{named ?? erg.name}</span>
          <span className="eg-r-sub">
            <span className="eg-link-state">
              <span className={dotClass(erg)} aria-hidden="true" />
              {LINK_WORD[erg.link]}
            </span>
            {rec ? <span className={rec === "UNSAVED" ? "eg-pip eg-pip-on" : "eg-pip"}>{rec}</span> : null}
            {/* THE RACE RESULT went, or did not (hub.ts postRaceResult). */}
            {erg.race.note ? <span className={erg.race.note.ok ? "eg-pip" : "eg-pip eg-pip-on"}>{erg.race.note.ok ? "RESULT POSTED" : "RESULT NOT POSTED"}</span> : null}
          </span>
        </span>

        {/* THE FOUR NUMBERS, IN THE ORDER HE READS THEM (owner, 2026-09-17,
         * after using it: "let us order this in terms of importance — let us
         * go distance, then pace, then expected finish, then time elapsed").
         * How far, how fast, where that lands, and only then the clock.
         *
         * ONCE THE PIECE HAS ENDED the third column has nothing left to
         * predict, so it prints the AVERAGE SPLIT for the piece instead of
         * the finish. It used to print the finish time, which was the same
         * number as ELAPSED — harmless while the two sat at opposite ends of
         * the row and a plain duplicate now that they are side by side. The
         * clock says FINAL under itself instead. */}
        <span className="eg-r-nums">
          <Num k="Distance" v={g ? fmtMeters(g.distanceM) : "—"} />
          <Num k="Pace /500m" v={a1 && a1.currentPaceS > 0 ? fmtPace(a1.currentPaceS) : "—"} />
          {ended ? (
            <Num k="Average /500m" v={a1 && a1.averagePaceS > 0 ? fmtPace(a1.averagePaceS) : "—"} s={g ? `OVER ${fmtMeters(g.distanceM)}` : ""} />
          ) : (
            <Num k={`Expected ${goalWord(goalOf(erg))} finish`} v={finish.value} s={finish.under} hint={finish.hint} />
          )}
          <Num k="Elapsed" v={g ? fmtElapsedHundredths(g.elapsedHundredths) : "—"} s={ended ? "FINAL" : ""} />
        </span>
      </a>

      {/* Outside the link: a control inside an anchor is not a control. The
       * rower search box (owner, 2026-09-23: "make the rower selection a
       * search box") and one quiet button. */}
      <div className="eg-r-side">
        <RowerPick ergId={erg.id} rower={erg.rower} roster={roster} signedIn={signedIn} onChanged={onChanged} />
        <RowMenu erg={erg} />
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

export function MonitorList({ playId, ergId, board: boardParam = null, look: lookParam = null, signedIn = false }: { playId?: string | null; ergId?: string | null; board?: string | null; look?: string | null; signedIn?: boolean }) {
  const [ergs, setErgs] = useState<Erg[]>([]);
  const [support, setSupport] = useState<"unknown" | "yes" | "no">("unknown");
  const [btOff, setBtOff] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(ergId ?? null);
  /* THE RACE BOARD (owner, 2026-09-21: "a screen where it shows all the
   * rowers that are currently connected — a live race board, one row per
   * lane, the distance they are at, the pace, their expected time, and who
   * is in the lead"). It is a third VIEW of this one page, beside the list
   * and the console, for the same reason those two are: the hub is a
   * module singleton and a view swap cannot drop a link. /erg?board=1 opens
   * straight onto it, which is what the laptop plugged into the TV wants.
   *
   * THE ROWER VIEW IS GONE (owner, same day: "it did not land, so we will
   * just have the one view").
   *
   * THE WALL (owner, same day: "this will be on a full screen monitor, give
   * me a view that would go on a TV") is the board again, full screen, in
   * one of three looks — a fourth view of the same page for the same
   * reason, and it sits OVER the board so leaving it lands back there.
   * /erg?board=tv&look=b opens straight onto it. */
  const [board, setBoard] = useState<boolean>(boardParam !== null);
  const [tv, setTv] = useState<TvLook | null>(boardParam === "tv" ? (parseTvLook(lookParam) ?? "a") : null);
  const [picking, setPicking] = useState(false);
  const [loadingRow, setLoadingRow] = useState<string | null>(null);
  const bump = useCallback(() => setErgs(listErgs()), []);

  /* The hub is a module singleton, so the first paint after a client-side
   * hop already has every erg that was connected before it. */
  useEffect(() => {
    setErgs(listErgs());
    return subscribe(setErgs);
  }, []);

  /* AUTO-SAVE is armed while an account is signed in (hub.ts). */
  useEffect(() => {
    setAutoSave(signedIn);
    setRacePost(signedIn);
    return () => {
      setAutoSave(false);
      setRacePost(false);
    };
  }, [signedIn]);

  /* THE ROSTER, once, for the rower search box on every row and in the
   * console head (RowerPick.tsx). */
  const [roster, setRoster] = useState<Roster | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    let gone = false;
    fetch("/api/erg/rowers")
      .then((r) => r.json())
      .then((j: { ok?: boolean; rowers?: Roster }) => {
        if (!gone && j.ok && j.rowers) setRoster(j.rowers);
      })
      .catch(() => {
        /* the pick stays disabled */
      });
    return () => {
      gone = true;
    };
  }, [signedIn]);

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
  if (open && openErg) return <ErgDetail erg={openErg} onBack={() => setOpen(null)} signedIn={signedIn} roster={roster} />;
  if (tv) return <RaceBoardTv ergs={ergs} look={tv} onLook={setTv} onExit={() => setTv(null)} />;
  if (board) return <RaceBoard ergs={ergs} onBack={() => setBoard(false)} onOpen={(id) => setOpen(id)} onTv={() => setTv("a")} />;

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
        {/* THE BOARD: every erg on this page as a lane, in race order. */}
        <button type="button" className="eg-btn" onClick={() => setBoard(true)} disabled={ergs.length === 0}>
          Race board
        </button>
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
            <ErgRow key={e.id} erg={e} onOpen={() => setOpen(e.id)} onChanged={bump} signedIn={signedIn} roster={roster} />
          ))}
        </div>
      ) : (
        <div className="eg-empty">No ergs yet — ADD AN ERG to pair a monitor, SIMULATE to see the screens with no erg in the room, or PLAY BACK A SAVED ROW.</div>
      )}

    </div>
  );
}
