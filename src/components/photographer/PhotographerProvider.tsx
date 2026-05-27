"use client";

import { SessionProvider } from "next-auth/react";

// Wraps photographer-area routes so useSession() works in the tree.
export function PhotographerProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
