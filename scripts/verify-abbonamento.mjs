// Banco dell'abbonamento su iPhone (In-App Purchase, deciso da Manuel il 4
// settembre 2026; mockup design/mockups/abbonamento-iphone.html v3).
//
// Cosa pretende:
//   1. sul WEB il muro non vende: nessuna scheda, il tasto rimanda all'App
//      Store, e dice i 14 giorni di prova senza promettere di piu;
//   2. dentro il guscio (negozio finto `window.__jmNegozioFinto`) il muro e a
//      SCHEDE: solo Mensile finche l'interruttore dell'annuale e spento,
//      prezzo e prova come li dice il negozio, "Ripristina acquisti" e la
//      nota su rinnovo e disdetta; acceso l'interruttore, compare Annuale;
//   3. l'ACQUISTO: il telefono riceve la transazione, la manda al server, il
//      server chiede ad APPLE (un App Store Server API finto che verifica il
//      gettone ES256 firmato con la chiave di scripts/lib/apple-chiave-finta.pem)
//      e SOLO allora il profilo diventa premium; la transazione si segna
//      finita DOPO; compare il benvenuto premium;
//   4. una ricevuta INVENTATA (transazione che Apple non conosce) NON accende
//      premium; una transazione gia legata a un altro account risponde 409;
//   5. il RIPRISTINO su un dispositivo nuovo riaccende premium;
//   6. le NOTIFICHE di Apple: DID_RENEW allunga la scadenza, EXPIRED abbassa
//      a free, la stessa notifica due volte non si applica due volte;
//   7. un premium SCADUTO e un free per il server (402 sulla route AI).
//
// Serve il dev server su :3100 con i finti (par. 6 del referto):
//   JM_SUPABASE_URL_SERVER=http://127.0.0.1:3198 OPENAI_BASE_URL=http://127.0.0.1:3199
//   APPLE_API_BASE_URL=http://127.0.0.1:3197 APPLE_IAP_KEY_ID=FINTOKEY01
//   APPLE_IAP_ISSUER_ID=00000000-finto-issuer APPLE_IAP_PRIVATE_KEY="$(cat scripts/lib/apple-chiave-finta.pem)"
//   SUPABASE_SERVICE_ROLE_KEY=finto OPENAI_API_KEY=finto ./node_modules/.bin/next dev -p 3100
// poi: node scripts/verify-abbonamento.mjs
import { chromium } from "playwright-core";
import { AppleFinto, OpenAIFinto, SupabaseFintoServer, jwsFinto } from "./lib/finti-server.mjs";
import { SupabaseFinto, jwtFinto, montaSupabaseFinto, UTENTE_ID } from "./lib/supabase-finto.mjs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const MENSILE = "com.manuelvisuals.journalme.premium.mensile";
const ANNUALE = "com.manuelvisuals.journalme.premium.annuale";
const BUNDLE = "com.manuelvisuals.journalme";
const ALTRO_UTENTE = "00000000-0000-4000-8000-000000000002";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const sb = new SupabaseFintoServer();
const oa = new OpenAIFinto();
const apple = new AppleFinto();
await sb.avvia(3198);
await oa.avvia(3199);
await apple.avvia(3197);

// Gli utenti: il gettone finto del browser deve essere lo stesso che il
// server finto riconosce.
const exp = Math.floor(Date.now() / 1000) + 6 * 3600;
const TOKEN = jwtFinto(exp, UTENTE_ID);
const TOKEN_ALTRO = jwtFinto(exp, ALTRO_UTENTE);
sb.utenti.set(TOKEN, { id: UTENTE_ID, email: "banco@dayalogue.test" });
sb.utenti.set(TOKEN_ALTRO, { id: ALTRO_UTENTE, email: "altro@dayalogue.test" });
sb.tab("profiles").push({ user_id: UTENTE_ID, plan: "free", plan_source: null, current_period_end: null });
sb.tab("profiles").push({ user_id: ALTRO_UTENTE, plan: "free", plan_source: null, current_period_end: null });

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

/**
 * Un dispositivo con la sessione cloud dell'utente e (se `negozio`) il
 * negozio finto. Il Supabase finto del BROWSER specchia i profili da quello
 * del SERVER: una verita sola.
 */
async function dispositivo({ negozio = null, viewport = { width: 430, height: 900 }, seme = null } = {}) {
  const finto = new SupabaseFinto();
  finto.tabelle.profiles = [];
  const ctx = await browser.newContext({ viewport, locale: "it-IT" });
  await montaSupabaseFinto(ctx, finto, { seme });
  await ctx.route("**/sbfinto.supabase.co/rest/v1/profiles**", (route) => {
    finto.tabelle.profiles = sb.tab("profiles").map((r) => ({ ...r }));
    return finto.gestisci(route);
  });
  await ctx.addInitScript(({ negozio, token }) => {
    try {
      window.localStorage.setItem("jm.plan", "free");
      // Il gettone: lo stesso che il server finto conosce.
      const s = JSON.parse(window.localStorage.getItem("sb-sbfinto-auth-token") || "{}");
      s.access_token = token;
      window.localStorage.setItem("sb-sbfinto-auth-token", JSON.stringify(s));
    } catch {}
    if (!negozio) return;
    // Il negozio finto: stessa forma del plugin nativo (negozio-ios.ts).
    const ascolto = [];
    window.__jmNegozioFinto = {
      __chiamate: [],
      __prodotti: negozio.prodotti,
      __transazioni: negozio.transazioni,
      async prodotti({ ids }) {
        this.__chiamate.push({ m: "prodotti", ids });
        return { prodotti: this.__prodotti.filter((p) => ids.includes(p.id)) };
      },
      async compra({ id }) {
        this.__chiamate.push({ m: "compra", id });
        const t = this.__transazioni.find((x) => x.productId === id);
        if (!t) return { esito: "annullato" };
        return { esito: "ok", ...t };
      },
      async ripristina() {
        this.__chiamate.push({ m: "ripristina" });
        return { transazioni: this.__transazioni };
      },
      async gestisci() {
        this.__chiamate.push({ m: "gestisci" });
      },
      async finisci({ transactionId }) {
        this.__chiamate.push({ m: "finisci", transactionId });
      },
      addListener(evento, f) {
        ascolto.push(f);
        return { remove() {} };
      },
      __emetti(t) {
        ascolto.forEach((f) => f(t));
      },
    };
  }, { negozio, token: TOKEN });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error" && !/402 \(Payment Required\)|409 \(Conflict\)|404 \(Not Found\)/.test(m.text())) errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  return { ctx, page, errors, finto };
}

/** Passa il cancello della cassaforte (le otto parole) e arriva sul diario. */
async function entra(page) {
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  const parole = page.locator(".jm-login-cassa-check input");
  try {
    await parole.waitFor({ state: "visible", timeout: 20_000 });
    await parole.check();
    await page.locator("button.btn-primary").click();
  } catch {
    // gia dentro (seme gia sul dispositivo)
  }
  await page.waitForTimeout(1200);
}

/** Apre il muro premium dal Recap ("Genera", gated su recap). */
async function apriMuro(page) {
  await page.goto(BASE + "/app/recap", { waitUntil: "domcontentloaded" });
  const gen = page.locator(".jm-gen-btn");
  await gen.waitFor({ state: "visible", timeout: 30_000 });
  await gen.click();
  await page.locator(".jm-wall").waitFor({ state: "visible", timeout: 10_000 });
  // Dentro il guscio le schede arrivano dal negozio (e l'interruttore
  // dell'annuale da /api/ospite/stato): si aspetta che compaiano.
  if (await page.evaluate(() => Boolean(window.__jmNegozioFinto))) {
    await page.locator(".jm-wall-scheda[data-prodotto]").first().waitFor({ state: "visible", timeout: 15_000 });
  }
  await page.waitForTimeout(300);
}

const TRANS_MENSILE = { jws: jwsFinto({ transactionId: "2001", originalTransactionId: "2000", productId: MENSILE, bundleId: BUNDLE }), transactionId: "2001", originalTransactionId: "2000", productId: MENSILE };
const fraUnMese = Date.now() + 30 * 24 * 3600 * 1000;
apple.transazioni.set("2001", {
  transactionId: "2001",
  originalTransactionId: "2000",
  productId: MENSILE,
  bundleId: BUNDLE,
  environment: "Sandbox",
  purchaseDate: Date.now(),
  expiresDate: fraUnMese,
  type: "Auto-Renewable Subscription",
  offerType: 1,
});

const NEGOZIO = {
  prodotti: [
    { id: MENSILE, prezzo: "4,99 EUR", valuta: "EUR", nome: "Premium", periodo: "mese", provaGiorni: 14, provaDisponibile: true },
    { id: ANNUALE, prezzo: "39,99 EUR", valuta: "EUR", nome: "Premium annuale", periodo: "anno", provaGiorni: 14, provaDisponibile: true },
  ],
  transazioni: [TRANS_MENSILE],
};

/* ================= 1. Il web: niente vendita, rimando all'App Store ================= */
{
  const { ctx, page, errors } = await dispositivo({ viewport: { width: 1440, height: 900 } });
  await entra(page);
  await apriMuro(page);
  const testo = await page.locator(".jm-wall").innerText();
  check("web: nessuna scheda di prodotto", (await page.locator(".jm-wall-scheda").count()) === 0);
  check("web: il tasto rimanda all'App Store", /Scarica dayalogue per iPhone/.test(testo), testo.slice(0, 80));
  check("web: dice i 14 giorni di prova e il prezzo", /14 giorni gratis/.test(testo) && /4,99/.test(testo));
  check("web: niente Ripristina acquisti (non c'e un negozio)", !/Ripristina acquisti/.test(testo));
  check("web: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ================= 2. Il guscio: il muro a schede ================= */
{
  const { ctx, page, errors } = await dispositivo({ negozio: NEGOZIO });
  await entra(page);
  await apriMuro(page);
  const schede = page.locator(".jm-wall-scheda[data-prodotto]");
  check("guscio: una scheda sola, Mensile (l'annuale e spento)", (await schede.count()) === 1 && (await schede.first().getAttribute("data-prodotto")) === "mensile", String(await schede.count()));
  check("guscio: la scheda dice prezzo e prova come li dice il negozio", /4,99 EUR al mese/.test(await schede.first().innerText()) && /14 giorni gratis/.test(await schede.first().innerText()));
  check("guscio: la scheda e gia scelta", (await schede.first().getAttribute("class")).includes("on"));
  const tasto = page.locator(".jm-wall .btn-primary");
  check("guscio: il tasto dice 'Prova gratis 14 giorni'", /Prova gratis 14 giorni/.test(await tasto.innerText()), await tasto.innerText());
  const testo = await page.locator(".jm-wall").innerText();
  check("guscio: Ripristina acquisti, rinnovo, disdetta, Termini e Privacy", /Ripristina acquisti/.test(testo) && /si rinnova da solo/.test(testo) && /Termini/.test(testo) && /Privacy/.test(testo));

  /* ================= 3. L'acquisto ================= */
  const appleChiamatePrima = apple.chiamate.length;
  await tasto.click();
  await page.locator(".jm-cong").waitFor({ state: "visible", timeout: 15_000 });
  check("acquisto: compare il benvenuto premium", true);
  const chiamate = await page.evaluate(() => window.__jmNegozioFinto.__chiamate);
  check("acquisto: il negozio ha ricevuto compra(mensile)", chiamate.some((c) => c.m === "compra" && c.id === MENSILE));
  const gettoni = apple.chiamate.slice(appleChiamatePrima);
  check("acquisto: il server ha chiesto ad Apple con un gettone ES256 valido", gettoni.length >= 1 && gettoni.every((c) => c.gettone.ok), JSON.stringify(gettoni[0]?.gettone));
  const prof = sb.tab("profiles").find((p) => p.user_id === UTENTE_ID);
  check("acquisto: il profilo e premium, fonte apple, con transazione e scadenza", prof.plan === "premium" && prof.plan_source === "apple" && prof.apple_original_transaction_id === "2000" && prof.apple_product_id === MENSILE && typeof prof.current_period_end === "string", JSON.stringify(prof));
  check("acquisto: la transazione e stata segnata finita DOPO la risposta del server", chiamate.some((c) => c.m === "finisci" && c.transactionId === "2001"));
  check("acquisto: il piano in tasca e premium", (await page.evaluate(() => localStorage.getItem("jm.plan"))) === "premium");
  check("guscio: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ================= 4. Ricevute inventate e conti sbagliati ================= */
{
  const inventata = { jws: jwsFinto({ transactionId: "9999", originalTransactionId: "9998", productId: MENSILE, bundleId: BUNDLE, expiresDate: fraUnMese }), transactionId: "9999" };
  const r = await fetch(BASE + "/api/apple/verifica", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN_ALTRO}` }, body: JSON.stringify(inventata) });
  const altro = sb.tab("profiles").find((p) => p.user_id === ALTRO_UTENTE);
  check("ricevuta inventata: il server risponde 404 e il profilo resta free", r.status === 404 && altro.plan === "free", `status ${r.status}, plan ${altro.plan}`);
  const r2 = await fetch(BASE + "/api/apple/verifica", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN_ALTRO}` }, body: JSON.stringify({ transactionId: "2001" }) });
  check("transazione di un altro account: 409 e il profilo resta free", r2.status === 409 && sb.tab("profiles").find((p) => p.user_id === ALTRO_UTENTE).plan === "free", `status ${r2.status}`);
  const r3 = await fetch(BASE + "/api/apple/verifica", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactionId: "2001" }) });
  check("senza account: 401 (premium e dell'account)", r3.status === 401, String(r3.status));
}

/* ================= 5. Il ripristino su un dispositivo nuovo ================= */
{
  sb.tab("profiles").find((p) => p.user_id === UTENTE_ID).plan = "free"; // come se il server avesse perso tutto
  const { ctx, page } = await dispositivo({ negozio: NEGOZIO });
  await entra(page);
  await apriMuro(page);
  await page.locator(".jm-wall-quiet button", { hasText: "Ripristina acquisti" }).click();
  await page.locator(".jm-cong").waitFor({ state: "visible", timeout: 15_000 });
  const prof = sb.tab("profiles").find((p) => p.user_id === UTENTE_ID);
  check("ripristino: il profilo torna premium via Apple", prof.plan === "premium" && prof.plan_source === "apple", JSON.stringify(prof));
  await ctx.close();
}

/* ================= 6. Le notifiche di Apple ================= */
{
  const notifica = (uuid, tipo, sottotipo, t) => JSON.stringify({
    signedPayload: jwsFinto({ notificationType: tipo, subtype: sottotipo, notificationUUID: uuid, data: { environment: "Sandbox", bundleId: BUNDLE, signedTransactionInfo: jwsFinto(t) } }),
  });
  const posta = (corpo) => fetch(BASE + "/api/apple/notifiche", { method: "POST", headers: { "Content-Type": "application/json" }, body: corpo });
  // Rinnovo: transazione nuova, stessa originale, scadenza piu avanti.
  const fraDueMesi = Date.now() + 60 * 24 * 3600 * 1000;
  apple.transazioni.set("2002", { transactionId: "2002", originalTransactionId: "2000", productId: MENSILE, bundleId: BUNDLE, environment: "Sandbox", expiresDate: fraDueMesi, type: "Auto-Renewable Subscription" });
  const r1 = await posta(notifica("uuid-rinnovo-1", "DID_RENEW", null, { transactionId: "2002", originalTransactionId: "2000", productId: MENSILE }));
  const j1 = await r1.json();
  const p1 = sb.tab("profiles").find((p) => p.user_id === UTENTE_ID);
  check("notifica DID_RENEW: applicata, scadenza spostata avanti", r1.status === 200 && j1.applicata === true && Math.abs(Date.parse(p1.current_period_end) - fraDueMesi) < 2000, JSON.stringify(j1));
  const r1bis = await posta(notifica("uuid-rinnovo-1", "DID_RENEW", null, { transactionId: "2002", originalTransactionId: "2000", productId: MENSILE }));
  const j1bis = await r1bis.json();
  check("notifica ripetuta (stesso UUID): doppione, non riapplicata", r1bis.status === 200 && j1bis.doppione === true, JSON.stringify(j1bis));
  // Scadenza: Apple dice che e scaduto (expiresDate nel passato).
  apple.transazioni.set("2003", { transactionId: "2003", originalTransactionId: "2000", productId: MENSILE, bundleId: BUNDLE, environment: "Sandbox", expiresDate: Date.now() - 1000, type: "Auto-Renewable Subscription" });
  const r2 = await posta(notifica("uuid-scaduto-1", "EXPIRED", "VOLUNTARY", { transactionId: "2003", originalTransactionId: "2000", productId: MENSILE }));
  const p2 = sb.tab("profiles").find((p) => p.user_id === UTENTE_ID);
  check("notifica EXPIRED: il profilo torna free", r2.status === 200 && p2.plan === "free", JSON.stringify(p2));
  check("notifica: il registro ha tre righe, due applicate", sb.tab("apple_notifiche").length === 2 && sb.tab("apple_notifiche").every((n) => n.applicata === true));
  // Una notifica con una transazione che Apple non conosce: 200 ma non applicata.
  const r3 = await posta(notifica("uuid-falsa-1", "DID_RENEW", null, { transactionId: "7777", originalTransactionId: "2000", productId: MENSILE }));
  const j3 = await r3.json();
  check("notifica falsa (Apple non la conosce): 200 ma NON applicata", r3.status === 200 && j3.applicata === false && sb.tab("profiles").find((p) => p.user_id === UTENTE_ID).plan === "free", JSON.stringify(j3));
}

/* ================= 7. Un premium scaduto e un free per il server ================= */
{
  const prof = sb.tab("profiles").find((p) => p.user_id === UTENTE_ID);
  prof.plan = "premium";
  prof.current_period_end = new Date(Date.now() - 60_000).toISOString();
  const r = await fetch(BASE + "/api/recap/generate", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify({}) });
  check("premium scaduto: la route AI risponde 402", r.status === 402, String(r.status));
  prof.current_period_end = new Date(Date.now() + 60_000).toISOString();
  const r2 = await fetch(BASE + "/api/recap/generate", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify({}) });
  check("premium in corso: la route AI NON risponde 402", r2.status !== 402, String(r2.status));
}

/* ================= 8. L'interruttore dell'annuale ================= */
{
  sb.regalo.annuale_attivo = true;
  // Il server tiene il regalo in memoria 30 s.
  await new Promise((r) => setTimeout(r, 31_000));
  const { ctx, page } = await dispositivo({ negozio: NEGOZIO });
  sb.tab("profiles").find((p) => p.user_id === UTENTE_ID).plan = "free";
  await entra(page);
  await apriMuro(page);
  const schede = page.locator(".jm-wall-scheda[data-prodotto]");
  const chiavi = await schede.evaluateAll((l) => l.map((e) => e.getAttribute("data-prodotto")));
  check("annuale acceso dal pannello: due schede, mensile e annuale", chiavi.join(",") === "mensile,annuale", chiavi.join(","));
  await schede.nth(1).click();
  await page.waitForTimeout(200);
  check("annuale: scegliendolo, la nota dice il prezzo annuale", /39,99 EUR all'anno/.test(await page.locator(".jm-wall-nota").innerText()));
  await ctx.close();
  sb.regalo.annuale_attivo = false;
}

await browser.close();
await sb.ferma();
await oa.ferma();
await apple.ferma();

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} PASS`);
process.exit(passed === results.length ? 0 : 1);
