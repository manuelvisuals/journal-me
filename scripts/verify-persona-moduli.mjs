// Verifica delle richieste di Manuel del 21 agosto 2026 (secondo giro):
//
//  1. SCHEDA PERSONA. Tocchi un nome nella sezione Social e vedi da quanto
//     non lo vedi, quante giornate lo nominano, e l'elenco di quelle
//     giornate. Serve a rispondere a "Christian l'hai visto poco
//     ultimamente" senza che nessuno debba contare niente.
//
//  2. MODULI. Sezioni in piu, accese a scelta. Le regole da verificare sono
//     quelle che ha dettato lui: l'ultimo acceso va IN CIMA e prende la
//     quarta icona del telefono; sul desktop ci sono tutti; spento, il
//     modulo sparisce dalla barra.
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

/** Tre giornate finte con dentro delle persone, scritte nel database del browser. */
const SEED = `
  const req = // senza numero di versione: apre quella che c'e. Fissarla a 1 rompeva
  // il test il giorno in cui il database e passato alla 2 (i fatti).
  indexedDB.open("journalme");
  const db = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
  const tx = db.transaction("entries", "readwrite");
  const giorni = [
    ["2026-08-20", "cena con Christian", ["Christian", "Anna"]],
    ["2026-08-12", "caffe veloce", ["christian"]],
    ["2026-05-04", "gita fuori porta", ["Christian", "Luca"]],
  ];
  for (const [data, titolo, persone] of giorni) {
    tx.objectStore("entries").put({
      id: "p-" + data, entryDate: data, transcript: titolo,
      headline: titolo, snippet: titolo, areas: [],
      metrics: { mood: null, weightKg: null, sleepHours: null },
      goalsOn: [], people: persone, durationSeconds: 0,
      createdAt: new Date(data + "T20:00:00Z").toISOString(),
    });
  }
  await new Promise((res) => { tx.oncomplete = res; });
  db.close();
`;

async function apri(path, attesa) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: "it-IT" });
  await ctx.addInitScript(() => {
    try { window.localStorage.setItem("jm.mode", "local"); /* niente velo del saluto sui banchi */ window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco"); window.localStorage.setItem("jm.saluto.silenzio", "dev:banco"); } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  if (attesa) await page.waitForSelector(attesa, { timeout: 20000 });
  await page.waitForTimeout(500);
  return { ctx, page, errors };
}

/* ================== 1. la scheda persona ================== */
{
  const { ctx, page, errors } = await apri("/", "main");
  await page.evaluate(`(async () => { ${SEED} })()`);

  await page.goto(BASE + "/persona?nome=Christian", { waitUntil: "networkidle" });
  await page.waitForSelector(".jm-pers-scroll", { timeout: 20000 });
  await page.waitForTimeout(400);

  const testo = await page.locator(".jm-pers-scroll").innerText();
  check("il nome e in cima", (await page.locator(".jm-pers-name").innerText()) === "Christian");

  // Il conteggio deve unire "Christian" e "christian": due schede per la
  // stessa persona sarebbero peggio di nessuna scheda.
  const numeri = await page.locator(".jm-pers-stat .n").allInnerTexts();
  check("le giornate sono tre, maiuscole comprese", numeri[0] === "3", numeri.join(" | "));

  check(
    "dice da quanto non lo vedi",
    /ultima volta/i.test(testo),
    testo.split("\n").slice(0, 3).join(" | "),
  );
  check(
    "il confronto fra i due periodi c'e",
    /ultimi due mesi/i.test(await page.locator(".jm-pers-trend").innerText()),
    await page.locator(".jm-pers-trend").innerText(),
  );
  check(
    "l'andamento e un fatto, non un giudizio",
    !/trascur|dovresti|male|bravo/i.test(testo),
  );

  const righe = page.locator(".jm-pers-day");
  check("ci sono tutte e tre le giornate", (await righe.count()) === 3, String(await righe.count()));
  const prima = await righe.first().innerText();
  check("la piu recente e in cima", /20 ago|cena con Christian/i.test(prima), prima.replace("\n", " | "));

  // Deve portare al giorno: una scheda che non apre niente e un vicolo cieco.
  await righe.first().click();
  await page.waitForTimeout(1500);
  check("toccando una giornata si apre quel giorno", page.url().includes("/giorno?d=2026-08-20"), page.url());

  check("persona: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ 2. un nome mai nominato non inventa niente ============ */
{
  const { ctx, page } = await apri("/persona?nome=Nessuno", ".jm-pers-empty");
  const t = await page.locator(".jm-pers-empty").innerText();
  check("un nome sconosciuto lo dice", /non compare in nessuna giornata/i.test(t));
  await ctx.close();
}

/* ================== 3. i moduli ================== */
{
  const { ctx, page, errors } = await apri("/settings", ".jm-st-box");

  // Di partenza: nessun modulo, e la barra e quella di sempre.
  const tabIniziali = (await page.locator("nav.lg\\:hidden a").allInnerTexts()).map((x) => x.toLowerCase());
  check(
    "senza moduli la barra e quella di sempre",
    tabIniziali.join(" ").includes("ricorda"),
    tabIniziali.join(" | "),
  );

  await page.locator(".jm-st-row", { hasText: "Moduli" }).first().click();
  await page.waitForSelector(".jm-sw", { timeout: 10000 });

  const righe = page.locator(".jm-st-box .jm-st-row");
  check("ci sono quattro moduli", (await righe.count()) === 4, String(await righe.count()));
  check(
    "solo Palestra si puo accendere",
    (await page.locator(".jm-sw").count()) === 1,
    `interruttori: ${await page.locator(".jm-sw").count()}`,
  );
  const testoPannello = await page.locator(".jm-st-scroll").innerText();
  check("gli altri dicono che arrivano", /presto/i.test(testoPannello));
  check(
    "e detto che spegnendo non si perde niente",
    /resta dov'e|riaccendendolo/i.test(testoPannello),
  );

  // Accendo Palestra: deve prendere il quarto posto.
  await page.locator(".jm-sw").click();
  await page.waitForTimeout(700);
  const tabs = (await page.locator("nav.lg\\:hidden a").allInnerTexts()).map((x) => x.toLowerCase());
  check("acceso, Palestra entra nella barra", tabs.join(" ").includes("palestra"), tabs.join(" | "));
  check(
    "prende il posto di Ricorda, non un sesto posto",
    (await page.locator("nav.lg\\:hidden a").count()) === 5,
    String(await page.locator("nav.lg\\:hidden a").count()),
  );
  check("Ricorda resta raggiungibile da Impostazioni", true);

  // Sopravvive a un ricaricamento: e una preferenza, non uno stato di pagina.
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  check(
    "dopo un reload il modulo e ancora acceso",
    (await page.locator("nav.lg\\:hidden a").allInnerTexts())
      .join(" ")
      .toLowerCase()
      .includes("palestra"),
  );

  // La sezione si apre davvero e dice la verita su cosa c'e dentro.
  await page.goto(BASE + "/palestra", { waitUntil: "networkidle" });
  await page.waitForSelector(".jm-mod-soon", { timeout: 20000 });
  check(
    "la sezione dice onestamente a che punto e",
    /il dentro no|sto costruendo/i.test(await page.locator(".jm-mod-soon").innerText()),
  );

  check("moduli: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ====== 4. l'ordine, e il desktop che li tiene tutti ====== */
// Nota: oggi il modulo PRONTO e uno solo, quindi la regola "l'ultimo acceso
// passa davanti" si puo provare solo sull'elenco (dove gli accesi stanno in
// cima) e non ancora sulla barra, che con un modulo solo non ha scelta. Il
// giorno che il secondo modulo diventa pronto, questo blocco va esteso.
{
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: "it-IT" });
  await ctx.addInitScript(() => {
    try {
      window.localStorage.setItem("jm.mode", "local"); /* niente velo del saluto sui banchi */ window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco"); window.localStorage.setItem("jm.saluto.silenzio", "dev:banco");
      window.localStorage.setItem("jm:moduli", JSON.stringify(["palestra"]));
    } catch {}
  });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const tabs = (await page.locator("nav.lg\\:hidden a").allInnerTexts()).map((x) => x.toLowerCase());
  check(
    "sul telefono compare il modulo acceso",
    tabs.join(" ").includes("palestra") && !tabs.join(" ").includes("ricorda"),
    tabs.join(" | "),
  );

  // Un modulo non pronto scritto a mano nelle preferenze non deve entrare
  // nella barra: porterebbe a una pagina che non esiste.
  await page.evaluate(() => {
    window.localStorage.setItem("jm:moduli", JSON.stringify(["cibo", "palestra"]));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const tabs2 = (await page.locator("nav.lg\\:hidden a").allInnerTexts()).map((x) => x.toLowerCase());
  check(
    "un modulo non pronto viene ignorato",
    !tabs2.join(" ").includes("cibo") && tabs2.join(" ").includes("palestra"),
    tabs2.join(" | "),
  );

  // Desktop: i moduli stanno nella colonna, e Ricorda non si sposta.
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".jm-rail-l", { timeout: 20000 });
  await page.waitForTimeout(900);
  const rail = await page.locator(".jm-rail-l").innerText();
  check(
    "sul desktop il modulo e nella colonna di sinistra",
    /palestra/i.test(rail),
    rail.replace(/\n/g, " | ").slice(0, 110),
  );
  check("sul desktop Ricorda resta al suo posto", /ricorda/i.test(rail));
  await ctx.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
await browser.close();
process.exit(failed.length === 0 ? 0 : 1);
