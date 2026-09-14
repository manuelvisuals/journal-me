// Spostare un racconto sul giorno giusto (14 settembre 2026, Manuel:
// "se sbaglio la data non posso correggerla"; mockup
// MOCKUP-sposta-giorno.html, risposte 1B 2C 3C).
//
// Cosa deve essere vero:
//  1. la chirurgia sul testo: si stacca SOLO l'ultimo pezzo, e niente si
//     perde ne si duplica — il pezzo staccato piu quello che resta fanno
//     sempre il testo di partenza;
//  2. il testo del giorno che riceve: in fondo, sotto il separatore, e
//     senza separatori a vuoto se era vuoto;
//  3. l'ordine delle scritture e le due domande: prima il giorno che
//     riceve, e la domanda sul giorno svuotato si fa PRIMA di scrivere;
//  4. i chiamanti: la data si tocca nella rilettura e nel transcript, e
//     una data scelta a mano spegne lo split.
//
//   node --experimental-strip-types scripts/verify-sposta-giorno.mjs
import { readFileSync } from "node:fs";
import {
  SEP_PEZZI,
  pezziDi,
  senzaUltimoPezzo,
  testoUnito,
  ultimoPezzo,
} from "../src/modules/oggi/pezzi.ts";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

/* ============ 1. la chirurgia ============ */
const tre = ["mattina in ufficio", "pranzo con Hoda", "sera in palestra"].join(SEP_PEZZI);
check("1 tre pezzi si contano tre", pezziDi(tre).length === 3);
check("1 l'ultimo pezzo e l'ultimo", ultimoPezzo(tre) === "sera in palestra");
check("1 quello che resta sono i primi due", senzaUltimoPezzo(tre) === ["mattina in ufficio", "pranzo con Hoda"].join(SEP_PEZZI));
check("1 niente si perde: resto + pezzo = partenza", senzaUltimoPezzo(tre) + SEP_PEZZI + ultimoPezzo(tre) === tre);

const uno = "una giornata sola, senza separatori";
check("1 un pezzo solo: si sposta lui", ultimoPezzo(uno) === uno);
check("1 un pezzo solo: non resta niente", senzaUltimoPezzo(uno) === "");

check("1 il testo vuoto non ha pezzi", ultimoPezzo("   ") === "" && senzaUltimoPezzo("") === "");
check("1 un separatore in fondo non e un pezzo", ultimoPezzo("prima" + SEP_PEZZI) === "prima");
check("1 due separatori di fila non creano un pezzo vuoto", pezziDi("a" + SEP_PEZZI + SEP_PEZZI + "b").length === 2);
check("1 gli spazi intorno ai pezzi si puliscono", ultimoPezzo("a" + SEP_PEZZI + "  b  ") === "b");
/* Un trattino in mezzo a una frase NON deve tagliare niente: chi scrive usa
   i trattini, e perdere meta racconto per una lineetta sarebbe il difetto
   peggiore di tutti. */
check("1 un trattino nel testo non taglia", pezziDi("ho detto - come sempre - che andava bene").length === 1);
check("1 una riga di trattini senza a capo prima non taglia", pezziDi("prima --- dopo").length === 1);

/* ============ 2. il giorno che riceve ============ */
check("2 su un giorno vuoto niente separatore", testoUnito("", "nuovo") === "nuovo");
check("2 su un giorno di soli spazi niente separatore", testoUnito("   \n ", "nuovo") === "nuovo");
check("2 su un giorno pieno il pezzo va IN FONDO", testoUnito("vecchio", "nuovo") === "vecchio" + SEP_PEZZI + "nuovo");
check("2 il giorno che riceve non perde il suo (sta davanti)", testoUnito("vecchio", "nuovo").startsWith("vecchio"));
check("2 due spostamenti di fila restano tre pezzi", pezziDi(testoUnito(testoUnito("a", "b"), "c")).length === 3);

/* ============ 3. l'azione ============ */
const azione = readFileSync("src/modules/oggi/sposta-giorno.ts", "utf8");
const iRiceve = azione.indexOf("reprocessEntryTranscript(opts.a");
const iParte = azione.indexOf("reprocessEntryTranscript(opts.da");
const iCancella = azione.indexOf("deleteEntry(opts.da)");
check("3 prima si scrive il giorno che RICEVE", iRiceve > 0 && iParte > iRiceve, `${iRiceve} < ${iParte}`);
check("3 si cancella solo dopo aver scritto la destinazione", iCancella > iRiceve);
check("3 lo stesso giorno non e uno spostamento", /opts\.da === opts\.a/.test(azione));
check("3 senza pezzo non si fa niente", /pezzo === ""\)? ?throw|if \(pezzo === ""\) throw/.test(azione));
check("3 'lascia vuota' svuota anche titolo e sintesi", /headline: "", snippet: "", areas: \[\], people: \[\]/.test(azione));

const foglio = readFileSync("src/modules/oggi/components/foglio-sposta.tsx", "utf8");
const iDomanda = foglio.indexOf('setPasso("vuoto")');
const iEsegui = foglio.indexOf("async function esegui");
check("3 la domanda sul giorno svuotato esiste", iDomanda > 0);
check("3 si chiede PRIMA di scrivere", /if \(restaVuoto\) setPasso\("vuoto"\);/.test(foglio) && iEsegui > 0);
check("3 il testo spostato e quello nell'editor, non quello a database", /transcript=\{value\}/.test(readFileSync("src/modules/oggi/components/transcript-editor.tsx", "utf8")));

/* ============ 4. i chiamanti ============ */
const rilettura = readFileSync("src/modules/oggi/components/review-screen.tsx", "utf8");
check("4 la rilettura ha la pastiglia della data", /ChipData/.test(rilettura) && /DatePickerPopover/.test(rilettura));
const editor = readFileSync("src/modules/oggi/components/transcript-editor.tsx", "utf8");
check("4 il transcript ha la pastiglia della data", /ChipData/.test(editor));
check("4 lo stesso giorno non apre il foglio", /if \(iso !== date\) setDestinazione\(iso\)/.test(editor));
const today = readFileSync("src/modules/oggi/components/today-client.tsx", "utf8");
check("4 scegliere la data nella rilettura spegne lo split", /dataScelta: true/.test(today) && /skipSplit: pending\.dataScelta/.test(today));
check("4 dopo lo spostamento la schermata di oggi si aggiorna", /setEntry\(esito\.partenza\)/.test(today));
const day = readFileSync("src/modules/oggi/components/day-client.tsx", "utf8");
check("4 anche /giorno puo spostare", /onSpostato=\{\(esito\)/.test(day));

const ko = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - ko}/${results.length} verdi`);
process.exit(ko ? 1 : 0);
