"use client";

/**
 * "AI di questo mese" (richiesta di Manuel, 19 ago 2026): la barra di
 * progresso della quota mensile inclusa nell'abbonamento, come la barra
 * di utilizzo di Claude. I numeri vengono da /api/usage (token UFFICIALI
 * loggati da ogni chiamata OpenAI); la quota per tier sta in plan_limits
 * e la modifichera la pagina admin (solo master).
 *
 * Solo cloud: in locale l'AI non esiste e la sezione non si monta.
 * Se la chiamata fallisce (rete, 401) la sezione sparisce in silenzio:
 * mai un errore rosso per un widget informativo.
 */

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { useStorageMode } from "@/lib/data/store";

type Usage = {
  totalTokens: number;
  totalUsd: number;
  allowanceUsd: number | null;
  pct: number | null;
};

export function UsageSection() {
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

  if (mode !== "cloud" || !usage) return null;

  const pct = usage.pct ?? 0;
  const width = Math.max(0, Math.min(100, pct));
  const warn = pct >= 90;

  return (
    <section className="jm-set-section">
      <div className="jm-set-section-h">AI di questo mese</div>
      <div className="jm-usage">
        <div className="jm-usage-top">
          <span className="jm-usage-t">Quota inclusa nell&apos;abbonamento</span>
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
          {formatNumber(usage.totalTokens)} token usati questo mese. La quota
          si azzera il primo del mese.
        </div>
      </div>
    </section>
  );
}
