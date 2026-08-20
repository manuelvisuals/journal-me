// Verifica dei fix del 20 agosto 2026:
//  1. il mic della cattura rapida in Ricorda e dietro can("voice") — in
//     modalita locale apriva la registrazione e mandava l'audio a
//     /api/transcribe-fallback, rompendo la promessa "nemmeno una richiesta";
//  2. il titolo della pagina dice "Ricorda", non "Remember";
//  3. /benvenuto mostra il prezzo da src/lib/pricing.ts e NON promette piu
//     un primo mese incluso che il checkout Stripe non prevede;
//  4. da lg gli editor a schermo intero (Modifica transcript, Rileggi,
//     Modifica recap) non sono piu una card di 480px centrata: margini
//     fissi 28px, dentro si allargano, con un bordo visibile e senza il
//     focus ring che disegnava un rettangolo attorno al testo;
// Il quarto fix di giornata (clearPlanCache al logout) NON e qui: il
// bottone Esci esiste solo con una sessione cloud vera e questo harness
// gira senza account, quindi resta verificato leggendo il codice invece
// che con un test finto.
//
// Serve il dev server su :3100 (npm run dev -- -p 3100).
import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3100";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

async function newPage(width, height, { local = true } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    locale: "it-IT",
    permissions: ["microphone"],
  });
  if (local) {
    await ctx.addInitScript(() => {
      try { window.localStorage.setItem("jm.mode", "local"); } catch {}
    });
  }
  const page = await ctx.newPage();
  const errors = [];
  const external = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("request", (r) => {
    const u = r.url();
    if (!u.startsWith(BASE) && !u.startsWith("data:") && !u.startsWith("blob:")) external.push(u);
  });
  return { ctx, page, errors, external };
}

/* ============ 1-2. Ricorda: mic dietro il muro, titolo italiano ============ */
for (const [label, w, h] of [["desktop", 1440, 900], ["phone", 430, 932]]) {
  const { ctx, page, errors, external } = await newPage(w, h);
  await page.goto(BASE + "/remember", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  check(
    `${label}: titolo "Ricorda"`,
    (await page.locator(".jm-rem-h").innerText()).trim() === "Ricorda",
  );

  // Il mic della quick capture NON deve aprire la registrazione in locale.
  await page.locator('[aria-label="Aggiungi con voce"]').click();
  await page.waitForTimeout(500);
  check(
    `${label}: mic Ricorda apre il muro premium`,
    await page.locator(".jm-wall").isVisible(),
  );
  check(
    `${label}: muro con il titolo della voce`,
    (await page.locator(".jm-wall-t").innerText().catch(() => "")).includes("raccontare a voce"),
  );
  check(
    `${label}: nessun overlay di registrazione aperto`,
    (await page.locator(".rec-ptt").count()) === 0,
  );

  // "non ora" chiude e lascia il campo di testo usabile: uscita gratuita.
  await page.locator(".jm-wall .btn-ghost").click();
  await page.waitForTimeout(300);
  check(
    `${label}: 'non ora' chiude il muro`,
    (await page.locator(".jm-wall").count()) === 0,
  );
  await page.locator('.jm-qc-card input').fill("nota scritta a mano");
  await page.locator('[aria-label="Aggiungi"]').click();
  await page.waitForTimeout(800);
  check(
    `${label}: la nota si salva lo stesso`,
    (await page.locator(".jm-rem-text").first().innerText()).includes("nota scritta a mano"),
  );

  check(`${label}: ZERO richieste esterne`, external.length === 0, external.slice(0, 3).join(" "));
  check(`${label}: zero errori console`, errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ 3. /benvenuto: prezzo onesto ============ */
{
  const { ctx, page, errors } = await newPage(430, 932, { local: false });
  await page.goto(BASE + "/benvenuto", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const price = (await page.locator(".jm-benv-price").innerText()).trim();
  check("benvenuto: prezzo 4,99 EUR al mese", /4,99\s*€\s*al mese/.test(price), price);
  check("benvenuto: niente 'primo mese incluso'", !/primo mese/i.test(price), price);
  check("benvenuto: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ 4. editor a schermo intero fluidi da lg ============ */
{
  const { ctx, page, errors } = await newPage(2600, 1419);
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.locator(".jm-ed-ta").click();
  await page.keyboard.type("Riga uno.\n\nRiga due del racconto di prova.");
  await page.keyboard.press("Control+Enter");
  await page.waitForTimeout(2000);
  await page.locator("header button", { hasText: "originale" }).click();
  await page.waitForTimeout(700);

  const geo = await page.evaluate(() => {
    const b = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width) }; };
    const ta = document.querySelector(".jm-editor-textarea");
    return {
      card: b(".jm-editor-card"),
      ta: b(".jm-editor-textarea"),
      vw: window.innerWidth,
      outlineWidth: ta ? getComputedStyle(ta).outlineWidth : null,
      cardBorder: (() => { const c = document.querySelector(".jm-editor-card"); return c ? getComputedStyle(c).borderTopWidth : null; })(),
    };
  });
  check(
    "modale: margini fissi 28px e larghezza fluida",
    geo.card.l === 28 && geo.card.w === geo.vw - 56,
    `left=${geo.card.l} w=${geo.card.w} vw=${geo.vw}`,
  );
  check("modale: staccata dall'alto (40px)", geo.card.t === 40, String(geo.card.t));
  check("modale: bordo visibile", geo.cardBorder === "1px", String(geo.cardBorder));
  check(
    "modale: niente focus ring attorno al testo",
    geo.outlineWidth === "0px",
    String(geo.outlineWidth),
  );
  check("modale: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ 5. sul telefono la modale resta un foglio pieno ============ */
{
  const { ctx, page } = await newPage(430, 932);
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const geo = await page.evaluate(() => {
    const el = document.createElement("div");
    el.className = "jm-editor-card";
    document.body.appendChild(el);
    const cs = getComputedStyle(el);
    const out = { maxWidth: cs.maxWidth, border: cs.borderTopWidth };
    el.remove();
    return out;
  });
  check("telefono: modale invariata (480px, senza bordo)", geo.maxWidth === "480px" && geo.border === "0px", JSON.stringify(geo));
  await ctx.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
await browser.close();
process.exit(failed.length === 0 ? 0 : 1);
