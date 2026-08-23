"use client";

/**
 * I soprannomi pronti da applicare, per le schermate che mostrano nomi.
 *
 * Torna un indice gia costruito (vedi src/lib/aliases.ts) invece della lista
 * grezza: chi lo usa non deve sapere come sono fatti, chiama `risolviLista` e
 * basta. Finche non sono arrivati l'indice e vuoto, e `risolvi` lascia i nomi
 * come stanno: una giornata che si mostra col soprannome per un istante e
 * meglio di una giornata che non si mostra.
 */

import { useEffect, useState } from "react";
import { indicizza, type IndiceAlias } from "@/lib/aliases";
import { loadAliases } from "@/lib/data/facts";
import type { DataMode } from "@/lib/data/entries";

const VUOTO: IndiceAlias = new Map();

export function useAliases(mode: DataMode, revision?: unknown): IndiceAlias {
  const [indice, setIndice] = useState<IndiceAlias>(VUOTO);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const lista = await loadAliases(mode);
        if (vivo) setIndice(indicizza(lista));
      } catch {
        if (vivo) setIndice(VUOTO);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [mode, revision]);

  return indice;
}
