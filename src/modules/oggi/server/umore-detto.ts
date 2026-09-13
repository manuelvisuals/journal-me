/**
 * L'umore si scrive SOLO se la persona ne ha parlato (Manuel, 13 settembre
 * 2026: "se non dici il tuo mood, automaticamente diventa so-so").
 *
 * Il codice era gia pronto per "non l'ha detto" (metrics.mood e null da
 * cima a fondo, la scheda mostra un trattino, come peso e sonno). Il
 * "cosi cosi" arrivava dal MODELLO: nel prompt 'neutral' era "normale, cosi
 * cosi", e una giornata raccontata senza emozioni forti a un modello sembra
 * "normale". Peso e sonno non hanno questo difetto perche sono numeri: un
 * 83,3 non si inventa, un "neutral" si.
 *
 * Quindi, come per il titolo (titoloInSentenceCase) e per il testo troppo
 * corto: la decisione la prende il codice con un righello, non il modello a
 * sensazione. Se nel racconto non c'e NESSUNA parola che parli di come la
 * persona si sente, l'umore che il modello ha scritto viene buttato.
 *
 * Il righello e volutamente largo (una parola dell'umore basta, in
 * qualunque punto del testo): il suo compito non e capire l'umore, e
 * distinguere "ne ha parlato" da "non ne ha parlato". Se una parola vera
 * manca dall'elenco, l'app mostra il trattino e la persona tocca la faccia:
 * un umore mancante si aggiunge in un tocco, uno inventato non si vede.
 *
 * Nessun import: lo legge anche il banco con --experimental-strip-types.
 */

/** Toglie accenti e maiuscole: "così" e "cosi" sono la stessa parola. */
function piatto(testo: string): string {
  return testo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Le parole dell'umore, italiano e inglese, come espressioni regolari su
 * testo gia "piatto". Ogni voce e un modo di dire COME CI SI SENTE: le
 * parole troppo comuni ("bene", "male", "good", "ok") entrano solo dentro
 * la locuzione che parla della persona ("sto bene", "feel good"), perche
 * da sole raccontano com'e andata una cosa, non com'e andata la persona.
 */
const VOCI: RegExp[] = [
  // la parola stessa
  /\b(umore|mood|morale|stato d'animo)\b/,
  // "mi sento", "mi sentivo", "sentirmi"
  /\b(mi sent[oi]|mi sentivo|mi sono sentit[oa]|sentirmi)\b/,
  /\b(sto|stavo|sono stat[oa]) (bene|benissimo|male|malissimo|meglio|peggio|giu|cosi cosi|una favola|uno straccio)\b/,
  // le facce dell'app, in parole
  /\b(seren[oa]|tranquill[oa]|felice|content[oa]|allegr[oa]|euforic[oa]|entusiast[ai]|rilassat[oa]|sollevat[oa]|motivat[oa]|energic[oa]|pien[oa] di energia|in forma|al settimo cielo|alla grande|fantastic[oa]mente|di buon umore|di ottimo umore)\b/,
  /\b(cosi cosi|sottotono|nella media|ne bene ne male|di cattivo umore|di pessimo umore)\b/,
  /\b(trist[ei]|giu di morale|abbattut[oa]|demoralizzat[oa]|malinconic[oa]|depress[oa]|svogliat[oa]|annoiat[oa]|frustrat[oa]|nervos[oa]|ansios[oa]|stressat[oa]|agitat[oa]|arrabbiat[oa]|esaust[oa]|sfinit[oa]|stanc[oa] mort[oa]|stanchissim[oa]|a pezzi|uno straccio)\b/,
  /\b(stanc[oa])\b/,
  // english
  /\b(i feel|i felt|i'm feeling|i was feeling|feeling|felt) (great|good|fine|ok|okay|so-so|meh|bad|awful|terrible|low|down|tired|exhausted|happy|sad|calm|relaxed|anxious|stressed|angry|upset|energetic|motivated|bored|frustrated|gloomy|serene|cheerful|glad|blue|drained|flat|numb|refreshed|rested)\b/,
  /\b(happy|cheerful|glad|joyful|serene|relaxed|energetic|motivated|refreshed|rested|euphoric|thrilled|excited|over the moon|in a good mood|in a great mood)\b/,
  /\b(so-so|meh|in a bad mood|in a foul mood|nothing special mood)\b/,
  /\b(sad|gloomy|depressed|tired|exhausted|drained|anxious|stressed|angry|upset|frustrated|bored|grumpy|irritable|moody|miserable|worn out|burnt out|burned out)\b/,
];

/** Vero se il racconto parla, da qualche parte, di come la persona si sente. */
export function umoreDetto(transcript: string): boolean {
  const t = piatto(transcript ?? "");
  if (t === "") return false;
  return VOCI.some((re) => re.test(t));
}

/**
 * L'umore che si salva: quello del modello se il racconto ne ha parlato,
 * altrimenti null. Il modello propone, il righello dispone.
 */
export function umoreDaSalvare<T extends string | null | undefined>(
  moodDelModello: T,
  transcript: string,
): T | null {
  if (!moodDelModello) return null;
  return umoreDetto(transcript) ? moodDelModello : null;
}
