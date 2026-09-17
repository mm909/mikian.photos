import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/* THE CONSOLE MOVED (owner, 2026-09-17: "let us keep Rowtember out of it —
 * these things should be a little disjoint"). The one-erg telemetry
 * console that lived here is now the erg product at /erg: many monitors at
 * once, a page per erg, sessions saved against the account rather than a
 * rower number. Nothing about a challenge is left in it.
 *
 * The old path stays only as this redirect, because it is what is written
 * in the owner's notes and what the race board linked to. Everything it
 * used to render is gone; the bytes it decoded moved to src/lib/pm5/. */
export default function Pm5TelemetryMoved() {
  redirect("/erg");
}
