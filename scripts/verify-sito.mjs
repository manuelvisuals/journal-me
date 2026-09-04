// IL SITO PUBBLICO su / e /support, e lo spostamento dell'app sotto /app
// (mockup design/mockups/sito-seo.html, approvato da Manuel il 31 agosto
// 2026) — porta 3100.
//
// Cosa si prova, e perche proprio questo:
//
//  1. IL TESTO E' GIA NELL'HTML. Non "la pagina si vede": si scarica la
//     pagina con fetch, senza browser, e ci si pretende dentro il titolo,
//     il sottotitolo, tutte e sei le domande e le risposte. E' l'unica
//     prova che valga per un motore di ricerca, che JavaScript non lo
//     esegue come lo esegue un browser.
//  2. LE DUE LINGUE SONO DUE PAGINE. /en deve arrivare in inglese dal
//     server, non diventare inglese dopo. Se un giorno qualcuno "unifica"
//     le due pagine con t(), questo controllo diventa rosso.
//  3. I METADATA: titolo, descrizione, canonical, hreflang, robots.
//  4. NIENTE APP NEI RISULTATI: robots.txt deve chiudere /app, /login,
//     /admin e /api, e la mappa del sito deve contenere solo le quattro
//     pagine pubbliche.
//  5. LO SPOSTAMENTO SOTTO /app: nessun file del progetto punta piu alle
//     vecchie rotte, e /privacy si apre senza sessione (era il difetto
//     trovato per strada: la pagina piu pubblica dell'app era l'unica che
//     chiedeva le chiavi).
//  6. IL SITO NON ENTRA NEL TELEFONO: le pagine si chiamano page.web.tsx,
//     e la radice non ha nessun page.tsx.
//  7. La barra in alto non sborda e la pagina non scorre di lato.
//  8. Zero errori in console, su tutte e quattro le pagine.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

/* ================= 1-4. quello che riceve un motore di ricerca ========= */

async function scarica(percorso) {
  const resp = await fetch(BASE + percorso);
  return { stato: resp.status, html: await resp.text() };
}

const home = await scarica("/");
check("/ risponde 200", home.stato === 200, String(home.stato));
check(
  "/ ha il titolo dell'eroe gia nell'HTML",
  home.html.includes("Racconta la giornata."),
);
check(
  "/ ha il sottotitolo gia nell'HTML",
  home.html.includes("Parli due minuti prima di dormire"),
);
check(
  "/ ha tutte e sei le domande nell'HTML",
  [
    "dayalogue e gratis?",
    "Dove finiscono le mie giornate?",
    "Chi legge quello che racconto?",
    "Posso portarmi via i miei dati?",
    "Serve internet?",
    "C'e l'app per iPhone?",
  ].every((d) => home.html.includes(d)),
);
check(
  "/ dichiara i dati strutturati delle domande",
  home.html.includes('"@type":"FAQPage"'),
);
check(
  "/ ha il titolo giusto nella scheda",
  /<title>dayalogue - il diario che si racconta a voce<\/title>/.test(home.html),
);
check(
  "/ ha la descrizione",
  /<meta name="description" content="Parli due minuti a fine giornata/.test(home.html),
);
check(
  "/ dichiara il canonical",
  home.html.includes('rel="canonical" href="https://www.dayalogue.com"'),
);
check(
  "/ dichiara le due lingue (hreflang)",
  /hrefLang="it"/i.test(home.html) && /hrefLang="en"/i.test(home.html),
);

const en = await scarica("/en");
check("/en risponde 200", en.stato === 200, String(en.stato));
check(
  "/en arriva GIA in inglese dal server",
  en.html.includes("Tell your day.") && en.html.includes("It writes the rest."),
);
check(
  "/en non contiene il titolo italiano",
  !en.html.includes("Racconta la giornata."),
);
check(
  "/en ha il suo titolo inglese",
  /<title>dayalogue - the journal you tell out loud<\/title>/.test(en.html),
);

const sup = await scarica("/support");
check("/support risponde 200", sup.stato === 200, String(sup.stato));
check(
  "/support ha titolo e intro nell'HTML",
  sup.html.includes("Assistenza") &&
    sup.html.includes("Se qualcosa non funziona o hai una domanda"),
);
const supEn = await scarica("/en/support");
check(
  "/en/support e in inglese",
  supEn.stato === 200 && supEn.html.includes("If something is not working"),
);

const robots = await scarica("/robots.txt");
check(
  "robots.txt chiude l'app ai motori",
  ["/app", "/login", "/auth", "/admin", "/api"].every((r) =>
    robots.html.includes(`Disallow: ${r}`),
  ),
  robots.html.replace(/\n/g, " ").slice(0, 90),
);
check(
  "robots.txt dichiara la mappa del sito",
  robots.html.includes("Sitemap: https://www.dayalogue.com/sitemap.xml"),
);

const mappa = await scarica("/sitemap.xml");
const url = [...mappa.html.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
check(
  "la mappa contiene le quattro pagine pubbliche",
  url.length === 4 &&
    url.some((u) => u.endsWith(".com/")) &&
    url.some((u) => u.endsWith("/en/")) &&
    url.some((u) => u.endsWith("/support")) &&
    url.some((u) => u.endsWith("/en/support")),
  url.join(" "),
);
check(
  "nella mappa non c'e nessuna schermata dell'app",
  !url.some((u) => /\/app(\/|$)/.test(u) || u.includes("/login")),
);

/* ================= 5. lo spostamento sotto /app ======================== */

function tuttiIFile(dir, out = []) {
  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules" || nome === ".next" || nome === ".next-mobile") continue;
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) tuttiIFile(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const sorgenti = tuttiIFile("src");
const VECCHIE = [
  "mese",
  "recap",
  "remember",
  "settings",
  "persona",
  "palestra",
  "benvenuto",
  "giorno",
  "checkout-finto",
];
const fuoriPosto = [];
for (const f of sorgenti) {
  const testo = readFileSync(f, "utf8");
  // Il modulo `sito` e l'eccezione, e non per comodita: per lui "/" NON e
  // piu l'app, e la sua home. Un "Annulla" che riporta al sito e cio che
  // deve fare.
  const dentroIlSito = f.startsWith("src/modules/sito/");
  for (const r of VECCHIE) {
    // Un indirizzo interno che comincia con /<rotta> e non con /app/<rotta>.
    const re = new RegExp(`["'\`]/${r}\\b`, "g");
    if (re.test(testo)) fuoriPosto.push(`${f}: /${r}`);
  }
  // La radice come indirizzo di navigazione: dal 31 agosto e il sito.
  if (!dentroIlSito) {
    for (const m of testo.matchAll(/(?:push|replace)\("\/"\)|href="\/"/g)) {
      fuoriPosto.push(`${f}: ${m[0]}`);
    }
  }
}
check(
  "nessun file punta piu alle vecchie rotte dell'app",
  fuoriPosto.length === 0,
  fuoriPosto.slice(0, 5).join(" | "),
);

const priv = await scarica("/privacy");
check("/privacy risponde 200", priv.stato === 200, String(priv.stato));

// I segnalibri vecchi non devono trovare il vuoto: /mese porta a /app/mese
// con un rimando permanente, e la query si porta dietro.
for (const [da, a] of [
  ["/mese", "/app/mese"],
  ["/remember", "/app/remember"],
  ["/settings", "/app/settings"],
  ["/giorno?d=2026-08-27", "/app/giorno?d=2026-08-27"],
]) {
  const resp = await fetch(BASE + da, { redirect: "manual" });
  const dove = resp.headers.get("location") ?? "";
  check(
    `il vecchio indirizzo ${da} porta a ${a}`,
    (resp.status === 308 || resp.status === 301) && dove.endsWith(a),
    `${resp.status} -> ${dove}`,
  );
}

/* ================= 6. il sito non entra nel telefono =================== */

check(
  "le pagine del sito si chiamano page.web.tsx",
  ["src/app/page.web.tsx", "src/app/en/page.web.tsx", "src/app/support/page.web.tsx", "src/app/en/support/page.web.tsx"].every(
    (f) => existsSync(f),
  ),
);
check(
  "la radice NON ha un page.tsx (finirebbe nel pacchetto iOS)",
  !existsSync("src/app/page.tsx"),
);
const conf = readFileSync("next.config.ts", "utf8");
check(
  "la build mobile accetta solo .tsx, quindi ignora il sito",
  /const mobileConfig[\s\S]*?pageExtensions: \["tsx"\]/.test(conf),
);
check(
  "la build web accetta anche web.tsx",
  /const webConfig[\s\S]*?pageExtensions: \[[^\]]*"web\.tsx"/.test(conf),
);
check(
  "build:ios scrive la radice del pacchetto",
  readFileSync("package.json", "utf8").includes("scripts/ios-radice.mjs"),
);

/* ================= 7-8. il browser =================================== */

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

async function apri(percorso, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: "it-IT" });
  const page = await ctx.newPage();
  const errori = [];
  page.on("console", (m) => {
    if (m.type() === "error") errori.push(m.text());
  });
  page.on("pageerror", (e) => errori.push("PAGEERROR " + e.message));
  await page.goto(BASE + percorso, { waitUntil: "networkidle" });
  return { ctx, page, errori };
}

for (const [percorso, w, h, nome] of [
  ["/", 1440, 900, "desktop"],
  ["/", 390, 844, "telefono"],
  ["/support", 390, 844, "supporto telefono"],
  ["/en", 1440, 900, "inglese desktop"],
]) {
  const { ctx, page, errori } = await apri(percorso, w, h);
  const m = await page.evaluate(() => {
    const nav = document.querySelector(".jm-sito-nav-in");
    const ultimo = [...document.querySelectorAll(".jm-sito-nav-r .jm-sito-b")].pop();
    return {
      scrollOrizzontale:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      sbordo:
        nav && ultimo
          ? Math.round(ultimo.getBoundingClientRect().right - nav.getBoundingClientRect().right)
          : null,
      accedi: !!document.querySelector(".jm-sito-nav-accedi")?.getClientRects().length,
      nav: !!nav,
    };
  });
  check(`${nome}: la pagina non scorre di lato`, m.scrollOrizzontale === 0, String(m.scrollOrizzontale));
  check(`${nome}: la barra in alto c'e`, m.nav === true);
  check(`${nome}: il tasto principale non sborda dalla barra`, m.sbordo !== null && m.sbordo <= 0, String(m.sbordo));
  if (w < 560) {
    check(`${nome}: "Accedi" sparisce dove non ci sta`, m.accedi === false);
  } else {
    check(`${nome}: "Accedi" c'e dove ci sta`, m.accedi === true);
  }
  check(`${nome}: zero errori console`, errori.length === 0, errori.slice(0, 2).join(" | "));
  await ctx.close();
}

/* il modulo di assistenza: si difende da solo prima di chiamare il server */
{
  const { ctx, page, errori } = await apri("/support", 1440, 900);
  await page.click(".jm-sito-azioni button");
  await page.waitForTimeout(300);
  const errore = await page.textContent(".jm-sito-err").catch(() => null);
  check(
    "assistenza: inviare vuoto non chiama il server e lo dice",
    errore !== null && errore.includes("problema"),
    String(errore),
  );
  check("assistenza: zero errori console", errori.length === 0, errori.slice(0, 2).join(" | "));
  await ctx.close();
}

/* l'app e ancora l'app: /app disegna la schermata Oggi col dock */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "it-IT" });
  await ctx.addInitScript(() => {
    try {
      window.localStorage.setItem("jm.mode", "local"); window.localStorage.setItem("jm.ospite", "0");
      window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
      window.localStorage.setItem("jm.saluto.silenzio", "dev:banco");
    } catch {}
  });
  const page = await ctx.newPage();
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".jm-appbar", { timeout: 25000 });
  const titolo = await page.textContent(".jm-appbar-t");
  check('/app e ancora la schermata del diario ("Diario")', titolo === "Diario", String(titolo));
  const dock = await page.locator(".jm-dock-wrap").count();
  check("/app ha ancora il dock", dock === 1, String(dock));
  const sito = await page.locator(".jm-sito").count();
  check("/app non ha addosso niente del sito", sito === 0);
  await ctx.close();
}

/* la rotta admin del SEO non si apre a mani vuote */
{
  const resp = await fetch(BASE + "/api/sito/seo");
  // 401 quando le env Supabase ci sono (produzione), 500 quando mancano
  // (questo sandbox: requireUser non ha nemmeno il client per verificare un
  // token). Quello che NON deve mai succedere e un 200: i testi del sito si
  // leggono da chiunque, ma il pannello che li scrive no.
  check(
    "GET /api/sito/seo senza token non si apre (401, o 500 senza env)",
    resp.status === 401 || resp.status === 500,
    String(resp.status),
  );
}

await browser.close();

const passati = results.filter((r) => r.ok).length;
console.log(`\n${passati}/${results.length} PASS`);
process.exit(passati === results.length ? 0 : 1);
