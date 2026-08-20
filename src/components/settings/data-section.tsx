"use client";

import { useEffect, useState } from "react";
import { backupBannerState, type BackupBannerState } from "@/lib/backup/backup";
import { useStorageMode } from "@/lib/data/store";
import { formatNumber } from "@/lib/format";

/**
 * Quel che resta di "Altro > I tuoi dati" dopo il passaggio a Impostazioni
 * (20 agosto 2026): il banner. Esporta, importa e cancella sono diventati
 * righe dell'elenco in settings-client.tsx, e la spiegazione di dove
 * vivono le giornate e il pannello WherePanel in panels.tsx.
 */

/**
 * Il banner rosso-ambra in cima ad Altro (solo modalita locale): compare se
 * l'ultimo backup e piu vecchio di 14 giorni, o non esiste e ci sono almeno
 * 7 giornate. Mai su Oggi.
 */
export function BackupBanner() {
  const mode = useStorageMode();
  const [state, setState] = useState<BackupBannerState | null>(null);

  useEffect(() => {
    if (mode !== "local") return;
    let alive = true;
    void backupBannerState().then((s) => {
      if (alive) setState(s);
    });
    return () => {
      alive = false;
    };
  }, [mode]);

  if (mode !== "local" || !state?.show) return null;

  const title =
    state.daysSince === null
      ? "Non hai mai fatto un backup"
      : `Non fai un backup da ${formatNumber(state.daysSince)} giorni`;

  return (
    <div className="jm-backup-warn">
      <div className="jm-backup-warn-t">{title}</div>
      <div className="jm-backup-warn-p">
        Le tue {formatNumber(state.entryCount)} giornate esistono solo su questo
        dispositivo. Se si rompe o lo formatti, non c&apos;e nessuna copia da
        nessuna parte: non esiste un server dove cercarle. Esporta il file e
        mettilo dove tieni le cose che non vuoi perdere.
      </div>
    </div>
  );
}
