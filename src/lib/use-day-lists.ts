"use client";

/**
 * Le persone e i luoghi di una giornata, pronti da mostrare.
 *
 * Mette insieme le tre cose che decidono cosa si vede, e lo fa in un posto
 * solo perche l'ordine conta:
 *
 *   1. quello che l'AI ha letto nel racconto (persone dall'entry, luoghi dai
 *      fatti);
 *   2. i SOPRANNOMI: "mio fratello" diventa Daniele, "da Charlie" esce dalle
 *      persone perche e un posto (src/lib/aliases.ts);
 *   3. le cose TOLTE a mano da quella giornata: hai nominato Marco ma non
 *      l'hai incontrato (migrazione 013);
 *   4. la GRAFIA: "KARYA" nel racconto si mostra "Karya", com'e scritta in
 *      rubrica (Ricorda > Persone). Vedi indicizzaGrafie in aliases.ts.
 *
 * Prima si risolve, poi si toglie: cosi se togli "Daniele" resta tolto anche
 * quando il racconto lo chiama "mio fratello". Al contrario, la X avrebbe
 * funzionato solo sulla grafia che stavi guardando.
 *
 * Niente di tutto questo riscrive il racconto o le giornate: si applica
 * quando si mostra, quindi una rilettura del testo — che rifa tutto da zero —
 * non puo rimettere dentro cio che avevi tolto.
 */

import { useCallback, useEffect, useState } from "react";
import {
  indicizza,
  indicizzaGrafie,
  chiaveAlias,
  risolviLista,
  type Grafie,
  type IndiceAlias,
} from "@/lib/aliases";
import {
  addExclusion,
  loadAliases,
  loadExclusions,
  loadFactsForDate,
  removeExclusion,
} from "@/lib/data/facts";
import { loadPersonaNames } from "@/lib/data/remembers";
import type { DataMode } from "@/lib/data/entries";
import type { DayExclusion, FactKind } from "@/lib/types";

export type DayLists = {
  people: string[];
  places: string[];
  /** Toglie una voce da questa giornata. */
  togli: (kind: FactKind, nome: string) => Promise<void>;
  /** Ci ripensa. */
  rimetti: (kind: FactKind, nome: string) => Promise<void>;
};

const VUOTO: IndiceAlias = new Map();
const NESSUNA_GRAFIA: Grafie = new Map();

export function useDayLists(
  mode: DataMode,
  dateISO: string,
  peopleGrezze: string[],
  /** Cambia quando la giornata e stata risalvata: fa ricaricare tutto. */
  revision: string | number | null,
): DayLists {
  const [aliases, setAliases] = useState<IndiceAlias>(VUOTO);
  const [grafie, setGrafie] = useState<Grafie>(NESSUNA_GRAFIA);
  const [luoghiGrezzi, setLuoghiGrezzi] = useState<string[]>([]);
  const [escluse, setEscluse] = useState<Set<string>>(new Set());
  const [giro, setGiro] = useState(0);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [ali, fatti, esc, rubrica] = await Promise.all([
        loadAliases(mode).catch(() => []),
        loadFactsForDate(mode, dateISO).catch(() => []),
        loadExclusions(mode, dateISO).catch(() => []),
        // La rubrica e solo per la grafia: se non arriva, i nomi escono
        // come sono scritti nel racconto, non spariscono.
        loadPersonaNames(mode).catch(() => [] as string[]),
      ]);
      if (!vivo) return;
      setAliases(indicizza(ali));
      setGrafie(indicizzaGrafie(rubrica));
      setLuoghiGrezzi(
        fatti
          .filter((f) => f.kind === "luogo")
          .map((f) => f.label.trim())
          .filter((l) => l.length > 0),
      );
      setEscluse(new Set(esc.map((e) => `${e.kind}|${e.labelKey}`)));
    })();
    return () => {
      vivo = false;
    };
  }, [mode, dateISO, revision, giro]);

  const togli = useCallback(
    async (kind: FactKind, nome: string) => {
      const e: DayExclusion = { entryDate: dateISO, kind, labelKey: chiaveAlias(nome) };
      // Sparisce subito: aspettare il salvataggio per veder sparire una
      // pastiglia fa sembrare che il tocco non sia arrivato.
      setEscluse((prev) => new Set(prev).add(`${kind}|${e.labelKey}`));
      try {
        await addExclusion(mode, e);
      } catch {
        setGiro((n) => n + 1);
      }
    },
    [mode, dateISO],
  );

  const rimetti = useCallback(
    async (kind: FactKind, nome: string) => {
      const e: DayExclusion = { entryDate: dateISO, kind, labelKey: chiaveAlias(nome) };
      setEscluse((prev) => {
        const p = new Set(prev);
        p.delete(`${kind}|${e.labelKey}`);
        return p;
      });
      try {
        await removeExclusion(mode, e);
      } catch {
        setGiro((n) => n + 1);
      }
    },
    [mode, dateISO],
  );

  // La grafia della rubrica vale per le persone: i luoghi non hanno una
  // rubrica, e restano come sono scritti.
  const fuori = (nomi: string[], kind: FactKind) =>
    risolviLista(nomi, kind, aliases, kind === "persona" ? grafie : undefined).filter(
      (n) => !escluse.has(`${kind}|${chiaveAlias(n)}`),
    );

  return {
    people: fuori(peopleGrezze, "persona"),
    places: fuori(luoghiGrezzi, "luogo"),
    togli,
    rimetti,
  };
}
