"use client";

import { useState } from "react";
import { Headline } from "@/components/runner/Headline";
import { clearRunnerState, useDevSettings } from "@/lib/devSettings";

export function DevPanel() {
  const [s, update] = useDevSettings();
  const [msg, setMsg] = useState("");

  return (
    <main className="screen" style={{ padding: "48px 32px 96px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "var(--muted)",
            marginBottom: 8,
          }}
        >
          Internal
        </div>
        <Headline
          as="h1"
          text="Dev panel"
          accent="panel"
          style={{
            margin: "0 0 32px",
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: 44,
            letterSpacing: "-.015em",
          }}
        />

        <Section title="Display">
          <Toggle
            label="Show dev banner on every page"
            value={s.showBanner}
            onChange={(v) => update({ showBanner: v })}
          />
        </Section>

        <Section title="Roles you act as (Phase 2+ surfaces)">
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
            These don&rsquo;t do anything yet beyond labeling the dev banner. They&rsquo;ll start gating routes in Phase 2 (auth + account view).
          </p>
          {(["runner", "photographer", "race_director", "admin"] as const).map((r) => (
            <Toggle
              key={r}
              label={r.replace("_", " ")}
              value={s.asRoles[r]}
              onChange={(v) => update({ asRoles: { ...s.asRoles, [r]: v } })}
            />
          ))}
        </Section>

        <Section title="Data controls">
          <button
            className="btn btn--ghost"
            onClick={() => {
              clearRunnerState();
              setMsg("Cleared runner state. Reload to see a fresh session.");
            }}
          >
            Clear cart / search / order state
          </button>
          {msg && (
            <div style={{ marginTop: 12, color: "var(--green)", fontSize: 13 }}>{msg}</div>
          )}
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2
        style={{
          margin: "0 0 14px",
          fontFamily: "var(--font-serif)",
          fontWeight: 500,
          fontSize: 22,
          color: "var(--ink)",
        }}
      >
        {title}
      </h2>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 10,
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {children}
      </div>
    </section>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        cursor: "pointer",
      }}
    >
      <span style={{ textTransform: "capitalize", fontSize: 14, color: "var(--ink)" }}>
        {label}
      </span>
      <span
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        style={{
          width: 40,
          height: 22,
          background: value ? "var(--accent)" : "var(--cream)",
          border: "1px solid var(--line)",
          borderRadius: 11,
          position: "relative",
          transition: "background var(--dur-hover) var(--ease)",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 1,
            left: value ? 19 : 1,
            width: 18,
            height: 18,
            background: "#fff",
            borderRadius: "50%",
            boxShadow: "0 1px 2px rgba(0,0,0,.12)",
            transition: "left var(--dur-hover) var(--ease)",
          }}
        />
      </span>
    </label>
  );
}
