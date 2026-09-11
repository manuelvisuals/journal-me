// La coda dell'analisi: l'AI non fallisce, al massimo tarda (11 settembre
// 2026, Manuel: "non deve proprio succedere che l'ai fallisce").
//
// Il danno che questo banco impedisce di tornare: una giornata salvata con
// "Giornata raccontata" al posto del titolo, zero aree e zero misure, solo
// perche la rete ha tardato. Il guasto veniva salvato COME SE FOSSE una
// risposta, e restava li per sempre.
//
// Cosa deve reggere:
//  1. con /api/process-entry rotta, la giornata si salva lo stesso (non si
//     perde una parola) e il lavoro finisce in coda su IndexedDB;
//  2. la schermata NON dice "aree macro non ancora estratte" (sarebbe una
//     bugia: suona definitivo e non lo e) ma dice che l'AI sta lavorando;
//  3. tornata la rete, la coda riparte DA SOLA — nessun tasto premuto — e
//     la giornata si completa: titolo vero, e la coda si svuota;
//  4. un 402 (regalo finito: l'AI ha detto di no, non ha fallito) NON entra
//     in coda: un no non si riprova all'infinito.
//
// Il server parla con un Supabase FINTO e un OpenAI FINTO (finti-server.mjs)
// su 3198 e 3199. Dev server come per verify-ospite.mjs:
//
//   JM_SUPABASE_URL_SERVER=http://127.0.0.1:3198 OPENAI_BASE_URL=http://127.0.0.1:3199 \
//   SUPABASE_SERVICE_ROLE_KEY=finto OPENAI_API_KEY=finto \
//   NEXT_PUBLIC_SUPABASE_URL=https://sbfinto.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=finto-anon-key \
//   ./node_modules/.bin/next dev -p 3100
import { chromium } from "playwright-core";
import { SupabaseFintoServer, OpenAIFinto } from "./lib/finti-server.mjs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const SB_HOST = "sbfinto.supabase.co";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const sb = new SupabaseFintoServer();
const oa = new OpenAIFinto();
await sb.avvia(3198);
await oa.avvia(3199);

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "it-IT" });
await ctx.route(`**/${SB_HOST}/**`, (route) =>
  route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
);
await ctx.addInitScript(() => {
  try {
    window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
    window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
    window.localStorage.setItem("jm.porta.lettera", "999");
  } catch {}
});
const page = await ctx.newPage();

/** La rete che cade: l'analisi non arriva al server. */
const rotta = (route) => route.abort();
async function processEntryRotta(si) {
  if (si) await ctx.route("**/api/process-entry", rotta);
  else await ctx.unroute("**/api/process-entry", rotta);
}

/** La coda com'e sul dispositivo. */
async function coda() {
  return page.evaluate(
    () =>
      new Promise((res) => {
        const r = indexedDB.open("journalme-coda");
        r.onerror = () => res([]);
        r.onsuccess = () => {
          const d = r.result;
          if (!d.objectStoreNames.contains("lavori")) return res([]);
          const tx = d.transaction("lavori", "readonly");
          const g = tx.objectStore("lavori").getAll();
          g.onsuccess = () => res(g.result ?? []);
          g.onerror = () => res([]);
        };
      }),
  );
}

/* ===== 1-2. la rete cade: la giornata resta, il lavoro va in coda ===== */
{
  await processEntryRotta(true);
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  await page.locator(".jm-ed-ta").waitFor({ state: "visible", timeout: 90_000 });
  await page.locator(".jm-ed-ta").click();
  await page.keyboard.type("Oggi mi sono alzato tardi e ho pesato ottantuno chili e mezzo.");
  await page.keyboard.press("Control+Enter");
  await page.locator(".jm-fv-h").waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(2500);

  const testo = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  check("1 la giornata si salva lo stesso: il testo c'e", /alzato tardi/.test(testo), testo.slice(0, 90));
  const inCoda = await coda();
  check("1 il lavoro e in coda su IndexedDB", inCoda.length === 1, JSON.stringify(inCoda));
  check(
    "2 la schermata dice che l'AI sta ancora lavorando, non 'aree non estratte'",
    /sta ancora elaborando/.test(testo) && !/aree macro non ancora estratte/.test(testo),
    testo.slice(0, 160),
  );
}

/* ===== 3. torna la rete: la coda finisce il lavoro da sola ===== */
{
  await processEntryRotta(false);
  // Nessun tasto: si riapre l'app, che e uno dei tre risvegli della coda.
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  await page.locator(".jm-fv-h").waitFor({ state: "visible", timeout: 60_000 });
  const finita = await page
    .waitForFunction(() => !document.body.innerText.includes("sta ancora elaborando"), null, {
      timeout: 60_000,
    })
    .then(() => true)
    .catch(() => false);
  check("3 senza premere niente, l'avviso 'sta ancora elaborando' sparisce", finita);
  await page.waitForTimeout(1500);
  const titolo = await page.locator(".jm-fv-h").innerText();
  check("3 la giornata ha il titolo vero dell'AI", /giornata da ospite/i.test(titolo), titolo);
  const dopo = await coda();
  check("3 la coda si e svuotata", dopo.length === 0, JSON.stringify(dopo));
}

/* ===== 4. il 402 non entra in coda: e un no, non un guasto ===== */
{
  await ctx.route("**/api/process-entry", (route) =>
    route.fulfill({
      status: 402,
      contentType: "application/json",
      body: JSON.stringify({ error: "regalo_finito", motivo: "finite" }),
    }),
  );
  await page.evaluate(
    () =>
      new Promise((res) => {
        const r = indexedDB.deleteDatabase("journalme");
        r.onsuccess = () => res(null);
        r.onerror = () => res(null);
        r.onblocked = () => res(null);
      }),
  );
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  await page.locator(".jm-ed-ta").waitFor({ state: "visible", timeout: 90_000 });
  await page.locator(".jm-ed-ta").click();
  await page.keyboard.type("Una giornata scritta quando il regalo e finito.");
  await page.keyboard.press("Control+Enter");
  await page.waitForTimeout(6000);
  const dopo = await coda();
  check("4 un 402 non mette niente in coda (un no non si riprova)", dopo.length === 0, JSON.stringify(dopo));
}

await ctx.close();
await browser.close();
await sb.ferma();
await oa.ferma();

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} PASS`);
process.exit(passed === results.length ? 0 : 1);
