"use client";

/**
 * Generazione di un recap: carica le giornate del periodo dallo store,
 * chiama /api/recap/generate, salva via store. Orchestrazione, non accesso
 * ai dati: per questo vive qui e non in JournalStore (SPEC-v2 §2.2).
 */

import { apiFetch } from "@/lib/api";
import { can } from "@/lib/capabilities";
import { getStore } from "@/lib/data/store";
import { t } from "@/lib/i18n";
import type { Entry, Recap, RecapPeriod } from "@/lib/types";

async function loadEntriesForPeriod(
  periodType: RecapPeriod,
  periodStart: string,
): Promise<Entry[]> {
  const store = getStore();
  const [y, m] = periodStart.split("-").map(Number);
  if (periodType === "month") {
    return store.loadMonthEntries(y, m);
  }
  const months = periodType === "semester" ? 6 : 12;
  const out: Entry[] = [];
  for (let i = 0; i < months; i++) {
    const monthIndex = m - 1 + i;
    const ty = y + Math.floor(monthIndex / 12);
    const tm = (monthIndex % 12) + 1;
    out.push(...(await store.loadMonthEntries(ty, tm)));
  }
  return out;
}

export async function generateAndSaveRecap(
  periodType: RecapPeriod,
  periodStart: string,
  periodEnd: string,
): Promise<Recap> {
  if (!can("recap")) {
    throw new Error(t("I recap non sono disponibili in questa modalita."));
  }
  const entries = await loadEntriesForPeriod(periodType, periodStart);
  const usable = entries.filter((e) => e.transcript.trim().length > 0);
  if (usable.length === 0) {
    throw new Error(t("Nessuna giornata raccontata in questo periodo."));
  }

  // A semester of entries through gpt-4o takes longer than the 15s default
  // for textual routes; 60s matches the ceiling of the lambdas themselves.
  const resp = await apiFetch("/api/recap/generate", {
    timeoutMs: 60_000,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      periodType,
      periodStart,
      periodEnd,
      entries: usable.map((e) => ({
        entryDate: e.entryDate,
        transcript: e.transcript,
        headline: e.headline,
        snippet: e.snippet,
      })),
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`AI error: ${txt.slice(0, 200)}`);
  }
  const ai = (await resp.json()) as {
    title: string;
    snippet: string;
    body: string;
  };

  return getStore().saveRecap({
    periodType,
    periodStart,
    periodEnd,
    title: ai.title,
    snippet: ai.snippet,
    body: ai.body,
  });
}
