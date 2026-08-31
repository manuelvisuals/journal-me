// Le domande che l'AI fa invece di indovinare (23 agosto 2026).
//
// Regola di Manuel: "l'AI non deve MAI indovinare". Questo test controlla che
// sia vera anche nei tre punti in cui e facile tradirla senza accorgersene:
//
//   1. Saltando una domanda. "Non saprei" deve lasciare la cosa SENZA area,
//      non sceglierne una a caso. Se il salto scegliesse, la regola sarebbe
//      finta esattamente dove serve di piu.
//   2. Sui soprannomi. "Mio fratello" e Daniele PER SEMPRE, e "da Charlie"
//      e un posto, quindi deve sparire dalle persone. Se l'alias valesse
//      solo per il futuro, le giornate di marzo resterebbero sbagliate.
//   3. Non richiedendo cio che e gia stato chiarito. Una domanda gia
//      risposta e la piu irritante di tutte, ed e anche la piu facile da
//      lasciarsi scappare.
//
// La parte pura gira senza browser e senza rete: i due moduli importati qui
// hanno solo importazioni di tipo, quindi node li legge direttamente.
// Uso: node --experimental-strip-types scripts/verify-chiarimenti.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const leggi = (p) => readFileSync(join(ROOT, p), "utf8");
/**
 * Il codice senza i commenti. Serve dove si cerca l'ASSENZA di qualcosa: il
 * file spiega a parole perche la schermata di permesso e stata tolta, e un
 * controllo ingenuo scambierebbe la spiegazione per la cosa spiegata.
 */
const senzaCommenti = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const { spostaFraAree } = await import(join(ROOT, "src/lib/chiarimenti-aree.ts"));
const { chiaveAlias, dividiNomi, indicizza, risolvi, risolviLista, uniscoNomi } =
  await import(join(ROOT, "src/lib/aliases.ts"));
const { ritagliaCitazione, spezzaAttorno } = await import(
  join(ROOT, "src/modules/oggi/citazione.ts")
);

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}
const uguali = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ============ 1. le aree: dove finisce la piscina di oggi ============ */

const AREE = [
  { label: "Relazioni", text: "Incontrato amici in piscina. Cena da Charlie." },
  { label: "Cibo", text: "Pizza margherita." },
];

{
  // Il caso vero del 22 agosto: la piscina era finita in Relazioni, e
  // rispondi che era allenamento.
  const dopo = spostaFraAree(AREE, "pomeriggio in piscina", ["Movimento"], [
    "Relazioni",
    "Movimento",
  ]);
  const mov = dopo.find((a) => a.label === "Movimento");
  check(
    "scegliendo Movimento, l'area compare",
    !!mov && /piscina/i.test(mov.text),
    JSON.stringify(mov),
  );
  check(
    "e le aree che non c'entravano restano intatte",
    uguali(dopo.find((a) => a.label === "Cibo"), AREE[1]),
  );
}

{
  // "Tutte e due": una cosa puo essere sport E compagnia.
  const dopo = spostaFraAree(AREE, "piscina", ["Relazioni", "Movimento"], [
    "Relazioni",
    "Movimento",
  ]);
  check(
    "'tutte e due' la mette in tutte e due",
    dopo.some((a) => a.label === "Relazioni") &&
      dopo.some((a) => a.label === "Movimento"),
    dopo.map((a) => a.label).join(", "),
  );
}

{
  // IL CASO CHE CONTA. "Non saprei" = nessuna scelta: la piscina esce da
  // Relazioni e NON entra in Movimento. Resta senza area.
  const dopo = spostaFraAree(AREE, "in piscina", [], ["Relazioni", "Movimento"]);
  const rel = dopo.find((a) => a.label === "Relazioni");
  check(
    "'non saprei' toglie la frase dall'area sbagliata",
    !!rel && !/piscina/i.test(rel.text),
    JSON.stringify(rel),
  );
  check(
    "'non saprei' NON sceglie un'area al posto tuo",
    !dopo.some((a) => a.label === "Movimento"),
    dopo.map((a) => a.label).join(", "),
  );
  check(
    "il resto dell'area sopravvive: si toglie la frase, non l'area",
    !!rel && /Charlie/i.test(rel.text),
    JSON.stringify(rel),
  );
}

{
  // Un'area che rimane senza niente sparisce: un'etichetta vuota sembra un
  // errore dell'app, non una giornata senza quella cosa.
  const sola = [{ label: "Movimento", text: "Pomeriggio in piscina." }];
  const dopo = spostaFraAree(sola, "pomeriggio in piscina", [], ["Movimento"]);
  check("un'area rimasta vuota sparisce", dopo.length === 0, JSON.stringify(dopo));
}

{
  // Rispondere due volte la stessa cosa non deve duplicare la frase.
  const uno = spostaFraAree(AREE, "piscina", ["Movimento"], ["Relazioni", "Movimento"]);
  const due = spostaFraAree(uno, "piscina", ["Movimento"], ["Relazioni", "Movimento"]);
  const mov = due.find((a) => a.label === "Movimento");
  check(
    "rispondere due volte non scrive la frase due volte",
    (mov.text.match(/piscina/gi) ?? []).length === 1,
    mov.text,
  );
}

{
  const dopo = spostaFraAree(AREE, "   ", ["Movimento"], ["Movimento"]);
  check("un soggetto vuoto non tocca niente", uguali(dopo, AREE));
}

/* ================= 2. i soprannomi, quando si mostra ================= */

const INDICE = indicizza([
  { kind: "persona", alias: "mio fratello", labelKeys: ["Daniele"] },
  { kind: "luogo", alias: "da charlie", labelKeys: ["da Charlie"] },
  // Dal 31 agosto 2026: un modo di dire puo valere per PIU persone.
  { kind: "persona", alias: "i miei amici", labelKeys: ["Hoda", "Liana"] },
  // Risposto "non e una persona": la casella resta vuota.
  { kind: "persona", alias: "nuovi amici", labelKeys: [] },
]);

check(
  "la chiave ignora maiuscole, accenti e spazi doppi",
  chiaveAlias("  Da  CHARLIE ") === chiaveAlias("da charlie"),
);
check(
  '"mio fratello" si mostra come Daniele',
  uguali(risolvi("mio fratello", "persona", INDICE).mostra, ["Daniele"]),
);
check(
  "e anche scritto in un altro modo",
  uguali(risolvi("Mio Fratello", "persona", INDICE).mostra, ["Daniele"]),
);
check(
  '"da Charlie" NON compare fra le persone: e un posto',
  uguali(risolvi("da Charlie", "persona", INDICE).mostra, []),
);
check(
  "ma compare fra i luoghi",
  uguali(risolvi("da Charlie", "luogo", INDICE).mostra, ["da Charlie"]),
);
check(
  "un nome mai chiarito passa com'e",
  uguali(risolvi("Keyko", "persona", INDICE).mostra, ["Keyko"]),
);

/* --- piu persone dietro un modo di dire solo (31 agosto 2026) --- */

check(
  '"i miei amici" diventa DUE persone, non una con quel nome',
  uguali(risolvi("i miei amici", "persona", INDICE).mostra, ["Hoda", "Liana"]),
  JSON.stringify(risolvi("i miei amici", "persona", INDICE).mostra),
);
{
  // IL CASO CHE CONTA. Prima della modifica la giornata mostrava una sola
  // pastiglia con scritto "i miei amici", e il conteggio degli incontri era
  // sbagliato di uno ogni volta.
  const fuori = risolviLista(["i miei amici"], "persona", INDICE);
  check(
    "una giornata con 'i miei amici' conta due incontri, non uno",
    fuori.length === 2,
    JSON.stringify(fuori),
  );
}
{
  // Nella stessa giornata puoi aver detto sia "i miei amici" sia "Liana":
  // Liana resta una sola, non due.
  const fuori = risolviLista(["i miei amici", "Liana"], "persona", INDICE);
  check(
    "un nome gia dentro il gruppo non si sdoppia",
    uguali(fuori, ["Hoda", "Liana"]),
    JSON.stringify(fuori),
  );
}
check(
  '"non e una persona" resta una risposta: non mostra niente',
  uguali(risolvi("nuovi amici", "persona", INDICE).mostra, []),
);
{
  // Il separatore fra i nomi: andata e ritorno, e le righe vecchie.
  check(
    "due nomi entrano e riescono in una casella sola",
    uguali(dividiNomi(uniscoNomi(["Hoda", "Liana"])), ["Hoda", "Liana"]),
  );
  check(
    "una riga scritta prima (un nome solo) si legge uguale",
    uguali(dividiNomi("Daniele"), ["Daniele"]),
  );
  check(
    "una casella vuota resta un elenco vuoto, cioe 'non e di questa specie'",
    uguali(dividiNomi(""), []) && uniscoNomi([]) === "",
  );
  check(
    "il separatore non e una virgola: un nome puo contenerla",
    !uniscoNomi(["Hoda", "Liana"]).includes(","),
  );
}
{
  // Nella stessa giornata puoi aver detto sia "mio fratello" sia "Daniele":
  // dopo la risoluzione sono la stessa persona, e la pastiglia e una sola.
  const fuori = risolviLista(
    ["mio fratello", "Daniele", "da Charlie", "Keyko"],
    "persona",
    INDICE,
  );
  check(
    "soprannome e nome vero nella stessa giornata fanno una persona sola",
    uguali(fuori, ["Daniele", "Keyko"]),
    JSON.stringify(fuori),
  );
}

/* ============== 3. il collegamento: cosa deve esserci ============== */

const rotta = leggi("src/modules/oggi/server/chiarimenti.ts") /* passo E: la logica vive nel modulo, la rotta e un guscio */;
check(
  "la rotta distingue le due specie di domanda",
  /identita/.test(rotta) && /episodio/.test(rotta),
);
check(
  "le azioni applicabili sono un elenco chiuso",
  /enum: \["persona", "specie", "area"\]/.test(rotta),
);
check(
  "una domanda gia chiarita non si ripresenta",
  /giaChiarito/.test(rotta) && /aliases\.map/.test(rotta),
);
check(
  "una domanda con un bottone solo non e una domanda",
  /opzioni\.length < 2/.test(rotta),
);
check(
  "il prompt vieta di chiedere cio che non cambia niente",
  /QUANDO NON CHIEDERE/.test(rotta),
);
check(
  "una risposta illeggibile non blocca il salvataggio",
  /return NextResponse\.json\(\{ domande: \[\] \}\)/.test(rotta),
);
check(
  "un guasto dell'AI non diventa un errore rosso sulla giornata",
  !/status: completion\.status/.test(rotta) &&
    /errore: `OpenAI \$\{completion\.status\}/.test(rotta),
);
check(
  "una chiave mancante si vede nel corpo, non come 500",
  /domande: \[\], errore: "OPENAI_API_KEY non configurata"/.test(rotta),
);

const chiar = leggi("src/lib/chiarimenti.ts");
check(
  "un dubbio non chiarito non fa perdere la giornata",
  /catch \{\s*return \[\];/.test(chiar),
);
check(
  "'non saprei' su un nome non scrive nessun soprannome",
  /if \(!valore\) continue;/.test(chiar),
);

const schermata = leggi("src/modules/oggi/components/chiarimenti-screen.tsx");
check(
  "NON c'e la schermata di permesso (tolta da Manuel)",
  !/chiedimi pure/i.test(senzaCommenti(schermata)),
);
check(
  "una domanda per volta, non un modulo",
  /domande\[i\]/.test(schermata),
);
check(
  "il campo libero e l'ULTIMA riga, dopo i bottoni",
  schermata.indexOf("d.opzioni.map") < schermata.indexOf("Un altro nome"),
);

const today = leggi("src/modules/oggi/components/today-client.tsx");
const day = leggi("src/modules/oggi/components/day-client.tsx");
check(
  "si chiede sia al primo salvataggio sia quando aggiungi a una giornata",
  /chiediChiarimenti/.test(today) && /chiediChiarimenti/.test(day),
);
check(
  "su una domanda di tipo, il bottone dice il TIPO e non un nome",
  /function nomeDelTipo/.test(schermata) &&
    /d\.azione === "specie" \? nomeDelTipo/.test(schermata),
);
check(
  "e il nome scende sotto, per far vedere come verra mostrato",
  /o\.nomeVero \|\| o\.etichetta/.test(schermata),
);
check(
  "ogni risposta si applica SUBITO, non alla fine di tutte",
  /onRisposta/.test(schermata) && /applicaUnaRisposta/.test(today),
);
check(
  "una risposta si applica alla SUA giornata, non a quella che guardi",
  /r\.domanda\.entryDate/.test(today) && /loadEntryForDate/.test(today),
);
check(
  "le domande in coda si chiedono all'APERTURA, non solo dopo un'analisi",
  /domandeInSospeso/.test(today) && /scansioneGiaFatta\(\)\) await/.test(today),
);
check(
  '"basta per adesso" mette in pausa fino alla prossima apertura, non di piu',
  /sessionStorage/.test(chiar) && /metteInPausa/.test(today),
);
check(
  "chi sta gia scrivendo non viene interrotto",
  /v === "filled" \|\| v === "empty" \? "chiarimenti" : v/.test(today),
);
check(
  "senza AI non si chiede niente, in nessuna delle due schermate",
  /if \(canAI && entryForDate\)/.test(today) && /if \(!canAI\) return;/.test(day),
);
check(
  "prima i chiarimenti, poi la rubrica delle persone",
  today.indexOf("setView(\"chiarimenti\")") < today.indexOf("vaiAlPassoPersone"),
);

// Dal passo C il catalogo e spezzato per modulo: la frase puo vivere in
// qualunque catalogo, il contratto e che esista.
import { readdirSync as _rd } from "node:fs";
const _catalogo = ["src/lib/i18n/catalogs/comune.ts", "src/lib/i18n/en-extra.ts"]
  .concat(_rd("src/modules").map((m) => `src/modules/${m}/en.ts`))
  .map((f) => leggi(f))
  .join("\n");
const extra = _catalogo;
for (const frase of ["Da chiarire", "Non adesso", "Non e una persona", "Un altro nome", "Avanti"]) {
  check(`"${frase}" e bilingue`, extra.includes(`"${frase}":`));
}

const usage = leggi("src/lib/data/usage.ts");
check(
  "chiedere costa, e il costo si vede nei consumi",
  /"chiarimenti"/.test(usage),
);


/* ===== 4. i tre difetti visti in produzione il 23 agosto 2026 ===== */

{
  // "Mio fratello" nella domanda, "fratello" nell'elenco della giornata: il
  // soprannome finiva su una chiave che non compariva da nessuna parte, e
  // rispondere non cambiava niente. Ora si scrive su tutte e due.
  check(
    "il soprannome si scrive su tutte le grafie di quella persona",
    /formeDelSoggetto/.test(chiar) && /base\.includes\(k\)/.test(chiar),
  );
  check(
    "ma non su una parola corta contenuta per caso",
    /k\.length >= 3/.test(chiar),
  );
}
check(
  "con azione persona il soggetto deve essere una persona della giornata",
  /ESATTAMENTE una delle/.test(rotta),
);
check(
  "la domanda non elenca le risposte che ha gia sotto forma di bottoni",
  /Non elencare le risposte dentro la domanda/.test(rotta),
);
check(
  "senza nomi da offrire si scrive direttamente, senza un tocco in piu",
  /liberoScelto \|\| \(!!d && d\.libero/.test(schermata),
);

const css = leggi("src/app/features.css");
check(
  "il tasto per saltare sta su una riga sola",
  /white-space: nowrap/.test(css.slice(css.indexOf(".jm-ch-skip"))),
);
check(
  "sul desktop la domanda sta al centro, non appesa in alto",
  /\.jm-ch-col \{\s*justify-content: center;/.test(css),
);
check(
  "il CSS nuovo sta in features.css come vuole ARCHITETTURA.md",
  /jm-ch-wrap/.test(css) && !/jm-ch-wrap/.test(leggi("src/app/globals.css")),
);


/* ===== 5. la coda: saltare non cancella, rispondere si (23 ago 2026) ===== */

const store = leggi("src/lib/data/store/types.ts");
check(
  "le domande vivono in una coda, non muoiono col salvataggio",
  /loadOpenQuestions/.test(store) && /saveOpenQuestions/.test(store),
);
{
  const cloud = leggi("src/lib/data/store/cloud.ts");
  check(
    "si rileggono le domande di TUTTE le giornate, non solo di oggi",
    /from\("open_questions"\)[\s\S]{0,200}\.is\("risposta", null\)/.test(cloud),
  );
  check(
    "rileggendo una giornata si rifanno solo le domande APERTE",
    /\.delete\(\)[\s\S]{0,200}\.is\("risposta", null\)/.test(cloud),
  );
  check(
    "una domanda gia risposta non si riapre",
    /giaDeciso/.test(cloud),
  );
}
check(
  "solo una risposta chiude una domanda: saltare no",
  /async function chiudi/.test(chiar) &&
    !/chiudi\(mode, domanda, null\)/.test(chiar),
);
check(
  '"non e una persona" e una risposta vera, e vale per sempre',
  /NON_E_UNA_PERSONA/.test(chiar) && /labelKeys: \[\]/.test(chiar),
);
check(
  "un soprannome senza nessun nome vero nasconde la voce",
  /suo\.labelKeys\.map/.test(leggi("src/lib/aliases.ts")),
);
{
  const sch = leggi("src/modules/oggi/components/chiarimenti-screen.tsx");
  check(
    'il tasto dice "Non adesso", non piu "lascialo com\'e"',
    /t\("Non adesso"\)/.test(sch) && !/Lascialo com/.test(senzaCommenti(sch)),
  );
  check(
    "c'e una via d'uscita che non cancella niente",
    /basta per adesso/.test(sch),
  );
  check(
    "ogni domanda dice di che giornata parla",
    /jm-ch-quando/.test(sch) && /relativeDayLabel/.test(sch),
  );
  check(
    "il tasto Avanti batte .btn-primary invece di perdere contro globals.css",
    /\.jm-ch-foot \.jm-ch-next \{/.test(leggi("src/app/features.css")),
  );
}
{
  const scan = leggi("src/lib/actions/scan-archivio.ts");
  check(
    "passando a premium si legge tutto il diario",
    /loadAllEntries/.test(scan) && /chiediChiarimenti/.test(scan),
  );
  check(
    "le giornate gia lette non si rileggono da capo: costano e non cambiano",
    /maiLetta/.test(scan),
  );
  check(
    "una giornata che non si lascia leggere non ferma le altre",
    /catch \{[\s\S]{0,200}\}/.test(scan),
  );
  check(
    "una per volta: sono chiamate a pagamento, non c'e fretta",
    !/Promise\.all/.test(scan),
  );
  check(
    "una scansione interrotta riprende invece di ricominciare",
    /loadQuestionDates/.test(scan) && /giaViste/.test(scan),
  );
  check(
    // Il logout e uscito da settings-client il 28 agosto: la porta
    // dell'account lo chiama da piu punti, e la logica vive in un posto solo.
    "la scansione parte una volta sola, e il logout la dimentica",
    /scansioneGiaFatta/.test(leggi("src/modules/oggi/components/today-client.tsx")) &&
      /dimenticaScansione/.test(leggi("src/lib/auth/logout.ts")),
  );
}

/* ===== 6. piu di una persona, e l'estratto sempre (31 agosto 2026) ===== */

{
  const sch = leggi("src/modules/oggi/components/chiarimenti-screen.tsx");
  check(
    "la risposta e un ELENCO, non un valore solo",
    /useState<string\[\]>\(\[\]\)/.test(sch) && !/setScelta\(/.test(senzaCommenti(sch)),
  );
  check(
    "si puo scegliere piu di una persona, e SOLO fra le persone",
    /const multi = d\.azione === "persona"/.test(sch),
  );
  check(
    "la casella dice prima del tocco se se ne puo scegliere piu di una",
    /function Casella/.test(sch) && /jm-ch-box\$\{multi \? "" : " tondo"\}/.test(sch),
  );
  check(
    "e lo dice anche a parole, non solo con la forma",
    /Puoi sceglierne piu di una\./.test(sch),
  );
  check(
    '"non e una persona" spegne i nomi: non si risponde una cosa e il contrario',
    /const ESCLUSIVE = new Set<string>/.test(sch) &&
      /tocca\(NON_E_UNA_PERSONA, "", true\)/.test(sch),
  );
  check(
    "l'estratto non e piu condizionato al capriccio del modello",
    !/\{d\.citazione && </.test(sch) && /ritagliaCitazione\(racconti/.test(sch),
  );
  check(
    "un estratto che manca si va a riprendere dal racconto di quel giorno",
    /loadEntryForDate\(mode, dataSenzaEstratto\)/.test(sch),
  );
}
{
  const cat = leggi("src/modules/oggi/citazione.ts");
  const TESTO =
    "Stamattina ho corso quaranta minuti. Ieri i miei amici mi hanno aiutato tanto ad accettare la separazione. Poi sono andato a dormire presto.";
  const c = ritagliaCitazione(TESTO, "i miei amici");
  check(
    "l'estratto e la frase che contiene la cosa in dubbio",
    c.includes("i miei amici") && !c.includes("quaranta minuti"),
    c,
  );
  check(
    "e l'estratto e COPIATO dal racconto, non riscritto",
    TESTO.includes(c),
    c,
  );
  {
    // Una domanda di area ha un soggetto parafrasato: si aggancia comunque
    // sulla parola che porta il significato.
    const a = ritagliaCitazione(TESTO, "la corsa di stamattina");
    check(
      "un soggetto parafrasato si aggancia alla sua parola piu lunga",
      a.includes("corso"),
      a,
    );
  }
  {
    // Il caso che rendeva la domanda un indovinello: nessun aggancio. Si
    // mostra l'inizio del racconto, che e sempre meglio del vuoto.
    const b = ritagliaCitazione(TESTO, "il capo");
    check("senza aggancio si mostra comunque un pezzo di racconto", b.length > 0, b);
    check("e anche quel pezzo e copiato", TESTO.includes(b.replace(/^\.\.\. |\ \.\.\.$/g, "")), b);
  }
  check(
    "un racconto vuoto non produce un estratto inventato",
    ritagliaCitazione("", "i miei amici") === "",
  );
  {
    const s = spezzaAttorno("ieri i miei amici mi hanno aiutato", "i miei amici");
    check(
      "la cosa in dubbio si puo mettere in evidenza",
      s.prima === "ieri " && s.dentro === "i miei amici",
      JSON.stringify(s),
    );
    const n = spezzaAttorno("una frase qualunque", "il capo");
    check(
      "e se non si trova, niente grassetto sulla parola sbagliata",
      n.dentro === "" && n.prima === "una frase qualunque",
    );
  }
  check(
    "l'estratto non taglia a meta le parole",
    /Non tagliare a meta di una parola/.test(cat),
  );
}
check(
  "la rotta non si fida di una citazione che nel racconto non c'e",
  /function citazioneVera/.test(rotta) &&
    /normalizza\(transcript\)\.includes\(normalizza\(c\)\)/.test(rotta),
);
check(
  "un modo di dire al plurale resta una domanda sulle persone",
  /Un modo di dire al PLURALE/.test(rotta),
);

const falliti = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - falliti.length}/${results.length} PASS` +
    (falliti.length ? ` . ${falliti.length} FAIL` : ""),
);
process.exit(falliti.length ? 1 : 0);
