"use client";

/**
 * Le metriche della giornata dentro la rail destra del desktop.
 *
 * Perche un componente a parte e non `MetricCards`: quello e fatto di tre
 * card affiancate e vuole i 390px del telefono. Nella rail ne ha 256, e
 * appena si apriva l'editor del mood (che ne chiede 170) le altre due si
 * schiacciavano a 45 e 55px e la card usciva 31px FUORI dalla rail —
 * misurato a 1728px il 20 agosto 2026.
 *
 * Qui una riga per metrica, e l'editor si apre SOTTO a tutta larghezza:
 * non c'e nessuna larghezza che possa mancare, quindi non c'e niente che
 * possa sbordare, a nessuna dimensione di finestra. Ogni bersaglio e
 * almeno 44px (brandbook cap. 05).
 *
 * Sul telefono non cambia niente: FilledView continua a usare MetricCards.
 */

import { useState } from "react";
import { formatDecimal, formatSleep } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { EntryMetrics, Mood } from "@/lib/types";

type Props = {
  metrics: EntryMetrics | null;
  onChange: (patch: Partial<EntryMetrics>) => void;
};

type Open = "none" | "weight" | "sleep" | "mood";

const MOOD_OPTIONS: { value: Mood; emoji: string; label: string }[] = [
  { value: "great", emoji: "\u{1F60A}", label: "molto bene" },
  { value: "good", emoji: "\u{1F642}", label: "bene" },
  { value: "neutral", emoji: "\u{1F610}", label: "cosi cosi" },
  { value: "low", emoji: "\u{1F614}", label: "giu" },
  { value: "bad", emoji: "\u{1F641}", label: "male" },
];

export function RailMetrics({ metrics, onChange }: Props) {
  const t = useT();
  const [open, setOpen] = useState<Open>("none");
  const toggle = (k: Open) => setOpen((cur) => (cur === k ? "none" : k));

  return (
    <div className="jm-rm">
      <MetricRow
        k={t("Peso")}
        open={open === "weight"}
        onToggle={() => toggle("weight")}
        value={
          metrics?.weightKg != null ? (
            <>
              {formatDecimal(metrics.weightKg, 1)}
              <small>kg</small>
            </>
          ) : null
        }
      >
        <WeightEditor
          value={metrics?.weightKg ?? null}
          onCommit={(v) => {
            onChange({ weightKg: v });
            setOpen("none");
          }}
        />
      </MetricRow>

      <MetricRow
        k={t("Sonno")}
        open={open === "sleep"}
        onToggle={() => toggle("sleep")}
        value={
          metrics?.sleepHours != null ? <>{formatSleep(metrics.sleepHours)}</> : null
        }
      >
        <SleepEditor
          value={metrics?.sleepHours ?? null}
          onCommit={(v) => {
            onChange({ sleepHours: v });
            setOpen("none");
          }}
        />
      </MetricRow>

      <MetricRow
        k={t("Mood")}
        open={open === "mood"}
        onToggle={() => toggle("mood")}
        value={
          metrics?.mood ? (
            <span className="jm-rm-face">
              {MOOD_OPTIONS.find((o) => o.value === metrics.mood)?.emoji}
            </span>
          ) : null
        }
      >
        <div className="jm-rm-moods">
          {MOOD_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={metrics?.mood === o.value ? "on" : undefined}
              aria-label={t(o.label)}
              aria-pressed={metrics?.mood === o.value}
              onClick={() => {
                onChange({ mood: o.value });
                setOpen("none");
              }}
            >
              {o.emoji}
            </button>
          ))}
        </div>
      </MetricRow>
    </div>
  );
}

function MetricRow({
  k,
  value,
  open,
  onToggle,
  children,
}: {
  k: string;
  value: React.ReactNode | null;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className={open ? "jm-rm-block open" : "jm-rm-block"}>
      <button
        type="button"
        className="jm-rm-row"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="jm-rm-k">{k}</span>
        <span className={value ? "jm-rm-v" : "jm-rm-v empty"}>
          {value ?? t("non segnato")}
        </span>
      </button>
      {open && <div className="jm-rm-edit">{children}</div>}
    </div>
  );
}

/* ----------------- peso ----------------- */

function WeightEditor({
  value,
  onCommit,
}: {
  value: number | null;
  onCommit: (v: number | null) => void;
}) {
  const [text, setText] = useState<string>(
    value != null ? formatDecimal(value, 1) : "",
  );

  const parse = (raw: string): number | null => {
    const t = raw.trim().replace(",", ".");
    if (t === "") return null;
    const n = parseFloat(t);
    return Number.isFinite(n) && n >= 20 && n <= 300
      ? Math.round(n * 10) / 10
      : null;
  };

  const step = (delta: number) => {
    const base = parse(text);
    const start = base ?? value ?? 70;
    const next = Math.max(20, Math.min(300, Math.round((start + delta) * 10) / 10));
    setText(formatDecimal(next, 1));
  };

  const t = useT();
  return (
    <div className="jm-rm-stepper">
      <button type="button" aria-label={t("Meno")} onClick={() => step(-0.1)}>
        &minus;
      </button>
      <input
        autoFocus
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommit(parse(text));
        }}
        aria-label={t("Peso in kg")}
      />
      <button type="button" aria-label={t("Piu")} onClick={() => step(0.1)}>
        +
      </button>
      <button
        type="button"
        className="jm-rm-ok"
        onClick={() => onCommit(parse(text))}
      >
        {t("ok")}
      </button>
    </div>
  );
}

/* ----------------- sonno ----------------- */

function SleepEditor({
  value,
  onCommit,
}: {
  value: number | null;
  onCommit: (v: number | null) => void;
}) {
  const [h, setH] = useState<string>(
    value != null ? String(Math.floor(value)) : "",
  );
  const [m, setM] = useState<string>(
    value != null
      ? String(Math.round((value - Math.floor(value)) * 60)).padStart(2, "0")
      : "",
  );

  const commit = () => {
    if (h.trim() === "" && m.trim() === "") {
      onCommit(null);
      return;
    }
    const hh = Math.max(0, Math.min(23, parseInt(h, 10) || 0));
    const mm = Math.max(0, Math.min(59, parseInt(m, 10) || 0));
    onCommit(hh + mm / 60);
  };

  const t = useT();
  return (
    <div className="jm-rm-stepper">
      <input
        autoFocus
        type="text"
        inputMode="numeric"
        value={h}
        placeholder="7"
        onChange={(e) => setH(e.target.value.replace(/\D/g, "").slice(0, 2))}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        aria-label={t("Ore di sonno")}
      />
      <span className="jm-rm-sep">h</span>
      <input
        type="text"
        inputMode="numeric"
        value={m}
        placeholder="30"
        onChange={(e) => setM(e.target.value.replace(/\D/g, "").slice(0, 2))}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        aria-label={t("Minuti di sonno")}
      />
      <button type="button" className="jm-rm-ok" onClick={commit}>
        {t("ok")}
      </button>
    </div>
  );
}
