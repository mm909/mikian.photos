import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { CHALLENGE, isRow100kAdmin } from "@/lib/row100k";
import { BarAccount } from "./BarAccount";

/* The one bar every /row100k page wears: ROW100K home chip, THE STATS,
 * THE FEED on the left; the sign-in / rower chip on the right (owner call,
 * cycle 2 — same header everywhere). Server component: it resolves the
 * session itself so pages don't each re-plumb it. `children` lands between
 * the links and the account chip for page-specific tags. */
export async function RowBar({
  active,
  children,
}: {
  active?: "home" | "stats" | "feed";
  children?: React.ReactNode;
}) {
  let signedIn = false;
  let rowerNumber: number | null = null;
  let admin = false;
  try {
    const actor = await getEffectiveActor();
    if (actor) {
      signedIn = true;
      admin = isRow100kAdmin(actor.email, actor.roles);
      const me = await db.rowParticipant.findUnique({
        where: { challenge_userId: { challenge: CHALLENGE, userId: actor.photographerId } },
        select: { rowerNumber: true },
      });
      rowerNumber = me?.rowerNumber ?? null;
    }
  } catch {
    /* cosmetic — a failed lookup just renders the signed-out chip */
  }

  const link = (href: string, label: string, key: "stats" | "feed") =>
    active === key ? (
      <span className="mono tag">{label}</span>
    ) : (
      <a className="mono back-link" href={href}>
        {label}
      </a>
    );

  return (
    <div className="bar">
      <span style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        {active === "home" ? (
          <span className="mono tag">ROW100K</span>
        ) : (
          <a className="mono tag" href="/row100k" style={{ textDecoration: "none" }}>
            ROW100K
          </a>
        )}
        {link("/row100k/stats", "THE STATS", "stats")}
        {link("/row100k/feed", "THE FEED", "feed")}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {children}
        <BarAccount signedIn={signedIn} rowerNumber={rowerNumber} admin={admin} />
      </span>
    </div>
  );
}
