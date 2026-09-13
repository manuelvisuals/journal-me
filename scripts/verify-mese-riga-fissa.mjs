// La riga del giorno scelto sotto la scacchiera del Mese NON si muove
// (13 settembre 2026, Manuel: "a seconda del contenuto la sezione si alza e
// si abbassa; la voglio sempre fissa"). Si misura il bordo superiore della
// riga passando da un giorno col titolo corto a uno col titolo lungo, e
// dalla riga di aiuto (nessun giorno scelto) al primo giorno: deve restare
// allo stesso pixel. Telefono (430x932), ospite locale, senza rete AI.
//
// Dev server come gli altri banchi (:3100 coi finti), poi:
//   node scripts/verify-mese-riga-fissa.mjs
import { chromium } from "playwright-core";

const EXE = process.env.JM_CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: "it-IT", isMobile: true, hasTouch: true });
await ctx.route("**/sbfinto.supabase.co/**", (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
await ctx.addInitScript(() => {
  try {
    window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
    window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
    window.localStorage.setItem("jm.mode", "local");
    window.localStorage.setItem("jm.ospite", "0");
  } catch {}
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

// Due giornate in IndexedDB, direttamente nel db locale (titolo = prima riga).
await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const oggi = new Date();
const iso = (d) => new Date(oggi.getFullYear(), oggi.getMonth(), d).toISOString().slice(0, 10);
const giorni = [
  { d: 3, titolo: "Corto." },
  { d: 4, titolo: "Una giornata lunghissima, piena di cose, con una riunione, la palestra, una cena fuori e una telefonata che non finiva mai." },
];
await page.evaluate(async ({ giorni }) => {
  const db = await new Promise((ok, no) => { const r = indexedDB.open("journalme"); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  const tx = db.transaction("entries", "readwrite");
  for (const g of giorni) {
    tx.objectStore("entries").put({ id: crypto.randomUUID(), entryDate: g.iso, transcript: g.titolo, headline: g.titolo, snippet: g.titolo, areas: [], people: [], goalsOn: [], durationSeconds: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  await new Promise((ok) => { tx.oncomplete = ok; });
}, { giorni: giorni.map((g) => ({ ...g, iso: iso(g.d) })) });

await page.goto(BASE + "/app/mese", { waitUntil: "domcontentloaded" });
// La scacchiera (vista "mini"), se la vista di fabbrica e la lista.
const scacchiera = page.locator(".jm-mese-mini");
if ((await scacchiera.count()) === 0) {
  await page.locator(".jm-mese-vista").first().click().catch(() => {});
}
await scacchiera.waitFor({ state: "visible", timeout: 20_000 });
const topDi = (sel) => page.locator(sel).evaluate((e) => Math.round(e.getBoundingClientRect().top));
const topHint = await topDi(".jm-mese-mini-hint");
const cella = (d) => page.locator(".jm-mese-mini button").filter({ hasText: new RegExp(`^${d}$`) }).first();
await cella(giorni[0].d).click();
await page.waitForTimeout(300);
const top1 = await topDi(".jm-mese-mini-prev");
const testo1 = await page.locator(".jm-mese-mini-prev .h").innerText();
await cella(giorni[1].d).click();
await page.waitForTimeout(300);
const top2 = await topDi(".jm-mese-mini-prev");
const righe2 = await page.locator(".jm-mese-mini-prev .h").evaluate((e) => Math.round(e.getBoundingClientRect().height / (parseFloat(getComputedStyle(e).fontSize) * 1.4)));
await cella(giorni[0].d).click();
await page.waitForTimeout(300);
const top3 = await topDi(".jm-mese-mini-prev");

check("il titolo corto e quello lungo lasciano la riga allo stesso pixel", top1 === top2 && top2 === top3, `${top1} / ${top2} / ${top3}`);
check("la riga di aiuto (nessun giorno) e alta quanto la riga del giorno", topHint === top1, `${topHint} vs ${top1}`);
check("il titolo lungo si ferma a due righe", righe2 === 2, String(righe2));
check("il titolo corto si legge intero", testo1 === giorni[0].titolo, testo1);
check("zero errori pagina", errors.length === 0, errors.slice(0, 2).join(" | "));

await browser.close();
const pass = results.filter((r) => r.ok).length;
console.log(`\n${pass}/${results.length} PASS`);
process.exit(pass === results.length ? 0 : 1);
