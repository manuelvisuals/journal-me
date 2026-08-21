// Verifica delle due richieste del 20 agosto 2026 (mockup approvato
// design/mockups/testo-e-giorno.html):
//
//  A. DIMENSIONE DELL'INTERFACCIA. E accessibilita, non una preferenza:
//     Manuel non vede bene. Quindi non basta che "cambi qualcosa" — deve
//     ingrandire DAVVERO, applicarsi PRIMA del primo disegno (o l'app
//     lampeggia piccola e poi salta), sopravvivere a un reload, e
//     soprattutto NON rompere il layout: e il rischio vero dello zoom, ed
//     e per questo che 100dvh e diventato calc(100dvh / scala).
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
        window.localStorage.setItem("jm.mode", "local");
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
    const screen = document.querySelector(".jm-screen");
    const zoom = Number(de.style.zoom || 1);
    return {
      zoom: de.style.zoom || "",
      cssScale: getComputedStyle(de).getPropertyValue("--jm-ui-scale").trim(),
      scrollW: de.scrollWidth,
      clientW: de.clientWidth,
      innerH: window.innerHeight,
      // Il difetto vero dello zoom sta QUI e non nell'altezza della
      // pagina: una pagina lunga scorre di suo, ed e giusto. Il bug era
      // che `min-height: 100dvh` dentro una radice zoomata valeva
      // 100dvh * zoom, cioe una schermata piena piu un pezzo. Si misura
      // il min-height calcolato e lo si confronta con lo schermo diviso
      // lo zoom: e esattamente cio che scrive .jm-screen.
      minH: screen ? parseFloat(getComputedStyle(screen).minHeight) : null,
      atteso: Math.round(window.innerHeight / zoom),
    };
  });

/* ============ A1. la riga in Impostazioni ============ */
{
  const { ctx, page, errors } = await open("/settings");
  const row = page.locator(".jm-st-row", { hasText: "Dimensione del testo" }).first();
  check("la riga esiste in Lingua e aspetto", (await row.count()) === 1);
  check(
    "la riga dice la misura attuale",
    (await row.locator(".jm-st-val").innerText()).trim() === "Normale",
    await row.locator(".jm-st-val").innerText(),
  );
  check("nessuno zoom quando la misura e Normale", (await geometry(page)).zoom === "");
  check("Impostazioni: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ A2. il pannello, e il cambio dal vivo ============ */
{
  const { ctx, page, errors } = await open("/settings");
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
  check("scegliere applica lo zoom subito, senza salvare", g.zoom === "1.3", g.zoom);
  check("la variabile CSS segue lo zoom", g.cssScale === "1.3", g.cssScale);
  check(
    "l'anteprima cresce insieme all'app",
    (await page
      .locator(".jm-st-prev-h")
      .evaluate((e) => e.getBoundingClientRect().height)) > primaAltezza * 1.2,
  );

  check(
    "100dvh corretto: la schermata resta alta uno schermo, non uno e un quarto",
    g.minH !== null && Math.abs(g.minH - g.atteso) <= 2,
    `minHeight=${g.minH} atteso=${g.atteso}`,
  );
  check("niente sbordamento laterale", g.scrollW <= g.clientW + 1, `${g.scrollW}/${g.clientW}`);

  check("cambio misura: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ A3. sopravvive al reload, e senza lampeggiare ============ */
for (const [scala, atteso] of [["1.5", "1.5"], ["0.9", "0.9"]]) {
  const { ctx, page, errors } = await open("/settings", { scale: scala });
  const g = await geometry(page);
  check(
    `scala ${scala}: applicata gia al primo disegno`,
    g.zoom === atteso && g.cssScale === atteso,
    `zoom=${g.zoom} var=${g.cssScale}`,
  );
  check(
    `scala ${scala}: 100dvh corretto`,
    g.minH !== null && Math.abs(g.minH - g.atteso) <= 2,
    `minHeight=${g.minH} atteso=${g.atteso}`,
  );
  check(`scala ${scala}: niente sbordamento laterale`, g.scrollW <= g.clientW + 1);
  check(`scala ${scala}: zero errori console`, errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ A4. il testo cresce DAVVERO, e la tab bar resta in fondo ============ */
{
  const misura = async (scale) => {
    const { ctx, page } = await open("/settings", { scale });
    const px = await page
      .locator(".jm-st-h1")
      .evaluate((e) => e.getBoundingClientRect().height);
    const tab = await page.locator("nav").last().evaluate((e) => {
      const r = e.getBoundingClientRect();
      return { bottom: Math.round(r.bottom), viewport: window.innerHeight };
    });
    await ctx.close();
    return { px, tab };
  };
  const a = await misura(null);
  const b = await misura("1.5");
  check(
    "a Massimo il titolo e davvero piu grande sullo schermo",
    b.px > a.px * 1.35,
    `${Math.round(a.px)}px -> ${Math.round(b.px)}px`,
  );
  check(
    "la tab bar resta incollata in fondo anche a Massimo",
    Math.abs(b.tab.bottom - b.tab.viewport) <= 2,
    `${b.tab.bottom}/${b.tab.viewport}`,
  );
}

/* ============ A5. anche le altre schermate reggono ============ */
for (const [path, w, h] of [
  ["/", 430, 932],
  ["/", 1440, 900],
  ["/mese", 430, 932],
  ["/remember", 430, 932],
  ["/settings", 1440, 900],
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
    `${path} ${w}px a 1,3: 100dvh corretto`,
    g.minH === null || Math.abs(g.minH - g.atteso) <= 2,
    `minHeight=${g.minH} atteso=${g.atteso}`,
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
  const { ctx, page, errors } = await open("/giorno?d=2026-08-19", { wait: ".jm-day-empty-wrap" });
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
  const { ctx, page, errors } = await open("/giorno?d=2026-08-19", { wait: ".jm-day-empty-wrap" });
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
