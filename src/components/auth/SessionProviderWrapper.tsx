"use client";

import { SessionProvider } from "next-auth/react";

/**
 * NextAuth's SessionProvider is a client component. Wrap once at the root so
 * useSession() works from anywhere — the Nav, the photographer area, etc.
 *
 * No props (we read session from /api/auth/session under the hood).
 */
export function SessionProviderWrapper({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
