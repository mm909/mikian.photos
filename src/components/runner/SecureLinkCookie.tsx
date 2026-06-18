"use client";

import { useEffect } from "react";

/**
 * Persist a secure-link token so a secure-link event survives navigation +
 * refresh without re-pasting `?k=`. Written client-side (the token is already
 * in the share URL, so it isn't a secret credential) and read back by the event
 * page + /api/photos on subsequent requests. Scoped to the event slug.
 */
export function SecureLinkCookie({ slug, token }: { slug: string; token: string }) {
  useEffect(() => {
    try {
      const maxAge = 60 * 60 * 24 * 30; // 30 days
      document.cookie = `mk_evk_${slug}=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; samesite=lax`;
    } catch {
      /* cookies disabled — the ?k= in the URL still works for this load */
    }
  }, [slug, token]);
  return null;
}
