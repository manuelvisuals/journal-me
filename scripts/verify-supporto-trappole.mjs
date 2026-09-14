// Le trappole del modulo di assistenza, e cio che la linguetta Feedback
// mette nell'indirizzo (13 settembre 2026).
//
// Cosa deve essere vero:
//  1. setaccio: il campo esca e l'orologio buttano via in SILENZIO, e non
//     buttano via chi non manda il tempo (un client vecchio);
//  2. contestoPulito: passano SEI chiavi e solo quelle, tagliate;
//  3. precompilatoDaIndirizzo: si legge senza fidarsi, e senza parametri
//     non produce niente;
//  4. i chiamanti: il modulo manda tempo ed esca, la rotta setaccia PRIMA
//     di validare e avvisa DOPO aver salvato, la pagina non monta piu la
//     barra del sito.
//
//   node --experimental-strip-types scripts/verify-supporto-trappole.mjs
import { readFileSync } from "node:fs";
import {
  CAMPO_ESCA,
  MIN_MS_COMPILAZIONE,
  MAX_MS_COMPILAZIONE,
  setaccio,
  contestoPulito,
} from "../src/modules/sito/supporto-regole.ts";
import { precompilatoDaIndirizzo } from "../src/modules/sito/supporto-indirizzo.ts";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

/* ============ 1. il setaccio ============ */
check("1 una persona passa", setaccio({ esca: "", msDaApertura: 9_000 }).ok);
check("1 il campo esca compilato e muto", (() => {
  const v = setaccio({ esca: "Acme Srl", msDaApertura: 9_000 });
  return !v.ok && v.muto === true;
})());
check("1 esca di soli spazi non e compilata", setaccio({ esca: "   ", msDaApertura: 9_000 }).ok);
check("1 sotto la soglia e muto", (() => {
  const v = setaccio({ esca: "", msDaApertura: MIN_MS_COMPILAZIONE - 1 });
  return !v.ok && v.muto === true;
})());
check("1 esattamente sulla soglia passa", setaccio({ esca: "", msDaApertura: MIN_MS_COMPILAZIONE }).ok);
check("1 un modulo di otto ore fa e muto", (() => {
  const v = setaccio({ esca: "", msDaApertura: MAX_MS_COMPILAZIONE + 1 });
  return !v.ok && v.muto === true;
})());
check("1 senza tempo NON si butta via niente (client vecchio)", setaccio({ esca: "" }).ok);
check("1 un tempo che non e un numero non butta via niente", setaccio({ esca: "", msDaApertura: "9000" }).ok);
check("1 la ragione c'e sempre", (() => {
  const v = setaccio({ esca: "Acme", msDaApertura: 9_000 });
  return !v.ok && typeof v.perche === "string" && v.perche.length > 0;
})());

/* ============ 2. il contesto ============ */
const c = contestoPulito({
  ua: "x".repeat(500),
  schermo: "390x844",
  lingua_browser: "it-IT",
  da: "app",
  versione: "1.0 (10)",
  schermata: "/app/mese",
  cattiva: "non deve passare",
  email: "ruba@example.com",
});
check("2 passano sei chiavi e solo sei", Object.keys(c).length === 6, Object.keys(c).join(","));
check("2 le chiavi estranee spariscono", c.cattiva === undefined && c.email === undefined);
check("2 lo ua e tagliato a 400", c.ua.length === 400);
check("2 le tre chiavi nuove arrivano", c.da === "app" && c.versione === "1.0 (10)" && c.schermata === "/app/mese");
check("2 cio che non e stringa diventa stringa vuota", (() => {
  const v = contestoPulito({ ua: 42, schermo: null, lingua_browser: {} });
  return v.ua === "" && v.schermo === "" && v.lingua_browser === "";
})());
check("2 senza contesto non si rompe", contestoPulito(undefined).ua === "");

/* ============ 3. l'indirizzo ============ */
check("3 senza parametri non produce niente", precompilatoDaIndirizzo({}) === undefined);
check("3 parametri vuoti non producono niente", precompilatoDaIndirizzo({ email: "  ", v: "" }) === undefined);
check("3 l'email arriva", precompilatoDaIndirizzo({ email: "a@b.it" })?.email === "a@b.it");
check("3 di un parametro doppio si prende il primo", precompilatoDaIndirizzo({ da: ["app", "altro"] })?.da === "app");
check("3 l'email lunga si taglia a 320", (precompilatoDaIndirizzo({ email: "a".repeat(400) })?.email ?? "").length === 320);
check("3 v e s diventano versione e schermata", (() => {
  const p = precompilatoDaIndirizzo({ v: "1.0 (10)", s: "/app" });
  return p?.versione === "1.0 (10)" && p?.schermata === "/app";
})());

/* ============ 4. i chiamanti ============ */
const modulo = readFileSync("src/modules/sito/components/supporto.tsx", "utf8");
check("4 il modulo manda il tempo", /msDaApertura: Date\.now\(\) - apertura\.current/.test(modulo));
check("4 il modulo manda il campo esca", /\[CAMPO_ESCA\]: esca/.test(modulo));
check("4 il modulo aspetta invece di rifiutare chi e veloce", /MIN_MS_COMPILAZIONE - passato/.test(modulo));
check("4 il campo esca c'e e non e spento", /jm-sito-esca/.test(modulo) && !/id=\{CAMPO_ESCA\}[\s\S]{0,200}hidden/.test(modulo));

const rotta = readFileSync("src/modules/sito/server/supporto.ts", "utf8");
const iSetaccio = rotta.indexOf("setaccio({");
const iOggetto = rotta.indexOf("const oggetto =");
const iInsert = rotta.indexOf('.from("supporto")');
const iPosta = rotta.indexOf("notificaSupporto({");
check("4 la rotta setaccia PRIMA di validare i campi", iSetaccio > 0 && iOggetto > iSetaccio);
check("4 la rotta risponde ok anche a chi butta via", /verdetto\.ok[\s\S]{0,320}NextResponse\.json\(\{ ok: true \}\)/.test(rotta));
check("4 la rotta SALVA prima di mandare l'email", iInsert > 0 && iPosta > iInsert);
check("4 l'email che non parte non fa fallire la risposta", /if \(!esito\.inviata\) console\.error/.test(rotta));

const pagina = readFileSync("src/modules/sito/components/pagina-supporto.tsx", "utf8");
check("4 la pagina non monta piu la barra del sito", !/NavSito/.test(pagina));
check("4 la pagina tiene marchio e due lingue", /Marchio/.test(pagina) && /jm-sito-lang/.test(pagina));

const css = readFileSync("src/modules/sito/styles.css", "utf8");
check("4 la testata nuda ha il suo stile", /\.jm-sito-sup-testata \{/.test(css));
check("4 il campo esca e fuori campo, non spento", /\.jm-sito-esca \{[\s\S]{0,200}left: -9999px/.test(css));

const posta = readFileSync("src/modules/sito/server/posta-supporto.ts", "utf8");
check("4 il rispondi torna a chi ha scritto", /reply_to: m\.email/.test(posta));
check("4 l'oggetto porta il titolo", /subject: `\[dayalogue\] \$\{m\.oggetto\}`/.test(posta));
check("4 senza chiave non si tenta nemmeno", /RESEND_API_KEY assente/.test(posta));
check("4 il nome del campo esca non si dichiara trappola", !/esca|trap|honey/i.test(CAMPO_ESCA));

const ko = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - ko}/${results.length} verdi`);
process.exit(ko ? 1 : 0);
