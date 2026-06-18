"use client";

import { useEffect, useState } from "react";

/**
 * Owner-only "view as role" preview. Lets the owner see the site as a user /
 * photographer would (nav tabs, owner-only menu items) without signing out.
 * Client-side only — the owner still has full server-side access; this just
 * changes what the UI chooses to show.
 *
 * Persisted in localStorage with a same-tab "storage" event so the Nav and the
 * account menu stay in sync (mirrors src/lib/devSettings.ts).
 */
export type ViewAsRole = "owner" | "photographer" | "user";

const KEY = "mikian.viewas.v1";

const VALID: ViewAsRole[] = ["owner", "photographer", "user"];

export function readViewAs(): ViewAsRole {
  if (typeof window === "undefined") return "owner";
  try {
    const v = window.localStorage.getItem(KEY) as ViewAsRole | null;
    return v && VALID.includes(v) ? v : "owner";
  } catch {
    return "owner";
  }
}

/** The (implied) roles an actor in this view would hold. Owner implies all. */
export function rolesForView(view: ViewAsRole): string[] {
  switch (view) {
    case "owner":
      return ["user", "photographer", "owner"];
    case "photographer":
      return ["user", "photographer"];
    case "user":
    default:
      return ["user"];
  }
}

export function useViewAs(): [ViewAsRole, (next: ViewAsRole) => void] {
  const [v, setV] = useState<ViewAsRole>("owner");
  useEffect(() => {
    setV(readViewAs());
    const listener = (e: StorageEvent) => {
      if (e.key === KEY) setV(readViewAs());
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);

  function update(next: ViewAsRole) {
    setV(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, next);
      // Notify same-tab listeners (StorageEvent only fires cross-tab natively).
      window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
    }
  }

  return [v, update];
}
