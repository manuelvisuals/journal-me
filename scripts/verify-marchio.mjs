// IL MARCHIO: SEGNO SOPRA, PAROLA SOTTO (2 settembre 2026, scelta di
// Manuel sul mockup sfondo-lancio.html "02 . Newsreader"; nato il 31
// agosto per il corsivo Sacramento, che non c'e piu) — porta 3100.
//
// La cosa che questo banco esiste per impedire e UNA: che la parola sembri
// scritta in Newsreader e invece sia il ripiego del sistema. E il difetto
// piu insidioso della tipografia, perche la pagina si vede lo stesso e
// nessuno se ne accorge — ci e gia successo con i mockup che caricavano i
// font da Google (HANDOVER §13). Quindi qui non si controlla che il CSS
// DICHIARI Newsreader: si MISURA la parola e la si confronta con la stessa
// parola scritta in un carattere che di sicuro non esiste. Se le due
// larghezze coincidono, il file non e arrivato e il banco e rosso.
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
check(
  '"day" pesa piu di "alogue"',
  /\.jm-marchio b\s*\{[^}]*font-weight:\s*600/.test(overrides) &&
    /\.jm-marchio\s*\{[^}]*font-weight:\s*300/.test(overrides),
);
const marchioTsx = readFileSync("src/components/brand/marchio.tsx", "utf8");
check(
  "il componente Marchio: il segno prima della parola, e <b>day</b>alogue",
  marchioTsx.indexOf("<BrandMark />") < marchioTsx.indexOf("<b>day</b>alogue"),
);
check(
  "nessun file del progetto nomina piu Sacramento come carattere in uso",
  !/sacramento/i.test(readFileSync("src/styles/overrides.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "")) &&
    !/sacramento/i.test(readFileSync("src/styles/base.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "")),
);

/* ============ 2. tutti i posti portano il componente ================== */

const POSTI = [
  ["la rail del desktop", "src/components/desktop/rail-left.tsx"],
  ["la splash", "src/components/splash.tsx"],
  ["lo sblocco biometrico", "src/components/biometric-lock.tsx"],
  ["il login", "src/app/(app)/login/page.tsx"],
  ["la privacy", "src/app/(app)/privacy/page.tsx"],
  ["il saluto d'avvio", "src/modules/accesso/components/saluto-avvio.tsx"],
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
        window.localStorage.setItem("jm.mode", "local");
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
async function davveroCorsivo(page) {
  return page.evaluate(() => {
    const misura = (famiglia) => {
      const s = document.createElement("span");
      s.style.cssText = `font-family:${famiglia};font-size:64px;position:absolute;visibility:hidden;white-space:nowrap`;
      s.textContent = "dayalogue";
      document.body.appendChild(s);
      const w = s.getBoundingClientRect().width;
      s.remove();
      return Math.round(w);
    };
    return {
      marchio: misura("var(--jm-font-marchio)"),
      inesistente: misura('"NonEsisteQuestoCarattere", cursive'),
      grottesco: misura("var(--jm-font-sans)"),
    };
  });
}

for (const [percorso, w, h, selettore, nome] of [
  ["/", 1440, 900, ".jm-sito-nav .jm-marchio", "sito, barra"],
  ["/", 390, 844, ".jm-sito-nav .jm-marchio", "sito sul telefono"],
  ["/login", 390, 844, ".jm-marchio", "login"],
  ["/app", 1440, 900, ".jm-rail-brand .jm-marchio", "rail del desktop"],
]) {
  const { ctx, page, errori } = await apri(percorso, w, h);
  const m = await davveroCorsivo(page);
  check(
    `${nome}: il carattere del marchio E' arrivato (non e il ripiego)`,
    m.marchio !== m.inesistente && m.marchio !== m.grottesco,
    `marchio ${m.marchio}px, ripiego ${m.inesistente}px, grottesco ${m.grottesco}px`,
  );

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
      };
    });
    check(
      `${nome}: usa il carattere del marchio`,
      /newsreader/i.test(dati.famiglia),
      dati.famiglia.slice(0, 60),
    );
    check(
      `${nome}: e in colonna, il segno sopra la parola`,
      dati.colonna && dati.segnoSopra,
      `direction ${dati.direzione}, segno y ${dati.segnoBottom} <= parola y ${dati.parolaTop}`,
    );
    check(
      `${nome}: "day" pesa piu di "alogue"`,
      Number(dati.pesoDay) > Number(dati.peso),
      `day ${dati.pesoDay}, resto ${dati.peso}`,
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
