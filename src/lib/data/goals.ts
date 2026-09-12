"use client";

/**
 * Facade sopra JournalStore: firme storiche invariate, corpo in
 * src/lib/data/store/cloud.ts. Vedi entries.ts per il perche.
 */

import { getStore } from "@/lib/data/store";
import { cached, invalidateAll } from "@/lib/data/cache";
import { apiFetch } from "@/lib/api";
import { getLang } from "@/lib/i18n";
import { utenteDalDispositivo } from "@/lib/supabase/client";
import type { DataMode } from "@/lib/data/entries";
import type { GoalDef } from "@/lib/types";

export async function loadGoalDefs(_mode?: DataMode): Promise<GoalDef[]> {
  return cached("goals", () => getStore().loadGoalDefs());
}

export async function addGoal(
  _mode: DataMode,
  label: string,
): Promise<GoalDef> {
  // Si svuota DOPO la scrittura: vedi invalidateAll in cache.ts.
  try {
    return await getStore().addGoal(label);
  } finally {
    invalidateAll();
  }
}

export async function removeGoal(_mode: DataMode, id: string): Promise<void> {
  // Si svuota DOPO la scrittura: vedi invalidateAll in cache.ts.
  try {
    return await getStore().removeGoal(id);
  } finally {
    invalidateAll();
  }
}

// Per quale utente si e gia chiesto, in questa apertura: chi esce e
// rientra con un altro account lo chiede di nuovo.
let semeChiestoPer: string | null = null;

/**
 * Gli obiettivi di fabbrica dell'ACCOUNT, nella lingua del dispositivo
 * (12 settembre 2026, migration 029: il trigger non c'e piu). Si chiede al
 * server una volta per apertura, dal cancello, appena si e in cloud con la
 * cassaforte aperta; il server risponde `seminati: 0` a chi li ha gia
 * avuti, quindi chiamarla due volte non fa danno. Se ha seminato davvero,
 * la cache si svuota: Oggi e Impostazioni li vedono al prossimo giro.
 */
export async function seminaObiettiviDiFabbrica(): Promise<number> {
  const utente = utenteDalDispositivo() ?? "?";
  if (semeChiestoPer === utente) return 0;
  semeChiestoPer = utente;
  try {
    const r = await apiFetch("/api/account/obiettivi-di-fabbrica", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lingua: getLang() }),
    });
    if (!r.ok) {
      // senza rete si riprova alla prossima apertura
      semeChiestoPer = null;
      return 0;
    }
    const j = (await r.json()) as { seminati?: number };
    const n = typeof j.seminati === "number" ? j.seminati : 0;
    if (n > 0) invalidateAll();
    return n;
  } catch {
    semeChiestoPer = null;
    return 0;
  }
}
