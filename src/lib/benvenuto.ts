/**
 * Il messaggio di benvenuto: il contratto, e il testo cotto dentro come
 * rete di sicurezza.
 *
 * PERCHE STA NELLO SCHELETRO E NON NEL MODULO ADMIN. Stessa ragione delle
 * aree (src/lib/aree.ts): il messaggio lo SCRIVE il pannello admin, ma lo
 * LEGGE il saluto all'avvio, che vive nel modulo accesso. Se vivesse dentro
 * `modules/admin`, il modulo accesso dovrebbe importare dal pannello di
 * controllo: la dipendenza al contrario. Il pannello si puo' spegnere, il
 * saluto no.
 *
 * IL TESTO QUI SOTTO NON E' UN DOPPIONE, E' UNA RETE. In modalita' locale
 * l'app non fa nemmeno una richiesta di rete (SPEC-v2 par. 1) e il guscio
 * iOS deve saper disegnare il benvenuto anche in aereo. Chi ha il cloud
 * legge dal database e sorpassa questo testo; chi non ce l'ha vede questo.
 *
 * DUE LINGUE, UNA DI RISERVA. Se il campo inglese e' vuoto si mostra
 * l'italiano: meglio una frase nella lingua sbagliata che un riquadro
 * vuoto.
 */

export type Benvenuto = {
  attivo: boolean;
  /** Alzato di uno dal pannello, fa cadere tutti i "non mostrare piu". */
  versione: number;

  occhiello: string;
  promessa: string;
  evidenza: string;
  /** Righe vuote fra i paragrafi; *fra asterischi* = grassetto. */
  testo: string;
  firma: string;
  bottone: string;
  /** La riga cliccabile in fondo. Senza indirizzo non compare. */
  contattoRiga: string;
  contattoUrl: string;

  occhielloEn: string;
  promessaEn: string;
  evidenzaEn: string;
  testoEn: string;
  firmaEn: string;
  bottoneEn: string;
  contattoRigaEn: string;

  /** data URL, oppure null: allora vale il file cotto nel pacchetto. */
  fotoData: string | null;
  logoTemaChiaroData: string | null;
  logoTemaScuroData: string | null;
};

/** La foto committata nel repo: e' il valore di riserva di `fotoData`. */
export const FOTO_DI_FABBRICA = "/foto-benvenuto.jpg";

/** Copia esatta del seed della migration 018. */
export const BENVENUTO_DI_FABBRICA: Benvenuto = {
  attivo: true,
  versione: 1,

  occhiello: "Benvenuto in",
  promessa:
    "Racconti la giornata a voce, come viene. dayalogue la scrive, le da un titolo e la divide in aree, e te la rida nel Mese e nei Recap.",
  evidenza: "Nessuna pubblicita. Le tue giornate non si vendono.",
  testo:
    "Ho fatto dayalogue come il diario che volevo per me: cinque minuti a fine giornata, e mesi dopo ritrovarci qualcosa.\n\nE' ancora il progetto di una persona sola, agli inizi: quello che mi scrivi cambia davvero cosa arriva dopo.\n\nSe qualcosa e confuso, rotto o manca, *scrivimi prima di lasciar perdere*. Leggo tutti i messaggi e rispondo io.",
  firma: "Manuel",
  bottone: "Inizia",
  contattoRiga: "Hai gia qualcosa in mente? Scrivimi qui",
  // La pagina dei contatti esiste (modulo `sito`, /support): da qui si
  // accende anche la linguetta Feedback, che legge lo stesso indirizzo.
  contattoUrl: "/support",

  occhielloEn: "Welcome to",
  promessaEn:
    "Tell your day out loud, just as it comes. dayalogue writes it down, gives it a headline, splits it into areas, and hands it back in Month and Recaps.",
  evidenzaEn: "No ads. Your days are never sold.",
  testoEn:
    "I built dayalogue as the diary I wanted for myself: five minutes at the end of the day, and something worth finding again months later.\n\nIt is still an early-stage, one-person project, so what you write me genuinely shapes what comes next.\n\nIf something feels confusing, broken or missing, *please message me before giving up*. I read every message and reply personally.",
  firmaEn: "Manuel",
  bottoneEn: "Get started",
  contattoRigaEn: "Already have something in mind? Tell me here",

  fotoData: null,
  logoTemaChiaroData: null,
  logoTemaScuroData: null,
};

/** Il messaggio gia' risolto nella lingua in cui l'app sta parlando. */
export type BenvenutoInLingua = {
  occhiello: string;
  promessa: string;
  evidenza: string;
  testo: string;
  firma: string;
  bottone: string;
  contattoRiga: string;
  contattoUrl: string;
};

function oItaliano(en: string, it: string): string {
  return en.trim() !== "" ? en : it;
}

export function benvenutoInLingua(b: Benvenuto, lang: string): BenvenutoInLingua {
  if (lang !== "en") {
    return {
      occhiello: b.occhiello,
      promessa: b.promessa,
      evidenza: b.evidenza,
      testo: b.testo,
      firma: b.firma,
      bottone: b.bottone,
      contattoRiga: b.contattoRiga,
      contattoUrl: b.contattoUrl,
    };
  }
  return {
    occhiello: oItaliano(b.occhielloEn, b.occhiello),
    promessa: oItaliano(b.promessaEn, b.promessa),
    evidenza: oItaliano(b.evidenzaEn, b.evidenza),
    testo: oItaliano(b.testoEn, b.testo),
    firma: oItaliano(b.firmaEn, b.firma),
    bottone: oItaliano(b.bottoneEn, b.bottone),
    // L'indirizzo e' uno solo: cambia la frase, non la destinazione.
    contattoRiga: oItaliano(b.contattoRigaEn, b.contattoRiga),
    contattoUrl: b.contattoUrl,
  };
}

/**
 * Il testo in paragrafi. Una riga vuota separa un paragrafo dall'altro; le
 * righe singole dentro un paragrafo restano attaccate, perche' chi incolla
 * da un editor manda a capo dove capita e non intendeva un paragrafo nuovo.
 */
export function paragrafi(testo: string): string[] {
  return testo
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter((p) => p !== "");
}

/** Un pezzo di paragrafo: normale, oppure in grassetto. */
export type Pezzo = { testo: string; forte: boolean };

/**
 * Il grassetto, *fra asterischi*. Niente markdown vero: un formato con una
 * regola sola si spiega in mezza riga sotto al campo del pannello, e non
 * apre la porta a link e titoli dentro una lettera di sei righe.
 *
 * Un asterisco spaiato resta un asterisco: sparire in silenzio sarebbe
 * peggio che vedersi.
 */
export function pezzi(paragrafo: string): Pezzo[] {
  const out: Pezzo[] = [];
  const re = /\*([^*\n]+)\*/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(paragrafo)) !== null) {
    if (m.index > ultimo) {
      out.push({ testo: paragrafo.slice(ultimo, m.index), forte: false });
    }
    out.push({ testo: m[1], forte: true });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < paragrafo.length) {
    out.push({ testo: paragrafo.slice(ultimo), forte: false });
  }
  return out.length > 0 ? out : [{ testo: paragrafo, forte: false }];
}

function testoDiRiga(r: Record<string, unknown>, k: string): string {
  const v = r[k];
  return typeof v === "string" ? v : "";
}

function dataDiRiga(r: Record<string, unknown>, k: string): string | null {
  const v = r[k];
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

/** Da una riga del database all'oggetto. Server e client leggono uguale. */
export function benvenutoDaRiga(r: Record<string, unknown>): Benvenuto {
  return {
    attivo: r.attivo !== false,
    versione: typeof r.versione === "number" ? r.versione : 1,

    occhiello: testoDiRiga(r, "occhiello"),
    promessa: testoDiRiga(r, "promessa"),
    evidenza: testoDiRiga(r, "evidenza"),
    testo: testoDiRiga(r, "testo"),
    firma: testoDiRiga(r, "firma"),
    bottone: testoDiRiga(r, "bottone"),
    contattoRiga: testoDiRiga(r, "contatto_riga"),
    contattoUrl: testoDiRiga(r, "contatto_url"),

    occhielloEn: testoDiRiga(r, "occhiello_en"),
    promessaEn: testoDiRiga(r, "promessa_en"),
    evidenzaEn: testoDiRiga(r, "evidenza_en"),
    testoEn: testoDiRiga(r, "testo_en"),
    firmaEn: testoDiRiga(r, "firma_en"),
    bottoneEn: testoDiRiga(r, "bottone_en"),
    contattoRigaEn: testoDiRiga(r, "contatto_riga_en"),

    fotoData: dataDiRiga(r, "foto_data"),
    logoTemaChiaroData: dataDiRiga(r, "logo_tema_chiaro_data"),
    logoTemaScuroData: dataDiRiga(r, "logo_tema_scuro_data"),
  };
}

/** L'indirizzo REST della tabella. Lo usano sia il server sia il client. */
export function urlBenvenuto(base: string): string {
  return `${base.replace(/\/$/, "")}/rest/v1/benvenuto?select=*&id=eq.1`;
}
