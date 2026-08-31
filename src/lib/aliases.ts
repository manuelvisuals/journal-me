/**
 * I soprannomi, applicati quando si MOSTRA.
 *
 * Regola fondativa del diario: il racconto e re, e non si riscrive mai. Se
 * hai detto "mio fratello", nel tuo testo restera per sempre "mio fratello" —
 * sono parole tue. Ma l'app, dal momento in cui glielo dici una volta, sa che
 * quel fratello si chiama Daniele: lo mostra col nome giusto, lo conta nella
 * scheda di Daniele, e non te lo richiede piu.
 *
 * Applicare al momento di mostrare, invece di riscrivere le giornate, ha tre
 * conseguenze buone e nessuna cattiva:
 *   - vale subito anche sulle giornate di marzo, senza migrare niente;
 *   - se cambi idea, cambi una riga e cambia tutto lo storico;
 *   - una rilettura del testo non puo rimettere il soprannome, perche il
 *     soprannome non e mai stato tolto: e il testo, e resta li.
 *
 * IL SECONDO MESTIERE. Un alias non dice solo "come si chiama": dice anche
 * "di che specie e". "Da Charlie" registrato come LUOGO significa che, se
 * l'AI lo ripesca fra le persone, e sbagliato e va tolto da li. E il difetto
 * che oggi sporca la lista delle persone in silenzio.
 *
 * IL TERZO MESTIERE (31 agosto 2026, richiesta di Manuel). Un soprannome puo
 * valere per PIU persone: "i miei amici" sono Hoda e Liana, e una sola delle
 * due sarebbe una bugia. Da qui `labelKeys` e un elenco, e risolvere una
 * voce puo produrne due. Non e solo comodita: finche era un nome solo, "i
 * miei amici" contava come UNA persona con quel nome buffo, e il conteggio
 * degli incontri era sbagliato di uno a ogni giornata.
 */

import type { Alias, FactKind } from "@/lib/types";

/**
 * La forma con cui due grafie della stessa cosa si incontrano: minuscolo,
 * senza accenti decorativi, spazi normalizzati. "Da Charlie" e "da  charlie"
 * sono la stessa chiave.
 */
export function chiaveAlias(testo: string): string {
  return testo
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Come piu nomi stanno in una casella di testo sola.
 *
 * La tabella `fact_aliases` ha UNA colonna `label_key`, e la sua chiave
 * primaria (utente, specie, alias) esiste apposta perche lo stesso
 * soprannome non punti a due cose diverse. Per tenere due nomi non serve una
 * tabella nuova: serve un separatore che nessuno possa scrivere per sbaglio.
 *
 * U+001F (UNIT SEPARATOR) non e sulla tastiera e non compare in un nome. Le
 * righe vecchie, scritte quando il nome era uno solo, non lo contengono e si
 * dividono in un elenco di uno: nessuna migrazione, nessun dato da toccare.
 */
const SEPARATORE_NOMI = "\u001f";

/** Da elenco a casella. Vuoto resta vuoto: e "non e di questa specie". */
export function uniscoNomi(nomi: string[]): string {
  return nomi.map((n) => n.trim()).filter(Boolean).join(SEPARATORE_NOMI);
}

/** Da casella a elenco. Una casella vuota da un elenco vuoto. */
export function dividiNomi(testo: string): string[] {
  return testo.split(SEPARATORE_NOMI).map((n) => n.trim()).filter(Boolean);
}

/** Indice per ricerche veloci: "kind|chiave" -> alias. */
export type IndiceAlias = Map<string, Alias>;

export function indicizza(aliases: Alias[]): IndiceAlias {
  const m: IndiceAlias = new Map();
  for (const a of aliases) {
    m.set(`${a.kind}|${chiaveAlias(a.alias)}`, a);
  }
  return m;
}

/**
 * Cosa fare con una voce che sta per essere mostrata sotto un certo tipo.
 *
 *  - `{ mostra: ["Daniele"] }`        -> mostrala con questo nome
 *  - `{ mostra: ["Hoda", "Liana"] }`  -> ne diventano DUE: "i miei amici"
 *                                        erano due persone, e il diario le
 *                                        mostra e le conta tutte e due
 *  - `{ mostra: [] }`                 -> NON va mostrata qui: appartiene a un
 *                                        altro tipo (e "da Charlie" fra le
 *                                        persone), oppure e stata dichiarata
 *                                        "non e una persona"
 *
 * L'elenco vuoto fa i due mestieri che prima faceva `null`: sono lo stesso
 * caso detto una volta sola — "qui non ci va niente".
 */
export function risolvi(
  nome: string,
  kind: FactKind,
  indice: IndiceAlias,
): { mostra: string[] } {
  const chiave = chiaveAlias(nome);
  if (!chiave) return { mostra: [] };

  const suo = indice.get(`${kind}|${chiave}`);
  // Un soprannome senza nessun nome vero vuol dire "questa cosa NON e di
  // questo tipo, e non lo sara mai": e la risposta a "nuovi amici" o "il
  // gruppo del calcetto", che sono persone al plurale, cioe nessuna persona
  // in particolare. Non serviva una tabella nuova: bastava una casella vuota.
  if (suo) return { mostra: suo.labelKeys.map((n) => n.trim()).filter(Boolean) };

  // Registrato sotto un'altra specie: qui non ci va. Si controllano tutte le
  // specie e non solo persona/luogo, perche il giorno che si chiarisce un
  // cibo o un lavoro deve valere la stessa regola senza ritocchi.
  for (const k of TUTTE_LE_SPECIE) {
    if (k === kind) continue;
    if (indice.has(`${k}|${chiave}`)) return { mostra: [] };
  }

  return { mostra: [nome] };
}

const TUTTE_LE_SPECIE: FactKind[] = [
  "cibo",
  "attivita",
  "persona",
  "lavoro",
  "luogo",
];

/**
 * Una lista intera. Toglie le voci che appartengono a un altro tipo, applica
 * i nomi veri, e non lascia doppioni: se in una giornata compaiono sia
 * "mio fratello" sia "Daniele", dopo la risoluzione sono la stessa persona e
 * la pastiglia e una sola.
 *
 * Una voce puo uscirne in DUE: "i miei amici" diventa Hoda e Liana. E lo
 * stesso motivo per cui il doppione va tolto qui e non a monte — se la
 * giornata dice sia "i miei amici" sia "Liana", Liana resta una sola.
 */
export function risolviLista(
  nomi: string[],
  kind: FactKind,
  indice: IndiceAlias,
): string[] {
  const visti = new Set<string>();
  const fuori: string[] = [];
  for (const n of nomi) {
    for (const mostra of risolvi(n, kind, indice).mostra) {
      const k = chiaveAlias(mostra);
      if (visti.has(k)) continue;
      visti.add(k);
      fuori.push(mostra);
    }
  }
  return fuori;
}
