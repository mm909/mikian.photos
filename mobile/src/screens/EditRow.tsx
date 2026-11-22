import { useState } from "react";
import { Image, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { api, type Photo } from "../api";
import { CloseIcon } from "../icons";
import { mono } from "../site";
import { forgetStickers } from "../stickers";
import { C, F, fmtInt } from "../theme";
import { useKeyboardHeight, useModalHold } from "../ui";
import { pickPhoto, pickPhotos, uploadPhoto, type Picked } from "../upload";
import { parseTime } from "./RowScreen";

/* EDIT ROW, ALL OF IT (owner, 2026-11-21: "when I click edit row, I need to
 * be able to edit all of the things about it ... we'll allow them to edit
 * the meters and time, even on telemetry. But I also need to be able to
 * like add and remove photos and edit caption"; and of the sheet this
 * replaces: "it kind of like glitches ... the keyboard is still covering
 * the place where you type").
 *
 * A PAGE, not a sheet: it slides up over the row and fills the screen, so
 * nothing is typed at the foot of the glass where the keyboard lands. The
 * description is first, at the top; then the meters and the time, the
 * title, and the two photos. The keyboard does not come up until a field is
 * pressed, and the page makes room under itself for it.
 *
 * A ROW OFF THE MONITOR can have its meters and time changed too: the row
 * carries what is typed here, and the recording under it keeps what the
 * monitor read.
 *
 * TWO PHOTOS, as on every row (the site's rule: the rower, and the
 * monitor). Either can be swapped for one from the library or the camera;
 * taking one out leaves its place open, and the row saves once both places
 * are full again.
 *
 * It saves through the site's own edit (PATCH api/row100k/rows/[id]: the
 * same checks as logging) and the description's own route. */

export type Editable = { id: string; day: string; meters: number; seconds: number; title: string; caption: string; photos: Photo[]; photoKeys: string[]; telemetry: boolean };

const clock = (s: number) => {
  const t = Math.max(0, Math.round(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const ss = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};

/* A place for a photo: the one the row has (its key kept), a new one picked
 * on the phone, or nothing. */
type Slot = { kind: "kept"; key: string; uri: string } | { kind: "new"; pick: Picked } | null;

export function EditRow({ row, onClose, onSaved }: { row: Editable; onClose: () => void; onSaved: () => void }) {
  useModalHold();
  const kb = useKeyboardHeight();
  const [text, setText] = useState(row.caption);
  const [meters, setMeters] = useState(String(row.meters));
  const [time, setTime] = useState(clock(row.seconds));
  const [title, setTitle] = useState(row.title);
  const [slots, setSlots] = useState<Slot[]>(() => [0, 1].map((i) => (row.photoKeys[i] && row.photos[i] ? { kind: "kept" as const, key: row.photoKeys[i], uri: row.photos[i].thumb ?? row.photos[i].full } : null)));
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const m = Number(meters.replace(/[^\d]/g, ""));
  const s = parseTime(time);
  const photosChanged = slots.some((x, i) => (x?.kind === "kept" ? x.key !== row.photoKeys[i] : x !== null || !!row.photoKeys[i]));
  const numbersChanged = m !== row.meters || s !== row.seconds || title.trim() !== row.title;
  const wordsChanged = text.trim() !== row.caption.trim();
  const full = slots.every((x) => x !== null);
  const ok = m > 0 && s !== null && s > 0 && (!photosChanged || full);
  const dirty = photosChanged || numbersChanged || wordsChanged;

  const put = (i: number, v: Slot) => setSlots((cur) => cur.map((x, k) => (k === i ? v : x)));
  const choose = async (i: number, from: "library" | "camera") => {
    setError("");
    try {
      const p = from === "camera" ? await pickPhoto("camera") : (await pickPhotos(1))[0];
      if (p) put(i, { kind: "new", pick: p });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That photo could not be opened.");
    }
  };

  const save = async () => {
    if (!ok || busy) return;
    setError("");
    try {
      if (photosChanged || numbersChanged) {
        let keys: string[] | undefined;
        if (photosChanged) {
          keys = [];
          for (let i = 0; i < slots.length; i++) {
            const x = slots[i];
            if (!x) continue;
            if (x.kind === "kept") keys.push(x.key);
            else {
              setBusy(`Photo ${i + 1}`);
              keys.push(await uploadPhoto(x.pick));
            }
          }
        }
        setBusy("Saving");
        await api(`/api/row100k/rows/${row.id}`, { method: "PATCH", body: { day: row.day, meters: m, seconds: s, ...(title.trim() !== row.title ? { title: title.trim() } : {}), ...(keys ? { photos: keys } : {}) } });
        /* The stickers print the meters and the time. */
        forgetStickers();
      }
      if (wordsChanged) {
        setBusy("Saving");
        await api("/api/row100k/app/row", { body: { id: row.id, caption: text } });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not save. Try again.");
      setBusy("");
    }
  };

  const label = (t: string) => <Text style={[mono(10, false, C.gray, 0.14), { marginBottom: 6 }]}>{t}</Text>;
  const noRing = Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null;
  const figure = [{ borderBottomWidth: 1, borderColor: C.ink, fontFamily: F.black, fontSize: 28, paddingVertical: 6, color: C.ink, fontVariant: ["tabular-nums" as const] }, noRing];

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.paper, paddingTop: Platform.OS === "ios" ? 54 : 28 }}>
        <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 10, height: 50 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close without saving" onPress={onClose} hitSlop={8} style={{ width: 64, height: 44, justifyContent: "center", paddingLeft: 6 }}>
              <CloseIcon color={C.ink} size={24} />
            </Pressable>
            <Text style={{ flex: 1, textAlign: "center", fontFamily: F.black, fontSize: 20, color: C.ink }}>
              EDIT R<Text style={{ color: C.accent }}>O</Text>W
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Save" disabled={!ok || !dirty || !!busy} onPress={save} hitSlop={8} style={({ pressed }) => ({ width: 64, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: C.accent, opacity: !ok || !dirty || busy ? 0.35 : pressed ? 0.7 : 1 })}>
              <Text style={mono(11, true, "#fff", 0.1)}>Save</Text>
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: (Platform.OS === "ios" ? 0 : kb) + 60 }}>
            {label("Description")}
            <TextInput
              accessibilityLabel="Description"
              value={text}
              onChangeText={setText}
              multiline
              maxLength={500}
              placeholder="Say something about this row"
              placeholderTextColor={C.gray}
              style={[{ fontFamily: F.sans, fontSize: 16, lineHeight: 22, color: C.ink, minHeight: 92, padding: 12, borderWidth: 1, borderColor: C.line, borderRadius: 8, backgroundColor: C.card, textAlignVertical: "top" }, noRing]}
            />
            <Text style={[mono(10, false, C.gray, 0.08), { textAlign: "right", marginTop: 4 }]}>{text.length} / 500</Text>

            <View style={{ flexDirection: "row", gap: 18, marginTop: 18 }}>
              <View style={{ flex: 1 }}>
                {label("Meters")}
                <TextInput accessibilityLabel="Meters" value={meters} onChangeText={setMeters} keyboardType="number-pad" style={figure} />
              </View>
              <View style={{ flex: 1 }}>
                {label("Time")}
                <TextInput accessibilityLabel="Time, as minutes and seconds" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" autoCorrect={false} placeholder="20:00" placeholderTextColor={C.line} style={figure} />
              </View>
            </View>
            {m > 0 && s ? (
              <Text style={[mono(10, false, C.gray, 0.1), { marginTop: 8 }]}>
                {fmtInt(m)} m · {clock((s / m) * 500)} a 500
              </Text>
            ) : (
              <Text style={[mono(10, false, C.accent, 0.1), { marginTop: 8 }]}>The meters, and a time such as 20:00.</Text>
            )}
            {row.telemetry ? <Text style={{ fontFamily: F.sans, fontSize: 13, lineHeight: 18, color: C.gray, marginTop: 8 }}>This row came off the monitor. What is typed here is what the row counts for; the recording under it keeps what the monitor read.</Text> : null}

            <View style={{ marginTop: 22 }}>
              {label("Title")}
              <TextInput accessibilityLabel="Title" value={title} onChangeText={setTitle} maxLength={60} style={[{ borderBottomWidth: 1, borderColor: C.ink, fontFamily: F.bold, fontSize: 18, paddingVertical: 6, color: C.ink }, noRing]} />
            </View>

            <View style={{ marginTop: 24 }}>
              {label("Photos · you, and the monitor")}
              <View style={{ flexDirection: "row", gap: 10 }}>
                {slots.map((x, i) => (
                  <View key={i} style={{ flex: 1 }}>
                    <Pressable accessibilityRole="imagebutton" accessibilityLabel={x ? `Change photo ${i + 1}` : `Add photo ${i + 1}`} onPress={() => choose(i, "library")} style={{ aspectRatio: 4 / 5, borderRadius: 8, overflow: "hidden", backgroundColor: C.pale, alignItems: "center", justifyContent: "center", borderWidth: x ? 0 : 1.5, borderStyle: "dashed", borderColor: C.gray }}>
                      {x ? <Image source={{ uri: x.kind === "kept" ? x.uri : x.pick.uri }} resizeMode="cover" style={{ width: "100%", height: "100%" }} /> : <Text style={mono(11, true, C.accent, 0.12)}>Add a photo</Text>}
                      {x ? (
                        <Pressable accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`} onPress={() => put(i, null)} hitSlop={8} style={{ position: "absolute", top: 6, right: 6, width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" }}>
                          <CloseIcon color="#fff" size={16} />
                        </Pressable>
                      ) : null}
                    </Pressable>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
                      <Text accessibilityRole="button" onPress={() => choose(i, "library")} suppressHighlighting style={mono(10, true, C.ink, 0.1)}>
                        Library
                      </Text>
                      <Text accessibilityRole="button" onPress={() => choose(i, "camera")} suppressHighlighting style={mono(10, true, C.ink, 0.1)}>
                        Camera
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
              {photosChanged && !full ? <Text style={[mono(10, false, C.accent, 0.1), { marginTop: 10 }]}>A row carries two photos. Fill the open place to save.</Text> : null}
            </View>

            {error ? <Text style={{ fontFamily: F.sans, fontSize: 14, lineHeight: 20, color: C.accent, marginTop: 18 }}>{error}</Text> : null}
            {busy ? <Text style={[mono(11, true, C.ink, 0.12), { marginTop: 18 }]}>{busy}</Text> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
