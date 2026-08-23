"use client";

/**
 * I luoghi di una giornata, per la rail e per la fila sotto le persone.
 *
 * Non sono un campo dell'entry: sono i fatti di tipo "luogo" letti dal
 * racconto (SPEC-fatti). Per questo si caricano a parte e si ricaricano
 * quando la giornata cambia — ogni modifica al testo rifa l'analisi da zero,
 * fatti compresi, e la lista dei luoghi con essa.
 *
 * Se la lettura fallisce la lista resta vuota e la sezione non compare: un
 * luogo mancante e un peccato, un errore rosso sopra la giornata no.
 */

import { useEffect, useState } from "react";
import { loadFactsForDate } from "@/lib/data/facts";
import type { DataMode } from "@/lib/data/entries";

export function usePlaces(
  mode: DataMode,
  dateISO: string,
  /** Cambia quando la giornata e stata risalvata: fa ricaricare i fatti. */
  revision: string | number | null,
): string[] {
  const [places, setPlaces] = useState<string[]>([]);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const facts = await loadFactsForDate(mode, dateISO);
        if (!vivo) return;
        const luoghi = facts
          .filter((f) => f.kind === "luogo")
          .map((f) => f.label.trim())
          .filter((l) => l.length > 0);
        // Stesso posto nominato due volte nella stessa giornata: una
        // pastiglia sola. Il confronto e sul testo minuscolo perche
        // "Bubba Cafe" e "bubba cafe" sono lo stesso bar.
        const visti = new Set<string>();
        const unici: string[] = [];
        for (const l of luoghi) {
          const k = l.toLowerCase();
          if (visti.has(k)) continue;
          visti.add(k);
          unici.push(l);
        }
        setPlaces(unici);
      } catch {
        if (vivo) setPlaces([]);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [mode, dateISO, revision]);

  return places;
}
