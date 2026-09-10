// Le ruote di peso, sonno e mood (10 settembre 2026, mockup
// MOCKUP-ruote-metriche.html approvato da Manuel: 1,1,1,1,1 + sonno a passi
// di 30 minuti + peso che parte dall'ultimo inserito).
//
// Pretende:
//   1. un tocco sulla scheda apre un foglio dal basso, e NESSUN campo prende
//      il fuoco (niente tastiera): non esiste un <input> nel foglio;
//   2. il peso, quando la giornata non ce l'ha, parte dall'ultimo peso
//      registrato nei giorni prima; il numero grande cambia mentre la ruota
//      scorre; "Fatto" salva sul disco; "Togli" svuota;
//   3. il sonno ha i minuti solo a 00 e 30;
//   4. il mood e una ruota con faccia e parola.
// Serve il dev server :3100 (modalita locale, nessun finto).
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

/* ---- statico ---- */
{
  const foglio = readFileSync("src/modules/oggi/components/foglio-metrica.tsx", "utf8");
  check("nel foglio non c'e nessun <input>: niente tastiera", !/<input/.test(foglio));
  check("il sonno va a passi di 30 minuti", /\[0, 30\]\.map/.test(foglio));
  check("il peso parte dall'ultimo inserito prima della giornata", /ultimoPesoPrima\(dateISO\)/.test(foglio) && /e\.entryDate < dateISO/.test(foglio));
  const cards = readFileSync("src/modules/oggi/components/metric-cards.tsx", "utf8");
  check("le schede aprono il foglio, non un campo di testo", /<FoglioMetrica/.test(cards) && !/<input/.test(cards));
  const ruota = readFileSync("src/components/ui/ruota.tsx", "utf8");
  check("la ruota e uno scroll vero con lo scatto (scroll-snap, altezza misurata)", /offsetHeight/.test(ruota) && /scroll-snap/.test(readFileSync("src/modules/oggi/styles.css", "utf8")));
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const oggi = new Date();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const OGGI = iso(oggi);
const IERI = iso(new Date(oggi.getTime() - 86400_000));

const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: "it-IT", hasTouch: true });
await ctx.addInitScript(() => {
  try {
    window.localStorage.setItem("jm.mode", "local");
    window.localStorage.setItem("jm.ospite", "0");
    window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
    window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
  } catch {}
});
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(BASE + "/app", { waitUntil: "networkidle" });
const base = (d, extra) => ({ id: "r-" + d, entryDate: d, transcript: "Giornata.", headline: "Giornata", snippet: null, areas: [], metrics: { mood: null, weightKg: null, sleepHours: null }, goalsOn: [], people: [], durationSeconds: 0, createdAt: new Date().toISOString(), ...extra });
await page.evaluate(async ({ a, b }) => {
  const req = indexedDB.open("journalme");
  const db = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
  const tx = db.transaction("entries", "readwrite");
  tx.objectStore("entries").put(a); tx.objectStore("entries").put(b);
  await new Promise((res) => { tx.oncomplete = res; });
  db.close();
}, { a: base(IERI, { metrics: { mood: null, weightKg: 71.4, sleepHours: 6.25 } }), b: base(OGGI, {}) });
await page.goto(BASE + "/app", { waitUntil: "networkidle" });
await page.waitForSelector(".jm-metric", { timeout: 20000 });
await page.waitForTimeout(500);

const leggi = async () => page.evaluate(async (d) => {
  const req = indexedDB.open("journalme");
  const db = await new Promise((res) => { req.onsuccess = () => res(req.result); });
  const r = await new Promise((res) => { const g = db.transaction("entries").objectStore("entries").get(d); g.onsuccess = () => res(g.result); });
  db.close();
  return r?.metrics ?? null;
}, OGGI);

/** Fa scorrere una ruota di `n` righe (positivo = giu). */
async function scorri(sel, n) {
  await page.evaluate(({ sel, n }) => {
    const w = document.querySelector(sel);
    const h = w.firstElementChild.offsetHeight;
    w.scrollTo({ top: w.scrollTop + n * h });
  }, { sel, n });
  await page.waitForTimeout(350);
}

/* ---- peso ---- */
{
  await page.locator(".jm-metric").nth(0).click();
  const foglio = page.locator(".jm-sheet");
  await foglio.waitFor({ state: "visible", timeout: 5000 });
  await page.waitForSelector(".jm-ruota-kg", { timeout: 5000 });
  await page.waitForTimeout(300);
  check("peso: un tocco apre il foglio", await foglio.isVisible());
  check("peso: nessun campo ha il fuoco (niente tastiera)", await page.evaluate(() => !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName ?? "")));
  const big = (await page.locator(".jm-ruote-big").innerText()).replace(/\s+/g, " ");
  check("peso: parte dall'ultimo peso registrato (71,4 di ieri)", /71,4/.test(big), big);
  await scorri(".jm-ruota-dec", 1);
  const big2 = (await page.locator(".jm-ruote-big").innerText()).replace(/\s+/g, " ");
  check("peso: il numero grande cambia mentre la ruota scorre (71,5)", /71,5/.test(big2), big2);
  await page.locator(".jm-ruote-fatto").click();
  await page.waitForTimeout(600);
  check("peso: 'Fatto' chiude il foglio", (await page.locator(".jm-sheet").count()) === 0);
  const m = await leggi();
  check("peso: sul disco c'e 71,5", m?.weightKg === 71.5, JSON.stringify(m));
  check("peso: la scheda mostra 71,5", /71,5/.test(await page.locator(".jm-metric").nth(0).innerText()));
  // Togli
  await page.locator(".jm-metric").nth(0).click();
  await page.waitForSelector(".jm-ruota-kg", { timeout: 5000 });
  await page.locator(".jm-ruote-togli").click();
  await page.waitForTimeout(600);
  const m2 = await leggi();
  check("peso: 'Togli' svuota", m2?.weightKg == null, JSON.stringify(m2));
}

/* ---- sonno ---- */
{
  await page.locator(".jm-metric").nth(1).click();
  await page.waitForSelector(".jm-ruota-m", { timeout: 5000 });
  await page.waitForTimeout(300);
  const minuti = await page.locator(".jm-ruota-m .jm-ruota-v").allInnerTexts();
  check("sonno: i minuti sono solo 00 e 30", minuti.join(",") === "00,30", minuti.join(","));
  await scorri(".jm-ruota-m", 1);
  const big = (await page.locator(".jm-ruote-big").innerText()).replace(/\s+/g, " ");
  check("sonno: il numero grande segue (7h 30)", /7h 30/.test(big), big);
  await page.locator(".jm-ruote-fatto").click();
  await page.waitForTimeout(600);
  const m = await leggi();
  check("sonno: sul disco c'e 7,5 ore", m?.sleepHours === 7.5, JSON.stringify(m));
}

/* ---- mood ---- */
{
  await page.locator(".jm-metric").nth(2).click();
  await page.waitForSelector(".jm-ruota-mood", { timeout: 5000 });
  await page.waitForTimeout(300);
  const righe = await page.locator(".jm-ruota-mood .jm-ruota-v").count();
  const parole = await page.locator(".jm-ruota-mood .jm-ruota-parola").allInnerTexts();
  check("mood: cinque righe, faccia e parola", righe === 5 && parole.length === 5 && parole[1] === "bene", parole.join("|"));
  await scorri(".jm-ruota-mood", -1);
  await page.locator(".jm-ruote-fatto").click();
  await page.waitForTimeout(600);
  const m = await leggi();
  check("mood: dopo una riga in su e 'Fatto' il mood e 'good'", m?.mood === "good", JSON.stringify(m));
}

/* ---- il velo chiude ---- */
{
  await page.locator(".jm-metric").nth(0).click();
  await page.waitForSelector(".jm-sheet", { timeout: 5000 });
  await page.mouse.click(10, 40);
  await page.waitForTimeout(400);
  check("toccare fuori chiude il foglio senza salvare", (await page.locator(".jm-sheet").count()) === 0);
}
check("zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));

await browser.close();
const passati = results.filter((r) => r.ok).length;
console.log(`\n${passati}/${results.length} PASS`);
process.exit(passati === results.length ? 0 : 1);
