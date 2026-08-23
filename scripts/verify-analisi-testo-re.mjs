// "Il testo di tutta la giornata e king" (decisione di Manuel, 21 agosto
// 2026): ogni modifica rifa TUTTA l'analisi da zero - titolo, sintesi, aree
// e persone - sullo stesso testo completo. Nessuna modifica, nessun
// ricalcolo.
//
// PERCHE QUESTO TEST NON APRE IL BROWSER. Le funzioni AI esistono solo in
// modalita cloud, e in cloud serve una sessione vera: in questo contenitore
// non c'e, e fingerla vorrebbe dire provare la finzione invece dell'app. Il
// comportamento a schermo si verifica sul sito vero, a mano.
//
// Quello che si prova qui e il CABLAGGIO, ed e esattamente cio che si era
// rotto: chi chiama cosa, con quale testo, e cosa viene scritto. I due bug
// nati da un cablaggio sbagliato:
//
//   1. i nomi letti dal solo pezzo nuovo, e scritti al posto dei vecchi:
//      aggiungevi "pranzo con Francesco" e Marco spariva;
//   2. la modifica del testo non rileggeva i nomi affatto: aggiungevi
//      Giulia alla frase e Giulia non compariva mai.
//
// Sono difetti di collegamento, non di modello: si vedono nel codice, e qui
// si bloccano nel codice.
import { readFileSync } from "node:fs";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}
const leggi = (p) => readFileSync(p, "utf8");
/** Il corpo di una funzione, per non confondere due punti diversi del file. */
function funzione(src, firma) {
  const i = src.indexOf(firma);
  if (i === -1) return "";
  return src.slice(i, i + 1400);
}

const analisi = leggi("src/lib/actions/analyze-day.ts");
const salva = leggi("src/lib/actions/save-recording.ts");
const oggi = leggi("src/modules/oggi/components/today-client.tsx");
const editor = leggi("src/modules/oggi/components/transcript-editor.tsx");
const cloud = leggi("src/lib/data/store/cloud.ts");
const locale = leggi("src/lib/data/store/local.ts");

/* ====== 1. una sola analisi, e legge tutto ====== */
{
  check(
    "riassunto e fatti escono dalla stessa funzione",
    /callProcessEntry\(transcript\)/.test(analisi) &&
      /callExtractFacts\(transcript\)/.test(analisi),
  );
  // Lo stesso identico testo a tutte e due: e la proprieta che mancava.
  const dentro = funzione(analisi, "export async function analyzeDay(");
  check(
    "ricevono lo STESSO testo, non due testi diversi",
    /callProcessEntry\(transcript\)/.test(dentro) &&
      /callExtractFacts\(transcript\)/.test(dentro),
    dentro.split("\n").find((l) => l.includes("Promise.all")) ?? "",
  );
  check(
    "le due letture partono insieme, non in fila",
    /Promise\.all/.test(dentro),
  );
}

/* ====== 2. tutte le strade passano di li ====== */
{
  check(
    "il salvataggio di un racconto analizza tutto il giorno",
    /analyzeDay\(fullTranscript\)/.test(salva),
  );
  check(
    "anche la modifica del testo rianalizza tutto",
    /analyzeDay\(newTranscript\)/.test(
      funzione(salva, "export async function reprocessEntryTranscript("),
    ),
  );
  check(
    "nessuno chiama piu le rotte AI per conto suo",
    !/api\/process-entry/.test(salva) && !/api\/extract-facts/.test(salva),
  );
  check(
    "la schermata Oggi non fa piu una lettura sua dei nomi",
    !/api\/extract-facts/.test(oggi),
  );
}

/* ====== 3. una lettura fallita non cancella niente ====== */
{
  check(
    "se i nomi non si leggono, il campo resta assente (non vuoto)",
    /people: people \?\? undefined/.test(analisi),
  );
  check(
    "e assente vuol dire NON TOCCARE, scritto nel contratto",
    /ASSENTE \(undefined\) significa NON TOCCARE/.test(
      leggi("src/lib/data/store/types.ts"),
    ),
  );
  check(
    "il cloud scrive i nomi solo se ci sono",
    /if \(ai\.people\) row\.people = ai\.people;/.test(cloud),
  );
  check(
    "il locale idem",
    /\.\.\.\(ai\.people \? \{ people: ai\.people \} : \{\}\)/.test(locale),
  );
  check(
    "quando l'AI non risponde affatto, i nomi non si toccano",
    /people: undefined/.test(funzione(analisi, "function fallbackFields(")),
  );
}

/* ====== 4. niente modifiche, niente spesa ====== */
{
  check(
    "Salva e spento se il testo non e cambiato",
    /disabled=\{!isDirty \|\| isEmpty\}/.test(editor),
  );
}

/* ====== 5. la giornata non si scrive piu da altre parti ====== */
{
  check(
    "la schermata delle persone non riscrive la giornata",
    !/saveEntryPeople/.test(oggi),
  );
  check(
    "e chiede solo chi aggiungere alla rubrica",
    /addPersonas/.test(oggi),
  );
  check(
    "un rifiuto viene ricordato, o la domanda tornerebbe ogni volta",
    /jm:persone-rifiutate/.test(oggi),
  );
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length === 0 ? 0 : 1);
