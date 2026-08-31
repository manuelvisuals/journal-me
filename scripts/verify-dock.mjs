// La prova del DOCK DI VETRO, dentro un browser vero.
//
// Mockup: design/mockups/dock-liquid-glass.html (variante A, bolla
// "lente", scelte da Manuel il 29 agosto 2026).
//
// Il dock e l'unico pezzo che TUTTE le schermate montano: un errore qui
// non si vede in un posto, si vede ovunque. Per questo il banco guarda
// quattro cose che, se si rompono, rompono l'app e non solo il disegno:
//   1. la pillola e sospesa (staccata dal fondo e dai lati);
//   2. ogni bersaglio e almeno 44x44 (brandbook cap.05);
//   3. la bolla sta sul tasto acceso, misurata, e si sposta cambiando
//      schermata;
//   4. il contenuto NON resta sepolto sotto il vetro.
//
// Gira in modalita locale: non tocca il database vero e non chiama l'AI.

import { chromium } from "playwright-core";

const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const TEMI = ["minimal", "wine", "carta", "malva", "macchina"];

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

/**
 * Aspetta che la bolla si fermi, invece di contare fino a un secondo e
 * mezzo e sperare. Serve perche il viaggio passa di mano: cambiando
 * schermata il dock viene costruito due volte (scheletro di caricamento
 * e schermata vera), quindi la fine del movimento non arriva a un tempo
 * fisso dal tocco ma dipende da quanto ci mette a montare la pagina.
 */
async function bollaFerma(page, maxMs = 6000) {
  const inizio = Date.now();
  let ultimo = null;
  let uguali = 0;
  while (Date.now() - inizio < maxMs) {
    const x = await page.evaluate(() => {
      const b = document.querySelector(".jm-dock-bolla");
      return b ? Math.round(b.getBoundingClientRect().left) : null;
    });
    uguali = x !== null && x === ultimo ? uguali + 1 : 0;
    ultimo = x;
    if (uguali >= 3) return true;
    await page.waitForTimeout(70);
  }
  return false;
}

async function contesto({ tema = "minimal", aspetto = "light" } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "it-IT",
    colorScheme: aspetto,
  });
  await ctx.addInitScript(
    ([t, a]) => {
      try {
        window.localStorage.setItem("jm.mode", "local");
        window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
        window.localStorage.setItem("jm.saluto.silenzio", "dev:banco");
        window.localStorage.setItem("jm:theme", t);
        window.localStorage.setItem("jm:appearance", a);
      } catch {}
    },
    [tema, aspetto],
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  return { ctx, page, errors };
}

/* ============ 1. sospesa, e con i bersagli giusti ============ */
{
  const { ctx, page, errors } = await contesto();
  await page.goto(BASE + "/app", { waitUntil: "networkidle" });
  await page.waitForSelector(".jm-dock", { timeout: 20000 });
  await page.waitForTimeout(500);

  const misure = await page.evaluate(() => {
    const dock = document.querySelector(".jm-dock");
    const r = dock.getBoundingClientRect();
    return {
      sotto: window.innerHeight - r.bottom,
      sinistra: r.left,
      destra: window.innerWidth - r.right,
      largo: r.width,
      centrata: Math.abs(r.left - (window.innerWidth - r.right)) < 2,
    };
  });
  check(
    "la pillola e staccata dal fondo",
    misure.sotto >= 10,
    `${Math.round(misure.sotto)}px sotto`,
  );
  check(
    "ed e staccata dai lati, centrata",
    misure.sinistra >= 12 && misure.centrata,
    `${Math.round(misure.sinistra)}px a sinistra`,
  );

  const piccoli = await page.evaluate(() => {
    const fuori = [];
    for (const el of document.querySelectorAll(".jm-dock-t, .jm-dock-mic")) {
      const r = el.getBoundingClientRect();
      if (r.width < 44 || r.height < 44) {
        fuori.push(`${el.className} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    return fuori;
  });
  check(
    "ogni bersaglio del dock e almeno 44x44",
    piccoli.length === 0,
    piccoli.join(", "),
  );

  const vetro = await page.evaluate(() => {
    const s = getComputedStyle(document.querySelector(".jm-dock"));
    return {
      filtro: s.backdropFilter || s.webkitBackdropFilter,
      fondo: s.backgroundColor,
    };
  });
  check(
    "il vetro c'e davvero: sfocatura e saturazione",
    /blur/.test(vetro.filtro) && /saturate/.test(vetro.filtro),
    vetro.filtro,
  );
  check(
    "e sotto il vetro c'e un velo, non il vuoto",
    vetro.fondo !== "rgba(0, 0, 0, 0)" && vetro.fondo !== "transparent",
    vetro.fondo,
  );

  check("nessun errore in console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ 2. la bolla: misurata, non calcolata ============ */
{
  const { ctx, page, errors } = await contesto();
  await page.goto(BASE + "/app", { waitUntil: "networkidle" });
  await page.waitForSelector(".jm-dock-bolla", { timeout: 20000 });
  await page.waitForTimeout(700);

  const combacia = await page.evaluate(() => {
    const b = document.querySelector(".jm-dock-bolla").getBoundingClientRect();
    const acceso = document.querySelector(".jm-dock-t.on").getBoundingClientRect();
    return { dx: Math.abs(b.left - acceso.left), dw: Math.abs(b.width - acceso.width) };
  });
  check(
    "la bolla sta esattamente sul tasto acceso",
    combacia.dx <= 2 && combacia.dw <= 2,
    `scarto ${combacia.dx.toFixed(1)}px, larghezza ${combacia.dw.toFixed(1)}px`,
  );

  const prima = await page.evaluate(
    () => document.querySelector(".jm-dock-bolla").getBoundingClientRect().left,
  );
  await page.locator(".jm-dock-t").nth(1).click();
  const arrivata = await bollaFerma(page);
  check("la bolla si ferma (non resta a mezz'aria)", arrivata);
  const dopo = await page.evaluate(
    () => document.querySelector(".jm-dock-bolla").getBoundingClientRect().left,
  );
  check(
    "cambiando schermata la bolla viaggia fino al tasto nuovo",
    Math.abs(dopo - prima) > 20,
    `${Math.round(prima)} -> ${Math.round(dopo)}`,
  );
  const combacia2 = await page.evaluate(() => {
    const b = document.querySelector(".jm-dock-bolla").getBoundingClientRect();
    const acceso = document.querySelector(".jm-dock-t.on").getBoundingClientRect();
    return Math.abs(b.left - acceso.left);
  });
  check("e arriva precisa, non a occhio", combacia2 <= 2, `${combacia2.toFixed(1)}px`);

  check("nessun errore in console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ 3. il contenuto non resta sepolto ============ */
{
  const { ctx, page, errors } = await contesto();
  /* Impostazioni e non Mese: il Mese e una lista senza fine (scendendo
     nascono altri mesi), e "arrivare in fondo" li non vuol dire niente. */
  await page.goto(BASE + "/app/settings", { waitUntil: "networkidle" });
  await page.waitForSelector(".jm-dock", { timeout: 20000 });
  await page.waitForTimeout(600);

  /* LARGA COME I RIQUADRI (29 agosto 2026). Non "abbastanza larga": la
     STESSA misura del contenuto della schermata, bordo per bordo. Se un
     giorno la colonna cambia larghezza e il dock no, e qui che si vede. */
  const allineata = await page.evaluate(() => {
    const dock = document.querySelector(".jm-dock").getBoundingClientRect();
    const box = document.querySelector(".jm-st-box").getBoundingClientRect();
    return {
      dsx: Math.round(dock.left),
      dw: Math.round(dock.width),
      rsx: Math.round(box.left),
      rw: Math.round(box.width),
    };
  });
  check(
    "la pillola e larga come i riquadri della pagina, e allineata a loro",
    Math.abs(allineata.dsx - allineata.rsx) <= 1 &&
      Math.abs(allineata.dw - allineata.rw) <= 1,
    `dock ${allineata.dw}px da ${allineata.dsx}, riquadro ${allineata.rw}px da ${allineata.rsx}`,
  );

  const spazio = await page.evaluate(() => {
    const s = document.querySelector(".jm-dock-spazio");
    const d = document.querySelector(".jm-dock").getBoundingClientRect();
    return { alto: s ? s.getBoundingClientRect().height : 0, dock: d.height };
  });
  check(
    "il dock si porta dietro il suo spazio",
    spazio.alto >= spazio.dock + 20,
    `${Math.round(spazio.alto)}px di spazio per ${Math.round(spazio.dock)}px di pillola`,
  );

  const inFondo = await page.evaluate(async () => {
    /* Si scende finche non si smette di scendere. */
    let fermo = -1;
    for (let i = 0; i < 8 && fermo !== window.scrollY; i++) {
      fermo = window.scrollY;
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise((r) => setTimeout(r, 300));
    }
    const dock = document.querySelector(".jm-dock").getBoundingClientRect();
    /* L'ultima cosa VERA della pagina: si cerca il testo piu in basso,
       saltando il dock e il suo spazio. Guardare il vicino dello spazio
       non basta — puo essere un contenitore vuoto alto zero, e il banco
       passerebbe senza aver guardato niente. */
    let piuGiu = 0;
    let chi = "";
    for (const el of document.querySelectorAll("main *")) {
      if (el.closest(".jm-dock-wrap") || el.classList.contains("jm-dock-spazio")) continue;
      if (el.children.length > 0) continue; // solo le foglie: il testo vero
      const testo = (el.textContent || "").trim();
      if (!testo) continue;
      const r = el.getBoundingClientRect();
      if (r.height === 0) continue;
      if (r.bottom > piuGiu) {
        piuGiu = r.bottom;
        chi = testo.slice(0, 24);
      }
    }
    return { piuGiu, chi, dockTop: dock.top };
  });
  check(
    "arrivati in fondo, l'ultima riga non e nascosta dal vetro",
    inFondo.piuGiu > 0 && inFondo.piuGiu <= inFondo.dockTop + 1,
    `"${inFondo.chi}" finisce a ${Math.round(inFondo.piuGiu)}, il vetro comincia a ${Math.round(inFondo.dockTop)}`,
  );

  check("nessun errore in console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ 4. tutti i temi, chiaro e scuro ============ */
for (const tema of TEMI) {
  for (const aspetto of ["light", "dark"]) {
    const { ctx, page, errors } = await contesto({ tema, aspetto });
    await page.goto(BASE + "/app", { waitUntil: "networkidle" });
    await page.waitForSelector(".jm-dock", { timeout: 20000 });
    await page.waitForTimeout(400);
    const stato = await page.evaluate(() => {
      const dock = getComputedStyle(document.querySelector(".jm-dock"));
      const acceso = document.querySelector(".jm-dock-t.on");
      const spento = document.querySelector(".jm-dock-t:not(.on)");
      const bolla = getComputedStyle(document.querySelector(".jm-dock-bolla"));
      return {
        velo: dock.backgroundColor,
        bordo: dock.borderTopColor,
        acceso: acceso ? getComputedStyle(acceso).color : null,
        spento: spento ? getComputedStyle(spento).color : null,
        lente: bolla.backgroundImage,
      };
    });
    const trasparente = (v) => !v || v === "rgba(0, 0, 0, 0)" || v === "transparent";
    check(
      `${tema}/${aspetto}: il vetro ha velo, bordo e lente`,
      !trasparente(stato.velo) &&
        !trasparente(stato.bordo) &&
        stato.lente !== "none" &&
        !/transparent, transparent/.test(stato.lente),
      `velo ${stato.velo}`,
    );
    check(
      `${tema}/${aspetto}: il tasto acceso si distingue da quelli spenti`,
      stato.acceso !== null && stato.acceso !== stato.spento,
      `${stato.acceso} contro ${stato.spento}`,
    );
    check(
      `${tema}/${aspetto}: nessun errore in console`,
      errors.length === 0,
      errors.slice(0, 1).join(" | "),
    );
    await ctx.close();
  }
}

await browser.close();

const ok = results.filter((r) => r.ok).length;
console.log(`\n${ok}/${results.length} PASS`);
process.exit(ok === results.length ? 0 : 1);
