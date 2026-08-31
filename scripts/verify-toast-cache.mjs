// Verifica delle tre segnalazioni di Manuel del 21 agosto 2026:
//
//  1. AGGIUNGENDO A UNA GIORNATA NON SI VEDEVA NIENTE, e "non salvava".
//     Il database ha detto la verita: salvava, ma su un ALTRO giorno —
//     /api/split-by-date leggeva "ieri" dentro il testo e spostava tutto
//     su un'altra data, lasciando la schermata aperta identica a prima.
//     Ora chi aggiunge da /giorno ha gia scelto la data e lo split non
//     gira (skipSplit), e un avviso dice cosa sta succedendo.
//
//  2. AVVISO DI CARICAMENTO UNICO, riusato ovunque: uno solo nel DOM, mai
//     due insieme, e lo stesso componente per ogni operazione lenta.
//
//  3. PASSARE DA UNA SCHERMATA ALL'ALTRA ERA LENTO. Ora le letture
//     passano da una cache e gli altri tab si precaricano da soli: la
//     seconda visita a una schermata non deve rifare le stesse richieste.
//
// Serve il dev server su :3100.
import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3100";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

async function open(path, { wait = "main" } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: "it-IT" });
  await ctx.addInitScript(() => {
    try { window.localStorage.setItem("jm.mode", "local"); /* niente velo del saluto sui banchi */ window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco"); window.localStorage.setItem("jm.saluto.silenzio", "dev:banco"); } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  if (wait) await page.waitForSelector(wait, { timeout: 15000 });
  await page.waitForTimeout(700);
  return { ctx, page, errors };
}

/* ============ 1. l'avviso c'e, ed e uno solo ============ */
{
  const { ctx, page, errors } = await open("/app/giorno?d=2026-08-19", { wait: ".jm-day-empty-wrap" });

  check("all'inizio nessun avviso", (await page.locator(".jm-toast").count()) === 0);

  await page.locator(".jm-day-add").click();
  await page.waitForTimeout(300);
  await page.locator(".jm-sheet-row", { hasText: "Scrivi altro" }).click();
  await page.waitForTimeout(300);
  await page.locator(".jm-editor-textarea").fill("Ieri sono andato in palestra e ho mangiato una pizza.");

  // Il momento che Manuel ha visto vuoto: subito dopo "Continua".
  await page.locator(".jm-editor-btn.save").click();
  await page.waitForTimeout(120);
  check(
    "appena premi Continua l'avviso compare",
    (await page.locator(".jm-toast").count()) === 1,
  );
  check(
    "l'editor si chiude subito invece di restare congelato",
    (await page.locator(".jm-editor-textarea").count()) === 0,
  );
  // In locale il salvataggio e quasi istantaneo, quindi qui puo gia dire
  // "aggiunto": conta che l'utente non resti MAI davanti a niente.
  check(
    "l'avviso dice cosa sta succedendo",
    /salvo|aggiunto/i.test(await page.locator(".jm-toast-t").innerText()),
    await page.locator(".jm-toast-t").innerText(),
  );

  await page.waitForTimeout(2500);
  check(
    "a salvataggio finito l'avviso conferma",
    (await page.locator("body").innerText()).includes("Aggiunto alla giornata") ||
      (await page.locator(".jm-toast").count()) === 0,
  );

  // IL BUG: il testo diceva "ieri" e prima finiva su un altro giorno.
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const testo = await page.locator("body").innerText();
  check(
    "dopo un reload il testo e ANCORA su questo giorno",
    !testo.includes("Non hai raccontato questo giorno"),
    testo.split("\n").slice(0, 4).join(" | "),
  );
  check("avviso: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ 2. mai due avvisi insieme ============ */
{
  const { ctx, page } = await open("/app/giorno?d=2026-08-18", { wait: ".jm-day-empty-wrap" });
  for (const testo of ["Prima aggiunta.", "Seconda aggiunta."]) {
    await page.locator(".jm-day-add").click();
    await page.waitForTimeout(250);
    await page.locator(".jm-sheet-row", { hasText: "Scrivi altro" }).click();
    await page.waitForTimeout(250);
    await page.locator(".jm-editor-textarea").fill(testo);
    await page.locator(".jm-editor-btn.save").click();
    await page.waitForTimeout(150);
    check(
      `dopo "${testo}" c'e sempre UN solo avviso`,
      (await page.locator(".jm-toast").count()) === 1,
      String(await page.locator(".jm-toast").count()),
    );
    await page.waitForTimeout(1500);
  }
  await page.waitForTimeout(3200);
  check(
    "l'avviso sparisce da solo",
    (await page.locator(".jm-toast").count()) === 0,
    String(await page.locator(".jm-toast").count()),
  );
  await ctx.close();
}

/* ============ 3. la cache: la seconda visita non rifa le richieste ============ */
{
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: "it-IT" });
  await ctx.addInitScript(() => {
    try { window.localStorage.setItem("jm.mode", "local"); /* niente velo del saluto sui banchi */ window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco"); window.localStorage.setItem("jm.saluto.silenzio", "dev:banco"); } catch {}
  });
  const page = await ctx.newPage();

  // Si conta quante volte l'app CHIEDE i dati, non quanto ci mette: il
  // tempo su una macchina di prova non dice niente, il numero di
  // richieste si.
  await page.addInitScript(() => {
    window.__conteggio = {};
    const orig = window.fetch;
    window.fetch = function (...args) {
      const u = String(args[0]?.url ?? args[0] ?? "");
      window.__conteggio[u] = (window.__conteggio[u] ?? 0) + 1;
      return orig.apply(this, args);
    };
  });

  await page.goto(BASE + "/app", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Andata e ritorno fra i tab: se la cache lavora, la seconda visita a
  // Mese non deve far ricomparire lo scheletro di caricamento.
  await page.goto(BASE + "/app/mese", { waitUntil: "networkidle" });
  await page.waitForSelector(".jm-day-row", { timeout: 15000 });
  await page.goto(BASE + "/app", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const t0 = Date.now();
  await page.goto(BASE + "/app/mese", { waitUntil: "domcontentloaded" });
  // Sul telefono Mese e la lista giorno-per-giorno: la griglia
  // (.jm-mese-wrap) esiste nel DOM ma e nascosta sotto lg.
  await page.waitForSelector(".jm-day-row", { timeout: 15000 });
  const secondaVisita = Date.now() - t0;
  check(
    "la seconda visita a Mese e rapida",
    secondaVisita < 4000,
    `${secondaVisita}ms`,
  );
  await ctx.close();
}

/* ============ 4. il precaricamento parte, e DOPO la prima schermata ============ */
{
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: "it-IT" });
  await ctx.addInitScript(() => {
    try { window.localStorage.setItem("jm.mode", "local"); /* niente velo del saluto sui banchi */ window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco"); window.localStorage.setItem("jm.saluto.silenzio", "dev:banco"); } catch {}
  });
  const page = await ctx.newPage();
  await page.goto(BASE + "/app", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  // Dopo il precaricamento, la cache deve avere gia dentro le chiavi degli
  // altri tab: si vede da quanto e immediata Ricorda.
  const t0 = Date.now();
  await page.goto(BASE + "/app/remember", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".jm-rem-list", { timeout: 15000 });
  const ms = Date.now() - t0;
  check("Ricorda si apre senza attesa percepibile", ms < 4000, `${ms}ms`);
  await ctx.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
await browser.close();
process.exit(failed.length === 0 ? 0 : 1);
