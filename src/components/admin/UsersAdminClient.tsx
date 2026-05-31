"use client";

import { useCallback, useEffect, useState } from "react";
import { Headline } from "@/components/runner/Headline";
import { currentEvent } from "@/lib/data";
import {
  getDuplicatePolicy,
  setDuplicatePolicy,
  type DuplicatePolicy,
} from "@/lib/uploadSettings";

type Role = "runner" | "photographer" | "race_director" | "owner";
type ListRole = "photographer" | "race_director";

type AdminUser = {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  googleLinked: boolean;
  photoCount: number;
  createdAt: string;
  isYou: boolean;
};

/**
 * Owner-only admin. Two responsibilities now:
 *   1. Bundle price for the event (PricingPanel).
 *   2. Access allow-lists — who is a Race Director and who is a Photographer.
 *      Everyone not on a list is just a runner. You can add an email before
 *      that person ever signs in; their first Google login claims the row and
 *      inherits the role (see src/lib/auth.ts).
 */
export function UsersAdminClient() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/users", { cache: "no-store" });
      if (!r.ok) throw new Error(`users ${r.status}`);
      const d = (await r.json()) as { users: AdminUser[] };
      setUsers(d.users);
    } catch (e) {
      console.error(e);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addMember(role: ListRole, email: string): Promise<boolean> {
    setMutating(true);
    try {
      const r = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        alert(j.error ?? `Could not add (${r.status})`);
        return false;
      }
      await load();
      return true;
    } finally {
      setMutating(false);
    }
  }

  async function removeMember(role: ListRole, email: string): Promise<void> {
    setMutating(true);
    try {
      const r = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        alert(j.error ?? `Could not remove (${r.status})`);
        return;
      }
      await load();
    } finally {
      setMutating(false);
    }
  }

  // Owners hold every role implicitly, so exclude them from the grant lists —
  // the lists are for granting access to non-owners.
  const photographers = users.filter(
    (u) => u.roles.includes("photographer") && !u.roles.includes("owner")
  );
  const raceDirectors = users.filter(
    (u) => u.roles.includes("race_director") && !u.roles.includes("owner")
  );

  // Already-signed-in accounts the owner can pick from when granting a role —
  // every Google-linked non-owner who doesn't already hold that role. (They can
  // still type a brand-new email for someone who hasn't signed in yet.)
  const signedIn = users.filter((u) => u.googleLinked && !u.roles.includes("owner"));
  const photographerCandidates = signedIn.filter((u) => !u.roles.includes("photographer"));
  const raceDirectorCandidates = signedIn.filter((u) => !u.roles.includes("race_director"));

  return (
    <main className="screen" style={{ padding: "40px 24px 96px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 18,
            flexWrap: "wrap",
            marginBottom: 22,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--muted)",
                marginBottom: 8,
              }}
            >
              Admin · Owner only
            </div>
            <Headline
              as="h1"
              text="Access + pricing."
              accent="pricing."
              style={{
                margin: 0,
                fontFamily: "var(--font-serif)",
                fontWeight: 500,
                fontSize: 36,
                letterSpacing: "-.015em",
              }}
            />
          </div>
        </div>

        <PricingPanel />
        <DuplicatePolicyPanel />

        {loading ? (
          <p style={{ color: "var(--muted)" }}>Loading…</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 18,
            }}
          >
            <WhitelistPanel
              title="Photographers"
              desc="Can upload and manage photos for events."
              members={photographers}
              candidates={photographerCandidates}
              busy={mutating}
              onAdd={(email) => addMember("photographer", email)}
              onRemove={(email) => removeMember("photographer", email)}
            />
            <WhitelistPanel
              title="Race Directors"
              desc="Can see race-director dashboards (coming soon)."
              members={raceDirectors}
              candidates={raceDirectorCandidates}
              busy={mutating}
              onAdd={(email) => addMember("race_director", email)}
              onRemove={(email) => removeMember("race_director", email)}
            />
          </div>
        )}
      </div>
    </main>
  );
}

/**
 * One allow-list (Photographers or Race Directors). Add an email to grant the
 * role — works whether or not that person already has an account. Remove takes
 * them off the list (they fall back to a plain runner).
 */
function WhitelistPanel({
  title,
  desc,
  members,
  candidates,
  busy,
  onAdd,
  onRemove,
}: {
  title: string;
  desc: string;
  members: AdminUser[];
  /** Already-signed-in accounts the owner can pick from (typeahead). */
  candidates: AdminUser[];
  busy: boolean;
  onAdd: (email: string) => Promise<boolean>;
  onRemove: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  // Typeahead over already-signed-in accounts: match the typed text against
  // email or name. Empty query → show all candidates (a plain browse list).
  const q = email.trim().toLowerCase();
  const suggestions = candidates
    .filter((u) => !q || u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q))
    .slice(0, 6);
  const showSuggest = focused && suggestions.length > 0;

  async function addEmail(raw: string) {
    const e = raw.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
      setErr("Enter a valid email address.");
      return;
    }
    setErr(null);
    const ok = await onAdd(e);
    if (ok) {
      setEmail("");
      setFocused(false);
    }
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <h2
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              fontSize: 20,
              color: "var(--ink)",
            }}
          >
            {title}
          </h2>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--muted)",
            }}
          >
            {members.length}
          </span>
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{desc}</div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void addEmail(email);
          }}
          style={{ display: "flex", gap: 8, marginTop: 12 }}
        >
          <div style={{ position: "relative", flex: 1 }}>
            <input
              className="input"
              type="text"
              placeholder="Search a signed-in user, or type an email…"
              value={email}
              disabled={busy}
              autoComplete="off"
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 120)}
              style={{ width: "100%", padding: "8px 10px", fontSize: 14 }}
            />
            {showSuggest && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  right: 0,
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  boxShadow: "var(--shadow)",
                  zIndex: 20,
                  maxHeight: 240,
                  overflowY: "auto",
                }}
              >
                {suggestions.map((u) => {
                  const extraRoles = u.roles.filter((r) => r !== "runner");
                  return (
                    <button
                      key={u.id}
                      type="button"
                      // mousedown (not click) so it fires before the input blur
                      // hides the list.
                      onMouseDown={(e) => {
                        e.preventDefault();
                        void addEmail(u.email);
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 10px",
                        border: 0,
                        background: "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--ink)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {u.email}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          color: "var(--muted)",
                          marginTop: 1,
                        }}
                      >
                        {u.name}
                        {extraRoles.length > 0 ? ` · ${extraRoles.join(", ")}` : ""}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button type="submit" className="btn btn--primary" disabled={busy || !email.trim()}>
            Add
          </button>
        </form>
        {err && <div style={{ color: "var(--accent)", fontSize: 12, marginTop: 6 }}>{err}</div>}
      </div>

      {members.length === 0 ? (
        <div style={{ padding: "20px 18px", color: "var(--muted)", fontSize: 13 }}>
          No one yet.
        </div>
      ) : (
        members.map((u) => (
          <div
            key={u.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "11px 18px",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
                  color: "var(--ink)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {u.email}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: ".06em",
                  color: "var(--muted)",
                  marginTop: 1,
                }}
              >
                {u.googleLinked ? u.name : "not yet signed in"}
                {u.photoCount > 0 && ` · ${u.photoCount} photo${u.photoCount === 1 ? "" : "s"}`}
              </div>
            </div>
            <button
              className="btn btn--ghost btn--sm"
              disabled={busy}
              onClick={() => void onRemove(u.email)}
              style={{ color: "var(--accent)", flexShrink: 0 }}
            >
              Remove
            </button>
          </div>
        ))
      )}
    </div>
  );
}

/**
 * Default behavior when an upload's content hash collides with an existing
 * photo in the event. Persisted client-side (localStorage) and read by the
 * upload panel — see src/lib/uploadSettings.ts.
 */
function DuplicatePolicyPanel() {
  const [policy, setPolicy] = useState<DuplicatePolicy>("skip");
  useEffect(() => {
    setPolicy(getDuplicatePolicy());
  }, []);

  function choose(p: DuplicatePolicy) {
    setPolicy(p);
    setDuplicatePolicy(p);
  }

  const options: { value: DuplicatePolicy; label: string; desc: string }[] = [
    { value: "skip", label: "Skip", desc: "Leave the existing photo, drop the re-upload." },
    { value: "overwrite", label: "Overwrite", desc: "Replace the existing photo with the new one." },
  ];

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: "16px 18px",
        marginBottom: 22,
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1, minWidth: 220 }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          Duplicate uploads
        </div>
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: 18,
            color: "var(--ink)",
            marginTop: 2,
          }}
        >
          When the same photo is uploaded again
        </div>
      </div>
      <div
        role="radiogroup"
        aria-label="Duplicate upload policy"
        style={{
          display: "inline-flex",
          border: "1px solid var(--line)",
          borderRadius: 6,
          background: "var(--cream)",
          padding: 2,
        }}
      >
        {options.map((o) => {
          const active = policy === o.value;
          return (
            <button
              key={o.value}
              role="radio"
              aria-checked={active}
              title={o.desc}
              onClick={() => choose(o.value)}
              style={{
                padding: "7px 16px",
                border: 0,
                borderRadius: 4,
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                background: active ? "var(--surface)" : "transparent",
                color: active ? "var(--ink)" : "var(--muted)",
                boxShadow: active ? "var(--shadow)" : "none",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Owner-editable bundle price for the current event. Reads/writes
 * /api/admin/pricing (Event.bundlePriceCents). The price set here is what
 * checkout charges and the runner UI displays.
 */
function PricingPanel() {
  const [loading, setLoading] = useState(true);
  const [dollars, setDollars] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [save, setSave] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/pricing", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`pricing ${r.status}`))))
      .then((d: { priceDollars: number; isDefault: boolean }) => {
        if (cancelled) return;
        setDollars(d.priceDollars.toFixed(2));
        setIsDefault(d.isDefault);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSave() {
    const value = Number(dollars);
    if (!Number.isFinite(value) || value < 0) {
      setErr("Enter a valid dollar amount.");
      setSave("err");
      return;
    }
    setSave("saving");
    setErr(null);
    try {
      const r = await fetch("/api/admin/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceCents: Math.round(value * 100) }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `patch ${r.status}`);
      }
      const d = (await r.json()) as { priceDollars: number; isDefault: boolean };
      setDollars(d.priceDollars.toFixed(2));
      setIsDefault(d.isDefault);
      setSave("ok");
      setTimeout(() => setSave("idle"), 1600);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSave("err");
    }
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: "16px 18px",
        marginBottom: 22,
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1, minWidth: 220 }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          Bundle price · {currentEvent.name.join(" ")}
        </div>
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: 18,
            color: "var(--ink)",
            marginTop: 2,
          }}
        >
          What buyers pay for every photo from their race
          {isDefault && !loading && (
            <span style={{ color: "var(--muted)", fontSize: 13, marginLeft: 8 }}>
              (using default)
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--ink)" }}>$</span>
        <input
          className="input"
          inputMode="decimal"
          value={dollars}
          disabled={loading || save === "saving"}
          onChange={(e) => setDollars(e.target.value)}
          style={{ width: 110, padding: "8px 12px", fontSize: 16 }}
          aria-label="Bundle price in dollars"
        />
        <button className="btn btn--primary" onClick={onSave} disabled={loading || save === "saving"}>
          {save === "saving" ? "Saving…" : save === "ok" ? "✓ Saved" : "Save"}
        </button>
      </div>
      {err && (
        <div style={{ flexBasis: "100%", color: "var(--accent)", fontSize: 13 }}>{err}</div>
      )}
    </div>
  );
}
