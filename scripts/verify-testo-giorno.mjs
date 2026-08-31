// Verifica delle due richieste del 20 agosto 2026 (mockup approvato
// design/mockups/testo-e-giorno.html):
//
//  A. DIMENSIONE DEL TESTO. E accessibilita, non una preferenza: Manuel non
//     vede bene. Deve ingrandire DAVVERO, applicarsi PRIMA del primo
//     disegno (o l'app lampeggia piccola e poi salta) e sopravvivere a un
//     reload.
//
//     E soprattutto deve ingrandire SOLO IL TESTO. La prima versione usava
//     `zoom` sulla radice e cresceva tutto insieme, margini compresi: sullo
//     schermo entrava la stessa quantita di parole, solo piu grosse.
//     Manuel l'ha bocciata ("il gap destra e sinistra cambia, volevo solo
//     il font"). Il controllo qui sotto sui margini e la rete che impedisce
//     di tornarci per sbaglio.
//
//  B. IL TASTO NELLA GIORNATA. Prima /giorno era un vicolo cieco: una
//     giornata vuota diceva "vai su Oggi" e una piena non poteva ricevere
//     una riga in piu. Il foglio deve aprirsi, e in modalita locale NON
//     deve mostrare la voce "Racconta a voce" — non spenta: assente.
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

async function open(path, { w = 430, h = 932, scale = null, wait = ".jm-st-group" } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: "it-IT" });
  await ctx.addInitScript(
    ([s]) => {
      try {
        window.localStorage.setItem("jm.mode", "local"); /* niente velo del saluto sui banchi */ window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco"); window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
        if (s) window.localStorage.setItem("jm:scale", String(s));
      } catch {}
    },
    [scale],
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  if (wait) await page.waitForSelector(wait, { timeout: 15000 });
  await page.waitForTimeout(600);
  return { ctx, page, errors };
}

const geometry = (page) =>
  page.evaluate(() => {
    const de = document.documentElement;
    const box = document.querySelector(".jm-st-box") || document.querySelector("main > *");
    const testo = document.querySelector(".jm-st-h1, .jm-day-empty-h, h1");
    const r = box ? box.getBoundingClientRect() : null;
    return {
      zoom: de.style.zoom || "",
      cssScale: getComputedStyle(de).getPropertyValue("--jm-ui-scale").trim(),
      scrollW: de.scrollWidth,
      clientW: de.clientWidth,
      innerH: window.innerHeight,
      // I due numeri che contano: dove comincia il riquadro (margine
      // sinistro) e quanto e largo. Devono restare identici a ogni misura
      // del testo — e la cosa che Manuel ha chiesto.
      boxLeft: r ? Math.round(r.left) : null,
      boxWidth: r ? Math.round(r.width) : null,
      fontTesto: testo ? Math.round(parseFloat(getComputedStyle(testo).fontSize) * 10) / 10 : null,
    };
  });

/* ============ A1. la riga in Impostazioni ============ */
{
  const { ctx, page, errors } = await open("/app/settings");
  const row = page.locator(".jm-st-row", { hasText: "Dimensione del testo" }).first();
  check("la riga esiste in Lingua e aspetto", (await row.count()) === 1);
  check(
    "la riga dice la misura attuale",
    (await row.locator(".jm-st-val").innerText()).trim() === "Normale",
    await row.locator(".jm-st-val").innerText(),
  );
  check("niente zoom sulla radice (si scala il testo, non la pagina)", (await geometry(page)).zoom === "");
  check("Impostazioni: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ A2. il pannello, e il cambio dal vivo ============ */
{
  const { ctx, page, errors } = await open("/app/settings");
  await page.locator(".jm-st-row", { hasText: "Dimensione del testo" }).first().click();
  await page.waitForTimeout(300);

  const rows = page.locator(".jm-st-szrow");
  check("cinque misure fra cui scegliere", (await rows.count()) === 5);

  // Ogni riga e disegnata alla SUA misura: e il punto della schermata.
  const sizes = await rows.evaluateAll((els) =>
    els.map((e) => parseFloat(getComputedStyle(e).fontSize)),
  );
  check(
    "ogni riga e scritta alla misura che rappresenta",
    sizes.every((v, i) => i === 0 || v > sizes[i - 1]),
    sizes.join(" < "),
  );

  // Si misura il rettangolo sullo schermo, non il font-size: lo zoom non
  // cambia il valore scritto nel CSS, cambia quanto e grande davvero.
  const primaAltezza = await page
    .locator(".jm-st-prev-h")
    .evaluate((e) => e.getBoundingClientRect().height);

  // "Molto grande" = quarta riga.
  await rows.nth(3).click();
  await page.waitForTimeout(500);
  const g = await geometry(page);
  check("scegliere si applica subito, senza salvare", g.cssScale === "1.3", g.cssScale);
  check("niente zoom: solo il testo cambia", g.zoom === "");
  // La soglia e legata al passo di PARTENZA: si misura da li fino a 1,3.
  // Con il default a 1 il salto era +30%, con il default a 1,15 (22 agosto
  // 2026) e +13%. Il controllo verifica che l'anteprima cresca davvero,
  // non di quanto: il "quanto" lo decide una costante di prodotto.
  check(
    "l'anteprima cresce insieme all'app",
    (await page
      .locator(".jm-st-prev-h")
      .evaluate((e) => e.getBoundingClientRect().height)) > primaAltezza * 1.08,
  );

  check("niente sbordamento laterale", g.scrollW <= g.clientW + 1, `${g.scrollW}/${g.clientW}`);

  check("cambio misura: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ A3. sopravvive al reload, e senza lampeggiare ============ */
for (const [scala, atteso] of [["1.5", "1.5"], ["0.9", "0.9"]]) {
  const { ctx, page, errors } = await open("/app/settings", { scale: scala });
  const g = await geometry(page);
  check(
    `scala ${scala}: applicata gia al primo disegno`,
    g.cssScale === atteso,
    `var=${g.cssScale}`,
  );
  check(`scala ${scala}: niente sbordamento laterale`, g.scrollW <= g.clientW + 1);
  check(`scala ${scala}: zero errori console`, errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ A4. il testo cresce, i MARGINI NO ============ */
// Questo blocco e la richiesta di Manuel messa in un test.
for (const [w, h, etichetta] of [[430, 932, "telefono"], [1440, 900, "desktop"]]) {
  const misura = async (scale) => {
    const { ctx, page } = await open("/app/settings", { w, h, scale });
    const g = await geometry(page);
    const tab = await page.locator("nav").last().evaluate((e) => {
      const r = e.getBoundingClientRect();
      return { bottom: Math.round(r.bottom), viewport: window.innerHeight };
    });
    await ctx.close();
    return { ...g, tab };
  };
  // Si confrontano i due ESTREMI e non "il default contro il massimo": cosi
  // il controllo non si rompe ogni volta che il passo di partenza cambia.
  const uno = await misura("0.9");
  const max = await misura("1.5");

  check(
    `${etichetta}: da "Molto piccolo" a "Molto grande" il testo cresce davvero`,
    max.fontTesto > uno.fontTesto * 1.4,
    `${uno.fontTesto}px -> ${max.fontTesto}px`,
  );
  check(
    `${etichetta}: il margine sinistro NON cambia`,
    uno.boxLeft === max.boxLeft,
    `${uno.boxLeft}px -> ${max.boxLeft}px`,
  );
  check(
    `${etichetta}: la larghezza del contenuto NON cambia`,
    uno.boxWidth === max.boxWidth,
    `${uno.boxWidth}px -> ${max.boxWidth}px`,
  );
  // La tab bar esiste solo sotto lg: su desktop c'e la rail sinistra.
  if (w < 1024) {
    /* Dal 29 agosto 2026 il dock non e piu incollato al fondo: e una
       pillola SOSPESA (mockup dock-liquid-glass.html). Quello che deve
       restare vero e che non scappa mai via col contenuto — sta in
       fondo allo schermo, a una distanza sua, con poco testo e con
       tanto. */
    const stacco = max.tab.viewport - max.tab.bottom;
    const staccoPoco = uno.tab.viewport - uno.tab.bottom;
    check(
      `${etichetta}: il dock resta sospeso in fondo, sempre alla stessa altezza`,
      stacco >= 8 && stacco <= 48 && Math.abs(stacco - staccoPoco) <= 1,
      `${stacco}px dal fondo con tanto testo, ${staccoPoco}px con poco`,
    );
  }
}

/* ============ A5. anche le altre schermate reggono ============ */
for (const [path, w, h] of [
  ["/app", 430, 932],
  ["/app", 1440, 900],
  ["/app/mese", 430, 932],
  ["/app/remember", 430, 932],
  ["/app/settings", 1440, 900],
]) {
  const { ctx, page, errors } = await open(path, { w, h, scale: "1.3", wait: "main" });
  await page.waitForTimeout(900);
  const g = await geometry(page);
  check(
    `${path} ${w}px a 1,3: niente sbordamento laterale`,
    g.scrollW <= g.clientW + 1,
    `${g.scrollW}/${g.clientW}`,
  );

  check(
    `${path} ${w}px a 1,3: zero errori console`,
    errors.length === 0,
    errors.slice(0, 2).join(" | "),
  );
  await ctx.close();
}

/* ============ B1. il tasto nella giornata vuota ============ */
{
  const { ctx, page, errors } = await open("/app/giorno?d=2026-08-19", { wait: ".jm-day-empty-wrap" });
  check(
    "giornata vuota: non dice piu 'vai su Oggi'",
    !(await page.locator("body").innerText()).includes("Vai su Oggi"),
  );
  check(
    "giornata vuota: c'e un tasto per raccontarla",
    await page.locator(".jm-day-add").isVisible(),
  );
  const box = await page.locator(".jm-day-add").boundingBox();
  check("il tasto e un bersaglio da 44px almeno", box.height >= 44, String(Math.round(box.height)));

  await page.locator(".jm-day-add").click();
  await page.waitForTimeout(350);
  const voci = await page.locator(".jm-sheet-t").allInnerTexts();
  check("il foglio si apre", voci.length >= 2, voci.join(" . "));
  check(
    "in locale la voce non compare (assente, non spenta)",
    !voci.includes("Racconta a voce"),
    voci.join(" . "),
  );
  check(
    "ci sono 'Scrivi altro' e 'Salva in Ricorda'",
    voci.includes("Scrivi altro") && voci.includes("Salva in Ricorda"),
    voci.join(" . "),
  );

  // "Scrivi altro" apre l'editor, e la data resta quella della schermata.
  await page.locator(".jm-sheet-row", { hasText: "Scrivi altro" }).click();
  await page.waitForTimeout(400);
  check("'Scrivi altro' apre l'editor", await page.locator(".jm-editor-textarea").isVisible());

  await page.locator(".jm-editor-textarea").fill("Prova di aggiunta a un giorno passato.");
  await page.locator(".jm-editor-btn.save").click();
  await page.waitForTimeout(1600);
  check(
    "il testo finisce SU QUEL GIORNO e la schermata lo mostra",
    (await page.locator("body").innerText()).includes("Prova di aggiunta"),
  );
  check("giornata: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ B2. e sulla giornata gia raccontata ============ */
{
  const { ctx, page, errors } = await open("/app/giorno?d=2026-08-19", { wait: ".jm-day-empty-wrap" });
  await page.locator(".jm-day-add").click();
  await page.waitForTimeout(300);
  await page.locator(".jm-sheet-row", { hasText: "Scrivi altro" }).click();
  await page.waitForTimeout(300);
  await page.locator(".jm-editor-textarea").fill("Prima riga della giornata.");
  await page.locator(".jm-editor-btn.save").click();
  await page.waitForTimeout(1600);

  check(
    "giornata piena: il tasto c'e ancora, in fondo al racconto",
    await page.locator(".jm-day-add").isVisible(),
  );
  await page.locator(".jm-day-add").click();
  await page.waitForTimeout(300);
  await page.locator(".jm-sheet-row", { hasText: "Scrivi altro" }).click();
  await page.waitForTimeout(300);
  await page.locator(".jm-editor-textarea").fill("Seconda riga, aggiunta dopo.");
  await page.locator(".jm-editor-btn.save").click();
  await page.waitForTimeout(1800);

  await page.locator(".jm-day-head-action").click();
  await page.waitForTimeout(500);
  const testo = await page.locator(".jm-editor-textarea").inputValue();
  check(
    "la seconda aggiunta NON sostituisce la prima",
    testo.includes("Prima riga") && testo.includes("Seconda riga"),
    testo.replace(/\n/g, " | ").slice(0, 120),
  );
  check("aggiunte multiple: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
await browser.close();
process.exit(failed.length === 0 ? 0 : 1);
