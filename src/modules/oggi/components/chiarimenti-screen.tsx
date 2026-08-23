"use client";

/**
 * Le domande dell'AI, una per volta, subito dopo l'analisi.
 *
 * NIENTE SCHERMATA DI PERMESSO. Il mockup ne aveva una ("tre cose non le ho
 * capite, chiedimi pure") e Manuel l'ha tolta il 23 agosto 2026: chiedere il
 * permesso di chiedere e una cerimonia, e la cerimonia costa un tocco a ogni
 * giornata per non dire niente. Finita l'analisi, la prima domanda e gia li.
 *
 * Perche una per volta e non un modulo con dieci campi: a un modulo si
 * risponde in fretta e male, e una risposta data male qui diventa un
 * soprannome sbagliato inciso per sempre.
 *
 * "Non saprei" e una risposta vera, non una scappatoia: vedi
 * src/lib/chiarimenti.ts.
 */

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { compactDayDate, parseISODate, relativeDayLabel, todayISO } from "@/lib/format";
import { NON_E_UNA_PERSONA, type Domanda, type Risposta } from "@/lib/chiarimenti";

type Props = {
  domande: Domanda[];
  /**
   * Chiamata a OGNI risposta, non alla fine.
   *
   * Il 23 agosto sera, in produzione: si rispondeva alla prima domanda, si
   * passava alla seconda, si chiudeva la scheda — e la prima tornava, come
   * se non avessi risposto. Le risposte si applicavano tutte insieme alla
   * fine, e "la fine" con un arretrato di cinque domande non arriva quasi
   * mai. Ora ogni risposta vale nel momento in cui la dai.
   */
  onRisposta: (risposta: Risposta) => void;
  /** `interrotto` = ha premuto "basta per adesso": le altre restano in coda. */
  onDone: (interrotto?: boolean) => void;
  saving?: boolean;
};

/**
 * SALTARE NON CANCELLA NIENTE. Dal 23 agosto 2026 una domanda saltata resta
 * in coda e torna alla prossima analisi: e la regola di Manuel, "puo solo
 * saltarla adesso, ma tanto poi te la rifaro dopo". Per questo il tasto dice
 * "non adesso" e non "lascialo com'e": la seconda era una promessa falsa.
 *
 * L'unica uscita definitiva per una cosa che non e una persona — "nuovi
 * amici", "il gruppo del calcetto" — e il bottone che lo dice. E una
 * risposta, non una fuga.
 */

export function ChiarimentiScreen({
  domande,
  onRisposta,
  onDone,
  saving = false,
}: Props) {
  const t = useT();
  const [i, setI] = useState(0);
  const [scelta, setScelta] = useState<string | null>(null);
  const [nomeVero, setNomeVero] = useState<string>("");
  const [liberoScelto, setLiberoScelto] = useState(false);
  const [testoLibero, setTestoLibero] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const d = domande[i];

  /**
   * Si scrive a mano quando lo si e chiesto, oppure quando non c'e niente da
   * scegliere: se la rubrica e vuota — ed e vuota per chiunque cominci oggi —
   * una domanda sul nome di una persona non ha nessun bottone da offrire, e
   * mostrare "un altro nome" come unica strada e un tocco chiesto per niente.
   */
  const libero =
    liberoScelto || (!!d && d.libero && (d.opzioni?.length ?? 0) === 0);

  useEffect(() => {
    if (libero) inputRef.current?.focus();
  }, [libero]);

  if (!d) return null;

  const ultima = i === domande.length - 1;
  const valoreScelto = libero ? testoLibero.trim() : scelta;
  const puoAvanzare = !!valoreScelto && valoreScelto.length > 0;

  function avanti(valore: string | null) {
    // Subito, non alla fine: vedi onRisposta nei Props.
    onRisposta({ domanda: d, valore, nomeVero });
    if (ultima) {
      onDone();
      return;
    }
    setI((n) => n + 1);
    setScelta(null);
    setNomeVero("");
    setLiberoScelto(false);
    setTestoLibero("");
  }

  return (
    <div className="jm-ch-wrap">
      <div className="jm-ch-col">
        <div className="jm-ch-top">
          <span className="jm-ch-kicker">{t("Da chiarire")}</span>
          <span className="jm-ch-count">
            {t("{n} di {tot}", {
              n: String(i + 1),
              tot: String(domande.length),
            })}
          </span>
        </div>

        {/* Di che giornata si parla. Senza, con l'arretrato di un mese si
            leggono cinque domande che dicono tutte "oggi". */}
        <div className="jm-ch-quando">{quando(d.entryDate)}</div>

        <div className="jm-ch-bars" aria-hidden="true">
          {domande.map((q, n) => (
            <span key={q.id} className={`jm-ch-bar${n <= i ? " on" : ""}`} />
          ))}
        </div>

        <div className="jm-ch-scroll">
          {d.citazione && <div className="jm-ch-quote">{d.citazione}</div>}
          <h2 className="jm-ch-q">{d.testo}</h2>
          {d.perche && <p className="jm-ch-why">{d.perche}</p>}

          {libero ? (
            <div>
              <input
                ref={inputRef}
                className="jm-ch-field"
                value={testoLibero}
                maxLength={60}
                aria-label={d.testo}
                onChange={(e) => setTestoLibero(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && puoAvanzare) {
                    e.preventDefault();
                    avanti(testoLibero.trim());
                  }
                }}
              />
              <div className="jm-ch-hint">
                {t("Da adesso lo riconosco con questo nome in tutto il diario.")}
              </div>
            </div>
          ) : (
            <div className="jm-ch-opts">
              {d.opzioni.map((o) => {
                // Su una domanda di SPECIE la risposta e il tipo, non il
                // nome: l'etichetta la scrive il codice, non il modello.
                // Il 23 agosto, in produzione, la domanda «"Da Gino" chi o
                // che cosa indica?» offriva "Gino" e "da Gino" — due nomi,
                // e nessuno dei due diceva quale fosse la persona e quale il
                // posto. Il nome scende sotto, dove serve a capire come
                // verra mostrato.
                const tipo = d.azione === "specie" ? nomeDelTipo(o.valore, t) : null;
                const titolo = tipo ?? o.etichetta;
                const sotto = tipo ? o.nomeVero || o.etichetta : o.sotto;
                return (
                  <button
                    key={o.valore + o.etichetta}
                    type="button"
                    className={`jm-ch-opt${scelta === o.valore ? " sel" : ""}`}
                    onClick={() => {
                      setScelta(o.valore);
                      setNomeVero(o.nomeVero);
                    }}
                    aria-pressed={scelta === o.valore}
                  >
                    <span className="jm-ch-lab">
                      {titolo}
                      {sotto && <span className="sub">{sotto}</span>}
                    </span>
                  </button>
                );
              })}

              {/* Non e una persona: "nuovi amici" e un gruppo, non
                  qualcuno. E una risposta vera e chiude la domanda per
                  sempre, in tutte le giornate. */}
              {d.azione === "persona" && (
                <button
                  type="button"
                  className={`jm-ch-opt${scelta === NON_E_UNA_PERSONA ? " sel" : ""}`}
                  onClick={() => {
                    setScelta(NON_E_UNA_PERSONA);
                    setNomeVero("");
                  }}
                  aria-pressed={scelta === NON_E_UNA_PERSONA}
                >
                  <span className="jm-ch-lab">
                    {t("Non e una persona")}
                    <span className="sub">{t("non chiedermelo piu")}</span>
                  </span>
                </button>
              )}

              {/* Il campo libero e l'ULTIMA riga, non la prima: scrivere un
                  nome a mano e il modo piu facile per ritrovarsi "Daniele" e
                  "daniele" come due persone diverse. */}
              {d.libero && (
                <button
                  type="button"
                  className="jm-ch-opt ghost"
                  onClick={() => {
                    setLiberoScelto(true);
                    setScelta(null);
                  }}
                >
                  <span className="jm-ch-lab">
                    {t("Un altro nome")}
                    <span className="sub">{t("lo scrivo io")}</span>
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="jm-ch-foot">
          <button
            type="button"
            className="jm-ch-skip"
            disabled={saving}
            onClick={() => avanti(null)}
          >
            {t("Non adesso")}
          </button>
          <button
            type="button"
            className="btn-primary jm-ch-next"
            disabled={!puoAvanzare || saving}
            onClick={() => avanti(valoreScelto)}
          >
            {ultima ? t("Fine") : t("Avanti")}
          </button>
        </div>

        {/* L'uscita, sotto e piccola: non cancella niente, le domande
            restano in coda e tornano. Serve con l'arretrato addosso, dove
            rispondere a quaranta domande per tornare al diario sarebbe una
            trappola. */}
        {domande.length > 1 && (
          <div className="jm-ch-basta-riga">
            <button
              type="button"
              className="jm-ch-basta"
              disabled={saving}
              onClick={() => onDone(true)}
            >
              {t("basta per adesso")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Come si chiama un tipo, in parole.
 *
 * Non passa dal modello di proposito: e l'unica cosa della schermata che
 * DEVE essere esatta, perche e la risposta stessa. Un tipo sconosciuto torna
 * null e si ricade sull'etichetta scritta dal modello, che e sempre meglio
 * di un bottone vuoto.
 */
function nomeDelTipo(valore: string, t: (s: string) => string): string | null {
  switch (valore) {
    case "persona":
      return t("Una persona");
    case "luogo":
      return t("Un posto");
    case "cibo":
      return t("Qualcosa da mangiare");
    case "attivita":
      return t("Un'attivita");
    case "lavoro":
      return t("Lavoro");
    default:
      return null;
  }
}

/** "ieri", "dom 23 ago": la giornata da cui viene la domanda. */
function quando(dateISO: string): string {
  try {
    const d = parseISODate(dateISO);
    return `${relativeDayLabel(d, parseISODate(todayISO()))} . ${compactDayDate(d)}`;
  } catch {
    return dateISO;
  }
}
