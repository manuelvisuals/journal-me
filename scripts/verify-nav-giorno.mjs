// La prova del CAMBIO GIORNO, dentro un browser vero.
//
// Mockup: design/mockups/navigazione-giorno.html (variante A, scelta da
// Manuel il 29 agosto 2026). Qui non si controlla che il codice sia
// scritto giusto: si tocca la freccia e si guarda cosa succede.
//
// La regola che questo banco esiste per difendere: il passato si sfoglia
// senza fondo, il futuro NO. Se un giorno qualcuno toglie il controllo sul
// domani, questo banco deve diventare rosso.
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

/* Le date si contano nel fuso dell'app (Europe/Rome, src/lib/format.ts:57)
   e non in quello della macchina: altrimenti questo banco sarebbe rosso
   solo fra mezzanotte e le due, che e il modo peggiore di essere rosso. */
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
const ALTROIERI = isoApp(2);
const TRE = isoApp(3);

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

/** Tre giornate scritte di fila: cosi sfogliando si vede cambiare il testo. */
const SEED = `
  const req = indexedDB.open("journalme");
  const db = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
  const giorni = [
    ["${IERI}", "la telefonata rimandata"],
    ["${ALTROIERI}", "il giro lungo del canale"],
    ["${TRE}", "niente di speciale"],
  ];
  const tx = db.transaction("entries", "readwrite");
  for (const [data, titolo] of giorni) {
    tx.objectStore("entries").put({
      id: "t-" + data, entryDate: data,
      transcript: "Giornata di prova: " + titolo + ".",
      headline: titolo,
      snippet: "Una riga di sintesi per " + data + ".",
      areas: [
        { label: "Relazioni", text: "Qualcuno, da qualche parte, e una telefonata lunga." },
        { label: "Corpo", text: "Camminata al mattino, poi palestra nel pomeriggio." },
        { label: "Lavoro", text: "Riunione, revisione, e una mail che aspettava da giorni." },
        { label: "Casa", text: "Spesa grossa, cucina sistemata, lavatrice." },
        { label: "Testa", text: "Letto mezz'ora prima di dormire, senza telefono." },
        { label: "Soldi", text: "Pagata la bolletta e messo da parte il resto." },
      ],
      metrics: { mood: null, weightKg: null, sleepHours: null },
      goalsOn: [], people: [], durationSeconds: 0,
      createdAt: new Date(data + "T20:00:00Z").toISOString(),
    });
  }
  await new Promise((res) => { tx.oncomplete = res; });
  db.close();
`;

async function contesto(width = 430, conDito = false) {
  const ctx = await browser.newContext({
    viewport: { width, height: 932 },
    locale: "it-IT",
    hasTouch: conDito,
    isMobile: conDito,
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
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + "/app", { waitUntil: "networkidle" });
  await page.evaluate(`(async () => { ${SEED} })()`);
  return { ctx, page, errors };
}

const rel = (page) => page.locator(".jm-day-nav-rel").first().innerText();
const titolo = (page) => page.locator(".jm-fv-h").first().innerText();

/** Il dito: parte dal centro del riquadro e si sposta di dx. */
async function trascina(page, dx) {
  const box = await page.locator(".jm-day-sw").first().boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(box.height / 2, 300);
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(x + (dx * i) / 12, y + 2);
  await page.mouse.up();
  await page.waitForTimeout(900);
}

/* ============ 1. le frecce, e il muro del futuro ============ */
{
  const { ctx, page, errors } = await contesto();
  await page.goto(`${BASE}/app/giorno?d=${ALTROIERI}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".jm-day-nav-rel", { timeout: 20000 });

  check(
    "la testata dice che giorno stai guardando",
    (await rel(page)).trim().length > 0,
    await rel(page),
  );
  check(
    "e sotto c'e la data esatta",
    (await page.locator(".jm-day-nav-abs").first().innerText()).trim().length > 0,
    await page.locator(".jm-day-nav-abs").first().innerText(),
  );
  check(
    "su un giorno passato la freccia avanti e viva",
    await page.locator(".jm-day-nav-arw").last().isEnabled(),
  );

  const primaTitolo = (await titolo(page)).trim();
  await page.locator(".jm-day-nav-arw").first().click();
  await page.waitForTimeout(600);
  check(
    "la freccia indietro porta al giorno prima: cambia il racconto",
    (await titolo(page)).trim() !== primaTitolo,
    `${primaTitolo} -> ${(await titolo(page)).trim()}`,
  );
  check(
    "e l'indirizzo segue il giorno mostrato",
    page.url().includes(TRE),
    page.url(),
  );
  check(
    "senza cambiare pagina: il riquadro dello scorrimento e sempre lo stesso",
    (await page.locator(".jm-day-sw").count()) === 1,
  );

  // Avanti un giorno alla volta finche non si esce dal passato: da
  // l'altroieri meno uno servono tre passi per arrivare a oggi.
  for (let i = 0; i < 3; i++) {
    await page.locator(".jm-day-nav-arw").last().click();
    await page.waitForTimeout(700);
  }
  check("da ieri, avanti ancora, si arriva su Oggi", page.url().endsWith("/app"), page.url());
  /* Dal 30 agosto 2026 (la barra in alto, scelta di Manuel) su Oggi il
     NOME del giorno lo dice la barra e non la testata: scritto in tutti e
     due era la stessa parola due volte a pochi pixel. La testata tiene la
     data esatta, che la barra non dice. Su /giorno il nome resta nella
     testata, ed e gia provato qui sopra. */
  await page.waitForSelector(".jm-appbar-t", { timeout: 20000 });
  const nellaBarra = (await page.locator(".jm-appbar-t").innerText()).trim();
  check("e Oggi si chiama Oggi: lo dice la barra in alto", nellaBarra.toLowerCase() === "oggi", nellaBarra);
  check(
    "sul telefono la testata non ripete la parola",
    !(await page.locator(".jm-day-nav-rel").first().isVisible()),
  );
  const dataEsatta = await page.locator(".jm-day-nav-abs").first().innerText();
  check("ma la testata dice ancora la data esatta", /\d/.test(dataEsatta), dataEsatta);

  /* IL MURO. Se qualcuno toglie il controllo sul futuro, e questa riga a
     diventare rossa per prima. */
  check(
    "su Oggi la freccia avanti e SPENTA: domani non si apre",
    await page.locator(".jm-day-nav-arw").last().isDisabled(),
  );
  check(
    "spenta, non sparita: la testata non balla",
    (await page.locator(".jm-day-nav-arw").count()) === 2,
  );

  check("nessun errore in console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ 2. il dito ============ */
{
  const { ctx, page, errors } = await contesto();
  await page.goto(`${BASE}/app/giorno?d=${IERI}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".jm-fv-h", { timeout: 20000 });

  const partenza = (await titolo(page)).trim();
  await trascina(page, 160); // verso destra -> il giorno prima
  check(
    "trascinando verso destra arriva il giorno prima",
    (await titolo(page)).trim() !== partenza && page.url().includes(ALTROIERI),
    `${partenza} -> ${(await titolo(page)).trim()} (${page.url()})`,
  );

  await trascina(page, -160); // verso sinistra -> si torna avanti
  check(
    "trascinando verso sinistra si torna avanti",
    page.url().includes(IERI),
    page.url(),
  );

  const fermo = (await titolo(page)).trim();
  await trascina(page, 40); // sotto la soglia: non deve succedere niente
  check(
    "un trascinamento corto non cambia giorno",
    (await titolo(page)).trim() === fermo && page.url().includes(IERI),
    page.url(),
  );

  check("nessun errore in console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ 3. il dito contro il muro ============ */
{
  const { ctx, page, errors } = await contesto();
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
  // Si aspetta la DATA e non il nome: su Oggi, dal 30 agosto 2026, il nome
  // sul telefono e nella barra in alto (vedi il blocco 1).
  await page.waitForSelector(".jm-day-nav-abs", { timeout: 20000 });
  const dove = page.url();

  // Su Oggi il riquadro dello scorrimento c'e solo a giornata raccontata:
  // se non c'e, il muro lo prova comunque la freccia spenta (blocco 1).
  const haRiquadro = (await page.locator(".jm-day-sw").count()) > 0;
  if (haRiquadro) {
    await trascina(page, -160); // verso domani
    check("da Oggi, il dito verso domani non porta da nessuna parte", page.url() === dove, page.url());
    check(
      "e una riga spiega perche",
      (await page.locator(".jm-day-nav-muro.on").count()) === 1 ||
        (await page.locator(".jm-day-nav-muro").first().innerText()).length > 0,
    );
  } else {
    check("da Oggi (giornata non raccontata) il muro e la freccia spenta", true);
  }

  check(
    "e la freccia avanti resta spenta anche dopo il gesto",
    await page.locator(".jm-day-nav-arw").last().isDisabled(),
  );
  check("nessun errore in console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ 4. il dito di lato ferma la pagina ============ */
{
  const { ctx, page, errors } = await contesto();
  await page.goto(`${BASE}/app/giorno?d=${IERI}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".jm-day-sw", { timeout: 20000 });
  await page.waitForTimeout(600);

  const alta = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );
  check("la giornata di prova e abbastanza alta da scorrere", alta > 260, `${Math.round(alta)}px`);

  await page.evaluate(() => window.scrollTo(0, 200));
  await page.waitForTimeout(250);

  const box = await page.locator(".jm-day-sw").first().boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(box.height / 2, 220);
  await page.mouse.move(x, y);
  await page.mouse.down();
  /* Quaranta pixel di lato: il gesto e dichiarato orizzontale. */
  for (let i = 1; i <= 6; i++) await page.mouse.move(x + (40 * i) / 6, y + 1);

  /* Adesso la pagina PROVA a scorrere: non deve riuscirci. E' lo stesso
     tentativo che fa il browser quando il dito non e perfettamente
     dritto — che poi e sempre. */
  const durante = await page.evaluate(async () => {
    window.scrollTo(0, 520);
    await new Promise((r) => setTimeout(r, 150));
    return Math.round(window.scrollY);
  });
  check(
    "mentre il dito va di lato, la pagina resta ferma dov'era",
    durante === 200,
    `pagina a ${durante}, attesa a 200`,
  );

  await page.mouse.up();
  await page.waitForTimeout(700);

  const dopo = await page.evaluate(async () => {
    window.scrollTo(0, 520);
    await new Promise((r) => setTimeout(r, 150));
    return Math.round(window.scrollY);
  });
  check(
    "alzato il dito, la pagina torna a scorrere come sempre",
    dopo > 400,
    `${dopo}`,
  );

  check("nessun errore in console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ 5. lo stesso, ma col DITO vero ============ */
{
  /* Il mouse non scorre la pagina: il blocco col mouse si prova solo
     "chiedendo" alla pagina di scorrere. Col dito invece e il browser a
     volerlo fare, ed e esattamente il fastidio che Manuel ha sentito sul
     telefono. Qui i tocchi sono veri (touchStart/touchMove del motore),
     non simulati col puntatore. */
  const { ctx, page, errors } = await contesto(430, true);
  await page.goto(`${BASE}/app/giorno?d=${IERI}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".jm-day-sw", { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.evaluate(() => window.scrollTo(0, 200));
  await page.waitForTimeout(250);

  const cdp = await ctx.newCDPSession(page);
  const box = await page.locator(".jm-day-sw").first().boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(box.height / 2, 220);

  /* Si ascolta il gesto da FUORI, dopo il componente: cosi si vede se
     ha detto di no allo scorrimento. E' il controllo che conta davvero,
     perche il browser di questa macchina e Chromium e con un gesto cosi
     obliquo non scorre comunque — Safari su iPhone si, ed e li che il
     fastidio si vedeva. Guardare solo "la pagina non si e mossa" qui
     sarebbe un verde regalato. */
  await page.evaluate(() => {
    window.__mosse = [];
    window.addEventListener(
      "touchmove",
      (e) => window.__mosse.push(e.defaultPrevented),
      { passive: true },
    );
  });

  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  /* Un dito umano non e mai dritto: 120px di lato e 40 in giu. E' quel
     "40 in giu" che prima si portava via la pagina. */
  for (let i = 1; i <= 8; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + (120 * i) / 8, y: y + (40 * i) / 8 }],
    });
    await page.waitForTimeout(16);
  }
  const mosse = await page.evaluate(() => window.__mosse || []);
  const dopoLaSoglia = mosse.slice(2);
  check(
    "col dito: il gesto laterale dice di no allo scorrimento della pagina",
    dopoLaSoglia.length > 0 && dopoLaSoglia.every(Boolean),
    `${dopoLaSoglia.filter(Boolean).length} mosse fermate su ${dopoLaSoglia.length}`,
  );
  const durante = await page.evaluate(() => Math.round(window.scrollY));
  check(
    "col dito: e la pagina infatti resta dov'era",
    durante === 200,
    `pagina a ${durante}, attesa a 200`,
  );

  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(900);

  /* E il gesto ha comunque fatto il suo mestiere: siamo al giorno prima. */
  check(
    "col dito: e il giorno e cambiato lo stesso",
    page.url().includes(ALTROIERI),
    page.url(),
  );

  /* Dopo, il dito deve poter scorrere la pagina come sempre. */
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y + 120 }] });
  for (let i = 1; i <= 8; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y + 120 - (140 * i) / 8 }],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(500);
  const scorso = await page.evaluate(() => Math.round(window.scrollY));
  check(
    "col dito: lo scorrimento verticale normale funziona ancora",
    scorso > 0,
    `pagina a ${scorso}`,
  );

  check("nessun errore in console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ Il nome del giorno, "B in serif" (mockup restyling §07,
   scelta di Manuel del 1 settembre 2026): sopra il nome umano col serif
   di prosa, sotto la coordinata SENZA giorno della settimana — mai la
   stessa data scritta due volte, nemmeno per un giorno di mesi fa. ==== */
{
  const { ctx, page } = await contesto();
  /* Un giorno lontano piu di una settimana: prima qui rel e abs erano
     la stessa identica data. */
  const lontano = new Date(Date.now() - 40 * 24 * 3600 * 1000);
  const iso = lontano.toISOString().slice(0, 10);
  await page.goto(BASE + "/app/giorno?d=" + iso, { waitUntil: "networkidle" });
  await page.waitForSelector(".jm-day-nav-rel", { timeout: 20000 });
  const testata = await page.evaluate(() => {
    const r = document.querySelector(".jm-day-nav-rel");
    const a = document.querySelector(".jm-day-nav-abs");
    return {
      rel: r.innerText.trim(),
      abs: a.innerText.trim(),
      font: getComputedStyle(r).fontFamily,
    };
  });
  check(
    "giorno lontano: sopra c'e un NOME, non una data",
    testata.rel.length > 0 && !/\d/.test(testata.rel),
    testata.rel,
  );
  check(
    "e sotto la data si e tolta il cappello (niente giorno della settimana)",
    /^\d{1,2}\s\S+/.test(testata.abs) && testata.rel !== testata.abs,
    testata.abs,
  );
  check(
    "il nome parla col serif di prosa del tema",
    /spectral|newsreader|garamond|palatino|georgia/i.test(testata.font),
    testata.font,
  );
  await ctx.close();
}

await browser.close();

const ok = results.filter((r) => r.ok).length;
console.log(`\n${ok}/${results.length} PASS`);
process.exit(ok === results.length ? 0 : 1);
