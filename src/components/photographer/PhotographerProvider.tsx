"use client";

/**
 * Historically wrapped the photographer area in <SessionProvider>. The
 * session provider has been lifted to the root layout (see
 * src/components/auth/SessionProviderWrapper.tsx) so useSession() works
 * everywhere, including the runner Nav.
 *
 * Keeping this component as a thin pass-through so existing imports from
 * src/app/photographer/layout.tsx still resolve. Safe to inline at the
 * layout once nothing else depends on this name.
 */
export function PhotographerProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
