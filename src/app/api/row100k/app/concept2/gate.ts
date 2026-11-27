import { ergApiDenial, ergViewer } from "@/app/erg/gate";

/* THE DOOR on the Concept2 Logbook routes: in development (CLAUDE.md), so
 * an admin account only in production and open in local dev, like the
 * site's own erg routes (app/erg/gate.ts ergApiDenial). When the owner
 * says it goes live, this is the one function that changes. */
export async function concept2Viewer(): Promise<{ userId: string } | { error: string; status: number }> {
  const v = await ergViewer();
  const denied = ergApiDenial(v);
  if (denied) return denied;
  return { userId: v.userId as string };
}
