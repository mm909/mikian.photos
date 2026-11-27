import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";
import { API, api } from "../api";
import { fetchFile, shareFile, type Fetched } from "../files";
import { Chip, Eye, mono } from "../site";
import { C } from "../theme";
import { Waiting, sideways, useLoad, useScrollDir } from "../ui";

/* THE POSTERS (owner, 2026-11-26: "need to bring over the poster utility
 * into the app. ... We want to bring the poster for the individual rower.
 * We want to bring the poster for Rowtember in general. We want to be able
 * to select time frames. We want to be able to change the color. We want
 * different aspect ratios. We don't need race day or top 10 at the moment.
 * The other poster I need is one for M2D."). Nothing is drawn in the app:
 * the site's own poster engine draws each sheet on the server
 * (/api/row100k/app/poster) and it comes here as a PNG, the way a sticker
 * does. Pick whose (You, the month's edition, M2D), the time frame, the
 * colour and the size; the preview is the file that is shared. SHARE hands
 * it to the share sheet; SAVE does the same with the full print file for a
 * wall size (150 ppi), which the share sheet saves to Photos or Files. */

export type PosterSubject = "rower" | "rowtember" | "m2d";
type Opt = { key: string; label: string };
type Options = {
  me: number | null;
  community: string;
  subjects: Opt[];
  periods: Opt[];
  current: string;
  colors: (Opt & { swatch: string; ground: string })[];
  formats: (Opt & { kind: "print" | "instagram"; w: number; h: number })[];
};

const ask = (o: { subject: string; m: string; color: string; format: string; mine: boolean; full: boolean }) =>
  `subject=${o.subject}${o.subject === "m2d" ? (o.mine ? "" : "&mine=0") : `&m=${o.m}`}&color=${o.color}&format=${o.format}${o.full ? "&full=1" : ""}`;
const nameOf = (q: string) => `row-poster-${q.replace(/[^a-z0-9]+/gi, "-")}.png`;

/* One file per ask, kept for the visit. */
const kept = new Map<string, Promise<Fetched>>();
function poster(q: string): Promise<Fetched> {
  let p = kept.get(q);
  if (!p) {
    p = fetchFile(`${API}/api/row100k/app/poster?${q}`, nameOf(q), 60_000);
    kept.set(q, p);
    p.catch(() => kept.delete(q));
  }
  return p;
}

export function PostersScreen({ start, onScrollDir }: { start?: PosterSubject; onScrollDir?: (down: boolean) => void }) {
  const dir = useScrollDir(onScrollDir);
  const { data: o, error, reload } = useLoad(() => api<Options>("/api/row100k/app/poster?options=1"), []);
  const [subject, setSubject] = useState<PosterSubject | null>(start ?? null);
  const [m, setM] = useState<string | null>(null);
  const [color, setColor] = useState("cream");
  const [format, setFormat] = useState("story");
  const [mine, setMine] = useState(true);
  const [uri, setUri] = useState("");
  const [bad, setBad] = useState("");
  const [busy, setBusy] = useState<"" | "share" | "save">("");
  const [note, setNote] = useState("");

  /* You first for a rower; the month's poster for anyone who has not joined. */
  const subj: PosterSubject = subject ?? (o?.me ? "rower" : "rowtember");
  const period = m ?? o?.current ?? "";
  const fmt = o?.formats.find((f) => f.key === format) ?? o?.formats[0];
  const q = o ? ask({ subject: subj, m: period, color, format, mine, full: false }) : "";

  useEffect(() => {
    if (!q) return;
    let live = true;
    setUri("");
    setBad("");
    poster(q)
      .then((f) => live && setUri(f.uri))
      .catch((err: unknown) => live && setBad(err instanceof Error ? err.message : "That poster could not be drawn just now."));
    return () => {
      live = false;
    };
  }, [q]);

  if (!o) return <Waiting error={error} onRetry={reload} />;

  const run = async (what: "share" | "save") => {
    setBusy(what);
    setNote("");
    try {
      const full = what === "save" && fmt?.kind === "print";
      const fq = full ? ask({ subject: subj, m: period, color, format, mine, full: true }) : q;
      const did = await shareFile(await poster(fq), nameOf(fq), "image/png", "public.png");
      if (did === "download") setNote("Saved to your downloads.");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "That did not work.");
    }
    setBusy("");
  };

  const row = (opts: Opt[], on: string, pick: (k: string) => void) => (
    <ScrollView horizontal {...sideways} showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
      {opts.map((x) => (
        <Chip key={x.key} label={x.label} on={x.key === on} onPress={() => pick(x.key)} />
      ))}
    </ScrollView>
  );
  const pill = (label: string, what: "share" | "save", fill: boolean) => (
    <Pressable accessibilityRole="button" disabled={busy !== "" || !uri} onPress={() => run(what)} style={({ pressed }) => ({ flex: 1, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: fill ? C.accent : "transparent", borderWidth: fill ? 0 : 2, borderColor: C.ink, opacity: busy !== "" || !uri ? 0.5 : pressed ? 0.7 : 1 })}>
      <Text style={mono(12, true, fill ? "#fff" : C.ink, 0.14)}>{busy === what ? "Working" : label}</Text>
    </Pressable>
  );
  const ratio = fmt ? fmt.w / fmt.h : 9 / 16;

  return (
    <ScrollView {...dir} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 132 }}>
      {/* THE PREVIEW: the file itself, at the frame's own shape. */}
      <View style={{ alignItems: "center", marginTop: 8 }}>
        <View style={{ width: ratio < 0.7 ? "72%" : "100%", aspectRatio: ratio, backgroundColor: o.colors.find((c) => c.key === color)?.ground ?? C.pale, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.line }}>
          {uri ? (
            <Image source={{ uri }} resizeMode="contain" accessibilityLabel="The poster" accessibilityIgnoresInvertColors style={{ width: "100%", height: "100%" }} />
          ) : bad ? (
            <Text style={[mono(10, false, C.gray), { textAlign: "center", paddingHorizontal: 16 }]}>{bad}</Text>
          ) : (
            <ActivityIndicator color={C.gray} />
          )}
        </View>
      </View>
      <Text style={[mono(11, false, C.gray, 0.12), { textAlign: "center", marginTop: 10, minHeight: 16 }]}>{note}</Text>
      <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
        {pill("Share", "share", false)}
        {pill(fmt?.kind === "print" ? "Save print size" : "Save", "save", true)}
      </View>

      <Eye left="Poster" right="Whose" />
      {row(o.subjects, subj, (k) => setSubject(k as PosterSubject))}
      {subj === "m2d" && o.me ? (
        <View style={{ marginTop: 10 }}>
          {row(
            [
              { key: "mine", label: "With my meters" },
              { key: "all", label: "Everyone" },
            ],
            mine ? "mine" : "all",
            (k) => setMine(k === "mine"),
          )}
        </View>
      ) : null}

      {/* The time frame: each month, newest first, and all time. M2D is its
          own window, Nov 26 - Dec 24, and has none to pick. */}
      {subj === "m2d" ? null : (
        <>
          <Eye left="Time frame" />
          {row(o.periods, period, setM)}
        </>
      )}

      <Eye left="Color" />
      <ScrollView horizontal {...sideways} showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
        {o.colors.map((c) => {
          const on = c.key === color;
          return (
            <Pressable key={c.key} accessibilityRole="button" accessibilityLabel={c.label} accessibilityState={{ selected: on }} onPress={() => setColor(c.key)} style={{ alignItems: "center", width: 74 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: on ? 3 : 1, borderColor: on ? C.ink : C.line, backgroundColor: c.ground, alignItems: "center", justifyContent: "center" }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.swatch }} />
              </View>
              <Text numberOfLines={1} style={[mono(9, on, on ? C.ink : C.gray, 0.08), { marginTop: 6 }]}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Eye left="Size" right="Phone · print" />
      {row(o.formats, fmt?.key ?? format, setFormat)}
    </ScrollView>
  );
}
