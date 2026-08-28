/**
 * Le macro-aree: il contratto, e l'elenco cotto dentro come rete di
 * sicurezza.
 *
 * PERCHE STA NELLO SCHELETRO E NON NEL MODULO ADMIN. Le aree le SCRIVE il
 * pannello admin, ma le LEGGONO il riassunto della giornata, le domande di
 * chiarimento, la schermata del giorno e i recap. Se vivessero dentro
 * `modules/admin`, il modulo `oggi` dovrebbe importare da li: l'app che
 * lavora dipenderebbe dal suo pannello di controllo, che e la dipendenza al
 * contrario. Il pannello si puo spegnere, il diario no.
 *
 * CHIAVE E NOME SONO DUE COSE DIVERSE. Dentro ogni giornata salvata
 * (entries.areas) c'e scritta la chiave. Il nome e solo cio che si legge a
 * schermo e si puo cambiare quando si vuole senza toccare lo storico. Per
 * questo le sei chiavi storiche sono le etichette maiuscole di sempre.
 *
 * L'ELENCO QUI SOTTO NON E UN DOPPIONE, E UNA RETE. La modalita locale non
 * fa nemmeno una richiesta di rete (SPEC-v2 §1) e il guscio iOS deve
 * disegnare una giornata anche in aereo: senza un elenco cotto dentro il
 * pacchetto, quelle due promesse si rompono. Chi ha il cloud legge dal
 * database e sorpassa questa lista; chi non ce l'ha vede le sei di sempre.
 */

export type Area = {
  /** Opaca e immutabile: e cio che finisce dentro le giornate. */
  chiave: string;
  nome: string;
  nomeEn: string;
  /** Finisce parola per parola nelle istruzioni del modello. */
  cosaCiVa: string;
  ordine: number;
  /** Il nome del disegno, o niente: Corpo non ha mai avuto un'icona. */
  icona: string | null;
  attiva: boolean;
};

/** Le sei di sempre. Copia esatta del seed della migration 015. */
export const AREE_DI_FABBRICA: Area[] = [
  {
    chiave: "Lavoro",
    nome: "Lavoro",
    nomeEn: "Work",
    cosaCiVa:
      "Progetti, ufficio, studio fatto per lavoro, soldi guadagnati, colleghi in quanto colleghi.",
    ordine: 10,
    icona: "lavoro",
    attiva: true,
  },
  {
    chiave: "Relazioni",
    nome: "Relazioni",
    nomeEn: "Relationships",
    cosaCiVa:
      "Persone incontrate o nominate, famiglia, amici, appuntamenti. Una persona nominata sta sempre qui.",
    ordine: 20,
    icona: "relazioni",
    attiva: true,
  },
  {
    chiave: "Cibo",
    nome: "Cibo",
    nomeEn: "Food",
    cosaCiVa: "Cosa ha mangiato e bevuto. Un pasto sta sempre qui, mai in Corpo.",
    ordine: 30,
    icona: "cibo",
    attiva: true,
  },
  {
    chiave: "Movimento",
    nome: "Movimento",
    nomeEn: "Movement",
    cosaCiVa:
      "Palestra, camminate, sport, piscina fatta per allenarsi. Il corpo che si muove apposta.",
    ordine: 40,
    icona: "movimento",
    attiva: true,
  },
  {
    chiave: "Corpo",
    nome: "Corpo",
    nomeEn: "Body",
    cosaCiVa:
      "Il resto del corpo che non e ne cibo ne movimento: sonno, stanchezza, dolori, malattie, peso.",
    ordine: 50,
    icona: null,
    attiva: true,
  },
  {
    chiave: "Emozioni",
    nome: "Emozioni",
    nomeEn: "Emotions",
    cosaCiVa:
      "Come si e sentito, se lo dice. Qui non si interpreta: niente letture psicologiche non richieste.",
    ordine: 60,
    icona: "emozioni",
    attiva: true,
  },
];

/** Il nome da mostrare, nella lingua in cui l'app sta parlando. */
export function nomeArea(a: Area, lang: string): string {
  return lang === "en" ? a.nomeEn : a.nome;
}

/**
 * Il nome da mostrare partendo dalla chiave scritta in una giornata. Una
 * chiave che non esiste piu (area cancellata a mano nel database) non deve
 * far sparire il testo: si mostra la chiave cosi com'e.
 */
export function nomeDaChiave(aree: Area[], chiave: string, lang: string): string {
  const a = aree.find((x) => x.chiave === chiave);
  return a ? nomeArea(a, lang) : chiave;
}

/** Solo le attive, in ordine: e cio che si offre al modello e all'utente. */
export function areeAttive(aree: Area[]): Area[] {
  return aree.filter((a) => a.attiva).sort((a, b) => a.ordine - b.ordine);
}

/**
 * Da una riga del database all'oggetto Area. Sta qui e non in due posti
 * perche server e client leggono la stessa tabella con la stessa forma.
 */
export function areaDaRiga(r: Record<string, unknown>): Area | null {
  const chiave = typeof r.chiave === "string" ? r.chiave : null;
  if (!chiave) return null;
  return {
    chiave,
    nome: typeof r.nome === "string" ? r.nome : chiave,
    nomeEn: typeof r.nome_en === "string" ? r.nome_en : chiave,
    cosaCiVa: typeof r.cosa_ci_va === "string" ? r.cosa_ci_va : "",
    ordine: typeof r.ordine === "number" ? r.ordine : 999,
    icona: typeof r.icona === "string" ? r.icona : null,
    attiva: r.attiva !== false,
  };
}

/** L'indirizzo REST della tabella. Lo usano sia il server sia il client. */
export function urlAree(base: string): string {
  return `${base.replace(/\/$/, "")}/rest/v1/aree?select=*&order=ordine.asc`;
}
