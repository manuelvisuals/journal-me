/**
 * I testi che Google legge, e la rete di sicurezza quando il database non
 * risponde.
 *
 * Questo file non importa React ne Next di proposito: lo leggono sia il
 * server (per costruire i metadata della pagina) sia il pannello dentro
 * /admin, e un import di troppo qui dentro si porta dietro mezza app in
 * due posti che non ne hanno bisogno.
 */

export type PaginaSito = "home" | "support";

export const PAGINE: readonly PaginaSito[] = ["home", "support"] as const;

export type LinguaSito = "it" | "en";

/** Una riga di `sito_seo` come viaggia fra database, rotta e pannello. */
export type RigaSeo = {
  pagina: PaginaSito;
  titolo_it: string;
  descrizione_it: string;
  titolo_en: string;
  descrizione_en: string;
  og_titolo_it: string;
  og_titolo_en: string;
  og_immagine: string | null;
  indicizzabile: boolean;
};

/**
 * I testi di fabbrica. Sono gli stessi che la migration 019 inserisce, e la
 * ragione per cui esistono due volte e una sola: se il database non risponde
 * la pagina deve uscire lo stesso, con un titolo vero. Un sito che va giu
 * perche una tabella di configurazione tace sarebbe peggio del problema che
 * quella tabella risolve.
 */
export const SEO_DI_FABBRICA: Record<PaginaSito, RigaSeo> = {
  home: {
    pagina: "home",
    titolo_it: "dayalogue - il diario che si racconta a voce",
    descrizione_it:
      "Parli due minuti a fine giornata: dayalogue trascrive, scrive il titolo e la sintesi, e tiene in ordine persone e ricordi.",
    titolo_en: "dayalogue - the journal you tell out loud",
    descrizione_en:
      "Talk for two minutes at the end of the day: dayalogue transcribes it, writes the headline and the summary, and keeps your people and notes in order.",
    og_titolo_it: "Racconta la giornata. Il resto lo scrive lui.",
    og_titolo_en: "Tell your day. It writes the rest.",
    og_immagine: null,
    indicizzabile: true,
  },
  support: {
    pagina: "support",
    titolo_it: "Assistenza - dayalogue",
    descrizione_it:
      "Qualcosa non funziona o hai una domanda? Scrivici da qui: rispondiamo a tutti.",
    titolo_en: "Support - dayalogue",
    descrizione_en:
      "Something not working, or a question? Write to us here: we answer everyone.",
    og_titolo_it: "",
    og_titolo_en: "",
    og_immagine: null,
    indicizzabile: true,
  },
};

/** I limiti che il pannello mostra: non tagliano, avvisano. */
export const LIMITI = {
  titolo: 60,
  descrizione: 155,
  ogTitolo: 90,
} as const;

/** Il testo giusto per la lingua, con la riserva quando il campo e vuoto. */
export function titoloDi(riga: RigaSeo, lingua: LinguaSito): string {
  const scelto = lingua === "it" ? riga.titolo_it : riga.titolo_en;
  const riserva = SEO_DI_FABBRICA[riga.pagina];
  return (
    scelto.trim() ||
    (lingua === "it" ? riserva.titolo_it : riserva.titolo_en)
  );
}

export function descrizioneDi(riga: RigaSeo, lingua: LinguaSito): string {
  const scelto = lingua === "it" ? riga.descrizione_it : riga.descrizione_en;
  const riserva = SEO_DI_FABBRICA[riga.pagina];
  return (
    scelto.trim() ||
    (lingua === "it" ? riserva.descrizione_it : riserva.descrizione_en)
  );
}

/** Il titolo social: vuoto vuol dire "usa quello normale", non "niente". */
export function ogTitoloDi(riga: RigaSeo, lingua: LinguaSito): string {
  const scelto = lingua === "it" ? riga.og_titolo_it : riga.og_titolo_en;
  return scelto.trim() || titoloDi(riga, lingua);
}

const CAMPI =
  "pagina,titolo_it,descrizione_it,titolo_en,descrizione_en,og_titolo_it,og_titolo_en,og_immagine,indicizzabile";

/** L'indirizzo REST della tabella, in lettura pubblica. */
export function urlSeo(base: string): string {
  return `${base.replace(/\/$/, "")}/rest/v1/sito_seo?select=${CAMPI}`;
}

/** Da riga grezza a riga tipata, o null se non ha la forma giusta. */
export function seoDaRiga(x: Record<string, unknown>): RigaSeo | null {
  const pagina = x.pagina;
  if (typeof pagina !== "string") return null;
  if (!PAGINE.includes(pagina as PaginaSito)) return null;
  const testo = (v: unknown): string => (typeof v === "string" ? v : "");
  return {
    pagina: pagina as PaginaSito,
    titolo_it: testo(x.titolo_it),
    descrizione_it: testo(x.descrizione_it),
    titolo_en: testo(x.titolo_en),
    descrizione_en: testo(x.descrizione_en),
    og_titolo_it: testo(x.og_titolo_it),
    og_titolo_en: testo(x.og_titolo_en),
    og_immagine: typeof x.og_immagine === "string" ? x.og_immagine : null,
    indicizzabile: x.indicizzabile !== false,
  };
}
