/**
 * Le traduzioni del modulo SITO (unite dal runtime i18n via
 * src/lib/i18n/en.ts).
 *
 * ATTENZIONE, qui c'e una divisione che conta: questo catalogo traduce SOLO
 * il pannello SEO, cioe l'unico pezzo del modulo che vive DENTRO l'app (in
 * /admin) e che quindi passa da t() come tutto il resto.
 *
 * Le parole del sito pubblico NON sono qui: stanno in
 * src/modules/sito/testi.ts, gia scritte nelle due lingue, perche la pagina
 * e server-rendered e deve arrivare al motore di ricerca gia nella lingua
 * del suo indirizzo. Il perche per esteso e in cima a quel file.
 */
export const SITO: Record<string, string> = {
  // Alcune frasi di questo pannello ("Titolo", "Anteprima", "Inglese",
  // "Salvo...") sono gia tradotte nel catalogo di un altro modulo: il
  // runtime unisce tutto, e definirle una seconda volta qui sarebbe un
  // conflitto silenzioso (verify-i18n lo fa diventare rosso). Si usano e
  // basta.
  "Sito": "Website",
  "Il titolo e la descrizione con cui dayalogue.com esce su Google. Le frasi dentro la pagina restano nel codice.":
    "The title and description dayalogue.com shows up with on Google. The words inside the page stay in the code.",
  "Pagina": "Page",
  "Pagina iniziale": "Home",
  "Assistenza": "Support",
  "Italiano": "Italian",
  "Come esce su Google": "How it shows up on Google",
  "Quello che si legge nella scheda del browser e in cima al risultato.":
    "What you read in the browser tab and at the top of the result.",
  "Descrizione": "Description",
  "Le due righe sotto il titolo, nel risultato di ricerca.":
    "The two lines under the title, in the search result.",
  "Quando lo condividi": "When you share it",
  "Titolo per i social": "Title for social",
  "Vuoto = usa il titolo qui sopra.": "Empty = use the title above.",
  "Immagine di anteprima": "Preview image",
  "L'indirizzo dell'immagine, 1200x630. Vuoto = nessuna immagine.":
    "The image address, 1200x630. Empty = no image.",
  "Visibilita": "Visibility",
  "Fatti trovare da Google": "Let Google find it",
  "Spento, la pagina resta online ma chiede ai motori di non indicizzarla.":
    "Off, the page stays online but asks search engines not to index it.",
};
