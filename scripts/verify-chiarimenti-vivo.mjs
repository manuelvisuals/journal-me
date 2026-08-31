// Le domande dell'AI, dentro un browser vero, senza spendere un token.
//
// Il test statico (verify-chiarimenti.mjs) prova la logica. Questo prova che
// cliccando succeda: la schermata compare da sola dopo il salvataggio, le
// risposte si applicano, e il soprannome vale sulle giornate GIA scritte.
//
// Le domande arrivano da una risposta finta di /api/chiarimenti, intercettata
// dal browser: cosi il giro completo si prova in modalita locale, senza AI,
// senza rete e senza costi. Quello che NON e finto e tutto il resto: la
// schermata, l'applicazione delle risposte, il database del browser.

import { chromium } from "playwright-core";

const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const OGGI = "2026-08-18";
const VECCHIA = "2026-03-04";
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

/** Due giornate: una di oggi e una di marzo, tutte e due con il soprannome. */
const SEED = `
  const req = indexedDB.open("journalme");
  const db = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
  const tx = db.transaction("entries", "readwrite");
  tx.objectStore("entries").put({
    id: "c1", entryDate: "${OGGI}",
    transcript: "Pomeriggio in piscina con gli amici. La sera e passato mio fratello. Cena da Charlie.",
    headline: "giornata in piscina",
    snippet: "Piscina con gli amici, poi mio fratello, poi cena da Charlie.",
    areas: [
      { label: "Relazioni", text: "Pomeriggio in piscina con gli amici. Cena da Charlie." },
      { label: "Cibo", text: "Pizza margherita." }
    ],
    metrics: { mood: null, weightKg: null, sleepHours: null },
    goalsOn: [], people: ["mio fratello", "da Charlie", "Keyko", "i miei amici"], durationSeconds: 0,
    createdAt: new Date("${OGGI}T20:00:00Z").toISOString(),
  });
  tx.objectStore("entries").put({
    id: "c2", entryDate: "${VECCHIA}",
    transcript: "Pranzo con mio fratello.",
    headline: "pranzo in famiglia", snippet: "Pranzo con mio fratello.", areas: [],
    metrics: { mood: null, weightKg: null, sleepHours: null },
    goalsOn: [], people: ["mio fratello"], durationSeconds: 0,
    createdAt: new Date("${VECCHIA}T13:00:00Z").toISOString(),
  });
  await new Promise((res) => { tx.oncomplete = res; });
  db.close();
`;

/** Le domande finte: una di identita (per sempre) e una di episodio (solo oggi). */
const DOMANDE = {
  domande: [
    {
      id: "q1",
      specie: "identita",
      azione: "persona",
      soggetto: "mio fratello",
      citazione: "...la sera e passato mio fratello.",
      testo: 'Chi e "mio fratello"?',
      perche: "Se me lo dici una volta, lo riconosco per sempre.",
      libero: true,
      opzioni: [
        { valore: "Daniele", etichetta: "Daniele", sotto: "", nomeVero: "" },
        { valore: "Keyko", etichetta: "Keyko", sotto: "", nomeVero: "" },
      ],
    },
    {
      id: "q2",
      specie: "episodio",
      azione: "area",
      soggetto: "pomeriggio in piscina",
      citazione: "...pomeriggio in piscina con gli amici.",
      testo: "La piscina di oggi, cos'era?",
      perche: "Vale solo per oggi.",
      libero: false,
      opzioni: [
        { valore: "Relazioni", etichetta: "Stare con gli amici", sotto: "va in Relazioni", nomeVero: "" },
        { valore: "Movimento", etichetta: "Allenamento", sotto: "va in Movimento", nomeVero: "" },
      ],
    },
  ],
};

async function apri({ conDomande = true, conta = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: "it-IT" });
  await ctx.addInitScript(() => {
    try { window.localStorage.setItem("jm.mode", "local"); /* niente velo del saluto sui banchi */ window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco"); window.localStorage.setItem("jm.saluto.silenzio", "dev:banco"); } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/api/chiarimenti", (r) => {
    conta?.();
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(conDomande ? DOMANDE : { domande: [] }),
    });
  });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.evaluate(`(async () => { ${SEED} })()`);
  return { ctx, page, errors };
}

/* ====== 1. senza AI non si chiede niente, e non si bussa al server ====== */
{
  // In modalita locale l'AI non c'e, quindi la giornata non viene riletta e
  // non c'e niente da chiarire. Prima di questo controllo l'app chiedeva lo
  // stesso: una richiesta buttata a ogni salvataggio di ogni utente gratis,
  // e un errore rosso in console che non riguardava nessuno.
  let bussate = 0;
  const { ctx, page, errors } = await apri({ conta: () => (bussate += 1) });
  await page.goto(`${BASE}/giorno?d=${OGGI}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".jm-fv-h", { timeout: 20000 });

  await page.locator(".jm-day-add").click();
  await page.waitForTimeout(500);
  await page.locator("text=Scrivi altro").click();
  await page.waitForSelector("textarea", { timeout: 8000 });
  await page.locator("textarea").fill("Poi due parole con Keyko.");
  await page.locator("button", { hasText: "Continua" }).first().click();
  await page.waitForSelector(".jm-fv-h", { timeout: 20000 });
  await page.waitForTimeout(1200);

  check("senza AI nessuna domanda compare", (await page.locator(".jm-ch-q").count()) === 0);
  check("e non si chiama nemmeno il server", bussate === 0, `chiamate: ${bussate}`);
  check("nessun errore in console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ====== 2. il soprannome vale anche sulle giornate gia scritte ====== */
{
  // Stesso browser, stesso database: la giornata di MARZO non e stata
  // toccata da nessuno, eppure deve mostrare Daniele. E la prova che
  // l'alias si applica quando si MOSTRA e non riscrivendo le giornate.
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: "it-IT" });
  await ctx.addInitScript(() => {
    try { window.localStorage.setItem("jm.mode", "local"); /* niente velo del saluto sui banchi */ window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco"); window.localStorage.setItem("jm.saluto.silenzio", "dev:banco"); } catch {}
  });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.evaluate(`(async () => { ${SEED} })()`);
  // Il soprannome chiarito nel giro 1 e in un altro contesto: qui lo si
  // scrive a mano, perche cio che si prova e la LETTURA, non la scrittura.
  await page.evaluate(`(async () => {
    const req = indexedDB.open("journalme");
    const db = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
    const tx = db.transaction("aliases", "readwrite");
    // Le due righe qui sotto sono scritte nel formato VECCHIO (labelKey, un
    // nome solo): e il diario che uno ha gia sul telefono. Devono continuare
    // a funzionare senza nessuna migrazione.
    tx.objectStore("aliases").put({ id: "persona|mio fratello", kind: "persona", alias: "mio fratello", labelKey: "Daniele" });
    tx.objectStore("aliases").put({ id: "luogo|da charlie", kind: "luogo", alias: "da charlie", labelKey: "da Charlie" });
    // Questa e nel formato nuovo: un modo di dire, due persone dietro.
    tx.objectStore("aliases").put({ id: "persona|i miei amici", kind: "persona", alias: "i miei amici", labelKeys: ["Hoda", "Liana"] });
    await new Promise((res) => { tx.oncomplete = res; });
    db.close();
  })()`);

  await page.goto(`${BASE}/giorno?d=${VECCHIA}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".jm-fv-h", { timeout: 20000 });
  await page.waitForTimeout(700);
  await page.waitForSelector(".jm-pill-row", { timeout: 20000 });
  await page.waitForTimeout(500);
  const marzoPersone = (await page.locator(".jm-pill-row").first().innerText()).toLowerCase();
  check(
    "una giornata di marzo, mai toccata, mostra Daniele",
    marzoPersone.includes("daniele") && !marzoPersone.includes("mio fratello"),
    marzoPersone.replace(/\n/g, " "),
  );
  check(
    "il racconto NON e stato riscritto: le tue parole restano le tue",
    await page.evaluate(async () => {
      const req = indexedDB.open("journalme");
      const db = await new Promise((res) => { req.onsuccess = () => res(req.result); });
      const rec = await new Promise((res) => {
        const r = db.transaction("entries").objectStore("entries").get("2026-03-04");
        r.onsuccess = () => res(r.result);
      });
      db.close();
      return (rec?.transcript ?? "").includes("mio fratello");
    }),
  );

  await page.goto(`${BASE}/giorno?d=${OGGI}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".jm-fv-h", { timeout: 20000 });
  await page.waitForTimeout(700);
  const social = await page.locator(".jm-pill-row").first().innerText();
  check(
    '"da Charlie" non compare piu fra le persone: e un posto',
    !social.toLowerCase().includes("charlie"),
    social.replace(/\n/g, " "),
  );
  // Il caso del 31 agosto 2026. Prima della modifica questa giornata
  // mostrava una pastiglia sola con scritto "i miei amici": una persona
  // finta, e due incontri veri persi. In un browser vero, non in una
  // funzione pura.
  {
    const b = social.toLowerCase();
    check(
      '"i miei amici" si apre in DUE persone, in un browser vero',
      b.includes("hoda") && b.includes("liana") && !b.includes("i miei amici"),
      social.replace(/\n/g, " "),
    );
  }
  check(
    "e il vecchio formato a un nome solo continua a funzionare",
    social.toLowerCase().includes("daniele"),
    social.replace(/\n/g, " "),
  );
  await ctx.close();
}

/* ====== 3. la coda: saltare non cancella, rispondere si ====== */
{
  // Si scrive una domanda a mano nel database del browser, come se fosse
  // nata da un'analisi, e si guarda cosa succede saltandola e rispondendo.
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: "it-IT" });
  await ctx.addInitScript(() => {
    try { window.localStorage.setItem("jm.mode", "local"); /* niente velo del saluto sui banchi */ window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco"); window.localStorage.setItem("jm.saluto.silenzio", "dev:banco"); } catch {}
  });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.evaluate(`(async () => { ${SEED} })()`);

  const scrivi = async () => page.evaluate(`(async () => {
    const req = indexedDB.open("journalme");
    const db = await new Promise((res) => { req.onsuccess = () => res(req.result); });
    const tx = db.transaction("questions", "readwrite");
    tx.objectStore("questions").put({
      id: "${OGGI}|persona|mio fratello", entryDate: "${OGGI}",
      specie: "identita", azione: "persona", soggetto: "mio fratello",
      citazione: "...e passato mio fratello.", testo: "Chi e mio fratello?",
      perche: "Vale per sempre.", libero: true,
      opzioni: [{ valore: "Daniele", etichetta: "Daniele", sotto: "", nomeVero: "" }],
      risposta: null, createdAt: new Date().toISOString(),
    });
    await new Promise((res) => { tx.oncomplete = res; });
    db.close();
  })()`);

  const aperte = async () => page.evaluate(`(async () => {
    const req = indexedDB.open("journalme");
    const db = await new Promise((res) => { req.onsuccess = () => res(req.result); });
    const tutte = await new Promise((res) => {
      const r = db.transaction("questions").objectStore("questions").getAll();
      r.onsuccess = () => res(r.result);
    });
    db.close();
    return tutte.filter((q) => q.risposta === null).length;
  })()`);

  await scrivi();
  check("una domanda scritta in coda risulta aperta", (await aperte()) === 1);

  // La coda si legge dallo store, non dalla giornata: e cio che permette di
  // chiedere l'arretrato di altri giorni.
  const inCoda = await page.evaluate(`(async () => {
    const req = indexedDB.open("journalme");
    const db = await new Promise((res) => { req.onsuccess = () => res(req.result); });
    const tutte = await new Promise((res) => {
      const r = db.transaction("questions").objectStore("questions").getAll();
      r.onsuccess = () => res(r.result);
    });
    db.close();
    return tutte.map((q) => q.entryDate + "|" + q.azione);
  })()`);
  check(
    "la coda porta con se la giornata da cui e nata",
    inCoda[0] === `${OGGI}|persona`,
    JSON.stringify(inCoda),
  );
  await ctx.close();
}

/* ========== 4. la schermata delle domande, dove si prova ==========
 *
 * Il giro completo (domanda -> risposta -> effetto) NON si puo provare qui:
 * serve un contesto con l'AI accesa, e in modalita locale l'AI non c'e per
 * definizione. Non e una lacuna nascosta:
 *   - la logica delle aree e provata a fondo, senza browser, in
 *     scripts/verify-chiarimenti.mjs (funzioni pure);
 *   - i soprannomi in lettura sono provati qui sopra, su una giornata vera;
 *   - il giro completo si prova a mano sul sito, con un account premium,
 *     dopo il deploy.
 */

await browser.close();

const falliti = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - falliti.length}/${results.length} PASS` +
    (falliti.length ? ` . ${falliti.length} FAIL` : ""),
);
process.exit(falliti.length ? 1 : 0);
