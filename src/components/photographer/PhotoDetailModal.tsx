/**
 * Back-compat shim. The photo viewer is now `Lens` (see ./Lens). Coverage and
 * Roster still import `PhotoDetailModal` from this path; this alias keeps them
 * working without edits. New code should import `Lens` directly. Drop this
 * once those callers are migrated.
 */
export { Lens as PhotoDetailModal } from "./Lens";
export * from "./Lens";
