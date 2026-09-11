// Lo specchio: la copia cifrata delle giornate sul dispositivo (decisione 1C
// di Manuel, 11 settembre 2026, "detesto vedere gli skeleton").
//
// Cosa deve reggere, e perche:
//  1. dopo la prima sincronizzazione il dispositivo ha una riga per giornata,
//     e quella riga e una BUSTA CHIUSA: nessuna parola del diario si legge
//     nel database locale. Se lo specchio fosse in chiaro, la promessa
//     "nessuno legge il tuo diario" morirebbe sul telefono invece che sul
//     server, che e lo stesso;
//  2. a specchio pronto, aprire Mese e un giorno NON scarica piu le buste:
//     zero richieste con `busta` dentro. E questo che toglie gli skeleton;
//  3. SENZA RETE (ogni chiamata a Supabase abortita) le giornate si leggono
//     lo stesso: e la prova che la copia e vera e non una cache di passaggio;
//  4. una giornata scritta si vede subito nello specchio (la busta appena
//     scritta, con la versione nuova), senza aspettare la sincronizzazione;
//  5. una giornata cancellata ALTROVE sparisce dallo specchio al primo
//     ritorno in pari: l'elenco leggero basta, senza tombstone;
//  6. il logout svuota lo specchio: un diario che resta addosso al telefono
//     dopo che la persona e uscita sarebbe il peggiore dei bug.
//
// Serve il dev server su :3100 con NEXT_PUBLIC_SUPABASE_URL=https://sbfinto.supabase.co.
import { chromium } from "playwright-core";
import { SupabaseFinto, montaSupabaseFinto } from "./lib/supabase-finto.mjs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const TITOLO = "Basalto turchese nella cava di Pietraperzia";
const CORPO = "Ho parlato con Filomena Squarcialupi del vivaio di ortensie a Camporotondo.";
const SPIA = ["Basalto", "Pietraperzia", "Filomena", "Squarcialupi", "ortensie", "Camporotondo"];

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const finto = new SupabaseFinto();

/** Lo specchio come lo vede il dispositivo: le righe grezze di IndexedDB. */
async function specchio(page) {
  return page.evaluate(
    () =>
      new Promise((res) => {
        const r = indexedDB.open("journalme-specchio");
        r.onerror = () => res({ errore: "apertura negata" });
        r.onsuccess = () => {
          const db = r.result;
          if (!db.objectStoreNames.contains("cassettine")) return res({ righe: [], meta: [] });
          const tx = db.transaction(["cassettine", "meta"], "readonly");
          const a = tx.objectStore("cassettine").getAll();
          const b = tx.objectStore("meta").getAll();
          tx.oncomplete = () => res({ righe: a.result ?? [], meta: b.result ?? [] });
        };
      }),
  );
}

// UN CONTESTO SOLO per tutto il banco: la chiave della cassaforte vive in
// IndexedDB, e `storageState` di Playwright salva solo cookie e
// localStorage. Con un contesto nuovo il dispositivo sarebbe un dispositivo
// NUOVO (niente chiave, niente specchio) e il banco misurerebbe un'altra
// cosa. Qui si vuole lo stesso telefono, riaperto.
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "it-IT" });
await montaSupabaseFinto(ctx, finto);
const page = await ctx.newPage();
let richieste = [];
page.on("request", (r) => {
  if (r.url().includes("/rest/v1/cassettine")) richieste.push(decodeURIComponent(r.url()));
});
const erroriPagina = [];
page.on("pageerror", (e) => erroriPagina.push(String(e)));

const aereo = (route) => route.abort();
async function senzaRete(si) {
  if (si) await ctx.route("**/sbfinto.supabase.co/**", aereo);
  else await ctx.unroute("**/sbfinto.supabase.co/**", aereo);
}

/** Le richieste che hanno chiesto le BUSTE (cioe il peso, cioe l'attesa). */
function richiesteConBusta() {
  return richieste.filter((u) => /select=[^&]*busta/.test(u));
}

async function passaCancello(p) {
  const check1 = p.locator(".jm-login-cassa-check input");
  try {
    await check1.waitFor({ state: "visible", timeout: 25_000 });
    await check1.check();
    await p.locator("button.btn-primary").click();
  } catch {
    // gia dentro
  }
}

/* ===== 1. una giornata scritta, e lo specchio che la tiene chiusa ===== */
{
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  await passaCancello(page);
  await page.locator(".jm-ed-ta").waitFor({ state: "visible", timeout: 40_000 });
  await page.locator(".jm-ed-ta").click();
  await page.keyboard.type(`${TITOLO}\n\n${CORPO}`);
  await page.keyboard.press("Control+s");
  await page.waitForFunction(() => document.body.innerText.includes("Basalto turchese"), null, { timeout: 40_000 });
  await page.waitForTimeout(2500);

  const s = await specchio(page);
  check("4 la giornata appena scritta e gia nello specchio", (s.righe ?? []).length === 1, JSON.stringify(s).slice(0, 160));
  const riga = (s.righe ?? [])[0];
  const suServer = finto.tab("cassettine")[0];
  check("4 lo specchio porta la versione appena scritta dal server", !!riga && !!suServer && riga.v === suServer.v, `${riga?.v} vs ${suServer?.v}`);
  const testoSpecchio = JSON.stringify(s);
  const trovate = SPIA.filter((w) => testoSpecchio.includes(w));
  check("1 nello specchio NESSUNA parola del diario si legge: e una busta chiusa", trovate.length === 0, trovate.join(","));
  check("1 la busta locale e la stessa del server (stessa cassaforte, stesso AES)", riga?.busta === suServer?.busta);
}

/* ===== 2. a specchio pronto non si scaricano piu le buste ===== */
{
  richieste = [];
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.body.innerText.includes("Basalto turchese"), null, { timeout: 40_000 });
  await page.waitForTimeout(2500);
  const dopoOggi = richiesteConBusta().length;
  check("2 aprire Oggi non scarica nessuna busta", dopoOggi === 0, richiesteConBusta().join(" | "));
  await page.goto(BASE + "/app/mese", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.body.innerText.includes("Basalto turchese"), null, { timeout: 40_000 });
  check("2 aprire Mese non scarica nessuna busta (niente skeleton da aspettare)", richiesteConBusta().length === 0, richiesteConBusta().join(" | "));
  check("2 la sincronizzazione ha chiesto solo l'elenco leggero", richieste.some((u) => /select=giorno,v(&|$)/.test(u)), richieste.join(" | "));
}

/* ===== 3. senza rete, il diario c'e lo stesso ===== */
{
  await senzaRete(true);
  await page.goto(BASE + "/app/mese", { waitUntil: "domcontentloaded" });
  const visto = await page
    .waitForFunction(() => document.body.innerText.includes("Basalto turchese"), null, { timeout: 40_000 })
    .then(() => true)
    .catch(() => false);
  check("3 senza rete Mese mostra lo stesso la giornata (lo specchio basta)", visto);
  await senzaRete(false);
}

/* ===== 5. cancellata altrove: al ritorno in pari sparisce ===== */
{
  finto.tabelle.cassettine = [];
  await page.goto(BASE + "/app/mese", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  const s = await specchio(page);
  check("5 la giornata cancellata altrove sparisce dallo specchio", (s.righe ?? []).length === 0, JSON.stringify(s.righe ?? []).slice(0, 120));
}

/* ===== 6. il logout svuota lo specchio ===== */
{
  // Si riscrive una giornata, cosi c'e qualcosa da svuotare.
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  await passaCancello(page);
  await page.locator(".jm-ed-ta").waitFor({ state: "visible", timeout: 40_000 });
  await page.locator(".jm-ed-ta").click();
  await page.keyboard.type("Una giornata qualunque, per avere qualcosa da svuotare.");
  await page.keyboard.press("Control+s");
  await page.waitForTimeout(3000);
  const prima = await specchio(page);
  check("6 prima del logout lo specchio ha la giornata", (prima.righe ?? []).length === 1, String((prima.righe ?? []).length));
  await page.goto(BASE + "/app/settings", { waitUntil: "domcontentloaded" });
  // Su desktop il gruppo Account e nascosto (l'identita sta nella rail
  // destra): si preme l'uscita VISIBILE, qualunque delle due sia.
  await page
    .locator(":is(button, .jm-st-row):visible", { hasText: "Esci dall'account" })
    .first()
    .click({ timeout: 30_000 });
  await page.waitForTimeout(3000);
  const dopo = await specchio(page);
  check("6 dopo il logout lo specchio e vuoto", (dopo.righe ?? []).length === 0 && (dopo.meta ?? []).length === 0, JSON.stringify(dopo).slice(0, 160));
  check("zero errori di pagina", erroriPagina.length === 0, erroriPagina.slice(0, 2).join(" | "));
}

await ctx.close();
await browser.close();

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} PASS`);
process.exit(passed === results.length ? 0 : 1);
