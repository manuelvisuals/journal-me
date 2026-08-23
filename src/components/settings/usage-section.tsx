"use client";

/**
 * "AI di questo mese" (richiesta di Manuel, 19 ago 2026): la barra di
 * progresso della quota mensile inclusa nell'abbonamento, come la barra
 * di utilizzo di Claude. I numeri vengono da /api/usage (token UFFICIALI
 * loggati da ogni chiamata OpenAI); la quota per tier sta in plan_limits
 * e la modifichera la pagina admin (solo master).
 *
 * Due punti di montaggio, stessa card: sul telefono dentro il pannello
 * radice di Impostazioni (UsageSection, dentro un SetGroup), su desktop
 * nella rail destra insieme all'account (UsageCard da sola), perche
 * Manuel l'ha chiesta "nell'account stesso".
 *
 * Solo cloud: in locale l'AI non esiste e la sezione non si monta.
 * Se la chiamata fallisce (rete, 401) la sezione sparisce in silenzio:
 * mai un errore rosso per un widget informativo.
 */

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { useStorageMode } from "@/lib/data/store";
import { useT } from "@/lib/i18n";
import { SetGroup } from "@/components/settings/rows";

type Usage = {
  totalTokens: number;
  totalUsd: number;
  allowanceUsd: number | null;
  pct: number | null;
};

function useAiUsage(): Usage | null {
  const mode = useStorageMode();
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    if (mode !== "cloud") return;
    let alive = true;
    void (async () => {
      try {
        const resp = await apiFetch("/api/usage", { method: "GET" });
        if (!resp.ok) return;
        const data = (await resp.json()) as Usage;
        if (alive) setUsage(data);
      } catch {
        // silenzio: widget informativo
      }
    })();
    return () => {
      alive = false;
    };
  }, [mode]);

  return mode === "cloud" ? usage : null;
}

/**
 * La card nuda, per la rail destra su desktop. `plain` la spoglia di
 * sfondo e bordo, per quando vive gia dentro una jm-st-box.
 */
export function UsageCard({ plain = false }: { plain?: boolean }) {
  const t = useT();
  const usage = useAiUsage();
  if (!usage) return null;

  const pct = usage.pct ?? 0;
  const width = Math.max(0, Math.min(100, pct));
  const warn = pct >= 90;

  return (
    <div className={`jm-usage${plain ? " plain" : ""}`}>
      <div className="jm-usage-top">
        <span className="jm-usage-t">
          {plain ? t("Quota inclusa nell'abbonamento") : t("AI di questo mese")}
        </span>
        <span className="jm-usage-pct" suppressHydrationWarning>
          {usage.pct !== null ? `${formatNumber(pct)}%` : "—"}
        </span>
      </div>
      <div
        className="jm-usage-bar"
        role="progressbar"
        aria-valuenow={width}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`jm-usage-fill${warn ? " warn" : ""}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="jm-usage-sub" suppressHydrationWarning>
        {t("{n} token usati questo mese. La quota si azzera il primo del mese.", {
          n: formatNumber(usage.totalTokens),
        })}
      </div>
    </div>
  );
}

/** La stessa card dentro un gruppo di Impostazioni, per il telefono. */
export function UsageSection() {
  const t = useT();
  const usage = useAiUsage();
  if (!usage) return null;

  return (
    <SetGroup label={t("AI di questo mese")}>
      <UsageCard plain />
    </SetGroup>
  );
}
