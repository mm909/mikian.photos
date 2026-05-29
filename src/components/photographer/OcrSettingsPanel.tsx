"use client";

import {
  OEM_OPTIONS,
  PROVIDER_OPTIONS,
  PSM_OPTIONS,
  type OcrSettings,
  type OemKey,
  type ProviderKey,
  type PsmKey,
} from "@/lib/bibOcrTypes";

/**
 * OCR tuning controls — the owner-facing knobs that used to live only in the
 * standalone OCR Lab. Now rendered inside the library detail modal's OCR-debug
 * section so detection tuning and the photo it acts on live on one surface.
 *
 * Pure controlled component: parent owns the `settings` object and applies
 * each change via `onPatch`. `onReset` / the copy-JSON button are small
 * conveniences carried over from the lab.
 */
export function OcrSettingsPanel({
  settings,
  onPatch,
  onReset,
}: {
  settings: OcrSettings;
  onPatch: <K extends keyof OcrSettings>(key: K, value: OcrSettings[K]) => void;
  onReset: () => void;
}) {
  const settingsJson = JSON.stringify(settings, null, 2);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Box title="Provider">
        <Field label="OCR backend">
          <Select
            value={settings.provider}
            onChange={(v) => onPatch("provider", v as ProviderKey)}
            options={Object.entries(PROVIDER_OPTIONS).map(([k, label]) => ({
              value: k,
              label,
            }))}
          />
        </Field>
      </Box>

      {settings.provider === "tesseract" && (
        <Box title="Tesseract">
          <Field label="PSM (page seg)">
            <Select
              value={settings.psm}
              onChange={(v) => onPatch("psm", v as PsmKey)}
              options={Object.entries(PSM_OPTIONS).map(([k, label]) => ({
                value: k,
                label: `${k} — ${label}`,
              }))}
            />
          </Field>
          <Field label="OEM (engine)">
            <Select
              value={settings.oem}
              onChange={(v) => onPatch("oem", v as OemKey)}
              options={Object.entries(OEM_OPTIONS).map(([k, label]) => ({
                value: k,
                label: `${k} — ${label}`,
              }))}
            />
          </Field>
          <Toggle
            label="Whitelist digits only"
            value={settings.whitelistDigits}
            onChange={(v) => onPatch("whitelistDigits", v)}
          />
        </Box>
      )}

      <Box title="Preprocessing">
        <Field label={`Prep width: ${settings.prepWidth}px`}>
          <Slider
            min={1200}
            max={4500}
            step={100}
            value={settings.prepWidth}
            onChange={(v) => onPatch("prepWidth", v)}
          />
        </Field>
        {settings.provider === "tesseract" ? (
          <>
            <Toggle
              label="Sharpen"
              value={settings.sharpen}
              onChange={(v) => onPatch("sharpen", v)}
            />
            <Toggle
              label="Normalize (histogram stretch)"
              value={settings.normalize}
              onChange={(v) => onPatch("normalize", v)}
            />
            <Field
              label={`Contrast linear(a=${settings.contrastA}, b=${settings.contrastB})`}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <NumberInput
                  value={settings.contrastA}
                  step={0.05}
                  min={0.5}
                  max={2.5}
                  onChange={(v) => onPatch("contrastA", v)}
                />
                <NumberInput
                  value={settings.contrastB}
                  step={2}
                  min={-60}
                  max={60}
                  onChange={(v) => onPatch("contrastB", v)}
                />
              </div>
            </Field>
            <Field
              label={
                settings.threshold == null
                  ? "Threshold (binarize): off"
                  : `Threshold (binarize): ${settings.threshold}`
              }
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Slider
                  min={0}
                  max={255}
                  step={1}
                  value={settings.threshold ?? 128}
                  onChange={(v) => onPatch("threshold", v)}
                  disabled={settings.threshold == null}
                />
                <Toggle
                  label="on"
                  inline
                  value={settings.threshold != null}
                  onChange={(v) => onPatch("threshold", v ? 128 : null)}
                />
              </div>
            </Field>
            <Toggle
              label="Invert (negate)"
              value={settings.invert}
              onChange={(v) => onPatch("invert", v)}
            />
          </>
        ) : (
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 11,
              color: "var(--muted)",
              lineHeight: 1.4,
            }}
          >
            Rekognition is trained on real-world photos — sharpen / contrast /
            threshold / invert are not applied. Only prep width (byte-size cap)
            has effect.
          </div>
        )}
      </Box>

      <Box title="Bib filter">
        <Field label={`Min digits: ${settings.minDigits}`}>
          <Slider
            min={1}
            max={5}
            step={1}
            value={settings.minDigits}
            onChange={(v) => onPatch("minDigits", v)}
          />
        </Field>
        <Field label={`Max digits: ${settings.maxDigits}`}>
          <Slider
            min={3}
            max={7}
            step={1}
            value={settings.maxDigits}
            onChange={(v) => onPatch("maxDigits", v)}
          />
        </Field>
        <Field label={`Floor 1-digit: ${(settings.floor1 * 100).toFixed(0)}%`}>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={settings.floor1}
            onChange={(v) => onPatch("floor1", v)}
          />
        </Field>
        <Field label={`Floor 2-digit: ${(settings.floor2 * 100).toFixed(0)}%`}>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={settings.floor2}
            onChange={(v) => onPatch("floor2", v)}
          />
        </Field>
        <Field label={`Floor 3-digit: ${(settings.floor3 * 100).toFixed(0)}%`}>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={settings.floor3}
            onChange={(v) => onPatch("floor3", v)}
          />
        </Field>
        <Field label={`Floor 4-5 digit: ${(settings.floor4plus * 100).toFixed(0)}%`}>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={settings.floor4plus}
            onChange={(v) => onPatch("floor4plus", v)}
          />
        </Field>
      </Box>

      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn--ghost btn--sm" onClick={onReset} style={{ flex: 1 }}>
          Reset to defaults
        </button>
        <button
          className="btn btn--ghost btn--sm"
          onClick={() => navigator.clipboard?.writeText(settingsJson)}
          style={{ flex: 1 }}
        >
          Copy settings JSON
        </button>
      </div>
    </div>
  );
}

/* --------------------------- control primitives --------------------------- */

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 8,
        padding: 12,
        background: "var(--surface)",
      }}
    >
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
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: "var(--muted)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function Slider({
  min,
  max,
  step,
  value,
  onChange,
  disabled,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ width: "100%", opacity: disabled ? 0.5 : 1 }}
    />
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
      className="input"
      style={{ padding: "6px 8px", fontSize: 13, width: "100%" }}
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input"
      style={{ width: "100%", padding: "6px 8px", fontSize: 13 }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Toggle({
  label,
  value,
  onChange,
  inline,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  inline?: boolean;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: inline ? 11 : 13,
        color: "var(--ink)",
      }}
    >
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        style={{ cursor: "pointer" }}
      />
      {label}
    </label>
  );
}
