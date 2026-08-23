/**
 * I consumi AI del mese, letti da /api/usage (mockup design/mockups/consumi-ai.html).
 *
 * Questo modulo NON traduce e NON formatta: risponde con numeri e conteggi,
 * e le etichette in italiano le mette il componente. Il motivo e la lingua:
 * `t()` e reattivo dentro React, e se le frasi fossero cotte qui dentro
 * resterebbero quelle del momento in cui e arrivata la risposta, e passare
 * da italiano a inglese non cambierebbe piu niente a schermo.
 *
 * Due scelte che non sono dettagli:
 *
 * 1. **In locale non si chiama niente.** `loadUsage` chiede prima la
 *    modalita e, se non e cloud, lancia senza toccare la rete. La riga in
 *    Impostazioni gia non esiste in locale (settings-client), ma la
 *    promessa "in locale nemmeno una richiesta" non deve dipendere dal
 *    fatto che per caso nessuno chiami questa funzione.
 * 2. **Una richiesta sola per visita.** La riga di Impostazioni mostra gia
 *    il totale e il pannello mostra il dettaglio: sono due componenti che
 *    vogliono lo stesso dato. La promessa viene tenuta in un modulo, cosi
 *    aprire il pannello non ricompra la stessa risposta.
 */

import { apiFetch } from "@/lib/api";
import { resolveStorageMode } from "@/lib/data/store";

/** Una riga di `byRoute` come la manda /api/usage. */
export type UsageRouteAgg = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  audioSeconds: number;
  estUsd: number;
};

/** La risposta grezza di /api/usage. */
export type UsagePayload = {
  monthStart: string;
  plan?: "free" | "premium";
  byRoute: Record<string, UsageRouteAgg>;
  totalUsd: number;
  /** Token ufficiali (input+output) sommati sul mese. */
  totalTokens?: number;
  /**
   * Quota mensile inclusa nel piano (tabella plan_limits) e percentuale
   * consumata. Null quando il tier non ha un tetto configurato: la barra
   * semplicemente non si disegna.
   */
  allowanceUsd?: number | null;
  pct?: number | null;
};

/**
 * Le attivita in cui si raggruppano le route. Sono quattro perche sono
 * quattro le cose che l'utente riconosce di aver fatto; "split-by-date",
 * "extract-people" e "classify" sono lo stesso gesto visto da fuori (l'app
 * che mette in ordine quello che hai raccontato) e stanno in una voce sola.
 */
export type UsageActivityId =
  | "transcribe"
  | "recap"
  | "process-entry"
  | "ricorda";

export type UsageActivity = {
  id: UsageActivityId;
  /** Quante chiamate, sommate su tutte le route del gruppo. */
  calls: number;
  /** Secondi di audio mandati (solo la trascrizione ne ha). */
  audioSeconds: number;
  usd: number;
  /** Quota sul totale, 0..1. Zero quando il totale e zero. */
  share: number;
};

export type UsageSummary = {
  /** Inizio del mese aggregato, ISO UTC, come lo manda la route. */
  monthStart: string;
  totalUsd: number;
  /** Giornate elaborate: le chiamate di process-entry. */
  days: number;
  /** Registrazioni trascritte. */
  recordings: number;
  audioSeconds: number;
  /** Ordinate dalla piu cara alla meno cara, senza le voci a zero chiamate. */
  activities: UsageActivity[];
  /** Nessuna chiamata AI in tutto il mese: e uno zero vero, non un errore. */
  empty: boolean;
  /** Token ufficiali (input+output) del mese, per la barra della quota. */
  totalTokens: number;
  /** Quota mensile del piano e percentuale consumata (richiesta di Manuel,
      19 ago: la barra "come quella di Claude"). Null = nessun tetto noto. */
  allowanceUsd: number | null;
  pct: number | null;
};

/** Quali route finiscono in quale voce. Una route assente vale zero. */
const GROUPS: { id: UsageActivityId; routes: string[] }[] = [
  { id: "transcribe", routes: ["transcribe"] },
  { id: "recap", routes: ["recap"] },
  { id: "process-entry", routes: ["process-entry"] },
  // "extract-facts" ha preso il posto di "extract-people" (22 agosto 2026):
  // le persone sono fatti come gli altri. La vecchia resta nell'elenco perche
  // i mesi passati hanno righe con quel nome, e un consuntivo che perde
  // pezzi di storia e peggio di uno con una voce in piu.
  {
    id: "ricorda",
    routes: ["split-by-date", "extract-people", "extract-facts", "classify"],
  },
];

/**
 * Da risposta grezza a riassunto. Esportata a parte perche e la sola parte
 * con una logica che si puo sbagliare, ed e verificabile senza browser.
 */
export function summarizeUsage(payload: UsagePayload): UsageSummary {
  const byRoute = payload.byRoute ?? {};
  const total = Number(payload.totalUsd) || 0;

  const activities: UsageActivity[] = [];
  for (const group of GROUPS) {
    let calls = 0;
    let usd = 0;
    let audioSeconds = 0;
    for (const route of group.routes) {
      const agg = byRoute[route];
      if (!agg) continue;
      calls += agg.calls ?? 0;
      usd += agg.estUsd ?? 0;
      audioSeconds += agg.audioSeconds ?? 0;
    }
    if (calls === 0) continue;
    activities.push({
      id: group.id,
      calls,
      audioSeconds,
      usd,
      share: total > 0 ? usd / total : 0,
    });
  }

  // Dalla piu cara: la schermata serve a far vedere da dove arriva il conto,
  // e l'ordine e l'unica cosa che lo dice senza doverlo leggere.
  activities.sort((a, b) => b.usd - a.usd);

  const transcribe = activities.find((a) => a.id === "transcribe");
  const process = activities.find((a) => a.id === "process-entry");

  return {
    monthStart: payload.monthStart,
    totalUsd: total,
    days: process?.calls ?? 0,
    recordings: transcribe?.calls ?? 0,
    audioSeconds: transcribe?.audioSeconds ?? 0,
    activities,
    empty: activities.length === 0,
    totalTokens: Number(payload.totalTokens) || 0,
    allowanceUsd:
      typeof payload.allowanceUsd === "number" ? payload.allowanceUsd : null,
    pct: typeof payload.pct === "number" ? payload.pct : null,
  };
}

let cached: Promise<UsageSummary> | null = null;

/**
 * I consumi del mese corrente. La promessa viene tenuta: due chiamanti
 * nella stessa visita fanno una richiesta sola. `reload` la butta via (il
 * bottone "riprova" dello stato di errore).
 */
export function loadUsage(reload = false): Promise<UsageSummary> {
  if (reload) cached = null;
  if (!cached) {
    cached = fetchUsage().catch((err: unknown) => {
      // Un errore non si tiene in cache, altrimenti "riprova" non riprova
      // niente per tutta la visita.
      cached = null;
      throw err;
    });
  }
  return cached;
}

async function fetchUsage(): Promise<UsageSummary> {
  const mode = await resolveStorageMode();
  if (mode !== "cloud") {
    throw new Error("I consumi AI esistono solo con un account cloud");
  }

  const resp = await apiFetch("/api/usage", { timeoutMs: 15_000 });
  if (!resp.ok) {
    let detail = "";
    try {
      const body = (await resp.json()) as { error?: string };
      detail = body.error ?? "";
    } catch {
      // corpo non JSON: resta il solo codice
    }
    throw new Error(detail || `HTTP ${resp.status}`);
  }

  const payload = (await resp.json()) as UsagePayload;
  return summarizeUsage(payload);
}
