// La prova viva del titolo tuo e dei luoghi, dentro un browser vero.
//
// Il test statico (verify-titolo-luoghi.mjs) controlla che il codice sia
// scritto giusto. Questo controlla che, cliccando davvero, succeda: il
// titolo si apre, si scrive, si salva, resta dopo il ricaricamento della
// pagina e da quel momento porta la targhetta "tuo". E che i luoghi
// compaiano accanto alle persone.
//
// Gira in modalita locale (database del browser), quindi non tocca il
// database vero e non chiama l'AI: non costa niente e puo girare sempre.

import { chromium } from "playwright-core";

const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const GIORNO = "2026-08-19";
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

/** Una giornata finta con dentro due persone e tre luoghi. */
const SEED = `
  const req = indexedDB.open("journalme");
  const db = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
  {
    const tx = db.transaction("entries", "readwrite");
    tx.objectStore("entries").put({
      id: "t-${GIORNO}", entryDate: "${GIORNO}",
      transcript: "Colazione al Bubba Cafe con Marco, pomeriggio in piscina, cena da Charlie.",
      headline: "giornata fra piscina e amici",
      snippet: "Colazione al Bubba Cafe, pomeriggio in piscina e cena da Charlie.",
      areas: [{ label: "Relazioni", text: "Colazione con Marco e cena da Charlie." }],
      metrics: { mood: null, weightKg: null, sleepHours: null },
      goalsOn: [], people: ["Marco", "Charlie"], durationSeconds: 0,
      createdAt: new Date("${GIORNO}T20:00:00Z").toISOString(),
    });
    await new Promise((res) => { tx.oncomplete = res; });
  }
  {
    const tx = db.transaction("facts", "readwrite");
    const luoghi = [["Bubba Cafe","bubba cafe"],["piscina","piscina"],["da Charlie","da charlie"],["bubba cafe","bubba cafe"]];
    let i = 0;
    for (const [label, labelKey] of luoghi) {
      tx.objectStore("facts").put({
        id: "f-" + (i++), entryDate: "${GIORNO}", kind: "luogo",
        label, labelKey, attrs: {}, confidence: 0.9, origin: "ai",
      });
    }
    tx.objectStore("facts").put({
      id: "f-cibo", entryDate: "${GIORNO}", kind: "cibo",
      label: "pizza margherita", labelKey: "pizza", attrs: {}, confidence: 0.9, origin: "ai",
    });
    await new Promise((res) => { tx.oncomplete = res; });
  }
  db.close();
`;

async function contesto(width) {
  const ctx = await browser.newContext({ viewport: { width, height: 932 }, locale: "it-IT" });
  await ctx.addInitScript(() => {
    try { window.localStorage.setItem("jm.mode", "local"); /* niente velo del saluto sui banchi */ window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco"); window.localStorage.setItem("jm.saluto.silenzio", "dev:banco"); } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  // Prima visita a vuoto: serve solo ad avere un'origine su cui scrivere.
  await page.goto(BASE + "/app", { waitUntil: "networkidle" });
  await page.evaluate(`(async () => { ${SEED} })()`);
  return { ctx, page, errors };
}

/* =============== 1. il titolo si riscrive e resta ================= */
{
  const { ctx, page, errors } = await contesto(430);
  await page.goto(`${BASE}/app/giorno?d=${GIORNO}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".jm-fv-h", { timeout: 20000 });

  const prima = (await page.locator(".jm-fv-h").first().innerText()).trim();
  check(
    "all'inizio si vede il titolo dell'AI, senza targhetta",
    prima.toLowerCase().includes("piscina"),
    prima,
  );
  check(
    "e non c'e la targhetta 'tuo'",
    (await page.locator(".jm-fv-tuo").count()) === 0,
  );
  check(
    "c'e la matita che dice che si puo toccare",
    (await page.locator(".jm-fv-hpen").count()) === 1,
  );

  await page.locator(".jm-fv-htap").first().click();
  await page.waitForSelector(".jm-fv-hedit", { timeout: 5000 });
  check("toccando il titolo si apre la scrittura", true);

  await page.locator(".jm-fv-hedit").fill("la domenica piu bella del mese");
  // Si salva uscendo, come dice la scritta sotto il campo.
  await page.locator("body").click({ position: { x: 5, y: 400 } });
  await page.waitForTimeout(1200);

  const dopo = (await page.locator(".jm-fv-h").first().innerText()).trim();
  check(
    "il titolo scritto a mano compare subito",
    dopo.toLowerCase().includes("domenica piu bella"),
    dopo,
  );
  check(
    "e da quel momento porta la targhetta 'tuo'",
    (await page.locator(".jm-fv-tuo").count()) === 1,
  );

  // Ricarico: se il salvataggio non fosse arrivato al database, qui
  // tornerebbe il titolo dell'AI.
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".jm-fv-h", { timeout: 20000 });
  await page.waitForTimeout(400);
  const dopoReload = (await page.locator(".jm-fv-h").first().innerText()).trim();
  check(
    "il titolo tuo sopravvive al ricaricamento della pagina",
    dopoReload.toLowerCase().includes("domenica piu bella"),
    dopoReload,
  );
  check(
    "e la targhetta pure",
    (await page.locator(".jm-fv-tuo").count()) === 1,
  );

  // La targhetta non deve essere una via d'uscita: e una scritta.
  const targhettaCliccabile = await page.evaluate(() => {
    const el = document.querySelector(".jm-fv-tuo");
    if (!el) return "assente";
    return el.tagName.toLowerCase();
  });
  check(
    "la targhetta 'tuo' non e un bottone: da qui non si torna indietro",
    targhettaCliccabile === "span",
    targhettaCliccabile,
  );

  check("nessun errore in console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* =============== 2. annullare con Esc non blocca niente ============ */
{
  const { ctx, page } = await contesto(430);
  await page.goto(`${BASE}/app/giorno?d=${GIORNO}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".jm-fv-htap", { timeout: 20000 });
  await page.locator(".jm-fv-htap").first().click();
  await page.waitForSelector(".jm-fv-hedit", { timeout: 5000 });
  await page.locator(".jm-fv-hedit").fill("un titolo scritto per sbaglio");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  const testo = (await page.locator(".jm-fv-h").first().innerText()).trim();
  check(
    "Esc annulla: resta il titolo dell'AI",
    testo.toLowerCase().includes("piscina"),
    testo,
  );
  check(
    "e la giornata NON risulta bloccata",
    (await page.locator(".jm-fv-tuo").count()) === 0,
  );
  await ctx.close();
}

/* =============== 3. i luoghi, telefono e desktop =================== */
for (const [nome, larghezza] of [
  ["telefono", 430],
  ["desktop", 1440],
]) {
  const { ctx, page } = await contesto(larghezza);
  await page.goto(`${BASE}/app/giorno?d=${GIORNO}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".jm-fv-h", { timeout: 20000 });
  await page.waitForTimeout(900);

  // Si guarda DENTRO il blocco dei luoghi, non dentro tutta la pagina: il
  // riassunto della giornata nomina il Bubba Cafe, e contando su tutta la
  // pagina si conterebbe quello.
  const blocco = page.locator(".jm-places:visible");
  check(`${nome}: c'e la sezione Luoghi`, (await blocco.count()) === 1);
  if ((await blocco.count()) !== 1) { await ctx.close(); continue; }
  const testo = (await blocco.innerText()).toLowerCase();
  check(
    `${nome}: si vedono i posti della giornata`,
    testo.includes("bubba cafe") && testo.includes("piscina") && testo.includes("da charlie"),
  );
  check(
    `${nome}: i cibi non finiscono fra i luoghi`,
    !testo.includes("pizza margherita"),
  );
  const spilli = await blocco.locator(".jm-pin").count();
  check(
    `${nome}: ogni luogo ha lo spillo che lo distingue da una persona`,
    spilli === 3,
    `spilli: ${spilli}`,
  );
  // "Bubba Cafe" e "bubba cafe" sono lo stesso bar: una pastiglia sola.
  const quante = (testo.match(/bubba cafe/g) ?? []).length;
  check(`${nome}: lo stesso posto non compare due volte`, quante === 1, `volte: ${quante}`);

  // Lo spillo sta ACCANTO al nome, non sopra. Il 23 agosto 2026, in
  // produzione, stava sopra: il reset di Tailwind mette display:block su
  // ogni <svg>, e la pastiglia dei luoghi (a differenza di quella delle
  // persone) non era inline-flex. Risultato: pastiglie alte il doppio.
  // Si misura confrontandola con la pastiglia di una PERSONA, che e la
  // stessa cosa con un'icona diversa e deve essere alta uguale.
  // Dal 23 agosto la pastiglia porta anche la X, e la classe `link` sta sul
  // nome dentro: si misura la pastiglia intera, in un blocco e nell'altro.
  const hLuogo = (await blocco.locator(".jm-pill-x").first().boundingBox())?.height ?? 0;
  const bloccoPersone = larghezza >= 1024
    ? page.locator(".jm-railr-sec:has(.jm-pill-x):visible").first()
    : page.locator(".lg\\:hidden .jm-pill-row:visible").first();
  const hPersona = (await bloccoPersone.locator(".jm-pill-x").first().boundingBox())?.height ?? 0;
  check(
    `${nome}: la pastiglia di un luogo e alta come quella di una persona (una riga)`,
    hPersona > 0 && Math.abs(hLuogo - hPersona) <= 2,
    `luogo ${Math.round(hLuogo)}px contro persona ${Math.round(hPersona)}px`,
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
