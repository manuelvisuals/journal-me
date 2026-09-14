// Il piano in linea con l'email nella testata del menu dell'account
// (Manuel, 13 settembre 2026: "madh52@gmail.com . Free >" oppure
// "madh52@gmail.com . Premium"; il > di Free e come "Scopri Premium").
//
//   1  telefono, cloud GRATIS: nel foglio c'e "email . Gratis" con la
//      freccina, ed e un tasto; toccarlo apre il muro Premium;
//   2  telefono, cloud PREMIUM: "email . Premium", non e un tasto, nessuna
//      riga "Scopri Premium";
//   3  computer, popover della rail: la stessa seconda riga;
//   4  in locale la seconda riga resta il sottotitolo di sempre, senza
//      puntino ne piano;
//   5  zero errori pagina.
//
// Dev server come per verify-ospite-schermate.mjs (finti su 3198/3199);
// poi: node scripts/verify-acct-piano.mjs
import { chromium } from "playwright-core";
import { SupabaseFinto, montaSupabaseFinto } from "./lib/supabase-finto.mjs";

const EXE = process.env.JM_CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

async function apri({ plan, telefono }) {
  const finto = new SupabaseFinto({ tabelle: { profiles: [{ user_id: "00000000-0000-4000-8000-000000000001", plan }] } });
  const ctx = await browser.newContext({
    viewport: telefono ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    locale: "it-IT",
  });
  await montaSupabaseFinto(ctx, finto);
  await ctx.addInitScript(({ plan }) => {
    try {
      window.localStorage.setItem("jm.plan", plan);
      window.localStorage.setItem("jm.mode", "cloud");
    } catch {}
  }, { plan });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  // Il primo accesso mostra le otto parole della cassaforte: si accetta e
  // si rientra (come in verify-recensione.mjs).
  const parole = page.locator(".jm-login-cassa-check input");
  try {
    await parole.waitFor({ state: "visible", timeout: 8_000 });
    await parole.check();
    await page.locator("button.btn-primary").click();
    await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  } catch {}
  return { ctx, page, errors };
}

/* ---------------- 1: telefono, gratis ---------------- */
{
  const { ctx, page, errors } = await apri({ plan: "free", telefono: true });
  await page.waitForSelector(".jm-hd-av", { timeout: 25_000 });
  await page.waitForTimeout(800);
  await page.locator(".jm-hd-av").click();
  await page.waitForSelector(".jm-acct-sheet-head", { timeout: 5_000 });
  const riga = page.locator(".jm-acct-sheet-head .e");
  await riga.locator(".jm-acct-piano").waitFor({ state: "visible", timeout: 5_000 });
  const testo = (await riga.innerText()).replace(/\s+/g, " ").trim();
  check("1 gratis: la seconda riga dice 'email . Gratis'", /banco@dayalogue\.test\s*·\s*Gratis/.test(testo), testo);
  const tasto = riga.locator("button.jm-acct-piano");
  check("1 gratis: 'Gratis' e un tasto con la freccina", (await tasto.count()) === 1 && (await tasto.locator("svg").count()) === 1);
  check("1 gratis: la riga 'Scopri Premium' / 'Passa a Premium' resta", /Premium/.test(await page.locator(".jm-acct-row").allInnerTexts().then((a) => a.join(" "))));
  await tasto.click();
  const muro = page.locator(".jm-wall");
  await muro.waitFor({ state: "visible", timeout: 8_000 }).catch(() => {});
  check("1 gratis: toccando la freccina si apre il muro Premium", await muro.isVisible());
  check("1 gratis: il foglio si e chiuso", (await page.locator(".jm-acct-sheet-head").count()) === 0);
  check("5 zero errori pagina (gratis)", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ---------------- 2: telefono, premium ---------------- */
{
  const { ctx, page, errors } = await apri({ plan: "premium", telefono: true });
  await page.waitForSelector(".jm-hd-av", { timeout: 25_000 });
  await page.waitForTimeout(800);
  await page.locator(".jm-hd-av").click();
  await page.waitForSelector(".jm-acct-sheet-head", { timeout: 5_000 });
  const riga = page.locator(".jm-acct-sheet-head .e");
  await riga.locator(".jm-acct-piano").waitFor({ state: "visible", timeout: 5_000 });
  const testo = (await riga.innerText()).replace(/\s+/g, " ").trim();
  check("2 premium: la seconda riga dice 'email . Premium'", /banco@dayalogue\.test\s*·\s*Premium$/.test(testo), testo);
  check("2 premium: 'Premium' NON e un tasto, niente freccina", (await riga.locator("button").count()) === 0 && (await riga.locator("svg").count()) === 0);
  check("2 premium: nessuna riga 'Scopri/Passa a Premium'", !/Premium/.test((await page.locator(".jm-acct-row").allInnerTexts()).join(" ")));
  check("5 zero errori pagina (premium)", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ---------------- 3: computer, popover ---------------- */
{
  const { ctx, page } = await apri({ plan: "free", telefono: false });
  await page.waitForSelector(".jm-acct-btn", { timeout: 25_000 });
  await page.waitForTimeout(800);
  await page.locator(".jm-acct-btn").click();
  await page.waitForSelector(".jm-acct-menu", { timeout: 5_000 });
  const riga = page.locator(".jm-acct-head .e");
  await riga.locator(".jm-acct-piano").waitFor({ state: "visible", timeout: 5_000 });
  const testo = (await riga.innerText()).replace(/\s+/g, " ").trim();
  check("3 computer: il popover ha la stessa riga 'email . Gratis'", /banco@dayalogue\.test\s*·\s*Gratis/.test(testo), testo);
  await riga.locator("button.jm-acct-piano").click();
  const muro = page.locator(".jm-wall");
  await muro.waitFor({ state: "visible", timeout: 8_000 }).catch(() => {});
  check("3 computer: la freccina apre il muro Premium", await muro.isVisible());
  await ctx.close();
}

/* ---------------- 4: locale ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "it-IT" });
  await ctx.addInitScript(() => {
    try {
      window.localStorage.setItem("jm.mode", "local");
      window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
      window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
    } catch {}
  });
  const page = await ctx.newPage();
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".jm-hd-av", { timeout: 25_000 });
  await page.waitForTimeout(800);
  await page.locator(".jm-hd-av").click();
  await page.waitForSelector(".jm-acct-sheet-head", { timeout: 5_000 });
  const riga = page.locator(".jm-acct-sheet-head .e");
  const testo = (await riga.innerText()).trim();
  check("4 locale: niente puntino ne piano, resta il sottotitolo", !testo.includes("·") && (await riga.locator(".jm-acct-piano").count()) === 0, testo);
  await ctx.close();
}

await browser.close();
const pass = results.filter((r) => r.ok).length;
console.log(`\n${pass}/${results.length} PASS`);
process.exit(pass === results.length ? 0 : 1);
