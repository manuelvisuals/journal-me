// La X che toglie una persona o un luogo da una giornata (23 agosto 2026).
//
// Richiesta di Manuel: "se menziono una persona ma non l'ho incontrata, non
// deve andare li". Il modo ovvio di implementarla — cancellare il nome
// dall'elenco salvato — sarebbe un bottone che si disfa da solo: le persone
// di una giornata si ricalcolano dal testo a ogni modifica, e alla prima
// riga aggiunta Marco tornerebbe.
//
// Per questo il controllo che conta e il terzo: TOGLI, POI AGGIUNGI UNA RIGA,
// e Marco deve restare fuori. Gli altri sono contorno.
//
// Gira in modalita locale: database del browser, nessuna AI, nessun costo.

import { chromium } from "playwright-core";

const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const GIORNO = "2026-08-17";
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

const SEED = `
  const req = indexedDB.open("journalme");
  const db = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
  {
    const tx = db.transaction("entries", "readwrite");
    tx.objectStore("entries").put({
      id: "x1", entryDate: "${GIORNO}",
      transcript: "Dovevo vedere Marco ma ha annullato. Colazione al Bubba Cafe con Keyko.",
      headline: "colazione con Keyko",
      snippet: "Marco ha annullato, colazione al Bubba Cafe con Keyko.",
      areas: [{ label: "Relazioni", text: "Colazione con Keyko." }],
      metrics: { mood: null, weightKg: null, sleepHours: null },
      goalsOn: [], people: ["Marco", "Keyko"], durationSeconds: 0,
      createdAt: new Date("${GIORNO}T10:00:00Z").toISOString(),
    });
    await new Promise((res) => { tx.oncomplete = res; });
  }
  {
    const tx = db.transaction("facts", "readwrite");
    tx.objectStore("facts").put({ id: "fx1", entryDate: "${GIORNO}", kind: "luogo", label: "Bubba Cafe", labelKey: "bubba cafe", attrs: {}, confidence: 0.9, origin: "ai" });
    tx.objectStore("facts").put({ id: "fx2", entryDate: "${GIORNO}", kind: "luogo", label: "ufficio", labelKey: "ufficio", attrs: {}, confidence: 0.9, origin: "ai" });
    await new Promise((res) => { tx.oncomplete = res; });
  }
  db.close();
`;

async function apri(larghezza = 430) {
  const ctx = await browser.newContext({ viewport: { width: larghezza, height: 932 }, locale: "it-IT" });
  await ctx.addInitScript(() => {
    try { window.localStorage.setItem("jm.mode", "local"); /* niente velo del saluto sui banchi */ window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco"); window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1"); } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + "/app", { waitUntil: "networkidle" });
  await page.evaluate(`(async () => { ${SEED} })()`);
  await page.goto(`${BASE}/app/giorno?d=${GIORNO}`, { waitUntil: "networkidle" });
  // Le pastiglie esistono in DUE posti — la colonna del telefono e la rail
  // del desktop — e quella dell'altra larghezza resta nel DOM, solo spenta.
  // Tutti i controlli guardano SOLO quelle visibili, se no contano il doppio.
  await page.waitForSelector(".jm-pill-x >> visible=true", { timeout: 20000 });
  await page.waitForTimeout(500);
  return { ctx, page, errors };
}

const testoDi = async (page, sel) =>
  (await page.locator(sel).first().innerText()).toLowerCase();

/* ================== 1. i nomi delle due sezioni ================== */
{
  const { ctx, page, errors } = await apri();
  const main = await testoDi(page, "main");
  check('sul telefono la sezione dice "Persone incontrate"', main.includes("persone incontrate"), );
  check('e "Luoghi visitati"', main.includes("luoghi visitati"));
  check('la vecchia "Social" non c\'e piu', !/\bsocial\b/.test(main));
  check("nessun errore in console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}
{
  const { ctx, page } = await apri(1440);
  const rail = await testoDi(page, ".jm-railr-sec:has(.jm-pill-x):visible");
  check("anche nella rail del desktop", rail.includes("persone incontrate"));
  await ctx.close();
}

/* ============ 2. la X toglie, e si puo rimettere subito ============ */
{
  const { ctx, page } = await apri();
  const pillMarco = page.locator(".jm-pill-x:visible", { hasText: "Marco" });
  check("all'inizio Marco c'e", (await pillMarco.count()) === 1);

  await pillMarco.locator(".jm-pill-del").click();
  await page.waitForTimeout(700);
  check(
    "toccando la X, Marco sparisce",
    (await page.locator(".jm-pill-x:visible", { hasText: "Marco" }).count()) === 0,
  );
  check(
    "ma Keyko resta: si toglie uno, non la sezione",
    (await page.locator(".jm-pill-x:visible", { hasText: "Keyko" }).count()) === 1,
  );
  check(
    "e c'e come rimediare a un tocco sbagliato",
    (await page.locator(".jm-undo:visible").count()) > 0,
    await page.locator(".jm-undo:visible").first().innerText().catch(() => ""),
  );

  await page.locator(".jm-undo:visible button").first().click();
  await page.waitForTimeout(700);
  check(
    "rimettendolo, Marco torna",
    (await page.locator(".jm-pill-x:visible", { hasText: "Marco" }).count()) === 1,
  );
  await ctx.close();
}

/* ====== 3. IL CONTROLLO CHE CONTA: sopravvive alla rilettura ====== */
{
  const { ctx, page, errors } = await apri();
  await page.locator(".jm-pill-x:visible", { hasText: "Marco" }).locator(".jm-pill-del").click();
  await page.waitForTimeout(800);

  // Si aggiunge una riga: il testo cambia, e l'analisi rifa persone e luoghi
  // da zero. Marco e ancora nel racconto ("dovevo vedere Marco").
  await page.locator(".jm-day-add").click();
  await page.waitForTimeout(500);
  await page.locator("text=Scrivi altro").click();
  await page.waitForSelector("textarea", { timeout: 8000 });
  await page.locator("textarea").fill("Poi il pomeriggio a casa.");
  await page.locator("button", { hasText: "Continua" }).first().click();
  await page.waitForSelector(".jm-pill-x >> visible=true", { timeout: 20000 });
  await page.waitForTimeout(1200);

  const pills = (await page.locator(".jm-pill-x:visible").allInnerTexts()).join(" ").toLowerCase();
  check(
    "dopo aver aggiunto una riga, Marco resta fuori",
    !pills.includes("marco"),
    pills.replace(/\n/g, " "),
  );
  check("e Keyko c'e ancora", pills.includes("keyko"), pills.replace(/\n/g, " "));
  check(
    "il racconto continua a nominarlo: le tue parole non si toccano",
    (await testoDi(page, "main")).includes("marco"),
  );

  // E resta fuori anche riaprendo la giornata da zero.
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".jm-pill-x >> visible=true", { timeout: 20000 });
  await page.waitForTimeout(700);
  const dopo = (await page.locator(".jm-pill-x:visible").allInnerTexts()).join(" ").toLowerCase();
  check("e resta fuori anche ricaricando la pagina", !dopo.includes("marco"), dopo.replace(/\n/g, " "));
  check(
    "il pentimento invece NON sopravvive: e roba di questa visita",
    (await page.locator(".jm-undo:visible").count()) === 0,
  );
  check("nessun errore in console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ 4. la X vale anche per i luoghi ============ */
{
  const { ctx, page } = await apri();
  const uff = page.locator(".jm-pill-x:visible", { hasText: "ufficio" });
  check("un luogo si toglie come una persona", (await uff.count()) === 1);
  await uff.locator(".jm-pill-del").click();
  await page.waitForTimeout(700);
  check(
    "il luogo tolto sparisce",
    (await page.locator(".jm-pill-x:visible", { hasText: "ufficio" }).count()) === 0,
  );
  check(
    "e gli altri luoghi restano",
    (await page.locator(".jm-pill-x:visible", { hasText: "Bubba" }).count()) === 1,
  );
  await ctx.close();
}

await browser.close();

const falliti = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - falliti.length}/${results.length} PASS` +
    (falliti.length ? ` . ${falliti.length} FAIL` : ""),
);
process.exit(falliti.length ? 1 : 0);
