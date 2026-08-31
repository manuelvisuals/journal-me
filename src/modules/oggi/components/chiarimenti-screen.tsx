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
import {
  NON_APPARTIENE,
  NON_E_UNA_PERSONA,
  type Domanda,
  type Risposta,
} from "@/lib/chiarimenti";
import { loadEntryForDate, type DataMode } from "@/lib/data/entries";
import { ritagliaCitazione, spezzaAttorno } from "@/modules/oggi/citazione";

type Props = {
  /** Serve solo per andare a riprendere il racconto quando l'estratto manca. */
  mode: DataMode;
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
  mode,
  domande,
  onRisposta,
  onDone,
  saving = false,
}: Props) {
  const t = useT();
  const [i, setI] = useState(0);
  /**
   * Le risposte scelte, sempre un elenco.
   *
   * Era un valore solo fino al 31 agosto 2026. Su una domanda di persone si
   * possono accendere piu nomi ("i miei amici" sono Hoda e Liana); su tutte
   * le altre l'elenco ha al massimo un elemento, perche toccare sostituisce.
   * Tenerne uno solo era la ragione per cui non si poteva rispondere il vero.
   */
  const [scelte, setScelte] = useState<string[]>([]);
  const [nomeVero, setNomeVero] = useState<string>("");
  const [liberoScelto, setLiberoScelto] = useState(false);
  const [testoLibero, setTestoLibero] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  /** I racconti gia andati a riprendere, per data: uno per giornata, non uno per domanda. */
  const [racconti, setRacconti] = useState<Record<string, string>>({});

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

  /**
   * L'estratto che manca si va a riprendere dal racconto di quella giornata.
   *
   * Le domande nuove arrivano gia con la citazione (la rotta la ritaglia).
   * Questo serve per la CODA: le domande scritte prima del 31 agosto 2026
   * hanno la casella vuota, e sono proprio quelle vecchie — cioe quelle a cui
   * senza il testo davanti non si sa rispondere. Una lettura per giornata,
   * tenuta da parte: la coda di un mese e fatta di poche giornate.
   */
  const dataSenzaEstratto = d && !d.citazione && racconti[d.entryDate] === undefined
    ? d.entryDate
    : null;
  useEffect(() => {
    if (!dataSenzaEstratto) return;
    let vivo = true;
    void (async () => {
      let testo = "";
      try {
        testo = (await loadEntryForDate(mode, dataSenzaEstratto))?.transcript ?? "";
      } catch {
        // Il racconto non si e lasciato leggere: si mostra la domanda senza
        // estratto invece di bloccarla. Meglio nuda che assente.
        testo = "";
      }
      if (vivo) setRacconti((p) => ({ ...p, [dataSenzaEstratto]: testo }));
    })();
    return () => {
      vivo = false;
    };
  }, [dataSenzaEstratto, mode]);

  if (!d) return null;

  const ultima = i === domande.length - 1;
  /**
   * Piu risposte insieme SOLO sulle persone, e solo quando ci sono nomi da
   * toccare. Su un'area la risposta e una per definizione ("tutte e due" e
   * gia un bottone suo), e su una specie una cosa non puo essere insieme un
   * posto e un cibo: li la scelta multipla sarebbe solo un modo per
   * rispondere una cosa senza senso.
   */
  const multi = d.azione === "persona" && !libero;
  const citazione =
    d.citazione || ritagliaCitazione(racconti[d.entryDate] ?? "", d.soggetto);
  const pezzi = spezzaAttorno(citazione, d.soggetto);
  const valoriScelti = libero
    ? [testoLibero.trim()].filter(Boolean)
    : scelte.filter(Boolean);
  const puoAvanzare = valoriScelti.length > 0;

  function pulisci() {
    setScelte([]);
    setNomeVero("");
    setLiberoScelto(false);
    setTestoLibero("");
  }

  /**
   * Un tocco su un bottone.
   *
   * `esclusiva` sono le risposte che dicono il contrario delle altre — "non
   * e una persona", "non c'entra con nessuna sfera": accenderle spegne tutto
   * il resto, e sceglierne un'altra le spegne. Tenerle accese insieme a due
   * nomi vorrebbe dire rispondere "sono Hoda e Liana, e comunque non sono
   * persone".
   */
  function tocca(valore: string, suoNomeVero: string, esclusiva: boolean) {
    setNomeVero(suoNomeVero);
    setScelte((prima) => {
      if (!multi || esclusiva) return prima.includes(valore) ? [] : [valore];
      const senzaEsclusive = prima.filter((v) => !ESCLUSIVE.has(v));
      return senzaEsclusive.includes(valore)
        ? senzaEsclusive.filter((v) => v !== valore)
        : [...senzaEsclusive, valore];
    });
  }

  function avanti(valori: string[]) {
    // Subito, non alla fine: vedi onRisposta nei Props.
    // `valore` resta la risposta in una riga: e cio che chiude la domanda
    // nella coda, e con due nomi e "Hoda, Liana".
    onRisposta({
      domanda: d,
      valore: valori.length > 0 ? valori.join(", ") : null,
      valori,
      nomeVero,
    });
    if (ultima) {
      onDone();
      return;
    }
    setI((n) => n + 1);
    pulisci();
  }

  /**
   * Un passo indietro (Manuel, 27 agosto 2026: "consentimi di tornare
   * indietro se ci ripenso"). La risposta gia data resta applicata — le
   * risposte valgono nel momento in cui le dai — ma rispondere di nuovo
   * la sovrascrive: soprannomi e aree si riscrivono, e la domanda si
   * richiude con l'ultima parola detta.
   */
  function indietro() {
    if (i === 0) return;
    setI((n) => n - 1);
    pulisci();
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
          {/* L'estratto del racconto, SEMPRE (regola di Manuel, 31 agosto
              2026): a una domanda su una giornata di tre settimane fa non si
              risponde a memoria. La cosa in dubbio e in evidenza, cosi la si
              trova con l'occhio senza rileggere la frase intera. */}
          {citazione && (
            <div className="jm-ch-quote">
              {pezzi.prima}
              {pezzi.dentro && <mark className="jm-ch-mark">{pezzi.dentro}</mark>}
              {pezzi.dopo}
            </div>
          )}
          <h2 className="jm-ch-q">{d.testo}</h2>
          {d.perche && <p className="jm-ch-why">{d.perche}</p>}
          {/* Detto a parole oltre che con la forma della casella: il quadrato
              lo capisce chi lo conosce, la riga la legge chiunque. */}
          {multi && <p className="jm-ch-multi">{t("Puoi sceglierne piu di una.")}</p>}

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
                    avanti([testoLibero.trim()]);
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
                const acceso = scelte.includes(o.valore);
                return (
                  <button
                    key={o.valore + o.etichetta}
                    type="button"
                    className={`jm-ch-opt${acceso ? " sel" : ""}`}
                    onClick={() => tocca(o.valore, o.nomeVero, false)}
                    aria-pressed={acceso}
                  >
                    <Casella multi={multi} />
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
                  className={`jm-ch-opt${scelte.includes(NON_E_UNA_PERSONA) ? " sel" : ""}`}
                  onClick={() => tocca(NON_E_UNA_PERSONA, "", true)}
                  aria-pressed={scelte.includes(NON_E_UNA_PERSONA)}
                >
                  <Casella multi={multi} />
                  <span className="jm-ch-lab">
                    {t("Non e una persona")}
                    <span className="sub">{t("non chiedermelo piu")}</span>
                  </span>
                </button>
              )}

              {/* Non c'entra con nessuna sfera: riparare una gomma non e
                  movimento ne lavoro, e solo una cosa fatta (Manuel, 27
                  agosto 2026). E una risposta vera: chiude la domanda per
                  sempre e non tocca le aree. */}
              {d.azione === "area" && (
                <button
                  type="button"
                  className={`jm-ch-opt${scelte.includes(NON_APPARTIENE) ? " sel" : ""}`}
                  onClick={() => tocca(NON_APPARTIENE, "", true)}
                  aria-pressed={scelte.includes(NON_APPARTIENE)}
                >
                  <Casella multi={multi} />
                  <span className="jm-ch-lab">
                    {t("Non c'entra con nessuna sfera")}
                    <span className="sub">{t("era solo una cosa da fare")}</span>
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
                    setScelte([]);
                  }}
                >
                  <Casella multi={multi} />
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
          {/* Il passo indietro compare solo quando c'e un indietro. */}
          {i > 0 && (
            <button
              type="button"
              className="jm-ch-skip"
              disabled={saving}
              onClick={indietro}
            >
              {t("indietro")}
            </button>
          )}
          <button
            type="button"
            className="jm-ch-skip"
            disabled={saving}
            onClick={() => avanti([])}
          >
            {t("Non adesso")}
          </button>
          <button
            type="button"
            className="btn-primary jm-ch-next"
            disabled={!puoAvanzare || saving}
            onClick={() => avanti(valoriScelti)}
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
 * Le risposte che non stanno insieme a nessun'altra: dicono il contrario.
 * Sono valori di macchina, non nomi, quindi non possono coincidere con una
 * persona vera.
 */
const ESCLUSIVE = new Set<string>([NON_E_UNA_PERSONA, NON_APPARTIENE]);

/**
 * La casella davanti alla risposta: QUADRATA quando se ne puo scegliere piu
 * di una, tonda quando no.
 *
 * Non e decorazione. E l'unica cosa che dice PRIMA del tocco cosa succedera
 * al secondo tocco, e senza di lei il bottone che si spegne da solo sembra
 * un difetto dell'app. La spunta si vede solo quando la risposta e accesa:
 * il colore lo mette il CSS, qui c'e solo la forma.
 */
function Casella({ multi }: { multi: boolean }) {
  return (
    <span className={`jm-ch-box${multi ? "" : " tondo"}`} aria-hidden="true">
      {multi ? (
        <svg viewBox="0 0 24 24" className="jm-ch-spunta">
          <path d="M4 12.5l5.5 5.5L20 7" />
        </svg>
      ) : (
        <span className="jm-ch-pallino" />
      )}
    </span>
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
