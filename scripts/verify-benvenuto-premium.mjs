// Il tasto "prova premium" di /app/benvenuto APRE il muro (9 settembre 2026).
//
// Trovato da Manuel sul telefono, appena reinstallata l'app: dopo il login
// con l'email compare la scelta "gratis o premium" e il tasto premium non
// faceva niente. Causa: il muro (PremiumWall) era montato solo dentro il
// guscio con le rail, e /app/benvenuto e una pagina "bare" (desktop-shell
// .tsx, isBareLayout) — openPremiumWall() accendeva uno stato che nessuno
// disegnava. Questo banco pretende:
//   1. dentro il guscio iOS (negozio finto) il tasto apre il muro A SCHEDE;
//   2. sul web il tasto apre il muro che rimanda all'App Store;
//   3. "non ora" lo chiude e si resta su /app/benvenuto, non su un buco.
//
// Serve il dev server su :3100 con i finti, come per verify-abbonamento
// (vedi la testa di quel banco). Poi: node scripts/verify-benvenuto-premium.mjs
import { chromium } from "playwright-core";
import { SupabaseFinto, jwtFinto, montaSupabaseFinto, UTENTE_ID } from "./lib/supabase-finto.mjs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const MENSILE = "com.manuelvisuals.journalme.premium.mensile";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const TOKEN = jwtFinto(Math.floor(Date.now() / 1000) + 6 * 3600, UTENTE_ID);

/** Un dispositivo con la sessione cloud (piano free) e, se chiesto, il negozio finto. */
async function dispositivo({ negozio = false } = {}) {
  const finto = new SupabaseFinto();
  finto.tabelle.profiles = [{ user_id: UTENTE_ID, plan: "free", plan_source: null, current_period_end: null }];
  const ctx = await browser.newContext({ viewport: { width: 430, height: 900 }, locale: "it-IT" });
  await montaSupabaseFinto(ctx, finto, { seme: null });
  await ctx.addInitScript(({ negozio, token, mensile }) => {
    try {
      window.localStorage.setItem("jm.plan", "free");
      const s = JSON.parse(window.localStorage.getItem("sb-sbfinto-auth-token") || "{}");
      s.access_token = token;
      window.localStorage.setItem("sb-sbfinto-auth-token", JSON.stringify(s));
    } catch {}
    if (!negozio) return;
    window.__jmNegozioFinto = {
      async prodotti({ ids }) {
        return { prodotti: [{ id: mensile, prezzo: "4,99 EUR", valuta: "EUR", nome: "Premium", periodo: "mese", provaGiorni: 14, provaDisponibile: true }].filter((p) => ids.includes(p.id)) };
      },
      async compra() { return { esito: "annullato" }; },
      async ripristina() { return { transazioni: [] }; },
      async gestisci() {},
      async finisci() {},
      addListener() { return { remove() {} }; },
    };
  }, { negozio, token: TOKEN, mensile: MENSILE });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error" && !/402|404|409/.test(m.text())) errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  return { ctx, page, errors };
}

async function tastoPremium(page) {
  await page.goto(BASE + "/app/benvenuto", { waitUntil: "domcontentloaded" });
  const tasto = page.locator(".jm-benv-card.pick button.btn-primary");
  await tasto.waitFor({ state: "visible", timeout: 30_000 });
  // La pagina abilita i tasti solo quando la modalita e risolta.
  await page.waitForFunction(() => {
    const b = document.querySelector(".jm-benv-card.pick button.btn-primary");
    return b && !b.disabled;
  }, null, { timeout: 30_000 });
  return tasto;
}

/* ================= 1. Guscio iOS: il muro a schede ================= */
{
  const { ctx, page, errors } = await dispositivo({ negozio: true });
  const tasto = await tastoPremium(page);
  await tasto.click();
  let aperto = true;
  try {
    await page.locator(".jm-wall").waitFor({ state: "visible", timeout: 10_000 });
  } catch {
    aperto = false;
  }
  check("guscio: il tasto 'prova premium' apre il muro", aperto);
  if (aperto) {
    let schede = true;
    try {
      await page.locator(".jm-wall-scheda[data-prodotto]").first().waitFor({ state: "visible", timeout: 15_000 });
    } catch {
      schede = false;
    }
    check("guscio: il muro e a schede (Mensile dal negozio)", schede);
    const testo = await page.locator(".jm-wall").innerText();
    check("guscio: la scheda dice il prezzo del negozio", /4,99/.test(testo), testo.slice(0, 80));
    // "non ora": si chiude e si resta sulla scelta, non su un buco.
    const nonOra = page.locator(".jm-wall button", { hasText: /non ora/i }).first();
    if (await nonOra.count()) {
      await nonOra.click();
      await page.waitForTimeout(400);
      check("guscio: 'non ora' chiude il muro", (await page.locator(".jm-wall").count()) === 0);
      check("guscio: dopo 'non ora' si resta su /app/benvenuto", /\/app\/benvenuto/.test(page.url()), page.url());
    } else {
      check("guscio: c'e il tasto 'non ora'", false);
    }
  }
  check("guscio: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ================= 2. Web: il muro che rimanda all'App Store ================= */
{
  const { ctx, page, errors } = await dispositivo({ negozio: false });
  const tasto = await tastoPremium(page);
  await tasto.click();
  let aperto = true;
  try {
    await page.locator(".jm-wall").waitFor({ state: "visible", timeout: 10_000 });
  } catch {
    aperto = false;
  }
  check("web: il tasto 'prova premium' apre il muro", aperto);
  if (aperto) {
    const testo = await page.locator(".jm-wall").innerText();
    check("web: il muro rimanda all'App Store", /Scarica dayalogue per iPhone/.test(testo), testo.slice(0, 80));
  }
  check("web: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

await browser.close();
const passati = results.filter((r) => r.ok).length;
console.log(`\n${passati}/${results.length} PASS`);
process.exit(passati === results.length ? 0 : 1);
