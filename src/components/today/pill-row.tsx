"use client";

/**
 * Le pastiglie delle persone e dei luoghi di una giornata, con la X.
 *
 * Una sola per tutte e due i posti in cui compaiono — la rail del desktop e
 * la colonna del telefono — perche erano gia due copie della stessa cosa e
 * la X avrebbe fatto tre.
 *
 * LA X TOGLIE DA QUELLA GIORNATA, non dal diario. Richiesta di Manuel il 23
 * agosto: "se menziono una persona ma non l'ho incontrata, non deve andare
 * li". Il racconto continua a nominarla, ed e giusto: sono parole tue. Quello
 * che cambia e che quel giorno non conta come incontro.
 */

import { useRouter } from "next/navigation";
import { PlacePin } from "@/components/ui/place-pin";
import { useT } from "@/lib/i18n";
import type { FactKind } from "@/lib/types";

type Props = {
  nomi: string[];
  kind: FactKind;
  /** Stile: la rail del desktop e la colonna del telefono hanno pastiglie diverse. */
  variante: "rail" | "colonna";
  /** Le persone hanno una scheda, i luoghi non ancora. */
  cliccabile?: boolean;
  onTogli: (kind: FactKind, nome: string) => void;
  /**
   * Cosa hai tolto DA QUANDO SEI SU QUESTA PAGINA. Serve solo a rimediare a
   * un tocco sbagliato: e in memoria, non salvato, e sparisce ricaricando.
   * Un elenco permanente di ripensamenti sarebbe una seconda lista da
   * gestire, e nessuno vuole gestire due liste per non gestirne una.
   */
  tolte?: string[];
  onRimetti?: (kind: FactKind, nome: string) => void;
};

export function PillRow({
  nomi,
  kind,
  variante,
  cliccabile = false,
  onTogli,
  tolte = [],
  onRimetti,
}: Props) {
  const t = useT();
  const router = useRouter();
  const base = variante === "rail" ? "jm-railr-chip" : "jm-person-pill";

  return (
    <>
    <div className={variante === "rail" ? "jm-railr-chips" : "jm-pill-row"}>
      {nomi.map((nome) => (
        <span key={nome} className={`${base} jm-pill-x`}>
          {kind === "luogo" && <PlacePin />}
          {cliccabile ? (
            <button
              type="button"
              className="jm-pill-name link"
              onClick={() => router.push(`/persona?nome=${encodeURIComponent(nome)}`)}
            >
              {nome}
            </button>
          ) : (
            <span className="jm-pill-name">{nome}</span>
          )}
          <button
            type="button"
            className="jm-pill-del"
            aria-label={t("togli {nome} da questa giornata", { nome })}
            title={t("togli {nome} da questa giornata", { nome })}
            onClick={() => onTogli(kind, nome)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </span>
      ))}
    </div>

    {tolte.length > 0 && onRimetti && (
      <div className="jm-undo">
        <span>{t("tolti da questa giornata:")}</span>
        {tolte.map((nome) => (
          <button key={nome} type="button" onClick={() => onRimetti(kind, nome)}>
            {t("rimetti {nome}", { nome })}
          </button>
        ))}
      </div>
    )}
    </>
  );
}
