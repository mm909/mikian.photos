import { r2Configured, r2PresignGet } from "@/lib/r2";

/* Server-side photo-key → display-URL resolution, shared by the feed and the
 * rower profile. Demo keys ("demo:#0077B6", written by the demo seed) are
 * flat color squares rendered as inline SVG data URIs and never touch R2.
 * Real keys are presigned for an hour, or dropped when R2 isn't configured —
 * rows without resolvable photos still render as text. */

/* Anything after "demo:" that isn't a hex color falls back to a neutral gray
 * rather than being interpolated into the SVG raw. */
function demoPhotoUrl(key: string): string {
  const color = key.slice("demo:".length);
  const fill = /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : "#7A7A74";
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='1000'%3E%3Crect width='100%25' height='100%25' fill='${encodeURIComponent(fill)}'/%3E%3C/svg%3E`;
}

/* One entry's keys → display URLs, order preserved (rower photo first). */
export async function resolvePhotoUrls(keys: string[]): Promise<string[]> {
  if (keys.length === 0) return [];
  const canSign = r2Configured();
  try {
    const urls = await Promise.all(
      keys.map((key) =>
        key.startsWith("demo:") ? demoPhotoUrl(key) : canSign ? r2PresignGet(key, 3600) : "",
      ),
    );
    return urls.filter(Boolean);
  } catch (err) {
    console.error("row100k: photo presign failed", err);
    return [];
  }
}
