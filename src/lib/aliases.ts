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
 *  - `{ mostra: "Daniele" }`  -> mostrala con questo nome
 *  - `{ mostra: null }`       -> NON va mostrata qui: appartiene a un altro
 *                                tipo (e "da Charlie" fra le persone)
 */
export function risolvi(
  nome: string,
  kind: FactKind,
  indice: IndiceAlias,
): { mostra: string | null } {
  const chiave = chiaveAlias(nome);
  if (!chiave) return { mostra: null };

  const suo = indice.get(`${kind}|${chiave}`);
  // Un soprannome senza nome vero vuol dire "questa cosa NON e di questo
  // tipo, e non lo sara mai": e la risposta a "nuovi amici" o "il gruppo del
  // calcetto", che sono persone al plurale, cioe nessuna persona in
  // particolare. Non serviva una tabella nuova: bastava una casella vuota.
  if (suo) return { mostra: suo.labelKey.trim() ? suo.labelKey : null };

  // Registrato sotto un'altra specie: qui non ci va. Si controllano tutte le
  // specie e non solo persona/luogo, perche il giorno che si chiarisce un
  // cibo o un lavoro deve valere la stessa regola senza ritocchi.
  for (const k of TUTTE_LE_SPECIE) {
    if (k === kind) continue;
    if (indice.has(`${k}|${chiave}`)) return { mostra: null };
  }

  return { mostra: nome };
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
 */
export function risolviLista(
  nomi: string[],
  kind: FactKind,
  indice: IndiceAlias,
): string[] {
  const visti = new Set<string>();
  const fuori: string[] = [];
  for (const n of nomi) {
    const { mostra } = risolvi(n, kind, indice);
    if (!mostra) continue;
    const k = chiaveAlias(mostra);
    if (visti.has(k)) continue;
    visti.add(k);
    fuori.push(mostra);
  }
  return fuori;
}
