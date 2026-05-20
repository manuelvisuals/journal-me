"use client";

import { useState } from "react";
import { formatDecimal, formatSleep } from "@/lib/format";
import type { EntryMetrics, Mood } from "@/lib/types";

type Props = {
  metrics: EntryMetrics | null;
  onChange: (patch: Partial<EntryMetrics>) => void;
};

type EditMode = "none" | "weight" | "sleep" | "mood";

const MOOD_OPTIONS: { value: Mood; emoji: string }[] = [
  { value: "great", emoji: "\u{1F60A}" },
  { value: "good", emoji: "\u{1F642}" },
  { value: "neutral", emoji: "\u{1F610}" },
  { value: "low", emoji: "\u{1F614}" },
  { value: "bad", emoji: "\u{1F641}" },
];

function moodEmoji(m: Mood | null): string {
  if (!m) return "—"; // em-dash placeholder
  return MOOD_OPTIONS.find((o) => o.value === m)?.emoji ?? "—";
}

export function MetricCards({ metrics, onChange }: Props) {
  const [edit, setEdit] = useState<EditMode>("none");

  return (
    <div
      className="flex items-center justify-between"
      style={{ padding: "14px 0", gap: 8 }}
    >
      {edit === "weight" ? (
        <WeightEditor
          value={metrics?.weightKg ?? null}
          onCommit={(v) => {
            onChange({ weightKg: v });
            setEdit("none");
          }}
          onCancel={() => setEdit("none")}
        />
      ) : (
        <WeightDisplay
          value={metrics?.weightKg ?? null}
          onOpen={() => setEdit("weight")}
        />
      )}

      {edit === "sleep" ? (
        <SleepEditor
          value={metrics?.sleepHours ?? null}
          onCommit={(v) => {
            onChange({ sleepHours: v });
            setEdit("none");
          }}
          onCancel={() => setEdit("none")}
        />
      ) : (
        <SleepDisplay
          value={metrics?.sleepHours ?? null}
          onOpen={() => setEdit("sleep")}
        />
      )}

      {edit === "mood" ? (
        <MoodEditor
          value={metrics?.mood ?? null}
          onPick={(m) => {
            onChange({ mood: m });
            setEdit("none");
          }}
        />
      ) : (
        <MoodDisplay
          value={metrics?.mood ?? null}
          onOpen={() => setEdit("mood")}
        />
      )}
    </div>
  );
}

function CardShell({
  editing,
  children,
  onClick,
}: {
  editing: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : -1}
      onClick={onClick}
      className={`jm-metric ${editing ? "editing" : ""}`}
    >
      {children}
    </div>
  );
}

const unitStyle: React.CSSProperties = {
  fontSize: 10,
  color: "var(--color-ink-faint)",
  fontWeight: 500,
};
const labelStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 600,
  color: "var(--color-ink-faint)",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  marginTop: 5,
};
const valueStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  color: "var(--color-ink)",
  letterSpacing: "-0.01em",
  lineHeight: 1,
};

/* Weight */
function WeightDisplay({
  value,
  onOpen,
}: {
  value: number | null;
  onOpen: () => void;
}) {
  return (
    <CardShell editing={false} onClick={onOpen}>
      <div style={valueStyle}>
        {value != null ? formatDecimal(value, 1) : "—"}
        <span style={unitStyle}> kg</span>
      </div>
      <div style={labelStyle}>peso</div>
    </CardShell>
  );
}

function WeightEditor({
  value,
  onCommit,
  onCancel,
}: {
  value: number | null;
  onCommit: (v: number | null) => void;
  onCancel: () => void;
}) {
  // Initial state from props, set once. Editor is unmounted when not editing,
  // so this re-initializes naturally each time it opens.
  const [text, setText] = useState<string>(
    value != null ? formatDecimal(value, 1) : "",
  );

  const commit = (raw: string) => {
    const trimmed = raw.trim().replace(",", ".");
    if (trimmed === "") {
      onCommit(null);
      return;
    }
    const n = parseFloat(trimmed);
    if (Number.isFinite(n) && n >= 20 && n <= 300) {
      onCommit(Math.round(n * 10) / 10);
    } else {
      onCancel();
    }
  };

  const step = (delta: number) => {
    const trimmed = text.trim().replace(",", ".");
    const base = parseFloat(trimmed);
    const start = Number.isFinite(base) ? base : value ?? 78;
    const next = Math.max(20, Math.min(300, Math.round((start + delta) * 10) / 10));
    setText(formatDecimal(next, 1));
  };

  return (
    <CardShell editing>
      <input
        autoFocus
        type="text"
        inputMode="decimal"
        className="jm-metric-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => commit(text)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(text);
          else if (e.key === "Escape") onCancel();
        }}
        size={5}
        aria-label="Peso in kg"
      />
      <div className="jm-stepper">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            step(-0.1);
          }}
          aria-label="Meno"
        >
          &minus;
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            step(+0.1);
          }}
          aria-label="Piu"
        >
          +
        </button>
      </div>
      <div style={labelStyle}>peso kg</div>
    </CardShell>
  );
}

/* Sleep */
function SleepDisplay({
  value,
  onOpen,
}: {
  value: number | null;
  onOpen: () => void;
}) {
  return (
    <CardShell editing={false} onClick={onOpen}>
      <div style={valueStyle}>{value != null ? formatSleep(value) : "—"}</div>
      <div style={labelStyle}>sonno</div>
    </CardShell>
  );
}

function SleepEditor({
  value,
  onCommit,
  onCancel,
}: {
  value: number | null;
  onCommit: (v: number | null) => void;
  onCancel: () => void;
}) {
  const initH = value != null ? Math.floor(value) : 7;
  const initM = value != null ? Math.round((value - Math.floor(value)) * 60) : 0;
  const [h, setH] = useState<string>(String(initH));
  const [m, setM] = useState<string>(String(initM).padStart(2, "0"));

  const commit = () => {
    if (h.trim() === "" && m.trim() === "") {
      onCommit(null);
      return;
    }
    const hh = Math.max(0, Math.min(23, parseInt(h, 10) || 0));
    const mm = Math.max(0, Math.min(59, parseInt(m, 10) || 0));
    onCommit(hh + mm / 60);
  };

  return (
    <CardShell editing>
      <div className="jm-sleep-inputs">
        <input
          autoFocus
          type="text"
          inputMode="numeric"
          value={h}
          onChange={(e) => setH(e.target.value.replace(/\D/g, "").slice(0, 2))}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            else if (e.key === "Escape") onCancel();
          }}
          aria-label="Ore di sonno"
        />
        <span className="sep">h</span>
        <input
          type="text"
          inputMode="numeric"
          value={m}
          onChange={(e) => setM(e.target.value.replace(/\D/g, "").slice(0, 2))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            else if (e.key === "Escape") onCancel();
          }}
          aria-label="Minuti di sonno"
        />
      </div>
      <div style={labelStyle}>sonno</div>
    </CardShell>
  );
}

/* Mood */
function MoodDisplay({
  value,
  onOpen,
}: {
  value: Mood | null;
  onOpen: () => void;
}) {
  return (
    <CardShell editing={false} onClick={onOpen}>
      <div style={{ fontSize: 22, lineHeight: 1 }}>{moodEmoji(value)}</div>
      <div style={labelStyle}>mood</div>
    </CardShell>
  );
}

function MoodEditor({
  value,
  onPick,
}: {
  value: Mood | null;
  onPick: (m: Mood) => void;
}) {
  return (
    <CardShell editing>
      <div className="jm-mood-picker">
        {MOOD_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onPick(o.value)}
            className={value === o.value ? "opt on" : "opt"}
            aria-label={`Mood ${o.value}`}
          >
            {o.emoji}
          </button>
        ))}
      </div>
      <div style={labelStyle}>mood</div>
    </CardShell>
  );
}
