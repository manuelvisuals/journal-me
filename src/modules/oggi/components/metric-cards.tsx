"use client";

import { useState } from "react";
import { formatDecimal, formatSleep } from "@/lib/format";
import type { EntryMetrics, Mood } from "@/lib/types";
import { useT } from "@/lib/i18n";
import {
  FoglioMetrica,
  MOOD_VOCI,
  type MisuraFoglio,
} from "@/modules/oggi/components/foglio-metrica";

type Props = {
  metrics: EntryMetrics | null;
  onChange: (patch: Partial<EntryMetrics>) => void;
  /** La giornata: il foglio del peso cerca l'ultimo peso prima di lei. */
  dateISO: string;
};

/**
 * Le tre schede: peso, sonno, mood.
 *
 * DAL 10 SETTEMBRE 2026 UN TOCCO APRE IL FOGLIO CON LE RUOTE
 * (foglio-metrica.tsx), non piu un campo di testo con la tastiera sotto.
 * Richiesta di Manuel: "si clicca e si apre qualcosa per selezionare
 * scrollando su e giu, come il timer di iPhone, senza tastiera". Le
 * schede restano quelle: cambiano solo cio che succede al tocco.
 */
function moodEmoji(m: Mood | null): string {
  if (!m) return "—";
  return MOOD_VOCI.find((o) => o.value === m)?.emoji ?? "—";
}

export function MetricCards({ metrics, onChange, dateISO }: Props) {
  const t = useT();
  const [foglio, setFoglio] = useState<MisuraFoglio | null>(null);

  return (
    <div
      className="flex items-center justify-between"
      style={{ padding: "14px 0", gap: 8 }}
    >
      <Scheda
        etichetta={t("peso")}
        onOpen={() => setFoglio({ tipo: "peso", valore: metrics?.weightKg ?? null })}
      >
        <div style={valueStyle}>
          {metrics?.weightKg != null ? formatDecimal(metrics.weightKg, 1) : "—"}
          <span style={unitStyle}> kg</span>
        </div>
      </Scheda>

      <Scheda
        etichetta={t("sonno")}
        onOpen={() => setFoglio({ tipo: "sonno", valore: metrics?.sleepHours ?? null })}
      >
        <div style={valueStyle}>
          {metrics?.sleepHours != null ? formatSleep(metrics.sleepHours) : "—"}
        </div>
      </Scheda>

      <Scheda
        etichetta={t("mood")}
        onOpen={() => setFoglio({ tipo: "mood", valore: metrics?.mood ?? null })}
      >
        <div style={{ fontSize: "calc(22px * var(--jm-ui-scale))", lineHeight: 1 }}>
          {moodEmoji(metrics?.mood ?? null)}
        </div>
      </Scheda>

      {foglio && (
        <FoglioMetrica
          misura={foglio}
          dateISO={dateISO}
          onClose={() => setFoglio(null)}
          onCommit={(v) => {
            if (foglio.tipo === "peso") onChange({ weightKg: v as number | null });
            else if (foglio.tipo === "sonno") onChange({ sleepHours: v as number | null });
            else onChange({ mood: v as Mood | null });
            setFoglio(null);
          }}
        />
      )}
    </div>
  );
}

function Scheda({
  etichetta,
  onOpen,
  children,
}: {
  etichetta: string;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="jm-metric"
    >
      {children}
      <div style={labelStyle}>{etichetta}</div>
    </div>
  );
}

const unitStyle: React.CSSProperties = {
  fontSize: "calc(10px * var(--jm-ui-scale))",
  color: "var(--color-ink-faint)",
  fontWeight: 500,
};
const labelStyle: React.CSSProperties = {
  fontSize: "calc(9px * var(--jm-ui-scale))",
  fontWeight: 600,
  color: "var(--color-ink-faint)",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  marginTop: 5,
};
const valueStyle: React.CSSProperties = {
  fontSize: "calc(18px * var(--jm-ui-scale))",
  fontWeight: 600,
  color: "var(--color-ink)",
  letterSpacing: "-0.01em",
  lineHeight: 1,
};
