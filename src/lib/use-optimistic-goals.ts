"use client";

/**
 * La spunta dell'obiettivo si accende SUBITO, non quando risponde il server.
 *
 * Segnalazione di Manuel del 21 agosto 2026: "quando li clicco ci mettono un
 * sacco a diventare cliccati". Aveva ragione, e la causa non era la rete
 * lenta: la schermata disegnava la spunta solo DOPO che il salvataggio era
 * tornato indietro. In cloud e un giro fino a Supabase, quindi fra il dito e
 * il segno nero passavano centinaia di millisecondi. Il primo istinto,
 * davanti a un comando che non risponde, e ripremerlo.
 *
 * COME. Si tiene una "verita provvisoria": l'elenco degli obiettivi che
 * l'utente ha appena toccato, con lo stato che ha chiesto. La schermata
 * disegna quella sopra i dati veri finche il salvataggio non torna; poi la
 * provvisoria sparisce e resta il dato vero, che nel caso normale dice
 * esattamente la stessa cosa.
 *
 * SE IL SALVATAGGIO FALLISCE la spunta torna com'era. Mentire per sempre
 * sarebbe peggio del ritardo: crederesti di aver segnato la palestra e
 * domani non ci sarebbe.
 *
 * PERCHE UN FILE A PARTE. Le stesse righe vivono in due schermate (Oggi e
 * la giornata singola) e in due posti dentro ognuna (la colonna del telefono
 * e la rail del desktop). Scritta una volta sola, non puo comportarsi in
 * modo diverso a seconda di dove tocchi.
 */

import { useCallback, useState } from "react";
import type { GoalDot } from "@/lib/types";

export type OptimisticGoals = {
  /** Gli obiettivi da disegnare: i veri, con sopra quelli appena toccati. */
  view: (goals: GoalDot[]) => GoalDot[];
  /**
   * Esegue il cambio: accende la spunta subito, poi salva. Se il salvataggio
   * va male, la spunta torna indietro e l'errore risale al chiamante.
   */
  toggle: (
    goals: GoalDot[],
    label: string,
    save: () => Promise<void>,
  ) => Promise<void>;
};

export function useOptimisticGoals(): OptimisticGoals {
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const view = useCallback(
    (goals: GoalDot[]): GoalDot[] =>
      goals.map((g) =>
        g.label in pending ? { ...g, on: pending[g.label] } : g,
      ),
    [pending],
  );

  const forget = useCallback((label: string) => {
    setPending((p) => {
      if (!(label in p)) return p;
      const next = { ...p };
      delete next[label];
      return next;
    });
  }, []);

  const toggle = useCallback(
    async (goals: GoalDot[], label: string, save: () => Promise<void>) => {
      // Lo stato di partenza e quello CHE SI VEDE, non quello salvato: se
      // l'utente tocca due volte di fila, il secondo tocco deve partire da
      // cio che ha appena visto.
      const shown = goals.find((g) => g.label === label);
      const next = !(shown?.on ?? false);
      setPending((p) => ({ ...p, [label]: next }));
      try {
        await save();
      } finally {
        // In entrambi i casi si torna alla verita: se il salvataggio e
        // andato bene, il chiamante ha gia aggiornato i dati veri e la
        // spunta non si muove; se e fallito, torna com'era.
        forget(label);
      }
    },
    [forget],
  );

  return { view, toggle };
}
