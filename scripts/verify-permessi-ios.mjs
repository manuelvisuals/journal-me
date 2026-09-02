// I PERMESSI DEL GUSCIO iOS (2 settembre 2026, richiesta di Manuel:
// "assicurati che l'app passi la revisione Apple per fotocamera e rullino").
//
// Il fatto: la foto profilo ha "Scatta una foto" (foto-row.tsx, input
// con capture="user") e la giornata ha "Aggiungi dal rullino" (add-to-day
// .tsx, input file image/*). Dentro WKWebView un input file apre il foglio
// di sistema con "Scatta foto" e "Libreria foto". Se in Info.plist manca
// la frase d'uso della fotocamera, al primo tocco su "Scatta foto" iOS
// CHIUDE L'APP (non chiede: uccide), ed e una bocciatura certa in
// revisione. Il rullino passa dal selettore privato di iOS (non serve il
// permesso), ma la frase deve esistere lo stesso: Apple la pretende per
// ogni API che l'app potrebbe toccare, e senza la build viene rifiutata
// all'upload (ITMS-90683).
//
// Questo banco e statico: legge Info.plist e i due componenti. Non prova
// il telefono — quello si guarda con gli occhi dopo la build.
import { readFileSync } from "node:fs";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const plist = readFileSync("ios/App/App/Info.plist", "utf8");

function frase(chiave) {
  const m = plist.match(new RegExp(`<key>${chiave}</key>\\s*<string>([^<]*)</string>`));
  return m ? m[1].trim() : null;
}

const RICHIESTE = [
  ["NSCameraUsageDescription", "la fotocamera (foto profilo: Scatta una foto)"],
  ["NSPhotoLibraryUsageDescription", "il rullino (foto profilo e foto della giornata)"],
  ["NSMicrophoneUsageDescription", "il microfono (la registrazione)"],
  ["NSFaceIDUsageDescription", "Face ID (il lucchetto)"],
];
for (const [chiave, cosa] of RICHIESTE) {
  const f = frase(chiave);
  check(`Info.plist spiega ${cosa}`, f !== null && f.length >= 30, f ? `"${f.slice(0, 60)}..."` : "MANCA");
  check(`${chiave}: la frase dice "dayalogue" e dice quando`, f !== null && /dayalogue/.test(f) && /quando|per /.test(f));
}

/* I due punti d'ingresso che rendono le frasi necessarie esistono davvero:
   se un giorno spariscono, le frasi restano innocue; se ne nasce un terzo
   (es. un input con capture in un altro modulo), questo elenco va
   aggiornato. */
const fotoRow = readFileSync("src/modules/impostazioni/components/foto-row.tsx", "utf8");
check("la foto profilo apre la fotocamera con capture (quindi serve NSCamera)", /capture="user"/.test(fotoRow));
const addToDay = readFileSync("src/modules/oggi/components/add-to-day.tsx", "utf8");
check("la giornata prende foto dal rullino con un input file", /type="file"[\s\S]{0,80}accept="image\/\*"/.test(addToDay));

/* Nessun input con capture fuori dai posti noti: un terzo punto d'ingresso
   della fotocamera senza che questo banco lo sappia e un buco. */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
function tsx(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) tsx(p, out);
    else if (/\.tsx$/.test(n)) out.push(p);
  }
  return out;
}
const conCapture = tsx("src").filter((f) => /capture=/.test(readFileSync(f, "utf8")));
check(
  "gli input con capture sono solo quelli noti",
  conCapture.length === 1 && conCapture[0].endsWith("foto-row.tsx"),
  conCapture.join(", "),
);

const passati = results.filter((r) => r.ok).length;
console.log(`\n${passati}/${results.length} PASS`);
process.exit(passati === results.length ? 0 : 1);
