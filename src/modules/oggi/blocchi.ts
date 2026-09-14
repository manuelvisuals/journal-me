/**
 * I BLOCCHI di una registrazione: quando un blocco e pieno, quanto tempo
 * resta, come i testi dei blocchi tornano un racconto solo.
 *
 * Il 14 settembre 2026 alle 23:45 Manuel ha raccontato la giornata per 3
 * minuti e 52 (226 pezzi, 6.717.776 byte) e il server ha risposto 413: su
 * Vercel il corpo di una richiesta si ferma a ~4,5 MB, e il file non e mai
 * arrivato alla funzione che trascrive. In piu quella funzione ha 60 s di
 * esecuzione: anche un file leggero, se e lungo, non fa in tempo. Il tetto
 * e doppio, peso E tempo, e da qui la registrazione e A BLOCCHI, come le
 * note vocali: ogni blocco dura al massimo BLOCCO_TETTO_MS di parlato
 * inciso o BLOCCO_TETTO_BYTE di audio, quello che arriva PRIMA. Il blocco
 * pieno si chiude, se ne apre un altro sulla stessa traccia del microfono,
 * e i testi si cuciono in ordine.
 *
 * Questo file non ha un solo import, sul modello di pezzi.ts: e la parte
 * dove un racconto si puo perdere davvero (un blocco che non si chiude, un
 * tempo che scorre mentre il tasto e lasciato, un testo unito nell'ordine
 * sbagliato), e il banco la prova da sola senza montare mezza app:
 * scripts/verify-registrazione-blocchi.mjs.
 *
 * ATTENZIONE AL NOME: "split" e gia occupato da split-by-date, che smista un
 * racconto su piu GIORNI. Qui si parla di BLOCCHI dell'audio, e basta.
 */

/** Un blocco dura al massimo 3 minuti di parlato INCISO (scelta di Manuel). */
export const BLOCCO_TETTO_MS = 180_000;

/**
 * ...oppure 3,5 MB di audio: e la rete di sicurezza sotto i ~4,5 MB del
 * server (la multipart aggiunge intestazioni) per quando il telefono ignora
 * la qualita chiesta. audioBitsPerSecond e una richiesta, non un ordine.
 */
export const BLOCCO_TETTO_BYTE = 3_500_000;

/**
 * Chiudere un blocco costa qualche decina di millisecondi di microfono, e
 * in un silenzio non se ne accorge nessuno: percio, se quando la persona
 * LASCIA il tasto il blocco e gia oltre questa frazione, si chiude li,
 * invece di aspettare il limite e tagliare nel mezzo di una parola. Chi
 * parla senza mai lasciare arriva al limite e li il taglio si fa lo stesso:
 * una sillaba si perde, ed e il prezzo dichiarato.
 */
export const SOGLIA_CHIUSURA_AL_RILASCIO = 0.9;

/**
 * La qualita da chiedere al registratore, per codec. Il modello che
 * trascrive riduce tutto a 16 kHz mono: Opus a 32 kbit/s basta e avanza,
 * mentre l'AAC (iPhone) a 32 impasta le consonanti, che sono cio che
 * distingue un nome proprio: 64. Non lo stesso numero per due codec.
 * La qualita di fabbrica del browser era ~238 kbit/s: roba da musica.
 */
export const OPUS_BPS = 32_000;
export const AAC_BPS = 64_000;

export function bitrateRichiesto(mime: string): number {
  return /mp4|aac|mpeg/i.test(mime) ? AAC_BPS : OPUS_BPS;
}

/* ------------------------------------------------------------------------
   Il tempo inciso: cresce SOLO mentre il tasto e premuto.
   ------------------------------------------------------------------------ */

/**
 * L'orologio del blocco. Con il push-to-talk il registratore e in pausa
 * mentre pensi: un conto alla rovescia sull'orologio a muro direbbe una
 * bugia (30 secondi rimasti quando ne hai due minuti). Si conta quello che
 * viene inciso, punto: `incisoMs` e la somma dei tratti gia chiusi e
 * `premutoDa` e l'istante in cui e iniziato il tratto in corso (null se il
 * tasto e lasciato).
 */
export type Orologio = {
  incisoMs: number;
  premutoDa: number | null;
};

export function orologioNuovo(): Orologio {
  return { incisoMs: 0, premutoDa: null };
}

/** Il tasto viene premuto all'istante `ora`. Premere due volte non conta. */
export function premi(o: Orologio, ora: number): Orologio {
  if (o.premutoDa !== null) return o;
  return { incisoMs: o.incisoMs, premutoDa: ora };
}

/** Il tasto viene lasciato all'istante `ora`. Lasciare senza premere non conta. */
export function lascia(o: Orologio, ora: number): Orologio {
  if (o.premutoDa === null) return o;
  return {
    incisoMs: o.incisoMs + Math.max(0, ora - o.premutoDa),
    premutoDa: null,
  };
}

/** Il tempo inciso finora, letto all'istante `ora`. */
export function incisoMs(o: Orologio, ora: number): number {
  if (o.premutoDa === null) return o.incisoMs;
  return o.incisoMs + Math.max(0, ora - o.premutoDa);
}

/* ------------------------------------------------------------------------
   Quando un blocco e pieno.
   ------------------------------------------------------------------------ */

export type StatoBlocco = {
  /** Il tempo inciso in questo blocco. */
  incisoMs: number;
  /** I byte che il registratore ha davvero consegnato per questo blocco. */
  byte: number;
};

/** Perche un blocco si e chiuso: al limite di tempo, di peso, o al rilascio del tasto. */
export type MotivoChiusura = "tempo" | "byte" | "rilascio";

/**
 * Quanto e pieno il blocco, da 0 a 1: la piu alta fra la frazione di tempo
 * e la frazione di byte. E su questa che si disegna la barra, perche e
 * fatta di byte VERI: se il telefono registra piu pesante di quanto
 * chiesto, la barra corre piu in fretta dell'orologio e dice la verita.
 */
export function avanzamento(s: StatoBlocco): number {
  const t = s.incisoMs / BLOCCO_TETTO_MS;
  const b = s.byte / BLOCCO_TETTO_BYTE;
  return Math.min(1, Math.max(0, t, b));
}

/** Il limite raggiunto, se uno dei due e stato raggiunto. Altrimenti null. */
export function limiteRaggiunto(s: StatoBlocco): "tempo" | "byte" | null {
  if (s.incisoMs >= BLOCCO_TETTO_MS) return "tempo";
  if (s.byte >= BLOCCO_TETTO_BYTE) return "byte";
  return null;
}

/**
 * Il blocco va chiuso ADESSO che il tasto e stato lasciato? Si, se e oltre
 * la soglia: meglio un taglio in un silenzio che uno in mezzo a una parola
 * fra pochi secondi.
 */
export function chiudereAlRilascio(s: StatoBlocco): boolean {
  return avanzamento(s) >= SOGLIA_CHIUSURA_AL_RILASCIO;
}

/**
 * Quanto tempo di parlato resta nel blocco, in ms. Tiene conto anche dei
 * byte: se il ritmo misurato e alto, i byte finiscono prima del tempo e il
 * tempo che resta e quello che i byte concedono, non i 3 minuti sperati.
 */
export function restanteMs(s: StatoBlocco): number {
  const perTempo = Math.max(0, BLOCCO_TETTO_MS - s.incisoMs);
  const ritmo = ritmoByteAlSecondo(s);
  if (ritmo === null) return perTempo;
  const perByte = Math.max(0, ((BLOCCO_TETTO_BYTE - s.byte) / ritmo) * 1000);
  return Math.min(perTempo, perByte);
}

/**
 * Il ritmo reale, byte al secondo di parlato inciso, misurato dai pezzi
 * che arrivano. Null finche non c'e almeno un secondo inciso: un ritmo
 * calcolato su 80 ms e un numero a caso.
 */
export function ritmoByteAlSecondo(s: StatoBlocco): number | null {
  if (s.incisoMs < 1000 || s.byte <= 0) return null;
  return s.byte / (s.incisoMs / 1000);
}

/* ------------------------------------------------------------------------
   I testi dei blocchi tornano un racconto solo.
   ------------------------------------------------------------------------ */

/**
 * L'esito della trascrizione di un blocco. `testo === null` vuol dire che
 * la trascrizione NON e riuscita (rete, tetto, server), che e una cosa
 * diversa da un blocco muto (testo ""): un blocco muto sparisce, un
 * blocco guasto lascia un buco dichiarato.
 */
export type EsitoBlocco = {
  /** La posizione del blocco nella registrazione, da 0. */
  indice: number;
  testo: string | null;
};

export type Racconto = {
  /** Il testo unito. Vuoto se nessun blocco ha portato parole. */
  testo: string;
  /** Quanti blocchi hanno fallito (e lasciato il segnaposto). */
  guasti: number;
  /** Quanti blocchi hanno portato parole. */
  riusciti: number;
};

/**
 * I testi si uniscono IN ORDINE DI INDICE, qualunque sia l'ordine in cui
 * gli esiti sono arrivati, con UNO SPAZIO in mezzo: non con il separatore
 * `\n---\n` di pezzi.ts, che divide i racconti aggiunti in giorni diversi,
 * non i pezzi di uno stesso racconto. Un blocco fallito non porta via gli
 * altri: al suo posto si scrive `segnaposto` (una riga onesta, tradotta
 * dal chiamante). Se NESSUN blocco ha portato parole il testo e vuoto, con
 * i guasti contati: chi chiama decide se e un racconto muto (zero guasti)
 * o una trascrizione fallita (da riprovare, non da salvare).
 */
export function unisciTesti(esiti: EsitoBlocco[], segnaposto: string): Racconto {
  const inOrdine = [...esiti].sort((a, b) => a.indice - b.indice);
  const parti: string[] = [];
  let guasti = 0;
  let riusciti = 0;
  for (const e of inOrdine) {
    if (e.testo === null) {
      guasti += 1;
      parti.push(segnaposto);
      continue;
    }
    const t = e.testo.trim();
    if (t === "") continue;
    riusciti += 1;
    parti.push(t);
  }
  if (riusciti === 0) return { testo: "", guasti, riusciti };
  return { testo: parti.join(" "), guasti, riusciti };
}

/**
 * La coda del testo di un blocco, da passare come contesto al blocco dopo.
 * Tagliando l'audio si ricrea la condizione che fece abbandonare il
 * realtime ("il modello non vedeva mai piu di un frammento" e i nomi
 * propri ne soffrivano): la cucitura compensa, il modello riprende il
 * filo. Le ultime `parole` parole, niente di piu: un prompt lungo costa e
 * non aiuta.
 */
export function codaDelTesto(testo: string, parole = 40): string {
  const tutte = testo.match(/\S+/g) ?? [];
  if (tutte.length === 0) return "";
  return tutte.slice(-parole).join(" ");
}
