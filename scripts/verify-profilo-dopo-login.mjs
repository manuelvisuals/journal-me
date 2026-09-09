// Banco del profilo che non si rileggeva (bug dal telefono, 9 settembre
// 2026: dopo logout e login la foto profilo "e sparita", ed e riapparsa
// dopo minuti).
//
// La causa in src/modules/impostazioni/profilo.ts: la lettura della riga
// `profiles` si fa UNA volta per apertura e la promessa si ricorda. Ma si
// ricordava anche quando la lettura usciva prima di leggere (modalita
// locale, nessun utente ancora, rete storta): da quel momento nessun
// componente rileggeva piu, e il pallino restava all'iniziale.
//
// Cosa deve essere vero, coi finti (dev server su :3100):
//  1. la prima lettura di `profiles` fallisce (500): il pallino resta
//     all'iniziale, com'e giusto in quel momento;
//  2. si va in un'altra schermata SENZA ricaricare (navigazione interna):
//     un componente nuovo monta, rilegge, e la foto compare;
//  3. la sorgente: un login nuovo (SIGNED_IN) fa rileggere.
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { SupabaseFinto, jwtFinto, montaSupabaseFinto, UTENTE_ID } from "./lib/supabase-finto.mjs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

// Un pixel rosso: basta che sia una data URL vera.
const FOTO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";
const TOKEN = jwtFinto(Math.floor(Date.now() / 1000) + 3600, UTENTE_ID);

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const finto = new SupabaseFinto();
finto.tabelle.profiles = [{ user_id: UTENTE_ID, plan: "free", plan_source: null, current_period_end: null, display_name: "Giulia", avatar_data: FOTO }];
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: "it-IT" });
await montaSupabaseFinto(ctx, finto);
// La prima lettura di profiles va storta, poi il finto risponde.
let guasti = 1;
let letture = 0;
await ctx.route(`**/sbfinto.supabase.co/rest/v1/profiles**`, (route) => {
  // Solo la lettura del profilo (nome e foto): il piano legge la stessa
  // tabella con altre colonne e non c'entra.
  if (route.request().method() === "GET" && /select=display_name/.test(route.request().url())) {
    letture += 1;
    if (guasti > 0) {
      guasti -= 1;
      return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "guasto del banco" }) });
    }
  }
  return finto.gestisci(route);
});
await ctx.addInitScript((token) => {
  try {
    window.localStorage.setItem("jm.plan", "free");
    const s = JSON.parse(window.localStorage.getItem("sb-sbfinto-auth-token") || "{}");
    s.access_token = token;
    window.localStorage.setItem("sb-sbfinto-auth-token", JSON.stringify(s));
  } catch {}
}, TOKEN);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
// Il cancello della cassaforte, se c'e.
const parole = page.locator(".jm-login-cassa-check input");
if (await parole.waitFor({ state: "visible", timeout: 15_000 }).then(() => true, () => false)) {
  await parole.check();
  await page.locator("button.btn-primary").click();
}
// Sul telefono il pallino e .jm-hd-av (intestazione); sul computer .jm-acct-btn.
const pallino = () => page.locator(".jm-hd-av, .jm-acct-btn").locator("visible=true").first();
await pallino().waitFor({ state: "visible", timeout: 30_000 });
await page.waitForTimeout(1500);
check("1 la prima lettura di profiles e fallita", letture >= 1 && guasti === 0, `letture=${letture}`);
check("1 col guasto il pallino resta all'iniziale (niente foto)", (await pallino().locator("img").count()) === 0);

/* ============ 2. si cambia schermata senza ricaricare ============ */
// Dal pallino alle Impostazioni: navigazione interna, non un reload. Le
// Impostazioni mostrano nome e foto nella loro colonna: un consumatore
// nuovo che monta e rilegge.
await pallino().click();
await page.getByRole("menuitem", { name: /Impostazioni|Settings/ }).first().click().catch(async () => {
  await page.getByText(/^Impostazioni$/).first().click();
});
await page.waitForURL(/\/app\/settings/, { timeout: 15_000 }).catch(() => undefined);
const fotoVista = await page
  .locator(".jm-hd-av img, .jm-acct-btn img, .jm-acct-menu img, .jm-rail-avatar img, .jm-foto-mini img, .jm-foto-avbtn img")
  .first()
  .waitFor({ state: "visible", timeout: 15_000 })
  .then(() => true, () => false);
check("2 dopo la navigazione interna il profilo si rilegge e la foto compare", fotoVista, `letture=${letture} url=${page.url()}`);
check("2 la seconda lettura di profiles c'e stata davvero", letture >= 2, `letture=${letture}`);
check("nessun errore di pagina", errors.length === 0, errors.slice(0, 2).join(" | "));

/* ============ 3. la sorgente ============ */
const src = readFileSync("src/modules/impostazioni/profilo.ts", "utf8");
check("3 sorgente: un SIGNED_IN azzera la lettura e rilegge", /evento !== "SIGNED_IN"\) return;\s*lettura = null;\s*void leggi\(\);/.test(src));
check("3 sorgente: le uscite anticipate non si ricordano", (src.match(/lettura = null;\s*return;/g) ?? []).length >= 3);

await browser.close();
const ko = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - ko}/${results.length} verdi`);
process.exit(ko ? 1 : 0);
