// Banco dell'ospite (SPEC-ospite-e-cassaforte.md, R1 R2 R3 R4; notte del 3
// settembre 2026, branch ospite-server). Prova la parte che NON si vede: le
// schermate aspettano l'ok di Manuel sul mockup ospite-primo-avvio.html.
//
// Cosa pretende, in ordine:
//   R1  primo avvio: nessun rimbalzo al login, si e su Oggi in modalita
//       locale, il braccialetto e nato nel "portachiavi" (IndexedDB sul web)
//       e il warm-up della trascrizione NON ha consumato niente;
//   R2  la quota scende SUL SERVER: dopo una giornata chiusa con l'AI il
//       database del server ha una riga, /api/ospite/stato la conta, e se si
//       cambia il conteggio sul server il dispositivo lo vede (cioe non ha
//       un conto suo). Rilavorare la stessa giornata non costa;
//   R2  reinstallazione simulata: un browser nuovo con lo STESSO seme nel
//       portachiavi (quello che fa iCloud) ha la quota gia consumata; un
//       dispositivo davvero nuovo parte da zero;
//   R3  a quota finita il salvataggio a mano riesce, la chiusura con l'AI
//       salva comunque il testo grezzo, e si apre il muro del REGALO FINITO
//       (con "Continua senza AI"), non il muro premium (il server risponde
//       402 regalo_finito, non "Premium required");
//   R4  tetto abbassato sotto il consumo: un ospite nuovo non riceve AI, un
//       ospite che ha gia iniziato la giornata la finisce; regalo spento,
//       idem;
//   par. 5  tutto cio che esce dal dispositivo verso l'esterno: NIENTE, e
//       verso /api solo le route AI dell'elenco chiuso (piu /api/ospite/stato,
//       che non porta testo). Nessuna scrittura verso Supabase dal browser.
//
// Il server (le route /api) parla con un Supabase FINTO e un OpenAI FINTO
// che questo banco avvia sulla stessa macchina (scripts/lib/finti-server.mjs),
// porte 3198 e 3199. Il dev server va lanciato cosi (una riga):
//
//   JM_SUPABASE_URL_SERVER=http://127.0.0.1:3198 OPENAI_BASE_URL=http://127.0.0.1:3199 \
//   SUPABASE_SERVICE_ROLE_KEY=finto OPENAI_API_KEY=finto \
//   NEXT_PUBLIC_SUPABASE_URL=https://sbfinto.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=finto-anon-key \
//   ./node_modules/.bin/next dev -p 3100
//
// poi: node scripts/verify-ospite.mjs
//
// Provato a mordere (vedi src/modules/accesso/REFERTO-ospite-notte.md).
import { chromium } from "playwright-core";
import { SupabaseFintoServer, OpenAIFinto } from "./lib/finti-server.mjs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const SB_HOST = "sbfinto.supabase.co";

/** Le sole route che un ospite puo chiamare: e l'elenco chiuso del par. 5. */
const ROUTE_AI = [
  "/api/transcribe-fallback",
  "/api/process-entry",
  "/api/split-by-date",
  "/api/extract-facts",
  "/api/chiarimenti",
  "/api/remember/classify",
];
const ROUTE_AMMESSE = [...ROUTE_AI, "/api/ospite/stato"];

import { readFileSync } from "node:fs";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

/* ================= CORS: l'header del braccialetto deve passare il preflight =================
   Dentro il guscio iOS l'app sta su capacitor://localhost e ogni header
   custom fa partire un preflight: un header non elencato in next.config.ts
   muore con "TypeError" prima ancora di uscire (successo il 4 settembre
   2026 alla prima registrazione sul telefono di Manuel). I banchi girano
   sulla stessa origine e non lo vedono: si legge il file. */
{
  const cfg = readFileSync("next.config.ts", "utf8");
  const m = cfg.match(/key:\s*"Access-Control-Allow-Headers",[\s\S]*?value:\s*"([^"]+)"/);
  const lista = (m?.[1] ?? "").split(",").map((x) => x.trim().toLowerCase());
  check("CORS: x-jm-braccialetto e fra gli header ammessi in next.config.ts (preflight del guscio iOS)", lista.includes("x-jm-braccialetto"), m?.[1] ?? "non trovato");
  check("CORS: anche x-jm-lang e Authorization ci sono ancora", lista.includes("x-jm-lang") && lista.includes("authorization"));
}

const sb = new SupabaseFintoServer();
const oa = new OpenAIFinto();
await sb.avvia(3198);
await oa.avvia(3199);

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

/**
 * Un dispositivo: contesto nuovo, interruttore dell'ospite acceso, saluto
 * silenziato. `seme` = il braccialetto gia nel portachiavi (base64 dei 32
 * byte), come quando iCloud lo riporta dopo la reinstallazione.
 */
async function dispositivo({ seme = null, viewport = { width: 1440, height: 900 } } = {}) {
  const ctx = await browser.newContext({ viewport, locale: "it-IT" });
  await ctx.route(`**/${SB_HOST}/**`, (route) => {
    verso_supabase.push(route.request().method() + " " + route.request().url());
    route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
  });
  await ctx.addInitScript(({ seme }) => {
    try {
      // Niente jm.ospite: dal 4 settembre 2026 acceso e il valore di fabbrica.
      window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
      window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
    } catch {}
    if (seme) {
      const req = indexedDB.open("journalme-chiave", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("semi");
      req.onsuccess = () => {
        const tx = req.result.transaction("semi", "readwrite");
        tx.objectStore("semi").put(seme, "braccialetto");
      };
    }
  }, { seme });
  const page = await ctx.newPage();
  const errors = [];
  const external = [];
  const api = [];
  // Un 402 e una risposta attesa per l'ospite a regalo finito (R3): il
  // browser la stampa come errore di rete, ma non e un errore dell'app.
  page.on("console", (m) => { if (m.type() === "error" && !/402 \(Payment Required\)/.test(m.text())) errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("request", (r) => {
    const u = r.url();
    if (u.startsWith(BASE)) {
      const p = new URL(u).pathname;
      if (p.startsWith("/api/")) api.push({ metodo: r.method(), path: p, braccialetto: r.headers()["x-jm-braccialetto"] ?? null });
      return;
    }
    if (!u.startsWith("data:") && !u.startsWith("blob:")) external.push(u);
  });
  return { ctx, page, errors, external, api };
}
const verso_supabase = [];

/** Il seme del braccialetto letto dal "portachiavi" del browser (IndexedDB). */
async function semeDelBraccialetto(page) {
  return page.evaluate(() => new Promise((resolve) => {
    const req = indexedDB.open("journalme-chiave", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("semi");
    req.onsuccess = () => {
      const tx = req.result.transaction("semi", "readonly");
      const g = tx.objectStore("semi").get("braccialetto");
      g.onsuccess = () => resolve(g.result ?? null);
      g.onerror = () => resolve(null);
    };
    req.onerror = () => resolve(null);
  }));
}

function segretoDaSeme(semeB64) {
  return Buffer.from(semeB64, "base64").toString("base64url");
}

/** Lo stato letto direttamente dal server con il segreto (quello che la riga di Impostazioni leggera). */
async function statoDalServer(segreto) {
  const r = await fetch(BASE + "/api/ospite/stato", { headers: segreto ? { "x-jm-braccialetto": segreto } : {} });
  return r.json();
}

async function scriviEChiudi(page, testo, { conAI }) {
  await page.locator(".jm-ed-ta").waitFor({ state: "visible", timeout: 30_000 });
  await page.locator(".jm-ed-ta").click();
  await page.keyboard.type(testo);
  await page.keyboard.press(conAI ? "Control+Enter" : "Control+s");
  await page.locator(".jm-fv-h").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(800);
  return page.locator(".jm-fv-h").innerText();
}

async function nuovaGiornata(page) {
  // Torna all'editor cancellando la giornata dal dispositivo (IndexedDB journalme).
  await page.evaluate(() => new Promise((resolve) => {
    const req = indexedDB.deleteDatabase("journalme");
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  }));
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
}

let semeA = null;
let segretoA = null;

// Il server tiene i limiti del regalo in memoria per 30 s e la spesa per
// 60 s: se un giro precedente li ha lasciati diversi, si aspetta che il
// server torni a leggere i valori di fabbrica di questo finto.
{
  const inizio = Date.now();
  for (;;) {
    const s = await statoDalServer(null);
    if (s.attivo === true && s.max === 10 && s.sopraIlTetto === false) break;
    if (Date.now() - inizio > 70_000) { console.log("il server non rilegge il regalo: " + JSON.stringify(s)); process.exit(1); }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

/* ================= R1: primo avvio, si apre e basta ================= */
{
  const { ctx, page, errors, external, api } = await dispositivo();
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  await page.locator(".jm-ed-ta").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(1500);
  check("R1 primo avvio: nessun rimbalzo al login, si e su Oggi", !page.url().includes("/login") && (await page.locator(".jm-ed-ta").isVisible()));
  check("R1 primo avvio: modalita locale scelta da sola", (await page.evaluate(() => localStorage.getItem("jm.mode"))) === "local");
  semeA = await semeDelBraccialetto(page);
  check("R1 primo avvio: il braccialetto e nato nel portachiavi (IndexedDB journalme-chiave)", typeof semeA === "string" && semeA.length > 20);
  segretoA = semeA ? segretoDaSeme(semeA) : null;
  check("R1 primo avvio: due tasti nell'editor (l'AI e accesa per l'ospite)", (await page.locator(".jm-ed-acts button").count()) === 2, String(await page.locator(".jm-ed-acts button").count()));
  // Aprire l'app non e chiedere all'AI: prima della prima chiusura con
  // l'AI il server non deve aver visto niente (nemmeno il warm-up, che in
  // modalita locale resta spento: prewarm.ts).
  check("R1 primo avvio: aprire l'app non chiama nessuna route", api.length === 0, api.map((a) => a.metodo + " " + a.path).join(", "));
  check("R1 primo avvio: nessuna giornata consumata solo per aver aperto", sb.tab("braccialetto_giornate").length === 0, String(sb.tab("braccialetto_giornate").length));

  /* ================= R2: la quota scende sul server ================= */
  const titolo = await scriviEChiudi(page, "Oggi ho provato l'app come ospite e ho chiuso la giornata con l'AI.", { conAI: true });
  check("R2 AI: la giornata e chiusa dal modello (titolo dell'OpenAI finto)", /giornata da ospite/.test(titolo), titolo);
  check("R2 server: ha registrato il braccialetto come hash, non il segreto", sb.tab("braccialetti").length === 1 && !JSON.stringify(sb.tab("braccialetti")).includes(segretoA ?? "???"));
  check("R2 server: una riga in braccialetto_giornate", sb.tab("braccialetto_giornate").length === 1, String(sb.tab("braccialetto_giornate").length));
  const usi = sb.tab("ai_usage");
  check("R2 server: ai_usage ha righe col braccialetto, regalo=true e un costo", usi.length >= 1 && usi.every((u) => u.braccialetto_id && u.regalo === true && u.costo_usd > 0 && u.user_id === null), JSON.stringify(usi[0] ?? null));
  const s1 = await statoDalServer(segretoA);
  check("R2 /api/ospite/stato: usate 1, rimaste 9, oggi coperta", s1.usate === 1 && s1.rimaste === 9 && s1.oggi === true && s1.max === 10, JSON.stringify(s1));
  // Il dispositivo non ha un conto suo: cambio il server e il dispositivo lo vede.
  const idA = sb.tab("braccialetti")[0].id;
  sb.tab("braccialetto_giornate").push({ braccialetto_id: idA, giorno: "2026-08-01", creato_il: "2026-08-01T10:00:00Z" });
  sb.tab("braccialetto_giornate").push({ braccialetto_id: idA, giorno: "2026-08-02", creato_il: "2026-08-02T10:00:00Z" });
  const s2 = await statoDalServer(segretoA);
  check("R2 il conto vive sul server: aggiunte 2 giornate lato server, lo stato dice 3", s2.usate === 3 && s2.rimaste === 7, JSON.stringify(s2));
  check("R2 sul dispositivo nessun contatore (localStorage senza 'usate'/'rimaste'/'quota')", await page.evaluate(() => !Object.keys(localStorage).some((k) => /quota|usate|rimaste|regalo/i.test(k))));
  // Rilavorare la stessa giornata non costa: chiudo di nuovo oggi con l'AI.
  await nuovaGiornata(page);
  await scriviEChiudi(page, "Seconda versione della stessa giornata, riscritta.", { conAI: true });
  check("R2 rilavorare oggi non costa una seconda giornata", sb.tab("braccialetto_giornate").filter((g) => g.braccialetto_id === idA).length === 3, String(sb.tab("braccialetto_giornate").length));

  /* ================= par. 5: cosa e uscito dal dispositivo ================= */
  const fuoriElenco = api.filter((a) => !ROUTE_AMMESSE.includes(a.path));
  check("par.5 verso /api solo le route AI dell'elenco chiuso", fuoriElenco.length === 0, fuoriElenco.map((a) => a.path).join(", "));
  check("par.5 ogni chiamata AI porta il braccialetto", api.filter((a) => ROUTE_AI.includes(a.path)).every((a) => a.braccialetto === segretoA));
  check("par.5 ZERO richieste esterne (Supabase compreso) dal browser", external.length === 0 && verso_supabase.length === 0, [...external, ...verso_supabase].slice(0, 3).join(" | "));
  check("par.5 sul server non resta il testo: nessuna tabella con la giornata", !JSON.stringify(sb.tabelle).includes("provato l'app come ospite") && !JSON.stringify(sb.tabelle).includes("Seconda versione"));
  check("R1-R2 zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ================= R2: reinstallazione simulata ================= */
{
  // Lo stesso seme torna dal portachiavi (iCloud): stesso braccialetto, quota gia usata.
  const { ctx, page, errors } = await dispositivo({ seme: semeA });
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  await page.locator(".jm-ed-ta").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(800);
  const seme2 = await semeDelBraccialetto(page);
  check("R2 reinstallazione: il seme nel portachiavi e lo stesso, non ne nasce uno nuovo", seme2 === semeA);
  check("R2 reinstallazione: sul server c'e ancora UN braccialetto", sb.tab("braccialetti").length === 1, String(sb.tab("braccialetti").length));
  const s = await statoDalServer(segretoDaSeme(seme2));
  check("R2 reinstallazione: la quota resta consumata (usate 3)", s.usate === 3, JSON.stringify(s));
  check("R2 reinstallazione: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}
{
  // Un dispositivo davvero nuovo (niente nel portachiavi): braccialetto nuovo, quota piena.
  const { ctx, page } = await dispositivo();
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  await page.locator(".jm-ed-ta").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(800);
  const semeB = await semeDelBraccialetto(page);
  check("R2 dispositivo nuovo: braccialetto diverso", semeB && semeB !== semeA);
  const s = await statoDalServer(segretoDaSeme(semeB));
  check("R2 dispositivo nuovo: quota piena (usate 0, rimaste 10)", s.usate === 0 && s.rimaste === 10, JSON.stringify(s));
  await ctx.close();
}

/* ================= R3: quando la quota finisce, finisce solo l'AI ================= */
{
  // Il braccialetto A ha 3 giornate; porto il regalo a 3 e tolgo la riga di oggi:
  // la prossima chiamata AI e "quota".
  const idA = sb.tab("braccialetti")[0].id;
  const oggi = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  sb.tabelle.braccialetto_giornate = sb.tab("braccialetto_giornate").filter((g) => !(g.braccialetto_id === idA && g.giorno === oggi));
  sb.tab("braccialetto_giornate").push({ braccialetto_id: idA, giorno: "2026-08-03", creato_il: "2026-08-03T10:00:00Z" });
  sb.regalo.giornate_per_ospite = 3;
  const righePrima = sb.tab("braccialetto_giornate").length;

  const { ctx, page, errors, api } = await dispositivo({ seme: semeA });
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  // La cache del regalo sul server dura 30 s: aspetto che il server rilegga.
  await page.waitForTimeout(31_000);
  const s0 = await statoDalServer(segretoA);
  check("R3 stato: quota finita (usate 3 su 3, rimaste 0)", s0.usate === 3 && s0.max === 3 && s0.rimaste === 0, JSON.stringify(s0));

  const chiamateOaPrima = oa.chiamate.length;
  const usiPrima = sb.tab("ai_usage").length;
  const regaloFinito = [];
  await page.exposeFunction("__jmRegaloFinito", (d) => regaloFinito.push(d));
  await page.evaluate(() => window.addEventListener("jm:regalo-finito", (e) => window.__jmRegaloFinito(e.detail)));

  // 1. salvataggio a mano: riesce, niente rete AI, niente muro
  const apiPrima = api.length;
  const t1 = await scriviEChiudi(page, "Prima riga scritta a mano a quota zero.\n\nIl resto del racconto.", { conAI: false });
  check("R3 a quota zero: 'salva e basta' riesce (titolo = prima riga)", /Prima riga scritta a mano/.test(t1), t1);
  const chiamateAMano = api.slice(apiPrima).filter((a) => ROUTE_AI.includes(a.path) && a.metodo === "POST");
  check("R3 a quota zero: il salvataggio a mano non chiama nessuna route AI", chiamateAMano.length === 0, chiamateAMano.map((a) => a.path).join(", "));
  check("R3 a quota zero: nessun muro", (await page.locator(".jm-wall").count()) === 0);

  // 2. chiusura con l'AI: il server dice regalo_finito, il testo si salva grezzo, il muro premium NON si apre
  await nuovaGiornata(page);
  // La pagina si e ricaricata: il listener va rimesso (la funzione esposta resta).
  await page.evaluate(() => window.addEventListener("jm:regalo-finito", (e) => window.__jmRegaloFinito(e.detail)));
  const t2 = await scriviEChiudi(page, "Chiusa con l'AI a quota zero: deve salvarsi comunque.", { conAI: true });
  const testo2 = await page.locator("main").innerText();
  check("R3 a quota zero: chiudere con l'AI salva comunque la giornata (testo grezzo, titolo di ripiego)", /Chiusa con l'AI a quota zero/.test(testo2) && !/giornata da ospite/.test(t2), t2);
  // Dal 4 settembre 2026 il muro esiste (abbonamento a schede): a regalo
  // finito si apre QUELLO del regalo, con "Continua senza AI", non il muro
  // premium di chi ha un account gratis.
  const muroTesto = await page.locator(".jm-wall").innerText().catch(() => "");
  check("R3 a quota zero: si apre il muro del regalo finito (non quello premium), con 'Continua senza AI'", /in regalo sono finite/.test(muroTesto) && /Continua senza AI/.test(muroTesto) && !/serve premium/.test(muroTesto), muroTesto.slice(0, 60));
  check("R3 a quota zero: il dispositivo riceve l'evento regalo_finito (motivo quota)", regaloFinito.some((d) => d?.error === "regalo_finito" && d?.motivo === "quota"), JSON.stringify(regaloFinito[0] ?? null));
  check("R3 a quota zero: il server non ha concesso giornate nuove", sb.tab("braccialetto_giornate").length === righePrima, String(sb.tab("braccialetto_giornate").length));
  check("R3 a quota zero: OpenAI non e stato chiamato e nessun consumo e stato scritto", oa.chiamate.length === chiamateOaPrima && sb.tab("ai_usage").length === usiPrima, `openai ${oa.chiamate.length - chiamateOaPrima}, ai_usage ${sb.tab("ai_usage").length - usiPrima}`);
  check("R3 zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
  sb.regalo.giornate_per_ospite = 10;
}

/* ================= R4: il tetto che si chiude da solo ================= */
{
  const oggi = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  const idA = sb.tab("braccialetti")[0].id;
  // A ha gia iniziato la giornata di oggi (riga presente); il tetto scende sotto il consumo.
  sb.tab("braccialetto_giornate").push({ braccialetto_id: idA, giorno: oggi, creato_il: new Date().toISOString() });
  const spesoUsd = sb.spesoMese();
  sb.regalo.tetto_mensile_eur = Math.max(0.000001, spesoUsd * sb.regalo.cambio_usd_eur / 2);
  const chiamateOa = oa.chiamate.length;

  // Ospite NUOVO: niente AI.
  const nuovo = await dispositivo();
  await nuovo.page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  await nuovo.page.waitForTimeout(61_000); // cache del regalo (30 s) e della spesa (60 s)
  const semeN = await semeDelBraccialetto(nuovo.page);
  const sN = await statoDalServer(segretoDaSeme(semeN));
  check("R4 tetto: lo stato dice sopraIlTetto", sN.sopraIlTetto === true, JSON.stringify(sN));
  const finitoN = [];
  await nuovo.page.exposeFunction("__jmRegaloFinito", (d) => finitoN.push(d));
  await nuovo.page.evaluate(() => window.addEventListener("jm:regalo-finito", (e) => window.__jmRegaloFinito(e.detail)));
  const tN = await scriviEChiudi(nuovo.page, "Ospite nuovo sopra il tetto: niente AI.", { conAI: true });
  const testoN = await nuovo.page.locator("main").innerText();
  check("R4 tetto: l'ospite nuovo NON riceve AI (giornata salvata, titolo di ripiego)", /Ospite nuovo sopra il tetto/.test(testoN) && !/giornata da ospite/.test(tN), tN);
  check("R4 tetto: il server risponde regalo_finito con motivo tetto", finitoN.some((d) => d?.motivo === "tetto"), JSON.stringify(finitoN[0] ?? null));
  check("R4 tetto: OpenAI non e stato chiamato per lui", oa.chiamate.slice(chiamateOa).filter((c) => c.url === "/v1/chat/completions").length === 0);
  const muroTetto = await nuovo.page.locator(".jm-wall").innerText().catch(() => "");
  check("R4 tetto: si apre il muro del regalo finito, non quello premium", /in regalo sono finite/.test(muroTetto) && !/serve premium/.test(muroTetto), muroTetto.slice(0, 60));
  await nuovo.ctx.close();

  // Ospite A, a meta giornata: la finisce.
  const a = await dispositivo({ seme: semeA });
  await a.page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  const tA = await scriviEChiudi(a.page, "Ospite a meta giornata sopra il tetto: la finisce.", { conAI: true });
  check("R4 tetto: chi ha gia iniziato la giornata la finisce con l'AI", /giornata da ospite/.test(tA), tA);
  await a.ctx.close();

  // Regalo spento dal pannello: come il tetto.
  sb.regalo.tetto_mensile_eur = 100;
  sb.regalo.attivo = false;
  const off = await dispositivo();
  await off.page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  await off.page.waitForTimeout(31_000);
  const finitoOff = [];
  await off.page.exposeFunction("__jmRegaloFinito", (d) => finitoOff.push(d));
  await off.page.evaluate(() => window.addEventListener("jm:regalo-finito", (e) => window.__jmRegaloFinito(e.detail)));
  const tOff = await scriviEChiudi(off.page, "Regalo spento: niente AI per i nuovi.", { conAI: true });
  const testoOff = await off.page.locator("main").innerText();
  check("R4 spento: l'ospite nuovo non riceve AI e il motivo e 'spento'", /Regalo spento/.test(testoOff) && !/giornata da ospite/.test(tOff) && finitoOff.some((d) => d?.motivo === "spento"), JSON.stringify(finitoOff[0] ?? null));
  await off.ctx.close();
  sb.regalo.attivo = true;
}

/* ================= Telefono 430: stesso primo avvio ================= */
{
  const { ctx, page, errors } = await dispositivo({ viewport: { width: 430, height: 900 } });
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  check("telefono: nessun login al primo avvio", !page.url().includes("/login"));
  const racconta = page.getByRole("button", { name: /Racconta a voce/ });
  check("telefono: il microfono e acceso (tasto 'Racconta a voce')", (await racconta.count()) === 1);
  check("telefono: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ================= Interruttore spento (jm.ospite = "0"): tutto come prima ================= */
// Dal 4 settembre 2026 il valore di fabbrica e ACCESO (Manuel ha approvato
// le schermate): il locale "puro" di prima esiste solo spegnendolo a mano,
// ed e cio che fanno tutti i banchi vecchi del locale.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "it-IT" });
  await ctx.route(`**/${SB_HOST}/**`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await ctx.addInitScript(() => {
    try {
      window.localStorage.setItem("jm.ospite", "0");
      window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
      window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
    } catch {}
  });
  const page = await ctx.newPage();
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  try { await page.waitForURL("**/login**", { timeout: 15_000 }); } catch {}
  check("interruttore spento (jm.ospite=0): il primo avvio porta ancora al login", page.url().includes("/login"));
  await ctx.close();
}

await browser.close();
await sb.ferma();
await oa.ferma();

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} PASS`);
process.exit(passed === results.length ? 0 : 1);
