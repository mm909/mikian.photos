import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { createElement } from "react";
import { ActivityIndicator, Animated, Easing, Image, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { api, type BoardData, type BoardRow, type FollowState, type Me, type Photo } from "../api";
import { CloseIcon, ShareIcon } from "../icons";
import type { TelemetryDoc } from "../pm5/session";
import { arcadeFor } from "../arcade/gate";
import { useSession } from "../session";
import { Chip, Ctl, Dash, Dateline, Dot, Eye, Lead, mono } from "../site";
import type { Fetched } from "../files";
import { GROUNDS, LENGTHS, M2D_REELS, STRIP, deck, filmReel, gifReel, rowReels, shareGif, reelStillUri, reelStripUri, copySticker, shareFilm, shareSticker, stickerUri, type ClipId, type GroundId, type ReelSource, type Sticker } from "../stickers";
import type { Row } from "../store";
import { C, F, LADDER, fmtClock, fmtInt, fmtPace, lifetimeTag } from "../theme";
import type { Faked } from "./RowScreen";
import { Avatar, Blocks, Btn, PhotoPair, Pop, Waiting, useCount, useLoad, useModalHold, sideways } from "../ui";
import { CommentsSheet, PostActions } from "./Comments";
import { EditRow } from "./EditRow";
import { Review } from "./Review";
import type { MetricId } from "./Field";
import type { RowMeasure } from "../pm5/craft";
import { RowMenu, Sheet } from "./Social";
import { useGame, useLastDemoGame, type Game } from "../arcade/games";
import { AfterRow } from "./AfterRow";
import { equip, useLocker } from "../arcade/locker";
import { levelOf } from "../arcade/score";
import { RARITY_COLOR, SKIN_BY_ID, STOCK, LAYER_WORD, wear } from "../arcade/skins";
import { TokenArt } from "../arcade/Token";

/* ONE ROW'S PAGE (owner, 2026-11-20). The journey he walked: "right as they
 * finish they submit the row and see an animation of their meters going up
 * and seeing who they have passed. They get a shareables menu, then they get
 * shown a stats page with all of their stats from this row if they were
 * connected to the erg (prob the same screen but with less stats if they
 * didnt). Then they might share the stickers"; and "if you tap a row it can
 * open up the commentary on that row, that post row screen, and there you
 * can use the shareables".
 *
 * So one page, top to bottom:
 *   LOGGED, only when the row was logged a moment ago: the all-time meters
 *     counting up (since 2026-11-23; see Logged), the next mark and the next
 *     rung, any tag just earned, and the month as a slice of its board, the
 *     rower's line rising past the rowers just passed;
 *   the row: who, when, the meters, the time and the split, the two photos;
 *   STICKERS, for the rower's own row: the site's transparent share cards,
 *     drawn by the site, a tap to share;
 *   REEL OVERLAYS, when the erg was connected: the row's numbers as short
 *     videos on a ground to key out, filmed by the site, to stitch into an
 *     edit in another app;
 *   THE READ, when the erg was connected: the recording read back; the
 *     monitor's averages alone when the recording is somebody else's.
 * Opened later from the feed or a profile it is the same page with no
 * LOGGED block. */

export type Fresh = { meters: number; monthBefore: number; lifeBefore: number; inMonth: boolean; goal: number; monthWord: string };

type RowData = {
  id: string;
  day: string;
  rowedStr: string;
  dayStr: string;
  clockStr: string;
  rowerNumber: number;
  numStr: string;
  name: string;
  title: string;
  caption?: string;
  meters: number | null;
  seconds: number | null;
  metersStr: string;
  durationStr: string;
  splitStr: string;
  photos: Photo[];
  /* On the rower's own row: the photos' storage keys, for EDIT ROW. */
  photoKeys?: string[];
  masked: boolean;
  digits?: number;
  elite: boolean;
  mine: boolean;
  /* The viewer is an admin: the owner's tools show on this row. */
  admin?: boolean;
  /* How the viewer stands to the row's rower, for the three dots. */
  rel?: { following: FollowState; bell: boolean; muted?: boolean };
  avatar?: string | null;
  /* The rower's usual, to read this row against. */
  usual?: { rows: number; avgPace: number; avgMeters: number; same: number; place: number; best: number } | null;
  canShare: boolean;
  canReel: boolean;
  likes?: number;
  liked?: boolean;
  comments?: number;
  erg: { id: string; device: string; simulated: boolean; watts: number | null; spm: number | null; hr: number | null; drag: number | null; strokes: number } | null;
  doc: TelemetryDoc | null;
};

export function RowPage({
  id,
  fresh,
  rows,
  localDoc,
  onRower,
  onDone,
  menu,
  onMenu,
  onWho,
  talk,
  onMetric,
  fake,
}: {
  id: string;
  fresh?: Fresh;
  /* A demo row "logged" (RowScreen.tsx Faked): the page is drawn from
   * what the form had, on the phone, and nothing on it reaches the site. */
  fake?: Faked;
  rows: Row[];
  localDoc?: TelemetryDoc;
  onRower: (n: number) => void;
  onDone: () => void;
  /* The three dots in the top bar, pressed (App.tsx holds it). */
  menu?: boolean;
  onMenu?: (open: boolean) => void;
  /* Whose row this is, once known: the top bar's mark rolls into it. */
  onWho?: (num: number) => void;
  /* Opened from a line about a comment: the comments come up at once. */
  talk?: boolean;
  /* A card of the analytics, asked about: its questions open (Field.tsx). */
  onMetric?: (id: MetricId, mine: RowMeasure) => void;
}) {
  const path = `/api/row100k/app/row?id=${id}`;
  const { me } = useSession();
  const loaded = useLoad(() => (fake ? Promise.resolve(null) : api<{ row: RowData }>(path)), [path, !!fake], fake ? null : path);
  const pretend = useMemo(() => (fake && fresh ? fakeRow(fake, fresh, localDoc ?? null, me) : null), [fake, fresh, localDoc, me]);
  const data = pretend ? { row: pretend } : loaded.data;
  const { error, reload } = loaded;
  const [sharing, setSharing] = useState<false | true | { start: string; only: string }>(false);
  const [talking, setTalking] = useState(!!talk);
  /* THE ARCADE'S AFTER-ROW, over a row just logged that had a run on it
   * (AfterRow.tsx): performance, progress, the boxes. Once. */
  const game = useGame(fake ? null : id);
  const demoGame = useLastDemoGame();
  const ran = fake ? demoGame : game;
  const [after, setAfter] = useState(true);
  const [said, setSaid] = useState<number | null>(null);
  /* EDIT ROW is open. It comes up a moment after the menu that asked for
   * it has gone: a phone will not raise one sheet while another is still
   * leaving, which is what made it stutter. */
  const [writing, setWriting] = useState(false);
  const edit = () => setTimeout(() => setWriting(true), 260);
  const who = data?.row.rowerNumber;
  useEffect(() => {
    if (who) onWho?.(who);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [who]);
  /* THE STICKERS ARE FETCHED AS THE PAGE OPENS, not when SHARE is pressed
   * (owner, 2026-11-22: "why do our shareables take so long to load?"), so
   * they are drawn by the time anybody asks for them. */
  const mayShare = !!data?.row.canShare && !data.row.masked;
  useEffect(() => {
    if (mayShare) deck(id).catch(() => null);
  }, [mayShare, id]);
  if (!data) return <Waiting error={error} onRetry={reload} />;
  const r = data.row;
  const doc = r.doc ?? localDoc ?? null;
  const erg = r.erg ? [r.erg.watts ? [`${r.erg.watts}`, "Watts"] : null, r.erg.spm ? [`${r.erg.spm}`, "Strokes a minute"] : null, r.erg.hr ? [`${r.erg.hr}`, "Heart rate"] : null, r.erg.drag ? [`${r.erg.drag}`, "Drag factor"] : null].filter((x): x is string[] => x !== null) : [];

  /* The row itself, small, under the all-time meters of a row just logged:
   * its meters, its time and its split (owner, 2026-11-23: "I know that I
   * just rode 5,000"). */
  const figures = (
    <Text style={{ fontFamily: F.mono, fontSize: 14, color: C.gray, marginTop: 10, fontVariant: ["tabular-nums"] }}>
      <Text style={{ fontFamily: F.monoBold, color: C.ink }}>+{fmtInt(r.meters ?? 0)} m  </Text>
      {r.masked ? null : <Text style={{ fontFamily: F.monoBold, color: C.ink }}>{r.durationStr}  </Text>}
      {r.splitStr}
    </Text>
  );

  const afterOn = after && !!fresh && !!ran && ran.mode === "solo" && arcadeFor(me) && Date.now() - ran.at < 30 * 60_000;
  return (
    <View style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 140 }}>
      {fake ? <Text style={[mono(10, true, C.accent, 0.12), { lineHeight: 16, marginBottom: 12 }]}>Demo row · nothing was saved</Text> : null}
      {/* WHO AND WHEN, in two tight lines (owner, 2026-11-21: "the space
          isn't used well up at the top. I feel like we can do the same with
          less vertical space"). The rower's number is in the bar above. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable accessibilityLabel={`${r.name}'s page`} onPress={() => onRower(r.rowerNumber)}>
          <Avatar uri={r.avatar} name={r.name} num={r.rowerNumber} size={40} />
        </Pressable>
        <Pressable accessibilityRole="link" accessibilityLabel={`${r.name}, rower ${r.numStr}`} onPress={() => onRower(r.rowerNumber)} hitSlop={8} style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 18, color: C.ink }}>
            {r.name}
          </Text>
          <Text numberOfLines={1} style={{ fontFamily: F.mono, fontSize: 11, color: C.gray, marginTop: 3 }}>
            {r.rowedStr} · {r.clockStr}
            {r.title ? ` · ${r.title}` : ""}
          </Text>
        </Pressable>
      </View>

      {/* THE TWO NUMBERS: how far, and at what pace (owner, 2026-11-21:
          "those are the two numbers I'm looking at"). The meters lead; the
          pace is second and no smaller than it needs to be; the time is the
          small one under it. */}
      {fresh && r.meters ? (
        <Logged fresh={fresh} meters={r.meters} line={figures} onRower={onRower} pretend={!!fake} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 16 }}>
          {/* In the ink, not the blue (owner, 2026-11-23: "let's default it
              to just white ... the 5,000 meters"). */}
          <View>
            {r.masked ? (
              <Blocks n={r.digits ?? 4} size={40} />
            ) : (
              <Text style={{ fontFamily: F.black, fontSize: 52, lineHeight: 54, letterSpacing: -1, color: C.ink, fontVariant: ["tabular-nums"] }}>{fmtInt(r.meters ?? 0)}</Text>
            )}
            <Text style={[mono(10, false, C.gray, 0.14), { marginTop: 4 }]}>Meters</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontFamily: F.black, fontSize: 32, lineHeight: 36, color: C.ink, fontVariant: ["tabular-nums"] }}>{r.splitStr}</Text>
            <Text style={[mono(10, false, C.gray, 0.14), { marginTop: 4 }]}>Pace{r.masked ? "" : ` · ${r.durationStr}`}</Text>
          </View>
        </View>
      )}

      <PhotoPair
        photos={r.photos}
        style={{ marginTop: 16 }}
        menu={fake ? undefined : (close, leave) => (
          <RowMenu
            row={{ id: r.id, rowerNumber: r.rowerNumber, name: r.name, mine: r.mine, photos: r.photos.length, rel: r.rel ?? { following: "none", bell: false } }}
            onClose={close}
            onRower={(n) => {
              leave();
              onRower(n);
            }}
            onEdit={() => {
              leave();
              edit();
            }}
            onChange={(what) => {
              leave();
              if (what === "row-gone" || what === "blocked") onDone();
              else reload();
            }}
          />
        )}
      />

      {/* A ROW OFF THE MONITOR IS LOGGED BEFORE ITS PHOTOS (autolog.ts,
          2026-11-24), so the rower's own row can be here with none. Where
          the two would be is the way to add them: EDIT ROW, which opens on
          its photos for a row that has none. Nobody else sees this. */}
      {r.mine && !r.masked && !fake && r.photos.length === 0 && r.meters && r.seconds ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Add the two photos to this row" onPress={() => setWriting(true)} style={({ pressed }) => ({ marginTop: 16, borderWidth: 1.5, borderStyle: "dashed", borderColor: C.gray, paddingVertical: 26, alignItems: "center", opacity: pressed ? 0.6 : 1 })}>
          <Text style={mono(12, true, C.accent, 0.14)}>Add the two photos</Text>
          <Text style={[mono(10, false, C.gray, 0.1), { marginTop: 6 }]}>You, and the monitor</Text>
        </Pressable>
      ) : null}

      {/* LIKE, COMMENT, SHARE, under the row as under a post (owner,
          2026-11-22: "that's where that share button can go"). The stickers
          are behind the share mark. */}
      {fake ? null : <PostActions id={r.id} likes={r.likes ?? 0} liked={!!r.liked} comments={said ?? r.comments ?? 0} onComments={() => setTalking(true)} onShare={r.canShare && !r.masked ? () => setSharing(true) : undefined} style={{ marginTop: 12 }} />}

      {/* THE DESCRIPTION, under the marks, the name before it. It is
          written and changed from EDIT ROW behind the three dots, never
          from a word on the page (owner, 2026-11-21: "I really don't like
          the ability to edit the caption without ... clicking those three
          dots and then explicitly editing it"; and of the word: "maybe
          caption isn't best word. Description is probably a better
          word"). */}
      {r.caption ? (
        <Text style={{ fontFamily: F.sans, fontSize: 15, lineHeight: 21, color: C.ink, marginTop: 10 }}>
          <Text style={{ fontFamily: F.bold }}>{r.name}</Text> {r.caption}
        </Text>
      ) : null}

      {/* AGAINST THE USUAL (owner, 2026-11-22: "there's got to be some more
          details here, even when it didn't come from the erg ... like this
          row's performance compared to how you normally perform"). */}
      {r.usual && r.meters && r.seconds ? <Usual u={r.usual} meters={r.meters} seconds={r.seconds} mine={r.mine} name={r.name} /> : null}

      {/* THE STICKERS, then the reels (owner, 2026-11-21: "before I see
          the reel overlays, I want to see the sticker overlays above
          them"). */}
      {/* THE ROW'S OWN, THEN M2D'S IN ROWS OF THEIR OWN (owner, 2026-11-26:
          "We can prob separate the M2d's stickers and reels from the normal
          ones. Have them in their own row?"). */}
      {mayShare ? <Stickers rowId={r.id} part="row" onOpen={(id) => setSharing({ start: id, only: ROW_ONLY })} /> : null}
      {r.canReel && !r.masked && !fake ? <Reels src={rowReels(r.id)} /> : null}
      {mayShare && !fake ? <Stickers rowId={r.id} part="m2d" onOpen={(id) => setSharing({ start: id, only: "m2d-" })} /> : null}
      {/* THE M2D COUNT-UPS: the rower's M2D total and everyone's, not this
          row, so they need no recording. */}
      {mayShare && !fake ? <Reels src={M2D_REELS} title="M2D reels" aside="Counting up" /> : null}

      {/* THE ROW'S GAME (owner, 2026-11-24: "after the stickers/reels and
          before the analytics. It shows the XP he got, the items he just
          got, and lets him equip them"). Only where this phone played one. */}
      {r.mine ? <GameSummary rowId={r.id} /> : null}

      {/* THE MONITOR'S AVERAGES, on ONE line, and only where the read
          below is not shown: the read's own NUMBERS carry the same figures
          (owner, 2026-11-21: "the numbers section and the erg have really
          similar data. Do we need both? I don't think so"; and of the
          three: "put them all in the same line"). */}
      {erg.length && !doc ? (
        <>
          <Eye left="Telemetry" right={r.erg?.simulated ? "Demo" : r.erg?.device} />
          <View style={{ flexDirection: "row" }}>
            {erg.map(([v, k]) => (
              <View key={k} style={{ flex: 1, paddingVertical: 10 }}>
                <Text style={{ fontFamily: F.black, fontSize: 26, color: C.ink, fontVariant: ["tabular-nums"] }}>{v}</Text>
                <Text style={[mono(9, false, C.gray, 0.12), { marginTop: 4 }]}>{k}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {doc ? <Review row={{ id: r.id, day: r.day, meters: r.meters ?? 0 }} rows={rows} doc={doc} onMetric={onMetric} own={r.mine} /> : null}

      {fresh ? <Btn label="Done" onPress={onDone} style={{ marginTop: 34 }} /> : null}

      {/* THE THREE DOTS at the top of the page: the rower's page, follow,
          notifications, mute, report; and, for the owner, his tools. */}
      {menu && onMenu && !fake ? (
        <RowMenu
          row={{ id: r.id, rowerNumber: r.rowerNumber, name: r.name, mine: r.mine, photos: r.photos.length, rel: r.rel ?? { following: "none", bell: false } }}
          onClose={() => onMenu(false)}
          onRower={onRower}
          onEdit={edit}
          onChange={(what) => (what === "row-gone" || what === "blocked" ? onDone() : reload())}
        />
      ) : null}
      {sharing ? <StickerViewer rowId={r.id} only={sharing === true ? undefined : sharing.only} start={sharing === true ? undefined : sharing.start} onClose={() => setSharing(false)} /> : null}
      {writing && r.mine && r.meters && r.seconds ? (
        <EditRow
          row={{ id: r.id, day: r.day, meters: r.meters, seconds: r.seconds, title: r.title, caption: r.caption ?? "", photos: r.photos, photoKeys: r.photoKeys ?? [], telemetry: !!r.erg }}
          onClose={() => setWriting(false)}
          onSaved={() => {
            setWriting(false);
            reload();
          }}
        />
      ) : null}
      {talking ? <CommentsSheet entryId={r.id} onClose={() => setTalking(false)} onRower={onRower} onCount={setSaid} /> : null}
    </ScrollView>
    {afterOn && ran ? <AfterRow g={ran} meters={r.meters ?? fresh?.meters ?? 0} time={r.durationStr ?? ""} pace={(r.splitStr ?? "").replace(/\s*\/500.*$/, "")} lifeBefore={fresh?.lifeBefore ?? 0} onClose={() => setAfter(false)} /> : null}
    </View>
  );
}

/* A DEMO ROW'S PAGE, put together on the phone from the form (Faked) and
 * the signed-in rower, in the shape the site sends a row in. */
function fakeRow(fake: Faked, fresh: Fresh, doc: TelemetryDoc | null, me: Me): RowData {
  const now = new Date();
  const h = now.getHours();
  const num = me.me?.rowerNumber ?? 0;
  const [y, mo, d] = (doc?.startedAt.slice(0, 10) ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`).split("-").map(Number);
  const seconds = fake.seconds;
  const pace = seconds > 0 && fresh.meters > 0 ? (seconds / fresh.meters) * 500 : 0;
  return {
    id: "demo",
    day: `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    rowedStr: "Today",
    dayStr: "Today",
    clockStr: `${h % 12 || 12}:${String(now.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`,
    rowerNumber: num,
    numStr: String(num).padStart(3, "0"),
    name: me.me?.displayName || me.name || "You",
    title: fake.title,
    caption: fake.caption || undefined,
    meters: fresh.meters,
    seconds: seconds || null,
    metersStr: fmtInt(fresh.meters),
    durationStr: seconds ? fmtClock(seconds, false) : "",
    splitStr: pace ? fmtPace(pace) : "",
    photos: fake.photos,
    masked: false,
    elite: false,
    mine: true,
    usual: null,
    canShare: false,
    canReel: false,
    avatar: me.avatar ?? null,
    erg: null,
    doc,
  };
}

/* This row beside the rower's own average, and its place among their rows
 * of the same distance. Every figure in the ink, better or not (owner,
 * 2026-11-23: "the against row as usual ... section, all the numbers there
 * should just be white ... the 9.1 seconds, the first of fourth, the plus
 * 1990 meters. All of that can be white instead of blue"). */
function Usual({ u, meters, seconds, mine, name }: { u: NonNullable<RowData["usual"]>; meters: number; seconds: number; mine: boolean; name: string }) {
  const pace = (seconds / meters) * 500;
  const dp = pace - u.avgPace;
  const dm = meters - u.avgMeters;
  const clock = (s: number) => `${Math.floor(s / 60)}:${(s - Math.floor(s / 60) * 60).toFixed(1).padStart(4, "0")}`;
  const line = (k: string, v: string, note: string) => (
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderColor: C.line }}>
      <Text style={mono(11, false, C.gray)}>{k}</Text>
      <Text style={{ fontFamily: F.mono, fontSize: 13, color: C.gray, fontVariant: ["tabular-nums"] }}>
        <Text style={{ fontFamily: F.black, fontSize: 18, color: C.ink }}>{v}</Text> {note}
      </Text>
    </View>
  );
  return (
    <>
      <Eye left={mine ? "Against your usual" : `Against ${name.split(" ")[0]}'s usual`} right={`${u.rows} rows`} />
      {line("Split", `${dp <= 0 ? "−" : "+"}${Math.abs(dp).toFixed(1)} s`, `usual ${clock(u.avgPace)}`)}
      {line("Length", `${dm >= 0 ? "+" : "−"}${fmtInt(Math.abs(dm))} m`, `usual ${fmtInt(u.avgMeters)} m`)}
      {u.same >= 2 ? line(`At ${fmtInt(meters)} m`, `${ordinal(u.place)} of ${u.same}`, u.place === 1 ? "the fastest" : `best ${clock(u.best)}`) : null}
    </>
  );
}

/* A DEMO ROW'S ANALYTICS (2026-11-22): the read of the piece the simulator
 * just rowed, straight off the phone. Nothing of it is logged or kept, and
 * the line at the top says so. */
export function DemoPage({ doc, meters, rows, onMetric }: { doc: TelemetryDoc; meters: number; rows: Row[]; onMetric?: (id: MetricId, mine: RowMeasure) => void }) {
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 140 }}>
      <Text style={[mono(10, true, C.ink, 0.12), { lineHeight: 16 }]}>Demo row · simulated · not logged</Text>
      <DemoGame />
      <Review row={{ id: "demo", day: doc.startedAt.slice(0, 10), meters }} rows={rows} doc={doc} onMetric={onMetric} />
    </ScrollView>
  );
}

/* ONE SAVED ERG SESSION that is not tied to a logged row: its read, on its
 * own (owner, 2026-11-22: "I should be able to click on these ... and see
 * the stat page"). */
export function ErgPage({ id, rows, onMetric }: { id: string; rows: Row[]; onMetric?: (id: MetricId, mine: RowMeasure) => void }) {
  const path = `/api/row100k/app/erg?id=${id}`;
  const { data, error, reload } = useLoad(() => api<{ session: { id: string; day: string; meters: number; doc: TelemetryDoc } }>(path), [path], path);
  if (!data) return <Waiting error={error} onRetry={reload} />;
  const s = data.session;
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 140 }}>
      <Review row={{ id: s.id, day: s.day, meters: s.meters }} rows={rows} doc={s.doc} onMetric={onMetric} own />
    </ScrollView>
  );
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

/* THE ROW JUST LOGGED (owner, 2026-11-23: "instead of the number that
 * counts up being the 5,000 or the meters that I just rode, I want it to be
 * ... my lifetime ... I know that I just rode 5,000, so I don't need to see
 * that increase"; "my all-time number is going to be super big ... my next
 * thing is till like 1 million ... the progress isn't very large ... we want
 * to make the user feel like they just made a lot of progress ... maybe we
 * change the axes"; and of the month: "since I'm already at the 100K, like
 * saying 115 of 100K doesn't really do it for me here. I think a better way
 * to show this November stat is by the board").
 *
 * So, top to bottom: the ALL-TIME meters rolling from where they were to
 * where they are (the row itself is the small line under it); THE NEXT
 * MARK, a bar over a round stretch of meters sized to the row (a 5K row
 * fills a fifth of a 25,000 m stretch), so this row's piece of it reads big;
 * the next rung, its bar from where the rower stood at the start of the
 * month (or the rung below, whichever is later), not from nothing; the
 * month's 100K bar only while the month is still short of it; and THE
 * BOARD, the rower's own line among the five above and the one below. */

/* The stretch a row's mark bar spans: the smallest round step at least four
 * times the row, so the row fills between a tenth and a quarter of it, and
 * crosses at most one mark. */
const STEPS = [5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];
const stepFor = (meters: number) => STEPS.find((s) => s >= meters * 4) ?? STEPS[STEPS.length - 1];

function Logged({ fresh, meters, line, onRower, pretend }: { fresh: Fresh; meters: number; line: ReactNode; onRower: (n: number) => void; /* A demo row: the board has not had these meters, so the slice adds them. */ pretend?: boolean }) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGo(true), 250);
    return () => clearTimeout(t);
  }, []);
  const monthAfter = fresh.monthBefore + (fresh.inMonth ? meters : 0);
  const month = useCount(go ? monthAfter : fresh.monthBefore, 1400);
  const lifeAfter = fresh.lifeBefore + meters;
  const life = useCount(go ? lifeAfter : fresh.lifeBefore, 1600);
  const tagBefore = lifetimeTag(fresh.lifeBefore)?.tag ?? "";
  const tagNow = lifetimeTag(lifeAfter);
  const newTag = tagNow?.tag && tagNow.tag !== tagBefore ? tagNow.tag : "";
  const club = fresh.inMonth && fresh.monthBefore < fresh.goal && monthAfter >= fresh.goal;

  /* THE NEXT MARK. A row that crosses one shows the stretch it finished,
   * filled to the end; otherwise the stretch it is in. */
  const step = stepFor(meters);
  const crossed = Math.floor(lifeAfter / step) > Math.floor(fresh.lifeBefore / step);
  const markLo = crossed ? Math.floor(lifeAfter / step) * step - step : Math.floor(fresh.lifeBefore / step) * step;
  const markHi = markLo + step;

  /* THE RUNG: its bar starts where the rower stood at the start of this
   * month, or at the rung below, whichever is later. */
  const rungBelow = LADDER.filter((l) => l.meters <= lifeAfter).pop() ?? null;
  const monthStart = fresh.inMonth ? Math.max(0, fresh.lifeBefore - fresh.monthBefore) : 0;
  const fromMonth = fresh.inMonth && monthStart > (rungBelow?.meters ?? 0);
  const rungLo = Math.min(fresh.lifeBefore, fromMonth ? monthStart : (rungBelow?.meters ?? 0));
  const next = tagNow?.next ?? null;

  /* All time is the big one, sized to fit "1,250,000" across a phone. */
  const big = fmtInt(lifeAfter).length;
  const size = big >= 9 ? 50 : big >= 7 ? 60 : 68;

  return (
    <View style={{ marginTop: 16 }}>
      <Pop>
        <Text style={mono(12, true, C.accent)}>Row logged</Text>
      </Pop>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <Text numberOfLines={1} style={{ fontFamily: F.black, fontSize: size, lineHeight: size + 6, letterSpacing: -1, color: C.ink, fontVariant: ["tabular-nums"] }}>
          {fmtInt(life)}
        </Text>
        <Text style={{ fontFamily: F.bold, fontSize: 22, color: C.gray }}>m</Text>
      </View>
      <Text style={mono(10, false, C.gray, 0.14)}>All time</Text>
      {line}

      <View style={{ marginTop: 22 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <Text style={mono(11, true)}>{crossed ? fmtInt(markHi) : `To ${fmtInt(markHi)}`}</Text>
          {crossed ? (
            <Pop delay={1500}>
              <Text style={mono(11, true, C.accent)}>Passed</Text>
            </Pop>
          ) : (
            <Text style={mono(11, false, C.gray)}>
              <Text style={{ fontFamily: F.monoBold, color: C.ink }}>{fmtInt(markHi - lifeAfter)}</Text> m to go
            </Text>
          )}
        </View>
        <Fill from={(fresh.lifeBefore - markLo) / step} to={(lifeAfter - markLo) / step} go={go} height={12} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
          <Text style={mono(9, false, C.gray, 0.08)}>{fmtInt(markLo)}</Text>
          <Text style={mono(9, false, C.gray, 0.08)}>{fmtInt(markHi)}</Text>
        </View>
      </View>

      {next ? (
        <View style={{ marginTop: 18 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <Text style={mono(11, true)}>To {next.tag}</Text>
            <Text style={mono(11, false, C.gray)}>
              <Text style={{ fontFamily: F.monoBold, color: C.ink }}>{fmtInt(next.meters - lifeAfter)}</Text> m to go
            </Text>
          </View>
          <Fill from={(fresh.lifeBefore - rungLo) / Math.max(1, next.meters - rungLo)} to={(lifeAfter - rungLo) / Math.max(1, next.meters - rungLo)} go={go} height={6} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
            <Text style={mono(9, false, C.gray, 0.08)}>{fromMonth ? `${fmtInt(rungLo)} · start of ${fresh.monthWord}` : rungBelow ? rungBelow.tag : "0"}</Text>
            <Text style={mono(9, false, C.gray, 0.08)}>{next.tag}</Text>
          </View>
        </View>
      ) : null}
      {newTag ? (
        <Pop delay={1700}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 }}>
            <Text style={{ fontFamily: F.monoBold, fontSize: 14, letterSpacing: 1, color: "#fff", backgroundColor: C.accent, paddingHorizontal: 9, paddingVertical: 3 }}>{newTag}</Text>
            <Text style={mono(11, true)}>New tag</Text>
          </View>
        </Pop>
      ) : null}

      {/* The month's 100K, only while the month is short of it (or this row
          is the one that gets there): past it, the board says the month. */}
      {fresh.inMonth && fresh.monthBefore < fresh.goal ? (
        <View style={{ marginTop: 22 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <Text style={mono(11, true)}>{fresh.monthWord}</Text>
            <Text style={mono(11, false, C.gray)}>
              <Text style={{ fontFamily: F.monoBold, color: C.ink }}>{fmtInt(month)}</Text> of {fmtInt(fresh.goal)} m
            </Text>
          </View>
          <Fill from={fresh.monthBefore / fresh.goal} to={monthAfter / fresh.goal} go={go} height={12} />
          {club ? (
            <Pop delay={1500}>
              <Text style={{ fontFamily: F.black, fontSize: 26, color: C.ink, marginTop: 12 }}>
                THE <Text style={{ color: C.accent }}>100K</Text> CLUB
              </Text>
            </Pop>
          ) : (
            <Text style={[mono(11, false, C.gray), { marginTop: 8 }]}>{fmtInt(fresh.goal - monthAfter)} m to 100K</Text>
          )}
        </View>
      ) : null}

      {fresh.inMonth ? <Climb meters={meters} word={fresh.monthWord} onRower={onRower} pretend={pretend} /> : null}
    </View>
  );
}

/* A bar that starts where it was and fills to where it is. */
function Fill({ from, to, go, height }: { from: number; to: number; go: boolean; height: number }) {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const a = useRef(new Animated.Value(clamp(from))).current;
  useEffect(() => {
    if (go) Animated.timing(a, { toValue: clamp(to), duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [a, go, to]);
  return (
    <View style={{ height, backgroundColor: C.pale }}>
      <Animated.View style={{ height: "100%", backgroundColor: C.accent, width: a.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }} />
      <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${clamp(from) * 100}%`, backgroundColor: C.ink }} />
    </View>
  );
}

/* THE MONTH, AS A SLICE OF ITS BOARD (owner, 2026-11-23: "I think that we
 * should show my number increasing and then my position changing on the
 * board if it changes ... it says 9,000 meters behind Abraham. I want to see
 * Abraham's name here. I don't see Abraham's row number here ... show the
 * people that are ... 1 below me and 5 above me ... I want to be able to see
 * where I'm going, who I'm passing").
 *
 * The month's board as it stands now (api/row100k/app/board, the rows the
 * 100K tab prints, masked the same way): the rower's line with the five
 * above it and the one below, each with its place, number, name and meters.
 * Read back one row: the rower's line starts where this row found it, under
 * everybody it has just passed, its meters count up to the total, and it
 * rises over them as they each drop a place; the window then settles so it
 * is five above and one below again. Places belong to the slots, not the
 * lines, so a line that moves takes the place of where it lands.
 *
 * The board's mask, kept: a hidden total is its blocks, a run-up total its
 * shape; the elite carry no place. A rower who is one of the hidden elite
 * does not move (their place is not on the board). Nothing draws for a
 * rower not on this month's board. */
const ROW_H = 44;
const ABOVE = 5;
const BELOW = 1;
const VIEW = ABOVE + 1 + BELOW;

function Climb({ meters, word, onRower, pretend }: { meters: number; word: string; onRower: (n: number) => void; pretend?: boolean }) {
  const { data } = useLoad(() => api<BoardData>("/api/row100k/app/board"), []);
  const rows = useMemo(() => (pretend ? withMeters(data?.rows ?? [], meters) : (data?.rows ?? [])), [data, meters, pretend]);
  const at = rows.findIndex((x) => x.me);
  if (!data || at < 0) return null;
  return <Slice rows={rows} at={at} meters={meters} word={word} onRower={onRower} />;
}

/* The board as it would stand with a demo row's meters on it: the rower's
 * line takes them and rises over every ranked, unmasked line straight above
 * it that it now has more than, the way the board would order it. A line
 * that is masked or carries no place does not move. */
function withMeters(rows: BoardRow[], meters: number): BoardRow[] {
  const at = rows.findIndex((x) => x.me);
  if (at < 0) return rows;
  const me = rows[at];
  if (me.unranked || me.blocks !== undefined) return rows;
  const up = { ...me, meters: me.meters + meters };
  let to = at;
  while (to > 0) {
    const x = rows[to - 1];
    if (x.unranked || x.blocks !== undefined || x.meters >= up.meters) break;
    to--;
  }
  const out = rows.filter((_, i) => i !== at);
  out.splice(to, 0, up);
  return out;
}

function Slice({ rows, at, meters, word, onRower }: { rows: BoardRow[]; at: number; meters: number; word: string; onRower: (n: number) => void }) {
  const me = rows[at];
  const before = Math.max(0, me.meters - meters);
  /* Everybody the row carried them past: the ranked lines straight under
   * the rower now that stood at or over what the rower had before it. The
   * board is in meters order there, so they are the next lines down. */
  let k = 0;
  if (!me.unranked && me.blocks === undefined) {
    for (let i = at + 1; i < rows.length; i++) {
      const x = rows[i];
      if (x.unranked || x.blocks !== undefined || x.meters < before) break;
      k++;
    }
  }
  /* Where the rower's line was (s) and is (at), in the board's order. */
  const s = at + k;
  const n = rows.length;
  const shown = Math.min(VIEW, n);
  const camOf = (i: number) => Math.max(0, Math.min(n - shown, i - ABOVE));
  /* p: the rower's line, from s to at. q: the window, which follows a beat
   * later for a short climb (so the line is seen rising) and with the line
   * for a long one (so it never leaves the window). Both start where the
   * row found the rower. */
  const p = useRef(new Animated.Value(s)).current;
  const q = useRef(new Animated.Value(s)).current;
  const [go, setGo] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGo(true), 1400);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!go || k === 0) return;
    const d = Math.min(2600, 900 + k * 180);
    const ease = Easing.bezier(0.2, 0.7, 0.2, 1);
    const native = Platform.OS !== "web";
    Animated.parallel([
      Animated.timing(p, { toValue: at, duration: d, easing: ease, useNativeDriver: native }),
      Animated.timing(q, { toValue: at, duration: d, delay: k <= 4 ? Math.round(d * 0.4) : 0, easing: k <= 4 ? Easing.inOut(Easing.cubic) : ease, useNativeDriver: native }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [go]);
  const mine = useCount(go ? me.meters : before, 1400);

  /* Places by slot: the ranked lines counted down the board. */
  const places: (number | null)[] = [];
  let c = 0;
  for (const x of rows) places.push(x.unranked ? null : ++c);
  const place = places[at];

  /* The others, in the board's order without the rower: other o is at slot
   * o while above the rower's line and o + 1 once under it. */
  const others = rows.filter((x) => !x.me);
  const lo = Math.max(0, camOf(at) - 1);
  const hi = Math.min(others.length - 1, camOf(s) + shown);
  /* Made once: the count above draws this every frame while the lines
   * move, and a moving line keeps the same interpolation all the way. */
  const moved = useMemo(() => {
    const slot = new Map<number, Animated.AnimatedInterpolation<number>>();
    for (let o = at; o < s; o++) slot.set(o, p.interpolate({ inputRange: [o, o + 1], outputRange: [(o + 1) * ROW_H, o * ROW_H], extrapolate: "clamp" }));
    return {
      slot,
      me: k > 0 ? p.interpolate({ inputRange: [at, s], outputRange: [at * ROW_H, s * ROW_H], extrapolate: "clamp" }) : null,
      cam: n > shown ? q.interpolate({ inputRange: [ABOVE, ABOVE + n - shown], outputRange: [0, -(n - shown) * ROW_H], extrapolate: "clamp" }) : null,
    };
  }, [p, q, at, s, k, n, shown]);
  const slotOf = (o: number) => (o < at ? o * ROW_H : o >= s ? (o + 1) * ROW_H : (moved.slot.get(o) ?? o * ROW_H));
  const meY = moved.me ?? at * ROW_H;
  const camY = moved.cam ?? 0;
  /* Before the climb starts the window stands where the row found the
   * rower: q starts at s. A board that does not move stands at `at`. */
  const camStill = -camOf(at) * ROW_H;

  const figure = (x: BoardRow, m: number) =>
    x.blocks !== undefined ? <Blocks n={x.blocks} size={12} /> : <Text style={{ fontFamily: F.mono, fontSize: 13, color: C.ink, fontVariant: ["tabular-nums"] }}>{x.me ? fmtInt(m) : (x.shape ?? fmtInt(x.meters))}</Text>;
  const line = (x: BoardRow, m: number) => (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Rower ${x.rowerNumber}, ${x.name}, ${x.blocks !== undefined ? "hidden" : `${fmtInt(x.me ? m : x.meters)} meters`}`}
      onPress={() => onRower(x.rowerNumber)}
      style={{ height: ROW_H, flexDirection: "row", alignItems: "center", paddingLeft: 40, paddingRight: 6, backgroundColor: x.me ? C.pale : C.tint, borderBottomWidth: 1, borderColor: C.line }}
    >
      <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.bold, fontSize: 15, color: C.ink }}>
        <Text style={{ fontFamily: x.me ? F.monoBold : F.mono, fontSize: 12, color: x.me ? C.accent : C.gray }}>{String(x.rowerNumber).padStart(3, "0")} · </Text>
        {x.name}
      </Text>
      {figure(x, m)}
    </Pressable>
  );

  /* THE ONE AHEAD, by number and name (owner, 2026-11-23). A total the
   * board hides (blocks, or the run-up's shape) gives no gap. */
  const ahead = at > 0 ? rows[at - 1] : null;
  const num3 = (x: BoardRow) => `${String(x.rowerNumber).padStart(3, "0")} · ${x.name}`;
  const gap = ahead && ahead.blocks === undefined && ahead.shape === undefined ? ahead.meters - me.meters : null;

  return (
    <View style={{ marginTop: 26 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", borderBottomWidth: 2, borderColor: C.ink, paddingBottom: 8 }}>
        <Text style={mono(11, true)}>{word} board</Text>
        <Dot size={11} />
        {k ? <Text style={mono(11, true)}>Passed {k} · </Text> : null}
        {place ? (
          <>
            <Text style={mono(11, true, C.accent)}>
              {k ? "Now " : ""}
              {ordinal(place)}
            </Text>
            <Text style={mono(11, false, C.gray)}> of {n}</Text>
          </>
        ) : (
          <Text style={mono(11, false, C.gray)}>{n} rowers</Text>
        )}
      </View>
      <View style={{ height: shown * ROW_H, overflow: "hidden" }}>
        <Animated.View style={{ position: "absolute", left: 0, right: 0, top: 0, height: n * ROW_H, transform: [{ translateY: k > 0 ? camY : camStill }] }}>
          {others.slice(lo, hi + 1).map((x, i) => (
            <Animated.View key={x.rowerNumber} style={{ position: "absolute", left: 0, right: 0, top: 0, transform: [{ translateY: slotOf(lo + i) }] }}>
              {line(x, x.meters)}
            </Animated.View>
          ))}
          <Animated.View style={{ position: "absolute", left: 0, right: 0, top: 0, zIndex: 2, transform: [{ translateY: meY }] }}>{line(me, mine)}</Animated.View>
          {/* The places, one to a slot, over the lines. */}
          {places.map((pl, i) =>
            i >= lo && i <= hi + 1 && pl !== null ? (
              <View key={`p${i}`} pointerEvents="none" style={{ position: "absolute", left: 6, top: i * ROW_H, height: ROW_H, justifyContent: "center", zIndex: 3 }}>
                <Text style={{ fontFamily: F.mono, fontSize: 13, color: C.gray, fontVariant: ["tabular-nums"] }}>{pl}</Text>
              </View>
            ) : null,
          )}
        </Animated.View>
      </View>
      {ahead ? (
        <Text style={[mono(11, false, C.gray, 0.12), { marginTop: 8, lineHeight: 18 }]}>
          {gap === null ? "Behind " : gap <= 0 ? "Level with " : `${fmtInt(gap)} m behind `}
          <Text style={{ fontFamily: F.monoBold, color: C.ink }}>{num3(ahead)}</Text>
        </Text>
      ) : (
        <Text style={[mono(11, true, C.accent), { marginTop: 8 }]}>Leading the board</Text>
      )}
    </View>
  );
}

/* THE STICKERS OF THIS ROW, a strip of them on the ink they are made for.
 * A press opens the viewer, where one is shared or copied. */
/* What the row's game gave: the XP and the level it left, how it went, and
 * the items out of its chest, each with EQUIP. */
function GameSummary({ rowId }: { rowId: string }) {
  const g = useGame(rowId);
  const { me } = useSession();
  return g && arcadeFor(me) ? <GameLines g={g} /> : null;
}
function DemoGame() {
  const g = useLastDemoGame();
  const { me } = useSession();
  return g && arcadeFor(me) ? <GameLines g={g} /> : null;
}
function GameLines({ g }: { g: Game }) {
  const l = useLocker();
  const was = levelOf(g.xpBefore);
  const now = levelOf(g.xpBefore + g.xp);
  const how = g.mode === "solo" ? `${g.kills} ${g.kills === 1 ? "floor" : "floors"} beaten` : `${g.matches} ${g.matches === 1 ? "match" : "matches"}`;
  /* The course's own lines (games from 2026-11-24 evening on). */
  const line = g.mode === "solo" && g.coins !== undefined ? [`${fmtInt(g.coins)} coins`, `${g.bosses ?? 0} ${g.bosses === 1 ? "boss" : "bosses"}`, `furthest floor ${g.best ?? 1}`, g.fish ? `${g.fish} fish` : "", g.wrecks ? `wrecked ${g.wrecks}×` : "never wrecked"].filter(Boolean).join(" · ") : "";
  return (
    <>
      <Eye left="The arcade" right={how} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text style={{ fontFamily: F.black, fontSize: 30, color: C.accent, fontVariant: ["tabular-nums"] }}>{`+${fmtInt(g.xp)} XP`}</Text>
        <Text style={mono(11, true)}>{now.level > was.level ? `LEVEL ${now.level} · UP` : `LEVEL ${now.level}`}</Text>
      </View>
      <View style={{ height: 8, backgroundColor: C.line, marginTop: 6 }}>
        <View style={{ width: `${Math.round((100 * now.into) / now.need)}%`, height: 8, backgroundColor: C.accent }} />
      </View>
      {line ? <Text style={[mono(10, true, C.gray, 0.1), { marginTop: 8 }]}>{line.toUpperCase()}</Text> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 10, rowGap: 10, marginTop: 14 }}>
        {g.items.map((id, i) => {
          const s = SKIN_BY_ID[id];
          if (!s) return null;
          const on = l.equipped[s.layer] === id;
          return (
            <View key={`${id}${i}`} style={{ width: 104, borderWidth: 1.5, borderColor: RARITY_COLOR[s.rarity], borderCurve: "continuous", borderRadius: 7, padding: 6, alignItems: "center" }}>
              <View style={{ height: 4, alignSelf: "stretch", backgroundColor: RARITY_COLOR[s.rarity], borderRadius: 2, marginBottom: 4 }} />
              <TokenArt paint={wear({ ...STOCK, [s.layer]: id })} size={56} t={1.3} trail={s.layer === "aura"} uid={`gs${id}${i}`} />
              <Text numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 12, color: C.ink, marginTop: 4 }}>{s.name}</Text>
              <Text style={mono(9, false, C.gray, 0.1)}>{LAYER_WORD[s.layer].toUpperCase()}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={on ? `${s.name} is on` : `Equip ${s.name}`} disabled={on} onPress={() => equip(s.layer, id).catch(() => null)} style={({ pressed }) => ({ marginTop: 6, alignSelf: "stretch", paddingVertical: 6, borderRadius: 5, backgroundColor: on ? C.paper : C.ink, borderWidth: 1.5, borderColor: C.ink, alignItems: "center", opacity: pressed ? 0.6 : 1 })}>
                <Text style={mono(10, true, on ? C.ink : C.paper)}>{on ? "ON" : "EQUIP"}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </>
  );
}

/* THE STRIP IS THERE FROM THE FIRST MOMENT (owner, 2026-11-26: "The
 * stickers section on the post row screen doesn't show up ... there's not
 * even any placeholders there ... kind of like Reels"). Until the deck has
 * come, four empty tiles on the ink with the turning wheel, as a reel tile
 * shows while its picture comes; a deck that could not be fetched says so
 * and offers another try, where it used to leave nothing at all. Only an
 * answer with no stickers in it (not the rower's row) takes the strip away. */
/* Every sticker id that is not M2D's, as StickerViewer's `only` takes ids:
 * a part of the deck is passed as the prefixes it starts with. */
const ROW_ONLY = "!m2d-";
function Stickers({ rowId, onOpen, part }: { rowId: string; onOpen: (id: string) => void; part: "row" | "m2d" }) {
  const { data, error, reload } = useLoad(() => deck(rowId), [rowId]);
  const cards = (data?.cards ?? []).filter((c) => (part === "m2d") === c.id.startsWith("m2d-"));
  if (data && !cards.length) return null;
  return (
    <>
      <Eye left={part === "m2d" ? "M2D stickers" : "Stickers"} right="For your story" />
      <ScrollView horizontal {...sideways} showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
        {!data
          ? [0, 1, 2, 3].map((k) =>
              error && k === 0 ? (
                <Pressable key={k} accessibilityRole="button" accessibilityLabel="The stickers did not load. Try again" onPress={() => reload()} style={{ width: 124 }}>
                  <View style={{ height: 150, backgroundColor: GROUND, alignItems: "center", justifyContent: "center", padding: 10 }}>
                    <Text style={[mono(10, true, "#fff", 0.12), { textAlign: "center", lineHeight: 15 }]}>{"Did not load\nTap to try again"}</Text>
                  </View>
                </Pressable>
              ) : (
                <View key={k} style={{ width: 124 }}>
                  <View style={{ height: 150, backgroundColor: GROUND, alignItems: "center", justifyContent: "center", opacity: error ? 0.5 : 1 }}>{error ? null : <ActivityIndicator color="#fff" />}</View>
                  <View style={{ height: 8, width: 70, backgroundColor: C.line, marginTop: 9 }} />
                </View>
              ),
            )
          : null}
        {cards.map((c) => (
          <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`Sticker: ${c.label}`} onPress={() => onOpen(c.id)} style={{ width: 124 }}>
            <View style={{ height: 150, backgroundColor: GROUND, alignItems: "center", justifyContent: "center", padding: 10 }}>
              <StickerImage id={c.id} rowId={rowId} ratio={c.width / c.height} />
            </View>
            <Text numberOfLines={1} style={[mono(10, true, C.ink, 0.12), { marginTop: 6 }]}>
              {c.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Dash style={{ marginTop: 14 }} />
    </>
  );
}

/* ---- STICKERS ---------------------------------------------------------- */

/* The art is white on nothing, so it is shown on ink, the way the site's
 * dialog shows it. */
const GROUND = "#1f2226";

/* THE STICKERS (owner, 2026-11-21: "whenever I open them up, I want to be
 * able to swipe through them ... I need a share button and a copy button
 * ... and then I can close it"). One screen on the dark ground the stickers
 * are made for, one sticker to a page, a swipe to the next; SHARE hands the
 * one showing to the phone's share sheet, COPY puts it on the clipboard. */
export function StickerViewer({ rowId, onClose, only, empty, start }: { rowId?: string; onClose: () => void; only?: string; empty?: string; start?: string }) {
  /* TWO ACROSS, LIKE STRAVA (owner, 2026-11-26: "The number of shareables
   * is getting to large for the dots a the bottom. Should we show them 2x2
   * like Strava does?"): every sticker at once in a grid of two columns,
   * scrolled down; a tap picks one (a white ring and a check), SHARE and
   * COPY act on the one picked. */
  useModalHold();
  const win = useWindowDimensions();
  const w = Math.min(win.width, 560);
  const { data, error } = useLoad(() => deck(rowId), [rowId]);
  const [pick, setPick] = useState<string | null>(start ?? null);
  const [busy, setBusy] = useState<"" | "share" | "copy">("");
  const [note, setNote] = useState("");
  /* `only`: the stickers whose id starts with it; "!m2d-" is every one
   * that does not. */
  const cards = (data?.cards ?? []).filter((c) => !only || (only.startsWith("!") ? !c.id.startsWith(only.slice(1)) : only.split(",").some((o) => c.id.startsWith(o))));
  const card = cards.find((c) => c.id === pick) ?? cards[0];
  const gap = 12;
  const tileW = Math.floor((w - 32 - gap) / 2);
  const run = async (what: "share" | "copy") => {
    if (!card) return;
    setBusy(what);
    setNote("");
    try {
      if (what === "copy") {
        await copySticker(card.id, rowId, data?.rowerNumber);
        setNote("Copied.");
      } else if ((await shareSticker(card.id, rowId, data?.rowerNumber)) === "download") setNote("Saved to your downloads.");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "That did not work.");
    }
    setBusy("");
  };
  const pill = (label: string, what: "share" | "copy", fill: boolean) => (
    <Pressable accessibilityRole="button" disabled={busy !== "" || !card} onPress={() => run(what)} style={({ pressed }) => ({ flex: 1, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: fill ? C.accent : "transparent", borderWidth: fill ? 0 : 2, borderColor: "#fff", opacity: busy !== "" || !card ? 0.5 : pressed ? 0.7 : 1 })}>
      <Text style={mono(12, true, "#fff", 0.14)}>{busy === what ? "Working" : label}</Text>
    </Pressable>
  );
  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#111214", alignItems: "center" }}>
        <View style={{ flex: 1, width: w, paddingTop: 44, paddingBottom: 30 }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
              <CloseIcon color="#fff" size={26} />
            </Pressable>
            <Text numberOfLines={1} style={[mono(12, true, "#fff"), { flex: 1, textAlign: "center" }]}>
              {card?.label ?? ""}
            </Text>
            <View style={{ width: 44 }} />
          </View>
          {data && cards.length === 0 ? (
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Text style={[mono(11, false, "#fff", 0.12), { textAlign: "center", paddingHorizontal: 20, lineHeight: 18 }]}>{empty ?? "Nothing to share yet."}</Text>
            </View>
          ) : !data ? (
            <View style={{ flex: 1, justifyContent: "center" }}>{error ? <Text style={[mono(11, false, "#fff", 0.12), { textAlign: "center", paddingHorizontal: 20 }]}>{error}</Text> : <ActivityIndicator color="#fff" />}</View>
          ) : (
            <ScrollView style={{ flex: 1, marginTop: 8 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, flexDirection: "row", flexWrap: "wrap", gap }}>
              {cards.map((c) => {
                const on = c.id === card?.id;
                return (
                  <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={c.label} accessibilityState={{ selected: on }} onPress={() => setPick(c.id)} style={{ width: tileW }}>
                    <View style={{ height: Math.round(tileW * 1.35), borderRadius: 14, borderWidth: 3, borderColor: on ? "#fff" : "transparent", backgroundColor: GROUND, alignItems: "center", justifyContent: "center", padding: 10, overflow: "hidden" }}>
                      <StickerImage id={c.id} rowId={rowId} ratio={c.width / c.height} />
                      {on ? (
                        <View style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ fontFamily: F.black, fontSize: 13, color: GROUND }}>✓</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text numberOfLines={1} style={[mono(9.5, true, on ? "#fff" : "rgba(255,255,255,0.55)", 0.1), { marginTop: 6 }]}>
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
          <Text style={[mono(11, false, "#fff", 0.12), { textAlign: "center", marginTop: 8, minHeight: 16 }]}>{note}</Text>
          <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 20, marginTop: 10 }}>
            {/* SHARE at the left, COPY at the right and the one that is
                filled (owner, 2026-11-22: "copy should be the primary"). */}
            {pill("Share", "share", false)}
            {pill("Copy", "copy", true)}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* STICKERS AS TILES (owner, 2026-11-26: "should prob have previews of the
 * stickers like we do for the reels"): the deck's stickers (`only`, as the
 * viewer takes it) in a sideways row of dark tiles, each drawn as it will
 * be shared; a tap opens the viewer at that one to share or copy. */
export function StickerTiles({ only, title = "Stickers", aside = "Tap to share", empty }: { only?: string; title?: string; aside?: string; empty?: string }) {
  const { data, error } = useLoad(() => deck(), []);
  const [open, setOpen] = useState<string | null>(null);
  const cards = (data?.cards ?? []).filter((c) => !only || only.split(",").some((o) => c.id.startsWith(o)));
  return (
    <>
      <Eye left={title} right={aside} />
      {!data ? (
        error ? <Text style={mono(11, false, C.gray)}>{error}</Text> : <ActivityIndicator color={C.ink} />
      ) : cards.length === 0 ? (
        <Text style={mono(11, false, C.gray)}>{empty ?? "Nothing to share yet."}</Text>
      ) : (
        <ScrollView horizontal {...sideways} showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
          {cards.map((c) => (
            <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`Sticker: ${c.label}`} onPress={() => setOpen(c.id)} style={({ pressed }) => ({ width: 164, opacity: pressed ? 0.7 : 1 })}>
              <View style={{ height: 164, backgroundColor: GROUND, alignItems: "center", justifyContent: "center", padding: 10 }}>
                <StickerImage id={c.id} ratio={c.width / c.height} />
              </View>
              <Text numberOfLines={1} style={[mono(10, true, C.ink, 0.12), { marginTop: 6 }]}>
                {c.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <Dash style={{ marginTop: 14 }} />
      {open ? <StickerViewer only={only} start={open} empty={empty} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function StickerImage({ id, rowId, ratio }: { id: string; rowId?: string; ratio: number }) {
  const [uri, setUri] = useState("");
  const [bad, setBad] = useState(false);
  useEffect(() => {
    let live = true;
    stickerUri(id, rowId)
      .then((u) => live && setUri(u))
      .catch(() => live && setBad(true));
    return () => {
      live = false;
    };
  }, [id, rowId]);
  if (bad) return <Text style={mono(10, false, C.gray)}>Could not be drawn</Text>;
  if (!uri) return <ActivityIndicator color="#fff" />;
  return <Image source={{ uri }} resizeMode="contain" accessibilityIgnoresInvertColors style={{ width: "100%", aspectRatio: ratio }} />;
}

/* ---- REEL OVERLAYS ----------------------------------------------------- */

/* The six clips the site's reel studio films (erg/reel/paint.ts), each
 * shown as the frame it ends on. A tap picks the ground and the length and
 * films it: the server paints every frame and sends back an MP4. Video
 * cannot be see-through, so the overlay comes on a colour to key out
 * (green, blue) or to blend away (black). */
export function Reels({ src, title = "Reel overlays", aside = "For your edit" }: { src: ReelSource; title?: string; aside?: string }) {
  const CLIPS = src.clips;
  const win = useWindowDimensions();
  const w = Math.min(win.width, 560);
  const n = CLIPS.length;
  /* Which clip is showing in the viewer; null while it is shut. */
  const [at, setAt] = useState<number | null>(null);
  const open = at === null ? null : CLIPS[at].id;
  const [bg, setBg] = useState<GroundId>("green");
  const [len, setLen] = useState<number>(10);
  /* FILM, THEN SHARE (owner, 2026-11-22: "when I click that filming
   * button, there should be a progress bar ... also preview me the film
   * ... I clicked filming and nothing's happening"). A bar runs while the
   * site films; SHARE is its own press, which is the only kind a browser
   * opens its share sheet for. */
  const [busy, setBusy] = useState(false);
  const [film, setFilm] = useState<Fetched | null>(null);
  /* What was made: the film on its ground, or the same clip with nothing
   * behind it, a GIF to paste on a story (owner, 2026-11-22: "build a
   * version of these that we can just copy with the transparent
   * background"). */
  const [made, setMade] = useState<"film" | "gif">("film");
  const [note, setNote] = useState("");
  const bar = useRef(new Animated.Value(0)).current;
  const turn = useRef(0);
  /* HOW LONG IS LEFT, counted down beside the bar while the site films. A
   * reckoning, from what a film of this length has been taking: the count
   * stops at one and waits. */
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setLeft((k) => Math.max(1, k - 1)), 1000);
    return () => clearInterval(t);
  }, [busy]);
  const reset = () => {
    turn.current++;
    setFilm(null);
    setBusy(false);
    setNote("");
  };
  useEffect(reset, [open, bg, len]);
  const shoot = async (what: "film" | "gif" = "film") => {
    if (!open) return;
    const mine = ++turn.current;
    setBusy(true);
    setMade(what);
    setNote("");
    /* Most of the way over the time it usually takes, then it waits. */
    const eta = what === "gif" ? Math.round(len * 0.6 + 3) : Math.round(len * 0.8 + 3);
    setLeft(eta);
    bar.setValue(0);
    Animated.timing(bar, { toValue: 0.94, duration: eta * 1000, easing: Easing.linear, useNativeDriver: false }).start();
    try {
      const f = what === "gif" ? await gifReel(src, open, len) : await filmReel(src, open, bg, len);
      if (mine !== turn.current) return;
      setFilm(f);
    } catch (err) {
      if (mine !== turn.current) return;
      setNote(err instanceof Error ? err.message : "That did not work.");
    }
    setBusy(false);
  };
  const share = async () => {
    if (!open || !film) return;
    setNote("");
    try {
      const did = made === "gif" ? await shareGif(film, src, open, len) : await shareFilm(film, src, open, bg, len);
      if (did === "download") setNote("Saved to your downloads.");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "That did not work.");
    }
  };

  /* THE CLIPS ARE SWIPED THROUGH, AS THE STICKERS ARE (owner, 2026-11-21:
   * "I can't swipe through the video, like the reels, like I can on the
   * shareables ... I want to be able to do the same thing with the reel
   * overlays"), and round and round the same way: the last is drawn again
   * before the first and the first again after the last, and a swipe that
   * settles on one of those two is moved, unseen, to the real one. */
  const pages = [CLIPS[n - 1], ...CLIPS, CLIPS[0]];
  const strip = useRef<ComponentRef<typeof ScrollView>>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(0);
  const placed = useRef(false);
  /* How tall the strip is, measured: a page of a sideways list has no
   * height of its own in a browser, and the clip is sized by its height. */
  const [tall, setTall] = useState(0);
  const show = (i: number) => {
    first.current = i;
    placed.current = false;
    setAt(i);
  };
  const place = () => {
    if (placed.current) return;
    placed.current = true;
    strip.current?.scrollTo({ x: (first.current + 1) * w, animated: false });
  };
  const onStrip = (x: number) => {
    if (!placed.current) return;
    const page = Math.round(x / Math.max(1, w));
    setAt((page - 1 + n) % n);
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      if (page === 0) strip.current?.scrollTo({ x: n * w, animated: false });
      else if (page === n + 1) strip.current?.scrollTo({ x: w, animated: false });
    }, 140);
  };

  return (
    <>
      <Eye left={title} right={aside} />
      <ScrollView horizontal {...sideways} showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
        {CLIPS.map((c, i) => (
          <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`Reel overlay: ${c.label}`} onPress={() => show(i)} style={{ width: 124 }}>
            <View style={{ height: 220, backgroundColor: GROUND, alignItems: "center", justifyContent: "center" }}>
              <Still src={src} clip={c.id} />
            </View>
            <Text numberOfLines={1} style={[mono(10, true, C.ink, 0.12), { marginTop: 6 }]}>
              {c.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Dash style={{ marginTop: 14 }} />

      <Modal visible={at !== null} animationType="fade" onRequestClose={() => setAt(null)}>
        <View style={{ flex: 1, backgroundColor: GROUND, alignItems: "center" }}>
          <View style={{ flex: 1, width: w, paddingTop: 50, paddingBottom: 30 }}>
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setAt(null)} hitSlop={8} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                <CloseIcon color="#fff" size={26} />
              </Pressable>
              <Text numberOfLines={1} style={[mono(12, true, "#fff"), { flex: 1, textAlign: "center" }]}>
                {CLIPS.find((c) => c.id === open)?.label ?? ""}
              </Text>
              <View style={{ width: 44 }} />
            </View>

            {/* THE CLIP, MOVING (owner, 2026-11-21: "when I go to click on
                the reel, I want to see a preview of that reel going"): the
                five-second version at ten frames a second, round and
                round, from the moment the clip is opened and while the site
                films. The film itself takes its place once it is made. */}
            <ScrollView ref={strip} horizontal {...sideways} pagingEnabled scrollEnabled={!busy} showsHorizontalScrollIndicator={false} contentOffset={{ x: (first.current + 1) * w, y: 0 }} onContentSizeChange={place}
              onLayout={(e) => {
                setTall(Math.floor(e.nativeEvent.layout.height));
                place();
              }}
              onScroll={(e) => onStrip(e.nativeEvent.contentOffset.x)}
              scrollEventThrottle={32}
              style={{ flex: 1 }}
            >
              {pages.map((c, p) => {
                const live = c.id === open;
                return (
                  <View key={`${c.id}-${p}`} style={{ width: w, height: tall || undefined, paddingHorizontal: 20, paddingVertical: 10, alignItems: "center", justifyContent: "center" }}>
                    {live && film && made === "gif" ? (
                      <Image source={{ uri: film.uri }} resizeMode="contain" accessibilityLabel="The clip with no background, playing" accessibilityIgnoresInvertColors style={{ width: "100%", height: "100%" }} />
                    ) : live && film && Platform.OS === "web" ? (
                      createElement("video", { src: film.uri, autoPlay: true, loop: true, muted: true, playsInline: true, style: { height: "100%", maxWidth: "100%", aspectRatio: "9 / 16", objectFit: "contain" } })
                    ) : live && film ? (
                      <Film uri={film.uri} />
                    ) : (
                      <Motion src={src} clip={c.id} play={live} />
                    )}
                  </View>
                );
              })}
            </ScrollView>
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 7, marginTop: 6, marginBottom: 12, minHeight: 8 }}>
              {CLIPS.map((c) => (
                <View key={c.id} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.id === open ? "#fff" : "rgba(255,255,255,0.3)" }} />
              ))}
            </View>

            <View style={{ paddingHorizontal: 20 }}>
              {film ? (
                <>
                  <Text style={[mono(11, false, "#fff", 0.12), { marginBottom: 12, lineHeight: 16 }]}>{note || (made === "gif" ? `Made: ${len} seconds with nothing behind it, a GIF. Share it, tap Copy, and paste it on your story. Nothing to key out.` : `Filmed: ${len} seconds on ${bg}, 20 frames a second. Key the ${bg === "black" ? "black out with a Screen blend" : `${bg} out`} in your edit.`)}</Text>
                  <Btn label="Share it" onPress={share} />
                  <Pressable accessibilityRole="button" onPress={reset} hitSlop={10} style={{ alignItems: "center", paddingTop: 16 }}>
                    <Text style={mono(11, true, "#fff", 0.12)}>Make another</Text>
                  </Pressable>
                </>
              ) : busy ? (
                <>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                    <Text style={mono(11, true, "#fff", 0.12)}>{made === "gif" ? `Making your ${len} second GIF` : `Filming your ${len} second clip`}</Text>
                    <Text style={[mono(11, true, "#fff", 0.12), { fontVariant: ["tabular-nums"] }]}>{left > 1 ? `${left} s left` : "Nearly there"}</Text>
                  </View>
                  <View accessibilityRole="progressbar" style={{ height: 10, backgroundColor: "rgba(255,255,255,0.18)", marginBottom: 16 }}>
                    <Animated.View style={{ height: "100%", backgroundColor: C.accent, width: bar.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }} />
                  </View>
                  <Pressable accessibilityRole="button" onPress={reset} hitSlop={10} style={{ alignItems: "center", paddingVertical: 8 }}>
                    <Text style={mono(11, true, "#fff", 0.12)}>Stop</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={{ flexDirection: "row", gap: 18, marginBottom: 14 }}>
                    <View>
                      <Text style={[mono(10, false, C.gray, 0.12), { marginBottom: 8 }]}>The ground to key out</Text>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        {GROUNDS.map((g) => (
                          <Light key={g.id} label={g.label} on={bg === g.id} onPress={() => setBg(g.id)} />
                        ))}
                      </View>
                    </View>
                    <View>
                      <Text style={[mono(10, false, C.gray, 0.12), { marginBottom: 8 }]}>How long</Text>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        {LENGTHS.map((l) => (
                          <Light key={l} label={`${l}`} on={len === l} onPress={() => setLen(l)} />
                        ))}
                      </View>
                    </View>
                  </View>
                  {note ? <Text style={[mono(11, false, "#fff", 0.12), { marginBottom: 12, lineHeight: 16 }]}>{note}</Text> : null}
                  <Btn label={`Film it · ${len} s`} onPress={() => shoot("film")} />
                  {/* THE SAME CLIP WITH NOTHING BEHIND IT: no ground to
                      key out, so the ground picked above is not read. */}
                  <Pressable accessibilityRole="button" accessibilityLabel={`Make it with no background, a ${len} second GIF`} onPress={() => shoot("gif")} hitSlop={10} style={{ alignItems: "center", paddingTop: 16 }}>
                    <Text style={mono(11, true, "#fff", 0.12)}>No background · GIF · {len} s</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

/* THE FILM ITSELF, on a phone, once it is made (owner, 2026-11-21: "even
 * after it's done making it, it doesn't show me the video playing. But
 * we've already made it, so we should play it"). The file the site sent,
 * round and round, silent, with no controls over it. This is the one thing
 * here that needs a video module in the build (expo-video, from 1.2.0). */
function Film({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return <VideoView player={player} nativeControls={false} contentFit="contain" allowsPictureInPicture={false} style={{ height: "100%", aspectRatio: 9 / 16 }} />;
}

/* A CLIP, MOVING, WITHOUT A VIDEO PLAYER. The site paints the five-second
 * version of the clip as fifty small frames on one picture, ten to a line
 * (erg/reel/serverReel.ts REEL_STRIP); this shows one frame of it at a
 * time, ten a second, holds the last for a beat and goes round. Until the
 * picture has come, the clip's last frame stands in its place. `play`
 * false: the still alone, for a clip that is beside the one being looked
 * at. */
const HOLD = 12;
function Motion({ src, clip, play }: { src: ReelSource; clip: ClipId; play: boolean }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [uri, setUri] = useState("");
  const [f, setF] = useState(0);
  useEffect(() => {
    if (!play) return;
    let live = true;
    reelStripUri(src, clip).then(
      (u) => live && setUri(u),
      () => null,
    );
    return () => {
      live = false;
    };
  }, [src.key, clip, play]);
  const moving = play && !!uri;
  useEffect(() => {
    if (!moving) return;
    setF(0);
    const t = setInterval(() => setF((k) => (k + 1) % (STRIP.frames + HOLD)), 1000 / STRIP.fps);
    return () => clearInterval(t);
  }, [moving]);
  /* Whole points, so one frame's edge is the next one's edge exactly. */
  const h = Math.floor(Math.min(box.h, (box.w * 16) / 9));
  const fw = Math.round((h * 9) / 16);
  const k = Math.min(f, STRIP.frames - 1);
  return (
    <View onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} style={{ flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center" }}>
      {h <= 0 ? null : moving ? (
        <View accessibilityLabel="A preview of the clip, playing" style={{ width: fw, height: h, overflow: "hidden" }}>
          <Image source={{ uri }} resizeMode="stretch" fadeDuration={0} accessibilityIgnoresInvertColors style={{ position: "absolute", left: -(k % STRIP.cols) * fw, top: -Math.floor(k / STRIP.cols) * h, width: fw * STRIP.cols, height: h * STRIP.rows }} />
        </View>
      ) : (
        <View style={{ height: h }}>
          <Still src={src} clip={clip} tall />
        </View>
      )}
    </View>
  );
}

/* A choice on the ink sheet: outlined in white, white when on. */
function Light({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={{ borderWidth: 2, borderColor: "#fff", backgroundColor: on ? "#fff" : "transparent", minHeight: 38, paddingHorizontal: 10, justifyContent: "center" }}>
      <Text style={mono(12, true, on ? GROUND : "#fff", 0.08)}>{label}</Text>
    </Pressable>
  );
}

function Still({ src, clip, tall }: { src: ReelSource; clip: ClipId; tall?: boolean }) {
  const [uri, setUri] = useState("");
  const [bad, setBad] = useState(false);
  useEffect(() => {
    let live = true;
    setUri("");
    setBad(false);
    reelStillUri(src, clip)
      .then((u) => live && setUri(u))
      .catch(() => live && setBad(true));
    return () => {
      live = false;
    };
  }, [src.key, clip]);
  if (bad) return <Text style={mono(10, false, C.gray)}>No preview</Text>;
  if (!uri) return <ActivityIndicator color="#fff" />;
  return <Image source={{ uri }} resizeMode="contain" accessibilityIgnoresInvertColors style={tall ? { height: "100%", aspectRatio: 9 / 16 } : { width: "100%", aspectRatio: 9 / 16 }} />;
}
