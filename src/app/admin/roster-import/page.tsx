import { redirect } from "next/navigation";
import { getEffectiveActor, isAdmin, canManageEvent } from "@/lib/permissions";
import { listEvents, getDefaultEvent, getEvent } from "@/lib/events";
import { db } from "@/lib/db";
import { RosterImportClient } from "./RosterImportClient";

/**
 * Roster import — event manager (platform owner OR the event's owner). Paste a
 * results link or CSV/table text (or upload a .csv); the tool detects the
 * source, previews the parsed rows, and imports them into the event's roster.
 *
 * Server-gated like the other admin surfaces: resolve the effective actor and
 * bounce anyone who can't manage at least one event. The manageable-events list
 * (owner → all; event-owner → theirs) is passed to the client for the picker;
 * ?eventId= preselects one.
 */
export const dynamic = "force-dynamic";

type EventOption = { id: string; name: string };

export default async function RosterImportPage({
  searchParams,
}: {
  searchParams: { eventId?: string };
}) {
  const actor = await getEffectiveActor();
  if (!actor) redirect("/");

  // Build the list of events this actor may manage. Platform owner sees all;
  // otherwise only events they own (Event.ownerId === their photographerId).
  let options: EventOption[] = [];
  if (isAdmin(actor)) {
    const evs = await listEvents({ includeArchived: true });
    options = evs.map((e) => ({ id: e.id, name: e.name }));
  } else {
    // Event-owner: query events they own directly (listEvents doesn't expose
    // ownerId). Fail-open to an empty list on any read error.
    try {
      const rows = await db.event.findMany({
        where: { ownerId: actor.photographerId },
        orderBy: { date: "desc" },
        select: { id: true, name: true },
      });
      options = rows.map((r) => ({ id: r.id, name: r.name }));
    } catch {
      options = [];
    }
  }

  if (options.length === 0) {
    // Nothing to manage → not an admin surface for this actor.
    redirect("/");
  }

  // Preselect: ?eventId if it's one they can manage, else the default event if
  // manageable, else the first option.
  let selectedId = options[0].id;
  const requestedId =
    typeof searchParams.eventId === "string" ? searchParams.eventId.trim() : "";
  if (requestedId && options.some((o) => o.id === requestedId)) {
    selectedId = requestedId;
  } else {
    const def = await getDefaultEvent();
    if (def && options.some((o) => o.id === def.id)) selectedId = def.id;
  }

  // Defense-in-depth: confirm the selected event is actually manageable (the
  // API re-checks too, but keep the page honest).
  if (requestedId && requestedId === selectedId) {
    const ev = await getEvent(selectedId);
    if (ev) {
      const evRow = await db.event
        .findUnique({ where: { id: selectedId }, select: { ownerId: true } })
        .catch(() => null);
      if (evRow && !canManageEvent(actor, evRow)) {
        // Fall back to the first manageable option.
        selectedId = options[0].id;
      }
    }
  }

  return <RosterImportClient events={options} initialEventId={selectedId} />;
}
