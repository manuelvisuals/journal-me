// La registrazione a blocchi (14 settembre 2026, decisione di Manuel dopo
// il 413 di quella sera: 3'52" di racconto = 6,7 MB, il server ne accetta
// ~4,5, la funzione ha 60 s). PROMPT-REGISTRAZIONE-A-BLOCCHI.md.
//
// Cosa deve essere vero, perche sono i punti dove un racconto si perde:
//  1. il tempo inciso cresce SOLO mentre il tasto e premuto;
//  2. il blocco si chiude sul tempo O sui byte, quello che arriva prima;
//  3. l'unione dei testi rispetta l'ordine anche se le risposte tornano
//     disordinate, e li cuce con uno spazio (non col separatore dei giorni);
//  4. un blocco fallito non porta via gli altri;
//  5. zero blocchi (nessuna parola detta) non producono un racconto salvato;
//  6. i chiamanti: mono, qualita chiesta per codec, tetto per blocco,
//     contesto al server, 413 detto per quello che e.
//
//   node --experimental-strip-types scripts/verify-registrazione-blocchi.mjs
import { readFileSync } from "node:fs";
import {
  AAC_BPS,
  BLOCCO_TETTO_BYTE,
  BLOCCO_TETTO_MS,
  OPUS_BPS,
  SOGLIA_CHIUSURA_AL_RILASCIO,
  avanzamento,
  bitrateRichiesto,
  chiudereAlRilascio,
  codaDelTesto,
  incisoMs,
  lascia,
  limiteRaggiunto,
  orologioNuovo,
  premi,
  restanteMs,
  ritmoByteAlSecondo,
  unisciTesti,
} from "../src/modules/oggi/blocchi.ts";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

/* ============ 0. i numeri della decisione ============ */
check("0 un blocco dura 3 minuti (scelta di Manuel)", BLOCCO_TETTO_MS === 180_000, String(BLOCCO_TETTO_MS));
check("0 il tetto in byte sta sotto i 4,5 MB del server con margine", BLOCCO_TETTO_BYTE <= 3_600_000 && BLOCCO_TETTO_BYTE >= 3_000_000, String(BLOCCO_TETTO_BYTE));
check("0 Opus a 32 kbit/s, AAC a 64: non lo stesso numero per due codec", OPUS_BPS === 32_000 && AAC_BPS === 64_000 && OPUS_BPS !== AAC_BPS);
check("0 webm/opus chiede Opus", bitrateRichiesto("audio/webm;codecs=opus") === OPUS_BPS);
check("0 mp4 (iPhone) chiede AAC", bitrateRichiesto("audio/mp4") === AAC_BPS);
/* Un blocco pieno di 3 minuti a 32 kbit/s pesa ~720 KB, a 64 ~1,44 MB:
   tutti e due stanno sotto il tetto in byte con margine, cioe con la
   qualita chiesta e il TEMPO a chiudere il blocco, come deve essere. */
check("0 tre minuti a Opus 32 stanno sotto il tetto in byte", (OPUS_BPS / 8) * 180 < BLOCCO_TETTO_BYTE);
check("0 tre minuti a AAC 64 stanno sotto il tetto in byte", (AAC_BPS / 8) * 180 < BLOCCO_TETTO_BYTE);

/* ============ 1. il tempo inciso cresce solo col tasto premuto ============ */
{
  let o = orologioNuovo();
  check("1 all'inizio zero", incisoMs(o, 0) === 0);
  o = premi(o, 1000);
  check("1 premuto: dopo 5 s ne segna 5", incisoMs(o, 6000) === 5000, String(incisoMs(o, 6000)));
  o = lascia(o, 6000);
  check("1 lasciato: il tempo si FERMA", incisoMs(o, 60_000) === 5000, String(incisoMs(o, 60_000)));
  o = premi(o, 60_000);
  check("1 ripremuto: riparte da dove era", incisoMs(o, 61_000) === 6000, String(incisoMs(o, 61_000)));
  const doppio = premi(o, 70_000);
  check("1 premere due volte non azzera il tratto", incisoMs(doppio, 71_000) === 16_000, String(incisoMs(doppio, 71_000)));
  const lasciatoDueVolte = lascia(lascia(o, 61_000), 90_000);
  check("1 lasciare due volte non aggiunge niente", lasciatoDueVolte.incisoMs === 6000, String(lasciatoDueVolte.incisoMs));
  check("1 un orologio che torna indietro non incide tempo negativo", incisoMs(premi(orologioNuovo(), 5000), 4000) === 0);
  /* Il caso della bugia: 30 s di parlato in 3 minuti di orologio a muro.
     Un conto alla rovescia sull'orologio direbbe "zero", il tempo inciso
     dice trenta secondi. */
  let p = orologioNuovo();
  for (let k = 0; k < 6; k++) {
    p = premi(p, k * 30_000);
    p = lascia(p, k * 30_000 + 5000);
  }
  check("1 sei tratti da 5 s in 3 minuti di orologio = 30 s incisi", incisoMs(p, 180_000) === 30_000, String(incisoMs(p, 180_000)));
  check("1 ...e il blocco NON e pieno", limiteRaggiunto({ incisoMs: incisoMs(p, 180_000), byte: 120_000 }) === null);
}

/* ============ 2. si chiude sul tempo O sui byte, il primo che arriva ============ */
check("2 sotto tutti e due i tetti: aperto", limiteRaggiunto({ incisoMs: 100_000, byte: 400_000 }) === null);
check("2 al tetto di tempo: chiuso per tempo", limiteRaggiunto({ incisoMs: BLOCCO_TETTO_MS, byte: 400_000 }) === "tempo");
check("2 al tetto di byte: chiuso per byte", limiteRaggiunto({ incisoMs: 60_000, byte: BLOCCO_TETTO_BYTE }) === "byte");
check("2 un millisecondo prima del tempo: ancora aperto", limiteRaggiunto({ incisoMs: BLOCCO_TETTO_MS - 1, byte: 0 }) === null);
check("2 un byte prima del tetto: ancora aperto", limiteRaggiunto({ incisoMs: 0, byte: BLOCCO_TETTO_BYTE - 1 }) === null);
{
  /* Il ritmo di quella sera, 29.724 byte/s (la qualita di fabbrica del
     browser): i byte finiscono a ~118 s, PRIMA dei 3 minuti. Simulato un
     pezzo al secondo come fa il MediaRecorder. */
  const ritmoDiFabbrica = Math.round(6_717_776 / 226);
  let chiusoA = null;
  let motivo = null;
  for (let s = 1; s <= 200 && chiusoA === null; s++) {
    const m = limiteRaggiunto({ incisoMs: s * 1000, byte: s * ritmoDiFabbrica });
    if (m) { chiusoA = s; motivo = m; }
  }
  check("2 al ritmo di fabbrica (29,7 KB/s) chiudono i BYTE", motivo === "byte", `a ${chiusoA} s`);
  check("2 ...e chiudono prima dei 3 minuti e sotto i 4,5 MB", chiusoA !== null && chiusoA < 180 && chiusoA * ritmoDiFabbrica < 4_500_000, `${chiusoA} s = ${chiusoA * ritmoDiFabbrica} byte`);
  /* Alla qualita chiesta (Opus 32 kbit/s = 4.000 byte/s) chiude il TEMPO. */
  chiusoA = null; motivo = null;
  for (let s = 1; s <= 200 && chiusoA === null; s++) {
    const m = limiteRaggiunto({ incisoMs: s * 1000, byte: s * (OPUS_BPS / 8) });
    if (m) { chiusoA = s; motivo = m; }
  }
  check("2 alla qualita chiesta chiude il TEMPO, a 180 s", motivo === "tempo" && chiusoA === 180, `${motivo} a ${chiusoA} s`);
}
check("2 la barra e la frazione piu alta fra tempo e byte", avanzamento({ incisoMs: 18_000, byte: BLOCCO_TETTO_BYTE / 2 }) === 0.5);
check("2 la barra e la frazione piu alta fra tempo e byte (tempo)", avanzamento({ incisoMs: BLOCCO_TETTO_MS / 4, byte: 100 }) === 0.25);
check("2 la barra non supera 1", avanzamento({ incisoMs: BLOCCO_TETTO_MS * 3, byte: 0 }) === 1);
check("2 la barra non scende sotto 0", avanzamento({ incisoMs: -5, byte: -5 }) === 0);
check("2 il ritmo si misura dai byte veri", ritmoByteAlSecondo({ incisoMs: 10_000, byte: 40_000 }) === 4000);
check("2 sotto un secondo il ritmo non si dichiara", ritmoByteAlSecondo({ incisoMs: 80, byte: 3000 }) === null);
check("2 il tempo che resta, a ritmo basso, e quello del tempo", restanteMs({ incisoMs: 60_000, byte: 240_000 }) === 120_000, String(restanteMs({ incisoMs: 60_000, byte: 240_000 })));
{
  /* A ritmo alto il tempo che resta e quello che i byte concedono. */
  const r = restanteMs({ incisoMs: 60_000, byte: 1_800_000 }); /* 30 KB/s */
  const attesi = ((BLOCCO_TETTO_BYTE - 1_800_000) / 30_000) * 1000;
  check("2 il tempo che resta, a ritmo alto, e quello dei byte", Math.abs(r - attesi) < 1 && r < 120_000, `${Math.round(r)} ms`);
}
check("2 al rilascio, oltre la soglia, si chiude", chiudereAlRilascio({ incisoMs: BLOCCO_TETTO_MS * SOGLIA_CHIUSURA_AL_RILASCIO, byte: 0 }) === true);
check("2 al rilascio, sotto la soglia, si continua", chiudereAlRilascio({ incisoMs: BLOCCO_TETTO_MS * (SOGLIA_CHIUSURA_AL_RILASCIO - 0.05), byte: 0 }) === false);
check("2 la soglia al rilascio e alta ma sotto il limite", SOGLIA_CHIUSURA_AL_RILASCIO >= 0.8 && SOGLIA_CHIUSURA_AL_RILASCIO < 1);

/* ============ 3. l'unione rispetta l'ordine, anche con risposte disordinate ============ */
const MANCA = "[manca un pezzo]";
{
  const disordinati = [
    { indice: 2, testo: "sera in palestra." },
    { indice: 0, testo: "Mattina in ufficio." },
    { indice: 1, testo: "Pranzo con Hoda," },
  ];
  const r = unisciTesti(disordinati, MANCA);
  check("3 tre blocchi arrivati in disordine escono in ordine", r.testo === "Mattina in ufficio. Pranzo con Hoda, sera in palestra.", r.testo);
  check("3 tre riusciti, zero guasti", r.riusciti === 3 && r.guasti === 0);
  check("3 si cuce con UNO spazio, non col separatore dei giorni", !r.testo.includes("\n---\n") && !r.testo.includes("  "));
  check("3 gli spazi intorno ai testi si puliscono", unisciTesti([{ indice: 0, testo: "  a  " }, { indice: 1, testo: " b " }], MANCA).testo === "a b");
  check("3 l'elenco di partenza non viene riordinato sul posto", disordinati[0].indice === 2);
  check("3 un blocco muto (testo vuoto) sparisce senza segnaposto", unisciTesti([{ indice: 0, testo: "a" }, { indice: 1, testo: "" }, { indice: 2, testo: "b" }], MANCA).testo === "a b");
}

/* ============ 4. un blocco fallito non porta via gli altri ============ */
{
  const r = unisciTesti([
    { indice: 0, testo: "Prima parte." },
    { indice: 1, testo: null },
    { indice: 2, testo: "Terza parte." },
  ], MANCA);
  check("4 il buco e dichiarato AL SUO POSTO", r.testo === `Prima parte. ${MANCA} Terza parte.`, r.testo);
  check("4 due riusciti, un guasto", r.riusciti === 2 && r.guasti === 1);
  const tutti = unisciTesti([{ indice: 0, testo: null }, { indice: 1, testo: null }], MANCA);
  check("4 tutti falliti: testo vuoto, non un racconto di soli segnaposto", tutti.testo === "" && tutti.guasti === 2 && tutti.riusciti === 0, JSON.stringify(tutti));
  const guastoInFondo = unisciTesti([{ indice: 0, testo: "Solo questo." }, { indice: 1, testo: null }], MANCA);
  check("4 il guasto in fondo lascia il segnaposto in fondo", guastoInFondo.testo === `Solo questo. ${MANCA}`);
}

/* ============ 5. zero blocchi non producono un racconto ============ */
{
  const zero = unisciTesti([], MANCA);
  check("5 zero blocchi: testo vuoto, zero guasti, zero riusciti", zero.testo === "" && zero.guasti === 0 && zero.riusciti === 0);
  const muti = unisciTesti([{ indice: 0, testo: "" }, { indice: 1, testo: "   " }], MANCA);
  check("5 solo blocchi muti: come zero blocchi", muti.testo === "" && muti.guasti === 0 && muti.riusciti === 0);
}

/* ============ 6. la coda del testo per il contesto ============ */
check("6 la coda sono le ultime N parole", codaDelTesto("uno due tre quattro cinque", 2) === "quattro cinque");
check("6 un testo corto torna intero", codaDelTesto("uno due", 40) === "uno due");
check("6 la coda di niente e niente", codaDelTesto("   ") === "");
check("6 la coda di fabbrica e corta (un prompt lungo costa e non aiuta)", codaDelTesto("x ".repeat(500)).split(" ").length <= 60);

/* ============ 7. i chiamanti ============ */
const overlay = readFileSync("src/modules/oggi/components/recording-overlay.tsx", "utf8");
const server = readFileSync("src/modules/oggi/server/transcribe-fallback.ts", "utf8");
const puro = readFileSync("src/modules/oggi/blocchi.ts", "utf8");
const css = readFileSync("src/modules/oggi/styles.css", "utf8");
const catalogo = readFileSync("src/modules/oggi/en.ts", "utf8");

check("7 blocchi.ts e puro: nessun import", !/^\s*import\s/m.test(puro));
check("7 blocchi.ts non esporta niente che si chiami 'split' (e di split-by-date)", !/export\s+(const|function|type)\s+\w*split/i.test(puro) && !/export\s+(const|function|type)\s+\w*split/i.test(overlay));
check("7 il microfono si chiede MONO", /channelCount:\s*1/.test(overlay));
check("7 la qualita si chiede per codec (audioBitsPerSecond da bitrateRichiesto)", /audioBitsPerSecond:\s*bitrateRichiesto\(/.test(overlay));
check("7 l'overlay usa la matematica di blocchi.ts", /from "@\/modules\/oggi\/blocchi"/.test(overlay) && /unisciTesti\(/.test(overlay) && /limiteRaggiunto\(/.test(overlay));
check("7 il tasto premuto/lasciato muove l'orologio dei blocchi", /premi\(orologioRef\.current/.test(overlay) && /lascia\(orologioRef\.current/.test(overlay));
check("7 il limite si controlla a ogni pezzo del registratore", /ondataavailable[\s\S]{0,900}limiteRaggiunto\(/.test(overlay));
check("7 al rilascio col blocco quasi pieno si chiude in un silenzio", /chiudereAlRilascio\(/.test(overlay) && /chiudiBlocco\("rilascio"\)/.test(overlay));
check("7 il blocco nuovo si apre sulla STESSA traccia (startTape dentro chiudiBlocco)", /async function chiudiBlocco[\s\S]*?startTape\(stream, ancoraPremuto\)/.test(overlay));
check("7 il tetto della trascrizione e PER BLOCCO", /timeoutMs:\s*TRASCRIZIONE_TETTO_MS/.test(overlay) && !/TRASCRIZIONE_TETTO_MS - \(Date\.now\(\)/.test(overlay));
check("7 ogni blocco riceve glossario e contesto", /fd\.set\("glossary", glossario\)/.test(overlay) && /fd\.set\("contesto", contesto\)/.test(overlay));
check("7 la coda del blocco prima diventa il contesto del dopo", /coda = codaDelTesto\(testo\)/.test(overlay));
check("7 un blocco fallito torna null, non stringa vuota", /Promise<string \| null>/.test(overlay) && /return null;/.test(overlay));
check("7 il segnaposto del buco passa da t()", /unisciTesti\(\s*esiti,\s*t\("\[qui manca un pezzo/.test(overlay));
check("7 ...ed e tradotto", /"\[qui manca un pezzo del racconto: la trascrizione di questo blocco non e riuscita\]":/.test(catalogo));
check("7 nessun blocco riuscito e almeno un guasto = errore, non giornata vuota", /racconto\.riusciti === 0 && racconto\.guasti > 0/.test(overlay));
check("7 zero blocchi con zero secondi: onStop vuoto, nessun racconto", /if \(blocchi\.length === 0\)[\s\S]{0,600}onStop\("", 0, targetDate\)/.test(overlay));
check("7 il 413 e detto per quello che e", /httpRef\.current === "413"/.test(overlay) && /troppo pesante/.test(overlay));
check("7 il vecchio messaggio 'controlla la connessione' non c'e piu", !/controlla la connessione e premi di nuovo Fine/.test(overlay));
check("7 l'overlay non cuce i blocchi col separatore dei giorni", !/SEP_PEZZI/.test(overlay) && !/\\n---\\n/.test(overlay));
check("7 la riga di diagnosi stampa k e bps", /k=\$\{k\} bps=/.test(overlay));
check("7 il server legge il contesto e lo mette nel prompt", /inForm\.get\("contesto"\)/.test(server) && /glossaryHint \+ contestoHint/.test(server));
check("7 la barra del blocco esiste, col prefisso del modulo", /jm-rec-blocco-barra/.test(overlay) && /\.jm-rec-blocco-barra \{/.test(css));
check("7 il primer dice quanto dura un blocco PRIMA di cominciare", /Ogni blocco dura al massimo \{min\} minuti/.test(overlay));
check("7 il percorso realtime non e tornato", !/realtime\/session/.test(overlay) && !/RTCPeerConnection/.test(overlay));
check("7 nessun blob viene tagliato dopo (niente slice sui blocchi)", !/\.slice\(\s*\d+\s*,\s*[\w.]+\s*\)\s*;?\s*\/\/.*blob/i.test(overlay) && !/blob\.slice\(/.test(overlay));

/* ============ esito ============ */
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
if (failed.length) {
  console.log("FALLITI:\n" + failed.map((f) => "  - " + f.name).join("\n"));
  process.exit(1);
}
