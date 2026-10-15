/* ANIMATED STICKERS (owner, 2026-10-15: "can we animate any of these
 * stickers? Can we try some animated stickers? Like when we do the clock,
 * can we start ticking?").
 *
 * Two cards move: THE CLOCK ticks (its seconds are the snapshot's elapsed
 * time plus the drift since the poll, so a repaint every TICK_MS is a
 * tick) and MILE counts up from 0 over COUNT_MS with its bar filling. A
 * painter gets an `Anim` with the ms since the animation began; no Anim
 * means the final frame, which is what a PNG export and the deck paint.
 *
 * Export: the preview canvas is recorded for VIDEO_MS with MediaRecorder
 * (captureStream at 30 fps). A video has no alpha, so the frame records
 * the clear look on ink instead and says so. MP4 is preferred where the
 * browser can write it (iOS Safari, recent Chrome) because a story takes
 * it straight from the camera roll; WebM is the fallback. */

export type Anim = {
  /* Milliseconds since the animation (or the recording) began. */
  t: number;
  /* Wall-clock ms, for anything that ticks. */
  now: number;
  /* True while recording: no transparent corners, since video has none. */
  video: boolean;
};

export const COUNT_MS = 1500;
export const TICK_MS = 250;
export const VIDEO_MS = 6000;

const easeOutCubic = (p: number): number => 1 - Math.pow(1 - p, 3);

/* 0 → 1 over COUNT_MS, eased; 1 for a final frame (no anim). */
export function progressAt(anim: Anim | undefined): number {
  if (!anim || !Number.isFinite(anim.t)) return 1;
  if (anim.t <= 0) return 0;
  if (anim.t >= COUNT_MS) return 1;
  return easeOutCubic(anim.t / COUNT_MS);
}

/* A whole number counting up to `target`. */
export function countUp(target: number, anim: Anim | undefined): number {
  return Math.round(target * progressAt(anim));
}

/* ------------------------------------------------------------ the video */

const MIMES = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];

export function videoMime(): string | null {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return null;
  for (const m of MIMES) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* an odd implementation throws on an unknown type: keep looking */
    }
  }
  return null;
}

export const videoExt = (mime: string): "mp4" | "webm" => (mime.includes("mp4") ? "mp4" : "webm");

/* Can this browser record a canvas at all? (No MediaRecorder: the frame
 * hides the button.) */
export function canRecord(): boolean {
  if (typeof HTMLCanvasElement === "undefined") return false;
  if (typeof (HTMLCanvasElement.prototype as { captureStream?: unknown }).captureStream !== "function") return false;
  return videoMime() !== null;
}

/* Records `canvas` for `ms` and resolves the clip as a File named
 * `<basename>.mp4|webm`, or null when nothing came out. The caller keeps
 * painting the canvas while this runs: captureStream only emits a frame
 * when the canvas changes. */
export function recordCanvas(canvas: HTMLCanvasElement, ms: number, basename: string): Promise<File | null> {
  const mime = videoMime();
  if (!mime) return Promise.resolve(null);
  let stream: MediaStream;
  let rec: MediaRecorder;
  try {
    stream = canvas.captureStream(30);
    rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  } catch {
    return Promise.resolve(null);
  }
  const chunks: Blob[] = [];
  return new Promise((resolve) => {
    let done = false;
    const finish = (file: File | null) => {
      if (done) return;
      done = true;
      stream.getTracks().forEach((t) => t.stop());
      resolve(file);
    };
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    rec.onerror = () => finish(null);
    rec.onstop = () => {
      const type = rec.mimeType || mime;
      const blob = new Blob(chunks, { type });
      finish(blob.size > 0 ? new File([blob], `${basename}.${videoExt(type)}`, { type }) : null);
    };
    try {
      rec.start(250);
    } catch {
      finish(null);
      return;
    }
    setTimeout(() => {
      try {
        if (rec.state !== "inactive") rec.stop();
        else finish(null);
      } catch {
        finish(null);
      }
    }, ms);
  });
}
