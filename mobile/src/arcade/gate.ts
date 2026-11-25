import type { Me } from "../api";

/* WHO SEES THE ARCADE: the owner, and nobody else until he opens it
 * (owner, 2026-11-24: "Wait until January to launch it, if not later. But
 * I'll be playing it the whole time"; "Don't disable it ... we can just
 * hide it"). Hidden, not switched off: the game, the locker and what is kept
 * on the phone are all there, only no door to them is drawn for anybody else
 * (the profile's arcade panel, FREE ROW or PLAY THE ARCADE on connect, the
 * game's summary on a row's page, the wiki, the locker, the developer
 * buttons). The day it opens is this one line: ARCADE_OPEN = true. */
export const ARCADE_OPEN = false;

/* Admin is the owner's accounts (src/lib/row100k.ts ADMIN_EMAILS). */
export const arcadeFor = (me: Pick<Me, "isAdmin">): boolean => ARCADE_OPEN || !!me.isAdmin;
