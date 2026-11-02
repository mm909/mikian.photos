"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { replay } from "./bracket";
import { LOOKS, W, bracketCard, optedInCard, palette, placeCard, type Fonts, type Look } from "./stickerPaint";
import { TOURNEY, skillLabel, teamName } from "./tournament";
import type { ResultRow, TeamRow } from "./BracketView";

/* THE STICKERS (owner, 2026-11-02): the OPTED IN team card — "use the
 * tone opted in instead of we're in" — and the whole bracket as one
 * image. The frame is the hyrox StickerFrame pattern: font probes, a
 * measure-then-draw painter, share / copy / download. No address on any
 * of it (owner, 2026-10-14). */

type Painter = (ctx: CanvasRenderingContext2D, look: Look, fonts: Fonts, draw: boolean) => number;

async function loadFonts(d: HTMLSpanElement | null, c: HTMLSpanElement | null): Promise<Fonts> {
  const fonts: Fonts = {
    display: d ? window.getComputedStyle(d).fontFamily : "Impact, sans-serif",
    cond: c ? window.getComputedStyle(c).fontFamily : "sans-serif",
  };
  try {
    await Promise.all([document.fonts.load(`400 100px ${fonts.display}`), document.fonts.load(`700 40px ${fonts.cond}`), document.fonts.ready]);
  } catch {
    /* paint in the fallback */
  }
  return fonts;
}

function render(canvas: HTMLCanvasElement, paint: Painter, look: Look, fonts: Fonts): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const h = Math.ceil(paint(ctx, look, fonts, false));
  canvas.width = W;
  canvas.height = h;
  ctx.clearRect(0, 0, W, h);
  const ground = palette(look).ground;
  if (ground) {
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, W, h);
  }
  paint(ctx, look, fonts, true);
}

const blobOf = (canvas: HTMLCanvasElement) =>
  new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });

export function PbStickerFrame({ paint, filename, pickers, label }: { paint: Painter; filename: (look: Look) => string; pickers?: ReactNode; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dProbe = useRef<HTMLSpanElement | null>(null);
  const cProbe = useRef<HTMLSpanElement | null>(null);
  const [look, setLook] = useState<Look>("court");
  const [msg, setMsg] = useState("");
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [canCopy, setCanCopy] = useState(false);
  const [handheld, setHandheld] = useState(false);

  useEffect(() => {
    const share = typeof navigator.canShare === "function";
    setCanShareFiles(share);
    setCanCopy(typeof ClipboardItem !== "undefined" && typeof navigator.clipboard?.write === "function" && window.isSecureContext);
    setHandheld(share && !!window.matchMedia?.("(pointer: coarse)").matches);
  }, []);

  const repaint = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fonts = await loadFonts(dProbe.current, cProbe.current);
    render(canvas, paint, look, fonts);
  }, [paint, look]);

  useEffect(() => {
    void repaint();
  }, [repaint]);

  const name = filename(look);
  const toBlob = () => (canvasRef.current ? blobOf(canvasRef.current) : Promise.resolve(null));

  const onDownload = async () => {
    const blob = await toBlob();
    if (!blob) return setMsg("Couldn’t make the image");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setMsg("Saved");
  };
  const onCopy = async () => {
    try {
      const pending = toBlob().then((b) => {
        if (!b) throw new Error("no image");
        return b;
      });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": pending })]);
      setMsg("Copied — paste it into your story");
    } catch {
      setMsg("Couldn’t copy — download instead");
    }
  };
  const onShare = async () => {
    try {
      const blob = await toBlob();
      if (!blob) throw new Error("no image");
      const file = new File([blob], name, { type: "image/png" });
      if (!navigator.canShare?.({ files: [file] })) throw new Error("unsupported");
      await navigator.share({ files: [file] });
      setMsg("");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setMsg("Sharing isn’t available — copy or download");
    }
  };

  return (
    <div className="pb-stk">
      <span ref={dProbe} aria-hidden className="pb-probe d">
        A
      </span>
      <span ref={cProbe} aria-hidden className="pb-probe c">
        A
      </span>
      {pickers}
      <div className="pb-stk-pick looks" role="group" aria-label="Look">
        {LOOKS.map((l) => (
          <button key={l.id} type="button" aria-pressed={look === l.id} onClick={() => setLook(l.id)}>
            {l.label}
          </button>
        ))}
      </div>
      <canvas ref={canvasRef} width={W} height={W} aria-label={label} className={look.startsWith("clear") ? "clear" : ""} />
      <div className="pb-stk-btns">
        {canShareFiles ? (
          <button type="button" className={handheld ? "primary" : ""} onClick={() => void onShare()}>
            Share
          </button>
        ) : null}
        {canCopy ? (
          <button type="button" onClick={() => void onCopy()}>
            Copy
          </button>
        ) : null}
        <button type="button" className={canShareFiles ? "" : "primary"} onClick={() => void onDownload()}>
          Download
        </button>
      </div>
      <p className="pb-stk-msg">{msg}</p>
    </div>
  );
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* OPTED IN, for one team. */
export function OptedInSticker({ team }: { team: TeamRow }) {
  const paint = useMemo<Painter>(() => {
    const card = optedInCard({ player1: team.player1, player2: team.player2, skill: skillLabel(team.skill), year: TOURNEY.year });
    return (ctx, look, fonts, draw) => placeCard(ctx, fonts, look, draw, card);
  }, [team]);
  return (
    <PbStickerFrame
      paint={paint}
      label={`Opted-in sticker for ${teamName(team.player1, team.player2)}`}
      filename={(look) => `pickleball-opted-in-${slug(team.player1)}-${slug(team.player2)}-${look}.png`}
    />
  );
}

/* OPTED IN with a team picker over it, for anyone re-making theirs. */
export function TeamStickers({ teams }: { teams: TeamRow[] }) {
  const [teamId, setTeamId] = useState(teams[teams.length - 1]?.id ?? "");
  const team = teams.find((t) => t.id === teamId) ?? teams[teams.length - 1];
  if (!team) return null;
  const paint: Painter = (ctx, look, fonts, draw) =>
    placeCard(ctx, fonts, look, draw, optedInCard({ player1: team.player1, player2: team.player2, skill: skillLabel(team.skill), year: TOURNEY.year }));
  return (
    <PbStickerFrame
      paint={paint}
      label={`Opted-in sticker for ${teamName(team.player1, team.player2)}`}
      filename={(look) => `pickleball-opted-in-${slug(team.player1)}-${slug(team.player2)}-${look}.png`}
      pickers={
        teams.length > 1 ? (
          <div className="pb-stk-pick" role="group" aria-label="Team">
            {teams.map((t) => (
              <button key={t.id} type="button" aria-pressed={t.id === team.id} onClick={() => setTeamId(t.id)}>
                {t.player1.split(" ")[0]} + {t.player2.split(" ")[0]}
              </button>
            ))}
          </div>
        ) : undefined
      }
    />
  );
}

/* THE WHOLE BRACKET as one image (owner, 2026-11-02: "bracket snapshot"). */
export function BracketSticker({ teams, results }: { teams: TeamRow[]; results: ResultRow[] }) {
  const paint = useMemo<Painter>(() => {
    const seeded = teams
      .filter((t) => !t.withdrawn && t.seed !== null)
      .sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0))
      .map((t) => t.id);
    const state = replay(seeded, results);
    const names = new Map(teams.map((t) => [t.id, { short: `${t.player1.split(" ")[0]} & ${t.player2.split(" ")[0]}` }]));
    const champ = state.champion ? teams.find((t) => t.id === state.champion) : null;
    const card = bracketCard(state, names, TOURNEY.year, champ ? teamName(champ.player1, champ.player2) : null);
    return (ctx, look, fonts, draw) => placeCard(ctx, fonts, look, draw, card);
  }, [teams, results]);
  return <PbStickerFrame paint={paint} label="The bracket as an image" filename={(look) => `pickleball-bracket-${look}.png`} />;
}
