// IL MARCHIO IN CORSIVO (31 agosto 2026, scelta di Manuel dopo il mockup
// dei quattro corsivi) — porta 3100.
//
// La cosa che questo banco esiste per impedire e UNA: che la parola sembri
// scritta in Sacramento e invece sia il ripiego del sistema. E il difetto
// piu insidioso della tipografia, perche la pagina si vede lo stesso e
// nessuno se ne accorge — ci e gia successo con i mockup che caricavano i
// font da Google (HANDOVER §13). Quindi qui non si controlla che il CSS
// DICHIARI Sacramento: si MISURA la parola e la si confronta con la stessa
// parola scritta in un carattere che di sicuro non esiste. Se le due
// larghezze coincidono, il file non e arrivato e il banco e rosso.
//
// Poi si controlla che il corsivo stia in tutti e sette i posti dove il
// nome e un MARCHIO, e in nessuno di quelli dove e una parola dentro una
// frase (la privacy, il testo di benvenuto, il nome del file di backup).
import { readFileSync, existsSync } from "node:fs";
import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

/* ============ 1. il file e la licenza sono nel repo ==================== */

check(
  "il carattere e nel repo, non preso da Google",
  existsSync("src/fonts/sacramento-latin-400-normal.woff2"),
);
check(
  "la licenza OFL viaggia accanto al carattere",
  existsSync("src/fonts/sacramento-OFL.txt") &&
    readFileSync("src/fonts/sacramento-OFL.txt", "utf8").includes(
      "SIL Open Font License, Version 1.1",
    ),
);
const layout = readFileSync("src/app/layout.tsx", "utf8");
check(
  "layout.tsx lo dichiara come carattere locale",
  /sacramento-latin-400-normal\.woff2/.test(layout) &&
    /variable: "--font-sacramento"/.test(layout),
);
check(
  "il token del marchio esiste ed e nello scheletro",
  /--jm-font-marchio:\s*var\(--font-sacramento\)/.test(
    readFileSync("src/styles/base.css", "utf8"),
  ),
);
check(
  "la classe .jm-marchio sta in overrides.css (l'ultimo import, cioe quello che vince)",
  /\.jm-marchio\s*\{[\s\S]*?--jm-font-marchio/.test(
    readFileSync("src/styles/overrides.css", "utf8"),
  ),
);

/* ============ 2. tutti e sette i posti la portano ====================== */

const POSTI = [
  ["la rail del desktop", "src/components/desktop/rail-left.tsx", "jm-rail-brand jm-marchio"],
  ["la splash", "src/components/splash.tsx", "jm-splash-mark jm-marchio"],
  ["lo sblocco biometrico", "src/components/biometric-lock.tsx", "jm-marchio mb-2"],
  ["il login", "src/app/(app)/login/page.tsx", "jm-marchio text-center"],
  ["il saluto d'avvio", "src/modules/accesso/components/saluto-avvio.tsx", "jm-benv-sal-marchio jm-marchio"],
  ["il pannello admin", "src/modules/admin/components/admin-client.tsx", "jm-adm-brand jm-marchio"],
  ["il sito", "src/modules/sito/components/guscio.tsx", "jm-sito-marchio jm-marchio"],
];
for (const [nome, file, pezzo] of POSTI) {
  check(`${nome}: il nome porta la classe del marchio`, readFileSync(file, "utf8").includes(pezzo));
}

/* Il sito ha DUE marchi: la barra e il piede. */
{
  const g = readFileSync("src/modules/sito/components/guscio.tsx", "utf8");
  const quanti = (g.match(/jm-sito-marchio jm-marchio/g) || []).length;
  check("il sito: sia la barra sia il piede", quanti === 2, `${quanti} su 2`);
}

/* Dove il nome e una PAROLA e non un marchio, non si tocca. */
for (const [nome, file] of [
  ["la privacy", "src/app/(app)/privacy/page.tsx"],
  ["il testo di benvenuto", "src/lib/benvenuto.ts"],
  ["il nome del file di backup", "src/lib/backup/backup.ts"],
]) {
  check(`${nome}: resta testo normale`, !readFileSync(file, "utf8").includes("jm-marchio"));
}

/* ============ 3. la misura: e davvero Sacramento? ====================== */

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
 * marchio e con uno che non esiste. Se le larghezze coincidono, Sacramento
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
  ["/", 1440, 900, ".jm-sito-nav .jm-sito-marchio", "sito, barra"],
  ["/", 390, 844, ".jm-sito-nav .jm-sito-marchio", "sito sul telefono"],
  ["/login", 390, 844, ".jm-marchio", "login"],
  ["/app", 1440, 900, ".jm-rail-brand", "rail del desktop"],
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
      };
    });
    check(
      `${nome}: usa il carattere del marchio`,
      /sacramento/i.test(dati.famiglia),
      dati.famiglia.slice(0, 60),
    );
    check(
      `${nome}: il tracking negativo delle intestazioni non lo stringe`,
      dati.tracking === "normal" || dati.tracking === "0px",
      dati.tracking,
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
    famiglia !== null && !/sacramento/i.test(famiglia),
    String(famiglia).slice(0, 50),
  );
  await ctx.close();
}

await browser.close();

const passati = results.filter((r) => r.ok).length;
console.log(`\n${passati}/${results.length} PASS`);
process.exit(passati === results.length ? 0 : 1);
