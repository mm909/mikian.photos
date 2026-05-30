/**
 * Client-side upload preferences (single-operator scale — persisted in
 * localStorage, set from the admin panel, read by the upload panel).
 *
 * Duplicate policy: when the sign route reports a fingerprint collision
 * (the same image already exists in the event), do we overwrite the
 * existing photo or skip the new upload? Previously this was a per-batch
 * prompt; the owner asked to make it a single setting instead.
 */
export type DuplicatePolicy = "skip" | "overwrite";

const DUP_POLICY_KEY = "mikian_dup_policy";

/** Read the duplicate policy. Defaults to the non-destructive "skip". */
export function getDuplicatePolicy(): DuplicatePolicy {
  if (typeof window === "undefined") return "skip";
  try {
    return window.localStorage.getItem(DUP_POLICY_KEY) === "overwrite"
      ? "overwrite"
      : "skip";
  } catch {
    return "skip";
  }
}

export function setDuplicatePolicy(policy: DuplicatePolicy): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DUP_POLICY_KEY, policy);
  } catch {
    /* private mode / storage disabled — non-fatal, falls back to default */
  }
}
