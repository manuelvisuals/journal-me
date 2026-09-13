// IL MARCHIO: SEGNO SOPRA, PAROLA SOTTO (2 settembre 2026, scelta di
// Manuel sul mockup sfondo-lancio.html "02 . Newsreader"; nato il 31
// agosto per il corsivo Sacramento, che non c'e piu) — porta 3100.
//
// DALL'11 SETTEMBRE 2026 (scelta 1B di Manuel) il marchio non e piu ne una
// foto ne del testo: sono DUE DISEGNI. Il segno e il simbolo dell'icona
// sulla home del telefono (la "d" coi tre pallini) e la parola e il
// tracciato di "dayalogue", coi due pesi gia dentro la forma. Quindi la
// vecchia misura del carattere non ha piu senso — un disegno non puo
// "ripiegare" su un altro font — e al suo posto si pretende che la parola
// sia davvero un disegno: un SVG con dentro un tracciato e il nome scritto
// per chi legge con le orecchie. Se un giorno qualcuno rimettesse del testo,
// il banco lo vede.
//
// Poi si controlla che il marchio (il componente Marchio) stia in tutti i
// posti dove il nome e un MARCHIO — col segno SOPRA la parola e "day" piu
// pesante di "alogue" — e in nessuno di quelli dove e una parola dentro
// una frase (il testo di benvenuto, il nome del file di backup). E che di
// Sacramento non resti niente: ne il file, ne la dichiarazione.
import { readFileSync, existsSync } from "node:fs";
import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

/* ============ 1. il carattere, il token, e niente Sacramento ============ */

check(
  "il carattere del marchio (Newsreader) e nel repo, non preso da Google",
  existsSync("src/fonts/newsreader-latin-wght-normal.woff2"),
);
check(
  "di Sacramento non resta il file",
  !existsSync("src/fonts/sacramento-latin-400-normal.woff2") &&
    !existsSync("src/fonts/sacramento-OFL.txt"),
);
const layout = readFileSync("src/app/layout.tsx", "utf8");
check(
  "layout.tsx dichiara Newsreader come carattere locale e non dichiara piu Sacramento",
  /newsreader-latin-wght-normal\.woff2/.test(layout) &&
    /variable: "--font-newsreader"/.test(layout) &&
    !/localFont\([^)]*sacramento/i.test(layout) &&
    !/--font-sacramento/.test(layout),
);
check(
  "il token del marchio esiste, e nello scheletro e punta a Newsreader",
  /--jm-font-marchio:\s*var\(--font-newsreader\)/.test(
    readFileSync("src/styles/base.css", "utf8"),
  ),
);
const overrides = readFileSync("src/styles/overrides.css", "utf8");
check(
  "la classe .jm-marchio sta in overrides.css (l'ultimo import, cioe quello che vince)",
  /\.jm-marchio\s*\{[\s\S]*?--jm-font-marchio/.test(overrides),
);
check(
  "il marchio e in colonna: segno sopra, parola sotto",
  /\.jm-marchio\s*\{[^}]*flex-direction:\s*column/.test(overrides) &&
    /\.jm-marchio \.jm-logo\s*\{[^}]*display:\s*block/.test(overrides),
);
const marchioTsx = readFileSync("src/components/brand/marchio.tsx", "utf8");
check(
  "il componente Marchio: il segno prima della parola, tutti e due disegni",
  marchioTsx.indexOf("<BrandMark />") < marchioTsx.indexOf("<BrandWord />") &&
    !/<b>day<\/b>alogue/.test(marchioTsx),
);
const segnoTsx = readFileSync("src/components/brand/brand-mark.tsx", "utf8");
check(
  "il segno e un disegno del tema: tre pallini d'accento (e, se c'e un glifo, in currentColor)",
  (segnoTsx.match(/<circle/g) ?? []).length === 3 &&
    /var\(--color-accent\)/.test(segnoTsx) &&
    (!/<path/.test(segnoTsx) || /currentColor/.test(segnoTsx)),
);
/* Senza i commenti: la storia del PNG e raccontata li dentro, e una
   ricerca cieca la scambierebbe per codice vivo. */
const segnoCodice = segnoTsx.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
check(
  "il segno non e piu un'immagine (niente <img>, niente logo.png)",
  !/<img/.test(segnoCodice) && !/logo\.png/.test(segnoCodice),
);
const parolaTsx = readFileSync("src/components/brand/brand-word.tsx", "utf8");
check(
  "la parola e un disegno, col nome scritto per chi legge con le orecchie",
  /aria-label="dayalogue"/.test(parolaTsx) && /<path/.test(parolaTsx),
);
check(
  "nessun file del progetto nomina piu Sacramento come carattere in uso",
  !/sacramento/i.test(readFileSync("src/styles/overrides.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "")) &&
    !/sacramento/i.test(readFileSync("src/styles/base.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "")),
);

/* ============ 2. tutti i posti portano il componente ================== */

const POSTI = [
  ["la rail del desktop", "src/components/desktop/rail-left.tsx"],
  /* "la splash" e FUORI dalla lista dal 13 settembre 2026: e in prova
     col marchio animato (public/marchio-animato.webp), controllato sotto. */
  ["lo sblocco biometrico", "src/components/biometric-lock.tsx"],
  ["il login", "src/app/(app)/login/page.tsx"],
  ["la privacy", "src/app/(app)/privacy/page.tsx"],
  ["la porta del giorno", "src/modules/accesso/components/porta-giorno.tsx"],
  ["il pannello admin", "src/modules/admin/components/admin-client.tsx"],
  ["il sito", "src/modules/sito/components/guscio.tsx"],
];
for (const [nome, file] of POSTI) {
  const src = readFileSync(file, "utf8");
  check(
    `${nome}: monta <Marchio /> e non scrive il nome a mano`,
    src.includes("<Marchio") && !/jm-marchio"|>\s*dayalogue\s*<|<span[^>]*>day<\/span>alogue/.test(src),
  );
}

/* PROVA DEL 13 SETTEMBRE 2026: la splash monta il marchio ANIMATO e non
   scrive il nome a mano. Quando la prova finisce, la splash torna nella
   lista qui sopra e questo blocco sparisce. */
{
  const s = readFileSync("src/components/splash.tsx", "utf8");
  check(
    "la splash (in prova): monta il marchio animato, file presente, e non scrive il nome a mano",
    /jm-splash-anim/.test(s) &&
      /\/marchio-animato\.webp/.test(s) &&
      existsSync("public/marchio-animato.webp") &&
      !/>\s*dayalogue\s*<|<span[^>]*>day<\/span>alogue/.test(s),
  );
}

/* Il sito ha DUE marchi: la barra (col segno) e il piede (senza). */
{
  const g = readFileSync("src/modules/sito/components/guscio.tsx", "utf8");
  const quanti = (g.match(/<Marchio/g) || []).length;
  check("il sito: sia la barra sia il piede", quanti === 2, `${quanti} su 2`);
  check("il sito: il piede e senza segno", /<Marchio segno=\{false\}/.test(g));
}

/* Dove il nome e una PAROLA e non un marchio, non si tocca. */
for (const [nome, file] of [
  ["il testo di benvenuto", "src/lib/benvenuto.ts"],
  ["il nome del file di backup", "src/lib/backup/backup.ts"],
]) {
  const src = readFileSync(file, "utf8");
  check(`${nome}: resta testo normale`, !src.includes("jm-marchio") && !src.includes("<Marchio"));
}

/* ============ 3. la misura: e davvero Newsreader? ====================== */

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

async function apri(percorso, w, h, locale = true) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: "it-IT" });
  if (locale) {
    await ctx.addInitScript(() => {
      try {
        window.localStorage.setItem("jm.mode", "local"); window.localStorage.setItem("jm.ospite", "0");
        window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
        window.localStorage.setItem("jm.saluto.silenzio", "dev:banco");
      } catch {}
    });
  }
  const page = await ctx.newPage();
  const errori = [];
  page.on("console", (m) => {
    if (m.type() === "error") errori.push(m.text());
  });
  await page.goto(BASE + percorso, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  return { ctx, page, errori };
}

/**
 * La prova vera: la stessa parola, stesso corpo, scritta col carattere del
 * marchio e con uno che non esiste. Se le larghezze coincidono, Newsreader
 * non e arrivato e stiamo guardando il ripiego.
 */
for (const [percorso, w, h, selettore, nome] of [
  ["/", 1440, 900, ".jm-sito-nav .jm-marchio", "sito, barra"],
  ["/", 390, 844, ".jm-sito-nav .jm-marchio", "sito sul telefono"],
  ["/login", 390, 844, ".jm-marchio", "login"],
  ["/app", 1440, 900, ".jm-rail-brand .jm-marchio", "rail del desktop"],
]) {
  const { ctx, page, errori } = await apri(percorso, w, h);

  const el = await page.$(selettore);
  check(`${nome}: il marchio e in pagina`, el !== null, selettore);
  if (el) {
    const dati = await el.evaluate((e) => {
      const s = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      return {
        famiglia: s.fontFamily,
        tracking: s.letterSpacing,
        peso: s.fontWeight,
        largo: Math.round(r.width),
        alto: Math.round(r.height),
        destra: Math.round(window.innerWidth - r.right),
        direzione: s.flexDirection,
        colonna: s.display.includes("flex") && s.flexDirection === "column",
        segnoBottom: Math.round(e.querySelector(".jm-logo")?.getBoundingClientRect().bottom ?? -1),
        parolaTop: Math.round(e.querySelector(".jm-marchio-parola")?.getBoundingClientRect().top ?? -2),
        segnoSopra:
          (e.querySelector(".jm-logo")?.getBoundingClientRect().bottom ?? Infinity) <=
          (e.querySelector(".jm-marchio-parola")?.getBoundingClientRect().top ?? -Infinity) + 1,
        pesoDay: e.querySelector("b") ? getComputedStyle(e.querySelector("b")).fontWeight : "0",
        parolaTag: (e.querySelector(".jm-marchio-parola")?.tagName ?? "?").toLowerCase(),
        parolaDisegno: (e.querySelector(".jm-marchio-parola")?.tagName ?? "").toLowerCase() === "svg",
      };
    });
    check(
      `${nome}: la parola e un disegno, non del testo`,
      dati.parolaDisegno,
      `tag ${dati.parolaTag}`,
    );
    check(
      `${nome}: e in colonna, il segno sopra la parola`,
      dati.colonna && dati.segnoSopra,
      `direction ${dati.direzione}, segno y ${dati.segnoBottom} <= parola y ${dati.parolaTop}`,
    );
    check(
      `${nome}: nel marchio non e rimasto del testo in grassetto`,
      dati.pesoDay === "0",
      `trovato un <b> con peso ${dati.pesoDay}`,
    );
    check(
      `${nome}: sta dentro lo schermo`,
      dati.destra >= 0 && dati.largo > 0,
      `larghezza ${dati.largo}, a destra restano ${dati.destra}`,
    );
  }
  check(`${nome}: zero errori console`, errori.length === 0, errori.slice(0, 2).join(" | "));
  await ctx.close();
}

/* La parola dentro una frase NON deve essere diventata corsiva. */
{
  const { ctx, page } = await apri("/privacy", 390, 844);
  const famiglia = await page.evaluate(() => {
    const p = [...document.querySelectorAll("p")].find((e) => e.textContent.includes("dayalogue e un diario"));
    return p ? getComputedStyle(p).fontFamily : null;
  });
  check(
    "la privacy: il nome dentro la frase resta testo normale",
    famiglia !== null && !/newsreader/i.test(famiglia),
    String(famiglia).slice(0, 50),
  );
  await ctx.close();
}

await browser.close();

const passati = results.filter((r) => r.ok).length;
console.log(`\n${passati}/${results.length} PASS`);
process.exit(passati === results.length ? 0 : 1);
