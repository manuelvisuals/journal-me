// La prova delle FOTO DAL RULLINO, dentro un browser vero.
//
// Mockup: design/mockups/foto-rullino.html (approvato da Manuel il
// 1 settembre 2026). Qui non si controlla che il codice sia scritto
// giusto: si scelgono dei file, si guarda la striscia comparire, si apre
// il visore, si elimina, si ricarica la pagina.
//
// Le regole che questo banco esiste per difendere:
//  1. le foto si aggiungono dal foglio "Aggiungi a questa giornata" e la
//     striscia compare nella giornata — e sopravvive a un reload (stanno
//     nel database del browser, non nella memoria del componente);
//  2. con piu di quattro foto la quarta casella dice "+N" e apre la
//     griglia sul posto;
//  3. il visore dice "X di Y", elimina chiede conferma e toglie la foto
//     dalla GIORNATA (il file scelto resta dov'era);
//  4. un giorno SENZA racconto puo avere le sue foto;
//  5. in modalita locale NESSUNA richiesta lascia il computer;
//  6. una giornata senza foto non cambia di un pixel (niente striscia).
//
// Gira in modalita locale (database del browser): non tocca il database
// vero e non chiama l'AI, quindi puo girare sempre.

import { chromium } from "playwright-core";

const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

function isoApp(giorniIndietro = 0) {
  const parti = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const d = new Date(`${parti}T12:00:00`);
  d.setDate(d.getDate() - giorniIndietro);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const g = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${g}`;
}

const IERI = isoApp(1);
const VUOTO = isoApp(5); // un giorno senza racconto

/* Un PNG 1x1 vero: al banco non serve una foto bella, serve un file che
   il decodificatore accetti. Nomi diversi per scelte diverse. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const file = (nome) => ({ name: nome, mimeType: "image/png", buffer: PNG });

const browser = await chromium.launch({
  executablePath: EXE,
  args: ["--no-sandbox"],
});

const SEED = `
  const req = indexedDB.open("journalme");
  const db = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
  const tx = db.transaction("entries", "readwrite");
  tx.objectStore("entries").put({
    id: "t-${IERI}", entryDate: "${IERI}",
    transcript: "Giornata di prova per le foto.",
    headline: "la giornata delle foto",
    snippet: "Una riga di sintesi.",
    areas: [{ label: "Relazioni", text: "Una telefonata lunga." }],
    metrics: { mood: null, weightKg: null, sleepHours: null },
    goalsOn: [], people: [], durationSeconds: 0,
    createdAt: new Date("${IERI}T20:00:00Z").toISOString(),
  });
  await new Promise((res) => { tx.oncomplete = res; });
  db.close();
`;

async function contesto() {
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 932 },
    hasTouch: true,
    locale: "it-IT",
  });
  await ctx.addInitScript(() => {
    try {
      window.localStorage.setItem("jm.mode", "local");
      window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
      window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
    } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  const esterne = [];
  page.on("request", (r) => {
    const u = r.url();
    if (!u.startsWith(BASE) && !u.startsWith("data:") && !u.startsWith("blob:")) {
      esterne.push(u);
    }
  });
  await page.goto(BASE + "/app", { waitUntil: "networkidle" });
  await page.evaluate(`(async () => { ${SEED} })()`);
  return { ctx, page, errors, esterne };
}

/** Apre il foglio e sceglie dei file dal "rullino". */
async function aggiungi(page, nomi) {
  await page.locator(".jm-day-add").first().click();
  await page.waitForSelector(".jm-sheet", { timeout: 10000 });
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.locator(".jm-sheet-row", { hasText: "Aggiungi dal rullino" }).click(),
  ]);
  await chooser.setFiles(nomi.map(file));
  await page.waitForTimeout(1200);
}

/* ============ 1. la giornata scritta: aggiunta, reload, +N ============ */
{
  const { ctx, page, errors, esterne } = await contesto();
  await page.goto(`${BASE}/app/giorno?d=${IERI}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".jm-fv-h", { timeout: 20000 });

  check(
    "prima delle foto la striscia NON esiste",
    (await page.locator(".jm-foto-wrap").count()) === 0,
  );

  await page.locator(".jm-day-add").first().click();
  await page.waitForSelector(".jm-sheet", { timeout: 10000 });
  check(
    "il foglio ha la riga Aggiungi dal rullino",
    (await page
      .locator(".jm-sheet-row", { hasText: "Aggiungi dal rullino" })
      .count()) === 1,
  );
  // si chiude e si riapre dalla stessa strada del banco: cosi il primo
  // giro di aggiunta parte dal foglio come fara il pollice
  await page.keyboard.press("Escape");
  await page.locator(".jm-sheet-scrim").click({ position: { x: 10, y: 10 } });
  await page.waitForTimeout(300);

  await aggiungi(page, ["a.png", "b.png"]);
  await page.waitForSelector(".jm-foto-wrap", { timeout: 10000 });
  check(
    "due foto scelte = due miniature nella striscia",
    (await page.locator(".jm-foto-strip .jm-foto-th").count()) === 2,
  );
  check(
    "sopra la striscia c'e la label Foto del giorno",
    (await page.locator(".jm-foto-wrap .jm-fv-social-l").innerText())
      .trim()
      .toLowerCase() === "foto del giorno",
  );

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".jm-foto-wrap", { timeout: 20000 });
  check(
    "dopo un reload le foto ci sono ancora (IndexedDB, non memoria)",
    (await page.locator(".jm-foto-strip .jm-foto-th").count()) === 2,
  );

  await aggiungi(page, ["c.png", "d.png", "e.png", "f.png"]);
  await page.waitForTimeout(600);
  const celle = await page.locator(".jm-foto-strip .jm-foto-th").count();
  const more = await page.locator(".jm-foto-more").count();
  check(
    "con sei foto la striscia mostra tre miniature e la casella +N",
    celle === 4 && more === 1,
    `celle=${celle} more=${more}`,
  );
  check(
    "la casella dice quante ne mancano (+3)",
    (await page.locator(".jm-foto-more").innerText()).trim() === "+3",
    await page.locator(".jm-foto-more").innerText(),
  );

  await page.locator(".jm-foto-more").click();
  await page.waitForTimeout(300);
  check(
    "toccarla apre la griglia sul posto, con tutte e sei",
    (await page.locator(".jm-foto-griglia .jm-foto-th").count()) === 6,
  );

  check("zero richieste fuori dal computer", esterne.length === 0, esterne[0] ?? "");
  check("zero errori console", errors.length === 0, errors[0] ?? "");
  await ctx.close();
}

/* ============ 2. il visore: contatore, frecce, elimina ============ */
{
  /* Contesto nuovo = browser pulito: le sei foto si aggiungono qui.
     (Ogni contesto Playwright ha il suo IndexedDB: quello della sezione
     1 non esiste piu, ed e giusto cosi — le sezioni non si parlano.) */
  const { ctx, page, errors } = await contesto();
  await page.goto(`${BASE}/app/giorno?d=${IERI}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".jm-fv-h", { timeout: 20000 });
  await aggiungi(page, ["a.png", "b.png", "c.png", "d.png", "e.png", "f.png"]);
  await page.waitForSelector(".jm-foto-wrap", { timeout: 10000 });

  await page.locator(".jm-foto-strip .jm-foto-th").first().click();
  await page.waitForSelector(".jm-foto-visore", { timeout: 10000 });
  check(
    "il visore dice 1 di 6",
    (await page.locator(".jm-foto-v-conta").innerText()).trim() === "1 di 6",
    await page.locator(".jm-foto-v-conta").innerText(),
  );
  check(
    "e sotto c'e il giorno per nome",
    (await page.locator(".jm-foto-v-data").innerText()).trim().length > 3,
    await page.locator(".jm-foto-v-data").innerText(),
  );

  /* IL VISORE COPRE LO SCHERMO INTERO (2 settembre 2026, screenshot di
     Manuel: visore sotto la barra in alto, foto fuori dallo schermo —
     colpa del will-change del piano dei giorni, che faceva da riferimento
     al fixed). Ora sta sul body: il suo riquadro E il viewport. */
  const box = await page.locator(".jm-foto-visore").boundingBox();
  const vp = page.viewportSize();
  check(
    "il visore copre tutto lo schermo, dal pixel 0",
    box && Math.round(box.x) === 0 && Math.round(box.y) === 0 &&
      Math.round(box.width) === vp.width && Math.round(box.height) === vp.height,
    JSON.stringify(box),
  );
  check(
    "il visore sta direttamente sul body (portal), non dentro il piano dei giorni",
    await page.locator("body > .jm-foto-visore").count() === 1,
  );
  const img = await page.locator(".jm-foto-v-corpo img").boundingBox();
  check(
    "la foto sta tutta dentro lo schermo",
    img && img.y >= 0 && img.x >= 0 && img.y + img.height <= vp.height + 1 && img.x + img.width <= vp.width + 1,
    JSON.stringify(img),
  );
  check(
    "col visore aperto il dito non scorre la pagina (touch-action: none)",
    (await page.locator(".jm-foto-visore").evaluate((e) => getComputedStyle(e).touchAction)) === "none",
  );

  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(200);
  check(
    "la freccia porta alla seconda: 2 di 6",
    (await page.locator(".jm-foto-v-conta").innerText()).trim() === "2 di 6",
  );

  /* LO SWIPE: da destra a sinistra si va alla foto dopo, e la pagina
     sotto resta ferma. Tocchi sintetici via CDP, come un dito vero. */
  const scrollPrima = await page.evaluate(() => window.scrollY);
  const cdp = await ctx.newCDPSession(page);
  const cx = vp.width / 2, cy = vp.height / 2;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx + 120, y: cy }] });
  for (let i = 1; i <= 8; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: cx + 120 - i * 30, y: cy + i * 2 }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(400);
  check(
    "lo swipe verso sinistra porta alla foto dopo: 3 di 6",
    (await page.locator(".jm-foto-v-conta").innerText()).trim() === "3 di 6",
    await page.locator(".jm-foto-v-conta").innerText(),
  );
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx - 120, y: cy }] });
  for (let i = 1; i <= 8; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: cx - 120 + i * 30, y: cy }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(400);
  check(
    "lo swipe verso destra torna indietro: 2 di 6",
    (await page.locator(".jm-foto-v-conta").innerText()).trim() === "2 di 6",
  );
  /* Un dito che va in verticale non cambia foto e non scorre la pagina. */
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx, y: cy - 100 }] });
  for (let i = 1; i <= 8; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: cx, y: cy - 100 + i * 30 }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(300);
  check(
    "un gesto verticale non cambia foto",
    (await page.locator(".jm-foto-v-conta").innerText()).trim() === "2 di 6",
  );
  check(
    "e la pagina sotto non si e mossa",
    (await page.evaluate(() => window.scrollY)) === scrollPrima,
    `scrollY ${scrollPrima} -> ${await page.evaluate(() => window.scrollY)}`,
  );
  check(
    "il giorno in pagina e sempre lo stesso (lo swipe delle foto non sfoglia i giorni)",
    page.url().includes(`d=${IERI}`),
    page.url(),
  );

  page.once("dialog", (d) => void d.accept());
  await page.locator('.jm-foto-v-fondo .jm-foto-v-btn').click();
  await page.waitForTimeout(800);
  check(
    "elimina (con conferma) toglie la foto: il contatore dice di 5",
    (await page.locator(".jm-foto-v-conta").innerText()).includes("di 5"),
    await page.locator(".jm-foto-v-conta").innerText(),
  );

  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  check(
    "chiuso il visore, la striscia si e aggiornata: tre miniature e +2",
    (await page.locator(".jm-foto-strip .jm-foto-th:not(.jm-foto-more)").count()) === 3 &&
      (await page.locator(".jm-foto-more").innerText()).trim() === "+2",
    await page.locator(".jm-foto-more").innerText(),
  );
  check("zero errori console nel visore", errors.length === 0, errors[0] ?? "");
  await ctx.close();
}

/* ============ 3. un giorno senza racconto ha le sue foto ============ */
/* Dal 2 settembre 2026 il giorno vuoto e lo stesso stato vuoto di Oggi:
   le foto si aggiungono dal + della barra e compaiono SOTTO i tasti. */
{
  const { ctx, page, errors } = await contesto();
  await page.goto(`${BASE}/app/giorno?d=${VUOTO}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".btn-primary", { timeout: 20000 });

  await page.locator('.jm-appbar-az .jm-cmd[aria-label="Aggiungi a questa giornata"]').click();
  await page.waitForSelector(".jm-sheet", { timeout: 10000 });
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.locator(".jm-sheet-row", { hasText: "Aggiungi dal rullino" }).click(),
  ]);
  await chooser.setFiles([file("g.png")]);
  await page.waitForSelector(".jm-foto-wrap", { timeout: 10000 });
  check(
    "sul giorno vuoto la foto compare, sotto i tasti dello stato vuoto",
    (await page.locator(".jm-foto-th").count()) === 1,
  );
  check(
    "e il giorno resta vuoto di parole (nessun racconto inventato)",
    (await page.locator(".btn-primary").count()) === 1 &&
      /Com'e andat/.test(await page.locator("body").innerText()),
  );
  check("zero errori console sul giorno vuoto", errors.length === 0, errors[0] ?? "");
  await ctx.close();
}

await browser.close();

const ok = results.filter((r) => r.ok).length;
console.log(`\n${ok}/${results.length} PASS`);
process.exit(ok === results.length ? 0 : 1);
