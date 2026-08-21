// Verifica delle frecce avanti/indietro in Mese (mockup mese-navigazione.html,
// variante 03). Locale, porta 3200.
//
// Cosa prova:
//  1. le due frecce ci sono, e sono DOPO il titolo nella riga (variante 03:
//     il titolo resta incolonnato con il lunedi della griglia);
//  2. indietro cambia mese e ricarica le giornate di quel mese;
//  3. avanti torna al mese di partenza;
//  4. sul mese corrente la freccia avanti e DISABILITATA e ancora VISIBILE
//     (spenta, non nascosta: se sparisse il titolo ballerebbe);
//  5. il titolo continua ad aprire il salto rapido, che e la cosa che
//     queste frecce non devono rompere;
//  6. il passaggio da dicembre a gennaio non sbaglia anno;
//  7. sul telefono la griglia non esiste, quindi non esistono le frecce.
import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3200";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

async function open(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: "it-IT" });
  await ctx.addInitScript(() => {
    try { window.localStorage.setItem("jm.mode", "local"); } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + "/mese", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  return { ctx, page, errors };
}

const prev = (p) => p.locator('[aria-label="Mese precedente"]');
const next = (p) => p.locator('[aria-label="Mese successivo"]');
const title = (p) => p.locator(".jm-mese-t");

{
  const { ctx, page, errors } = await open(1440, 950);

  check("le due frecce esistono", (await prev(page).count()) === 1 && (await next(page).count()) === 1);

  // Variante 03: il titolo sta a sinistra delle frecce e allineato alla griglia.
  const tb = await title(page).boundingBox();
  const pb = await prev(page).boundingBox();
  const cell = await page.locator(".jm-mese-wk div").first().boundingBox();
  check("variante 03: le frecce stanno DOPO il titolo", pb.x > tb.x + tb.width, `titolo ${Math.round(tb.x + tb.width)} freccia ${Math.round(pb.x)}`);
  check(
    "variante 03: il titolo resta incolonnato con la griglia",
    Math.abs(Math.round(tb.x) - Math.round(cell.x)) <= 3,
    `titolo ${Math.round(tb.x)} vs colonna ${Math.round(cell.x)}`,
  );

  const start = await title(page).innerText();
  check("si parte dal mese corrente", /Agosto 2026/i.test(start), start);
  check("mese corrente: avanti e disabilitato", await next(page).isDisabled());
  check("mese corrente: avanti e comunque VISIBILE", await next(page).isVisible());
  check("mese corrente: indietro e attivo", !(await prev(page).isDisabled()));

  await prev(page).click();
  await page.waitForTimeout(1200);
  const back1 = await title(page).innerText();
  check("indietro: si va a luglio", /Luglio 2026/i.test(back1), back1);
  check("luglio: avanti si riaccende", !(await next(page).isDisabled()));
  const luglio = await page.locator(".jm-mese-cell.full, .jm-mese-cell").count();
  check("luglio: la griglia si e ridisegnata", luglio > 0, `${luglio} celle`);

  await prev(page).click();
  await page.waitForTimeout(1200);
  check("indietro due volte: giugno", /Giugno 2026/i.test(await title(page).innerText()));

  await next(page).click();
  await next(page).click();
  await page.waitForTimeout(1200);
  const backHome = await title(page).innerText();
  check("avanti due volte: si torna ad agosto", /Agosto 2026/i.test(backHome), backHome);
  check("tornati a oggi: avanti di nuovo spento", await next(page).isDisabled());

  // Il titolo non deve aver perso il suo mestiere.
  await title(page).click();
  await page.waitForTimeout(500);
  check("il titolo apre ancora il salto rapido", (await page.locator(".jm-jump, [role=dialog]").count()) > 0);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  check("zero errori in console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* Il salto d'anno: da gennaio indietro si deve finire a dicembre 2025. */
{
  const { ctx, page } = await open(1440, 950);
  for (let i = 0; i < 8; i++) {
    await prev(page).click();
    await page.waitForTimeout(350);
  }
  const t8 = await title(page).innerText();
  check("otto mesi indietro: dicembre 2025", /Dicembre 2025/i.test(t8), t8);
  await prev(page).click();
  await page.waitForTimeout(500);
  const t9 = await title(page).innerText();
  check("nove indietro: novembre 2025, l'anno non salta", /Novembre 2025/i.test(t9), t9);
  await ctx.close();
}

/* Telefono: la griglia non c'e, quindi non ci sono nemmeno le frecce. */
{
  const { ctx, page } = await open(390, 820);
  const visible = await page.locator('[aria-label="Mese precedente"]:visible').count();
  check("telefono: nessuna freccia visibile", visible === 0, `${visible}`);
  check("telefono: resta il feed", (await page.locator(".jm-month-header").count()) > 0);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length === 0 ? 0 : 1);
