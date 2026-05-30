"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Headline } from "@/components/runner/Headline";
import { currentEvent } from "@/lib/data";

type Role = "runner" | "photographer" | "race_director" | "owner";

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

// Roles the owner can grant. "runner" is always present (the baseline) so
// we don't surface it as a toggle — only the upgrades.
const GRANTABLE_ROLES: { role: Role; label: string; desc: string }[] = [
  { role: "photographer", label: "Photographer", desc: "Upload + manage their own photos" },
  { role: "race_director", label: "Race Director", desc: "Sees race-director dashboards (WIP)" },
  { role: "owner", label: "Owner", desc: "Full control — including user management" },
];

type SaveState = "idle" | "saving" | "ok" | "err";

export function UsersAdminClient() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});

  const load = useCallback(async () => {
    setLoading(true);
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

  async function setUserRoles(userId: string, nextRoles: Role[]) {
    setSaveState((s) => ({ ...s, [userId]: "saving" }));
    try {
      const r = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: nextRoles }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `patch ${r.status}`);
      }
      const d = (await r.json()) as { user: { id: string; roles: Role[] } };
      setUsers((curr) =>
        curr.map((u) => (u.id === userId ? { ...u, roles: d.user.roles } : u))
      );
      setSaveState((s) => ({ ...s, [userId]: "ok" }));
      setTimeout(() => setSaveState((s) => ({ ...s, [userId]: "idle" })), 1400);
    } catch (e) {
      console.error(e);
      setSaveState((s) => ({ ...s, [userId]: "err" }));
    }
  }

  function toggleRole(user: AdminUser, role: Role) {
    const hasIt = user.roles.includes(role);
    const next = hasIt
      ? user.roles.filter((r) => r !== role)
      : ([...user.roles, role] as Role[]);
    void setUserRoles(user.id, next);
  }

  const ownerCount = users.filter((u) => u.roles.includes("owner")).length;
  const photographerCount = users.filter((u) => u.roles.includes("photographer")).length;
  const rdCount = users.filter((u) => u.roles.includes("race_director")).length;

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
              text="Users + roles."
              accent="roles."
              style={{
                margin: 0,
                fontFamily: "var(--font-serif)",
                fontWeight: 500,
                fontSize: 36,
                letterSpacing: "-.015em",
              }}
            />
          </div>
          <Link href="/photographer" className="btn btn--ghost">
            ← Photographer dashboard
          </Link>
        </div>

        <PricingPanel />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 10,
            marginBottom: 22,
          }}
        >
          <Stat label="Total users" value={users.length.toString()} />
          <Stat label="Owners" value={ownerCount.toString()} />
          <Stat label="Photographers" value={photographerCount.toString()} />
          <Stat label="Race directors" value={rdCount.toString()} />
        </div>

        {loading ? (
          <p style={{ color: "var(--muted)" }}>Loading…</p>
        ) : users.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No users yet.</p>
        ) : (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(220px, 2fr) repeat(3, minmax(120px, 1fr)) 80px",
                padding: "10px 14px",
                background: "var(--cream)",
                borderBottom: "1px solid var(--line)",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "var(--muted)",
                alignItems: "center",
              }}
            >
              <span>User</span>
              {GRANTABLE_ROLES.map((r) => (
                <span key={r.role} title={r.desc}>
                  {r.label}
                </span>
              ))}
              <span style={{ textAlign: "right" }}>Photos</span>
            </div>

            {users.map((u) => {
              const ss = saveState[u.id] ?? "idle";
              return (
                <div
                  key={u.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(220px, 2fr) repeat(3, minmax(120px, 1fr)) 80px",
                    padding: "12px 14px",
                    borderBottom: "1px solid var(--line)",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 14,
                        color: "var(--ink)",
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      {u.name}
                      {u.isYou && (
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 9,
                            letterSpacing: ".12em",
                            textTransform: "uppercase",
                            background: "var(--accent)",
                            color: "var(--paper)",
                            padding: "2px 6px",
                            borderRadius: 3,
                          }}
                        >
                          You
                        </span>
                      )}
                      {ss === "saving" && <SaveBadge>saving…</SaveBadge>}
                      {ss === "ok" && <SaveBadge>✓ saved</SaveBadge>}
                      {ss === "err" && <SaveBadge tone="err">failed</SaveBadge>}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        letterSpacing: ".06em",
                        color: "var(--muted)",
                        marginTop: 2,
                      }}
                    >
                      {u.email}
                      {!u.googleLinked && " · not yet signed in"}
                    </div>
                  </div>

                  {GRANTABLE_ROLES.map((r) => {
                    const checked = u.roles.includes(r.role);
                    const isSelfOwner = u.isYou && r.role === "owner";
                    return (
                      <label
                        key={r.role}
                        title={isSelfOwner ? "Can't remove your own owner role" : r.desc}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          cursor: isSelfOwner ? "not-allowed" : "pointer",
                          opacity: isSelfOwner ? 0.6 : 1,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isSelfOwner || ss === "saving"}
                          onChange={() => toggleRole(u, r.role)}
                          style={{
                            accentColor: "var(--accent)",
                            width: 16,
                            height: 16,
                            cursor: isSelfOwner ? "not-allowed" : "pointer",
                          }}
                        />
                        <span
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: 12,
                            color: "var(--ink)",
                          }}
                        >
                          {r.label}
                        </span>
                      </label>
                    );
                  })}

                  <div
                    style={{
                      textAlign: "right",
                      fontFamily: "var(--font-mono)",
                      fontSize: 13,
                      color: "var(--ink)",
                    }}
                  >
                    {u.photoCount}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div
          style={{
            marginTop: 14,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          Every user has the runner baseline — these toggles grant the extras.
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 8,
        padding: "10px 12px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 500,
          fontSize: 22,
          color: "var(--ink)",
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SaveBadge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "err";
}) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        letterSpacing: ".1em",
        textTransform: "uppercase",
        color: tone === "err" ? "var(--accent)" : "var(--muted)",
      }}
    >
      {children}
    </span>
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
