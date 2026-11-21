import * as Clipboard from "expo-clipboard";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { SAME_ORIGIN, loadToken } from "./api";

/* A PICTURE OR A VIDEO THE SITE MADE, fetched as the signed-in rower and
 * handed on. On a phone it is saved to the cache and given to the share
 * sheet (Instagram, Photos, Files, AirDrop). In a browser it goes to the
 * browser's own share sheet where there is one, and is downloaded where
 * there is not. The stickers and the reel overlays both come through here. */

export type Fetched = { uri: string; blob?: Blob };

export async function fetchFile(url: string, name: string): Promise<Fetched> {
  const t = await loadToken();
  const headers: Record<string, string> = t ? { authorization: `Bearer ${t}` } : {};
  if (Platform.OS === "web") {
    const res = await fetch(url, { headers, credentials: SAME_ORIGIN ? "include" : "omit" });
    if (!res.ok) {
      const said = await res.json().catch(() => null);
      throw new Error((said as { error?: string } | null)?.error ?? "That could not be made just now.");
    }
    const blob = await res.blob();
    return { uri: URL.createObjectURL(blob), blob };
  }
  const dest = new File(Paths.cache, name);
  try {
    if (dest.exists) dest.delete();
  } catch {
    /* A file that will not go is overwritten or fails below. */
  }
  const file = await File.downloadFileAsync(url, dest, { headers });
  return { uri: file.uri };
}

export async function shareFile(f: Fetched, name: string, mime: string, uti: string): Promise<"share" | "download" | "none"> {
  if (Platform.OS !== "web") {
    if (!(await Sharing.isAvailableAsync())) throw new Error("This phone has no share sheet to hand it to.");
    await Sharing.shareAsync(f.uri, { mimeType: mime, UTI: uti });
    return "share";
  }
  const file = f.blob ? new globalThis.File([f.blob], name, { type: mime }) : null;
  const nav = navigator as Navigator & { canShare?: (d: { files: unknown[] }) => boolean };
  if (file && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] } as ShareData);
      return "share";
    } catch {
      return "none";
    }
  }
  const a = document.createElement("a");
  a.href = f.uri;
  a.download = name;
  a.click();
  return "download";
}

/* A picture, onto the clipboard, to paste into a story or a message (owner,
 * 2026-11-21, of the stickers: "I need a share button and a copy button"). */
export async function copyImage(f: Fetched): Promise<void> {
  let b64: string;
  if (f.blob) {
    const blob = f.blob;
    b64 = await new Promise<string>((done, fail) => {
      const r = new FileReader();
      r.onload = () => done(String(r.result).replace(/^data:[^,]*,/, ""));
      r.onerror = () => fail(new Error("That picture could not be read."));
      r.readAsDataURL(blob);
    });
  } else {
    b64 = await new File(f.uri).base64();
  }
  await Clipboard.setImageAsync(b64);
}
