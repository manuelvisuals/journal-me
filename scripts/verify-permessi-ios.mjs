// I PERMESSI DEL GUSCIO iOS (2 settembre 2026, richiesta di Manuel:
// "assicurati che l'app passi la revisione Apple per fotocamera e rullino").
//
// Il fatto: la foto profilo ha "Scatta una foto" (foto-row.tsx, input
// con capture="user") e la giornata ha "Aggiungi foto" (add-to-day
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
  check(`${chiave}: la frase dice "dayalogue" e dice quando`, f !== null && /dayalogue/.test(f) && /quando|per |when|only /.test(f));
  // Bocciatura Apple del 14 settembre 2026 (linea guida 4 / 5.1.1(ii)): le
  // frasi erano solo in italiano su un iPhone in inglese. Info.plist tiene
  // l'INGLESE (la lingua base e quella del revisore) e it.lproj/InfoPlist.strings
  // l'italiano; tutte e due le lingue devono avere ogni chiave.
  check(`${chiave}: Info.plist e in inglese (la lingua base)`, f !== null && /\b(uses|opens|when|your)\b/.test(f) && !/\b(usa|quando|scegli)\b/.test(f), f ? `"${f.slice(0, 50)}"` : "");
  for (const lingua of ["en", "it"]) {
    const strings = readFileSync(`ios/App/App/${lingua}.lproj/InfoPlist.strings`, "utf8");
    const r = new RegExp(`"${chiave}"\\s*=\\s*"([^"]{30,})";`);
    const m = strings.match(r);
    check(`${chiave}: ${lingua}.lproj/InfoPlist.strings la traduce`, m !== null && /dayalogue/.test(m[1]));
  }
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

/* LE NOTIFICHE (9 settembre 2026, scelta di Manuel: B1). Il permesso si
   chiede DOPO la prima giornata salvata, mai all'avvio: all'avvio si
   risincronizza soltanto (zero finestre). Se qualcuno rimette la richiesta
   nel cancello, o la toglie dal salvataggio, questo banco esce rosso. */
const reminders = readFileSync("src/lib/native/reminders.ts", "utf8");
const proponi = reminders.slice(reminders.indexOf("export async function proponiPromemoriaSerale"), reminders.indexOf("export async function sincronizzaPromemoriaSerale"));
const sincronizza = reminders.slice(reminders.indexOf("export async function sincronizzaPromemoriaSerale"));
check("reminders: proponi chiede il permesso (requestPermissions)", /requestPermissions/.test(proponi));
check("reminders: sincronizza NON chiede mai il permesso", proponi.length > 0 && sincronizza.length > 0 && !/requestPermissions/.test(sincronizza));
const gate = readFileSync("src/components/auth-gate.tsx", "utf8");
check("il cancello all'avvio risincronizza soltanto", /sincronizzaPromemoriaSerale\(\)/.test(gate) && !/proponiPromemoriaSerale|ensureEveningReminder/.test(gate));
const salva = readFileSync("src/lib/actions/save-recording.ts", "utf8");
/* ---- il manifesto della privacy e il progetto Xcode (best practice 2024+) ---- */
const pbx = readFileSync("ios/App/App.xcodeproj/project.pbxproj", "utf8");
check("PrivacyInfo.xcprivacy esiste e dice niente tracciamento", /<key>NSPrivacyTracking<\/key>\s*<false\/>/.test(readFileSync("ios/App/App/PrivacyInfo.xcprivacy", "utf8")));
check("PrivacyInfo.xcprivacy e nelle Resources del progetto Xcode", /PrivacyInfo\.xcprivacy in Resources/.test(pbx));
check("InfoPlist.strings (en + it) e nelle Resources del progetto Xcode, e 'it' e fra le regioni note", /InfoPlist\.strings in Resources/.test(pbx) && /knownRegions = \(\s*en,\s*it,\s*Base,/.test(pbx) && /path = it\.lproj\/InfoPlist\.strings/.test(pbx) && /path = en\.lproj\/InfoPlist\.strings/.test(pbx));
check("Info.plist dichiara le lingue (CFBundleLocalizations: en, it)", /<key>CFBundleLocalizations<\/key>\s*<array>\s*<string>en<\/string>\s*<string>it<\/string>/.test(plist));
check("la frase del microfono non mente: l'audio viene inviato per la trascrizione, non 'resta sul telefono'", !/resta sul telefono|stays on the phone/.test(plist) && /sent only|inviato solo/.test(plist + readFileSync("ios/App/App/it.lproj/InfoPlist.strings", "utf8")));

check("il salvataggio della giornata propone la notifica (saved.length > 0)", /if \(saved\.length > 0\) void proponiPromemoriaSerale\(\)/.test(salva));
const chiedono = tsx("src").filter((f) => /proponiPromemoriaSerale/.test(readFileSync(f, "utf8")));
check("nessun componente .tsx chiede il permesso notifiche da solo", chiedono.length === 0, chiedono.join(", "));

const passati = results.filter((r) => r.ok).length;
console.log(`\n${passati}/${results.length} PASS`);
process.exit(passati === results.length ? 0 : 1);
