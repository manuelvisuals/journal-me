// La cache delle letture e di UNA modalita sola (12 settembre 2026).
//
// Manuel, dal telefono con l'account gratis: "in Impostazioni > Obiettivi
// ricompaiono sempre quelli che ho cancellato, e in due lingue". Il database
// dell'account aveva sei obiettivi; lo schermo ne mostrava nove. I tre in
// piu erano dell'OSPITE del telefono: la cache in memoria delle letture
// (src/lib/data/cache.ts) usa le stesse chiavi in locale e in cloud, e al
// login la modalita cambiava senza svuotarla. La prima schermata dopo
// l'accesso disegnava con i dati del telefono.
//
// Qui si rifa la strada VERA della persona, senza mai ricaricare la pagina
// (un reload svuota la cache e nasconde il difetto):
//   ospite -> Impostazioni > Obiettivi (la cache impara i sei di fabbrica)
//   -> "Ho gia un account" -> email -> codice -> /app -> cassaforte
//   -> menu del pallino -> Impostazioni -> Obiettivi.
// L'account finto non ha nessun obiettivo: se nella lista c'e "mosso il
// corpo", e il telefono che parla al posto dell'account.
//
// Dev server con i finti (come verify-ospite-schermate.mjs), poi:
//   node scripts/verify-cache-modalita.mjs
import { chromium } from "playwright-core";
import { SupabaseFintoServer, OpenAIFinto } from "./lib/finti-server.mjs";
import { SupabaseFinto, sessioneFinta, SB_HOST, UTENTE_ID } from "./lib/supabase-finto.mjs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const sb = new SupabaseFintoServer();
const oa = new OpenAIFinto();
await sb.avvia(3198);
await oa.avvia(3199);
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

const ctx = await browser.newContext({ viewport: { width: 430, height: 900 }, locale: "it-IT" });
const finto = new SupabaseFinto();
finto.tabelle.profiles = [{ user_id: UTENTE_ID, plan: "free" }];
finto.tabelle.goals = [];
// NON montaSupabaseFinto: quello mette gia la sessione nel dispositivo, e
// qui si parte da ospite. Le rotte si, la sessione arriva col codice.
await ctx.route(`**/${SB_HOST}/**`, (route) => finto.gestisci(route));
await ctx.addInitScript(() => {
  try {
    window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
    window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
  } catch {}
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

const testoObiettivi = async () => {
  await page.locator(".jm-st-row", { hasText: /^Obiettivi/ }).first().click();
  await page.waitForTimeout(800);
  return (await page.locator("main").innerText()).replace(/\s+/g, " ");
};

/* 1. ospite: Impostazioni > Obiettivi mostra i sei di fabbrica (e la cache li impara) */
await page.goto(BASE + "/app/settings", { waitUntil: "domcontentloaded" });
await page.waitForSelector(".jm-st-row", { timeout: 30_000 });
await page.waitForTimeout(1500);
const prima = await testoObiettivi();
check("1 ospite: gli obiettivi di fabbrica ci sono ('mosso il corpo')", /mosso il corpo/.test(prima), prima.slice(0, 80));
await page.locator(".jm-st-back, button[aria-label*='ndietro']").first().click().catch(() => page.goBack());
await page.waitForTimeout(600);

/* 2. senza ricaricare: "Ho gia un account" -> email -> codice */
await page.locator(".jm-st-row", { hasText: "Ho gia un account" }).first().click();
await page.waitForURL(/\/login/, { timeout: 15_000 });
await page.locator("input[type='email']").fill("ospite-diventato-account@dayalogue.test");
await page.locator("button.btn-primary").first().click();
await page.locator("input[placeholder='000000']").waitFor({ state: "visible", timeout: 15_000 });
// La sessione che il codice giusto lascerebbe: il finto risponde {} a
// /auth/v1/verify, quindi il gettone si mette qui, come in verify-ospite-schermate 06.
const SESSIONE = sessioneFinta(UTENTE_ID);
sb.utenti.set(SESSIONE.access_token, { id: UTENTE_ID, email: "ospite-diventato-account@dayalogue.test" });
await page.evaluate((sessione) => {
  window.localStorage.setItem("sb-sbfinto-auth-token", JSON.stringify(sessione));
  window.localStorage.setItem("jm:archivio-letto", "1");
  // niente velo del saluto dopo l'accesso (come verify-ospite-schermate 06)
  window.localStorage.setItem("jm.saluto.silenzio", "sid:banco#v1");
}, SESSIONE);
await page.locator("input[placeholder='000000']").fill("123456");
await page.locator("button.btn-primary", { hasText: /Entra/ }).first().click().catch(() => {});
await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20_000 }).catch(() => {});
check("2 dopo il codice si e su /app (senza ricaricare la pagina)", /\/app/.test(page.url()) && !/\/login/.test(page.url()), page.url());

/* 3. la cassaforte nuova, come fa il cancello */
const parole = page.locator(".jm-login-cassa-check input");
if (await parole.count()) {
  await parole.waitFor({ state: "visible", timeout: 30_000 });
  await parole.check();
  await page.locator("button.btn-primary").first().click();
  await page.waitForTimeout(2500);
}

/* 4. dal menu del pallino a Impostazioni > Obiettivi: e l'account, non il telefono */
await page.waitForTimeout(1500);
await page.locator(".jm-appbar .jm-hd-av").click({ force: true });
await page.locator(".jm-acct-sheet-head").waitFor({ state: "visible", timeout: 8_000 });
await page.locator(".jm-sheet-row, .jm-acct-row", { hasText: "Impostazioni" }).first().click();
await page.waitForURL(/\/app\/settings/, { timeout: 15_000 });
await page.waitForSelector(".jm-st-row", { timeout: 30_000 });
await page.waitForTimeout(1500);
const dopo = await testoObiettivi();
check("4 con l'account, la lista degli obiettivi NON ha quelli del telefono ('mosso il corpo')", !/mosso il corpo/.test(dopo), dopo.slice(0, 120));
check("4 ...e dice quello che l'account ha davvero: nessun obiettivo", /Nessun obiettivo/.test(dopo), dopo.slice(0, 120));
check("zero errori pagina", errors.length === 0, errors.slice(0, 2).join(" | "));

await ctx.close();
await browser.close();
const fails = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - fails}/${results.length} PASS`);
process.exit(fails ? 1 : 0);
