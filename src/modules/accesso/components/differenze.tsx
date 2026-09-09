"use client";

/**
 * "Vedi tutte le differenze": l'elenco completo Free / Premium, in UNA
 * colonna sola (Manuel, 9 settembre 2026, mockup MOCKUP-telefono-e-tasti).
 *
 * PERCHE NON UNA TABELLA A DUE COLONNE. Un iPhone e largo 390 punti; tolti
 * i bordi ne restano circa 320, e due colonne di pallini se ne prendono
 * 116. Alle parole ne avanzano 200, cioe sei o sette per riga: meta delle
 * voci vanno a capo e il pallino non e piu accanto alla sua riga. Col testo
 * ingrandito di iOS non si legge piu niente. Quindi: una riga per voce, e
 * il marchio "Premium" su quelle che si pagano.
 *
 * PERCHE STA IN UN COMPONENTE. Lo stesso elenco serve in due posti: il
 * foglio che si apre da /benvenuto e (domani) la voce delle Impostazioni.
 * Si scrive una volta, o le due liste divergono al primo ritocco.
 *
 * Le voci sono in ORDINE DI PRODOTTO: prima le quattro che ci sono sempre
 * (il gratis e un prodotto finito, non una versione mutilata), poi le
 * cinque che si pagano.
 */

import { useT } from "@/lib/i18n";

/** Una riga dell'elenco: la frase e se serve premium. */
export type RigaDifferenza = { testo: string; premium: boolean };

export const RIGHE_DIFFERENZE: RigaDifferenza[] = [
  { testo: "Scrivi la tua giornata", premium: false },
  { testo: "Obiettivi, peso, sonno, umore", premium: false },
  { testo: "Mese e Memo", premium: false },
  { testo: "Backup su file che puoi esportare", premium: false },
  { testo: "Racconti a voce, si trascrive da solo", premium: true },
  { testo: "Titolo, sintesi e aree della giornata", premium: true },
  { testo: "Recap del mese, del semestre, dell'anno", premium: true },
  { testo: "Copia criptata nel cloud, si aggiorna da sola", premium: true },
  { testo: "Su tutti i tuoi dispositivi, con la tua chiave", premium: true },
];

/** Solo l'elenco, senza foglio intorno: cosi lo puo montare anche Impostazioni. */
export function ElencoDifferenze() {
  const t = useT();
  return (
    <ul className="jm-diff-l">
      {RIGHE_DIFFERENZE.map((r) => (
        <li key={r.testo} className={r.premium ? "p" : undefined}>
          <span>{t(r.testo)}</span>
          {r.premium && <i className="jm-diff-m">{t("Premium")}</i>}
        </li>
      ))}
    </ul>
  );
}

/**
 * Il foglio che si apre dal bivio. Si chiude toccando fuori, il tasto, o
 * Esc: tre uscite, perche una schermata che spiega non deve mai diventare
 * una trappola.
 */
export function FoglioDifferenze({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <div
      className="jm-diff-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={t("Tutte le differenze")}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="jm-diff" onClick={(e) => e.stopPropagation()}>
        <div className="jm-diff-maniglia" aria-hidden="true" />
        <div className="jm-diff-t">{t("Tutte le differenze")}</div>
        <p className="jm-diff-p">{t("Quello che c'e sempre, e quello che aggiunge premium.")}</p>
        <ElencoDifferenze />
        <p className="jm-diff-nota">
          {t(
            "Su iPhone e iPad la chiave viaggia da sola con iCloud. Sul Mac la scrivi una volta.",
          )}
        </p>
        <button type="button" className="btn-ghost" onClick={onClose}>
          {t("Chiudi")}
        </button>
      </div>
    </div>
  );
}
