"use client";

import { formatDecimal } from "@/lib/format";
import type { AreaSummary } from "@/lib/types";

type Props = {
  /** Optional: override headline/snippet with real entry data. */
  headline?: string | null;
  snippet?: string | null;
  /** Macro-area summaries from AI. If empty/undefined, fake placeholders are used. */
  areas?: AreaSummary[];
};

// MVP: hard-coded mockup-like fake data for areas / metrics / dots.
// Will be swapped for real AI-generated content + persisted metrics later.

const FAKE_AREAS: AreaSummary[] = [
  {
    label: "Lavoro",
    text: "Deck per Marco chiuso a meta pomeriggio. Call Sara spostata a giovedi.",
  },
  {
    label: "Relazioni",
    text: "Discussione con Giulia sul weekend. Riappacificato a cena.",
  },
  {
    label: "Corpo",
    text: "8 km al tramonto, fiato buono. Cena leggera.",
  },
];

const FAKE_METRICS = {
  weightKg: 78.2,
  sleepText: "7h 12",
  moodEmoji: "\u{1F610}", // neutral face
};

const FAKE_DOTS: { label: string; on: boolean }[] = [
  { label: "scopato", on: true },
  { label: "no alcol", on: true },
  { label: "no junkfood", on: true },
  { label: "no sbirciato ex", on: false },
  { label: "camminato", on: true },
  { label: "visto sunset", on: true },
];

const FAKE_HEADLINE = "Giornata di transizione: lavoro avanza, umore vacilla";
const FAKE_SNIPPET =
  "Deck Marco chiuso. Lite con Giulia. Corsa al tramonto rimette in pari.";

export function FilledView({ headline, snippet, areas }: Props) {
  const displayHeadline = headline ?? FAKE_HEADLINE;
  const displaySnippet = snippet ?? FAKE_SNIPPET;
  const displayAreas =
    areas && areas.length > 0 ? areas : FAKE_AREAS;

  return (
    <div className="flex flex-1 flex-col" style={{ padding: "0 24px" }}>
      {/* Headline + snippet */}
      <h1
        style={{
          fontSize: 26,
          fontWeight: 650,
          lineHeight: 1.15,
          letterSpacing: "-0.025em",
          color: "var(--color-ink)",
          margin: "4px 0 10px",
        }}
      >
        {displayHeadline}
      </h1>
      <p
        style={{
          fontSize: 14,
          fontWeight: 400,
          color: "var(--color-ink-muted)",
          lineHeight: 1.55,
          marginBottom: 18,
        }}
      >
        {displaySnippet}
      </p>

      <Separator />

      {/* Macro areas */}
      {displayAreas.map((area) => (
        <div key={area.label} style={{ padding: "14px 0" }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 650,
              color: "var(--color-accent)",
              letterSpacing: "0.20em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            {area.label}
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--color-ink)",
              lineHeight: 1.55,
            }}
          >
            {area.text}
          </div>
        </div>
      ))}

      <Separator />

      {/* Metrics */}
      <div
        className="flex items-center justify-between"
        style={{ padding: "14px 0", gap: 8 }}
      >
        <MetricCard
          value={
            <>
              {formatDecimal(FAKE_METRICS.weightKg, 1)}
              <span style={unitStyle}> kg</span>
            </>
          }
          label="peso"
        />
        <MetricCard value={FAKE_METRICS.sleepText} label="sonno" />
        <MetricCard
          value={
            <span style={{ fontSize: 22, lineHeight: 1 }}>
              {FAKE_METRICS.moodEmoji}
            </span>
          }
          label="mood"
        />
      </div>

      {/* Goal dots */}
      <div
        className="flex items-center justify-center"
        style={{ gap: 9, padding: "14px 0 6px" }}
      >
        {FAKE_DOTS.map((dot) => (
          <span
            key={dot.label}
            title={dot.label}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: dot.on
                ? "var(--color-accent)"
                : "rgba(255,255,255,0.10)",
              border: dot.on
                ? "1px solid rgba(227,161,95,0.55)"
                : "1px solid rgba(255,255,255,0.06)",
              boxShadow: dot.on ? "0 0 8px rgba(227,161,95,0.40)" : "none",
              display: "inline-block",
            }}
          />
        ))}
      </div>
    </div>
  );
}

const unitStyle: React.CSSProperties = {
  fontSize: 10,
  color: "var(--color-ink-faint)",
  fontWeight: 500,
};

function Separator() {
  return (
    <div
      style={{
        height: 1,
        background: "var(--color-line)",
        margin: "4px 0",
      }}
    />
  );
}

function MetricCard({
  value,
  label,
}: {
  value: React.ReactNode;
  label: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        textAlign: "center",
        background: "var(--color-surface)",
        border: "1px solid var(--color-line)",
        borderRadius: 12,
        padding: "10px 6px",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.03), 0 8px 16px rgba(0,0,0,0.30)",
      }}
    >
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: "var(--color-ink)",
          letterSpacing: "-0.01em",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: "var(--color-ink-faint)",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          marginTop: 5,
        }}
      >
        {label}
      </div>
    </div>
  );
}
