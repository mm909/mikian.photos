"use client";

import { useEffect, useState } from "react";

const KEY = "mikian.dev.v1";

export type DevSettings = {
  showBanner: boolean;
  asRoles: {
    runner: boolean;
    photographer: boolean;
    race_director: boolean;
    admin: boolean;
  };
};

export const DEFAULT_SETTINGS: DevSettings = {
  showBanner: false,
  asRoles: { runner: true, photographer: false, race_director: false, admin: false },
};

function read(): DevSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useDevSettings(): [DevSettings, (next: Partial<DevSettings>) => void] {
  const [s, setS] = useState<DevSettings>(DEFAULT_SETTINGS);
  useEffect(() => {
    setS(read());
    const listener = (e: StorageEvent) => {
      if (e.key === KEY) setS(read());
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);

  function update(next: Partial<DevSettings>) {
    const merged = { ...s, ...next };
    setS(merged);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, JSON.stringify(merged));
      // Notify same-tab listeners by dispatching a fake event.
      window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
    }
  }

  return [s, update];
}

export function clearRunnerState() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("mikian.runner.v1");
}
