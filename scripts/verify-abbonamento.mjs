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
//      gettone ES256 firmato con la chiave di scripts/lib/apple-chiave-finta.txt)
//      e SOLO allora il profilo diventa premium; la transazione si segna
//      finita DOPO; compare il benvenuto premium; una ricevuta SCADUTA si
//      finisce lo stesso (verdetto definitivo), altrimenti Apple la ripropone
//      al posto di una vendita nuova;
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
//   APPLE_IAP_ISSUER_ID=00000000-finto-issuer APPLE_IAP_PRIVATE_KEY="$(cat scripts/lib/apple-chiave-finta.txt)"
//   SUPABASE_SERVICE_ROLE_KEY=finto OPENAI_API_KEY=finto ./node_modules/.bin/next dev -p 3100
// poi: node scripts/verify-abbonamento.mjs
import { chromium } from "playwright-core";
import { AppleFinto, OpenAIFinto, SupabaseFintoServer, jwsFinto } from "./lib/finti-server.mjs";
import { SupabaseFinto, jwtFinto, montaSupabaseFinto, UTENTE_ID } from "./lib/supabase-finto.mjs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const MENSILE = "com.manuelvisuals.journalme.premium.mensile";
const ANNUALE = "com.manuelvisuals.journalme.premium.annuale";
const BUNDLE = "com.manuelvisuals.dayalogue";
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
async function dispositivo({ negozio = null, viewport = { width: 430, height: 900 }, seme = null, token = TOKEN } = {}) {
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
  }, { negozio, token });
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
  // Chi non e premium vede la VETRINA del Recap (mockup premium-senza-password
  // E1): il tasto della prova apre il muro. Chi e premium ha "Genera".
  const gen = page.locator(".jm-rec-vetrina .btn-primary, .jm-gen-btn").first();
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

// Il server tiene il regalo in memoria 30 s: se un banco precedente ha
// lasciato l'annuale acceso, si aspetta che torni a leggere questo finto.
{
  const inizio = Date.now();
  for (;;) {
    const r = await fetch(BASE + "/api/ospite/stato").then((x) => x.json()).catch(() => null);
    if (r && r.annualeAttivo === false && r.attivo === true) break;
    if (Date.now() - inizio > 70_000) { console.log("il server non rilegge il regalo: " + JSON.stringify(r)); process.exit(1); }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

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

/* ================= 1b. Il muro e ISTANTANEO: non aspetta il server ================= */
// 6 settembre 2026 (Manuel): la scheda restava "-,- EUR" anche 30 secondi
// perche il muro chiedeva PRIMA /api/ospite/stato e POI i prodotti ad Apple.
// Qui il server e lento di proposito (6 s): la scheda Mensile deve comparire
// lo stesso entro un secondo e mezzo, dai prodotti precaricati all'avvio.
{
  const { ctx, page } = await dispositivo({ negozio: NEGOZIO });
  await ctx.route("**/api/ospite/stato", async (route) => {
    await new Promise((r) => setTimeout(r, 6000));
    return route.continue();
  });
  await entra(page);
  await page.goto(BASE + "/app/recap", { waitUntil: "domcontentloaded" });
  const gen = page.locator(".jm-rec-vetrina .btn-primary, .jm-gen-btn").first();
  await gen.waitFor({ state: "visible", timeout: 30_000 });
  const chiamateAvvio = await page.evaluate(() => window.__jmNegozioFinto.__chiamate.filter((c) => c.m === "prodotti").length);
  check("istantaneo: i prodotti sono stati chiesti ad Apple gia all'avvio, prima di aprire il muro", chiamateAvvio >= 1, String(chiamateAvvio));
  const t0 = Date.now();
  await gen.click();
  await page.locator(".jm-wall-scheda[data-prodotto=mensile]").waitFor({ state: "visible", timeout: 5_000 });
  const ms = Date.now() - t0;
  check("istantaneo: la scheda Mensile compare senza aspettare il server lento (< 1500 ms)", ms < 1500, `${ms} ms`);
  const testo = await page.locator(".jm-wall-scheda[data-prodotto=mensile]").innerText();
  check("istantaneo: la scheda ha gia il prezzo vero, non il fantasma", /4,99/.test(testo) && !/—/.test(testo), testo.slice(0, 60));
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

/* ================= 4b. Una ricevuta SCADUTA va chiusa lo stesso ================= */
// 5 settembre 2026: la transazione del giorno prima, mai finita perche il
// server aveva fallito, tornava a ogni "Compra" al posto di una vendita
// nuova. Il verdetto definitivo del server (qui: "scaduta", plan free)
// deve chiudere la transazione presso Apple, e il muro deve dirlo.
{
  apple.transazioni.set("2077", {
    transactionId: "2077",
    originalTransactionId: "2070",
    productId: MENSILE,
    bundleId: BUNDLE,
    environment: "Sandbox",
    purchaseDate: Date.now() - 2 * 24 * 3600 * 1000,
    expiresDate: Date.now() - 24 * 3600 * 1000,
    type: "Auto-Renewable Subscription",
  });
  sb.tab("profiles").find((p) => p.user_id === UTENTE_ID).plan = "free";
  const SCADUTA = { jws: jwsFinto({ transactionId: "2077", originalTransactionId: "2070", productId: MENSILE, bundleId: BUNDLE }), transactionId: "2077", originalTransactionId: "2070", productId: MENSILE };
  const { ctx, page } = await dispositivo({ negozio: { ...NEGOZIO, transazioni: [SCADUTA] } });
  await entra(page);
  await apriMuro(page);
  await page.locator(".jm-wall .btn-primary").click();
  await page.locator(".jm-wall-err, .jm-wall [role=alert]").first().waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(500);
  const testo = await page.locator(".jm-wall").innerText();
  const chiamate = await page.evaluate(() => window.__jmNegozioFinto.__chiamate);
  check("scaduta: il muro dice che l'abbonamento e scaduto, niente benvenuto", /scaduto/i.test(testo) && (await page.locator(".jm-cong").count()) === 0, testo.slice(0, 120));
  check("scaduta: la transazione viene FINITA lo stesso (verdetto definitivo)", chiamate.some((c) => c.m === "finisci" && c.transactionId === "2077"), JSON.stringify(chiamate.filter((c) => c.m === "finisci")));
  check("scaduta: il piano in tasca resta free", (await page.evaluate(() => localStorage.getItem("jm.plan"))) !== "premium");
  await ctx.close();
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

/* ================= 9. Premium SENZA email: l'ospite compra con il foglio di Apple =================
   Mockup premium-senza-password (risposte di Manuel: B1 C1 D1), migration
   025: il premium vive sul braccialetto del telefono; l'email arriva dopo,
   e allora il premium passa all'account (adotta_braccialetto). */
{
  sb.regalo.annuale_attivo = false;
  // Un dispositivo OSPITE: modalita locale, nessuna sessione, il negozio finto.
  const TRANS_OSPITE = { jws: jwsFinto({ transactionId: "3001", originalTransactionId: "3000", productId: MENSILE, bundleId: BUNDLE }), transactionId: "3001", originalTransactionId: "3000", productId: MENSILE };
  apple.transazioni.set("3001", { transactionId: "3001", originalTransactionId: "3000", productId: MENSILE, bundleId: BUNDLE, environment: "Sandbox", purchaseDate: Date.now(), expiresDate: fraUnMese, type: "Auto-Renewable Subscription", offerType: 1 });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 900 }, locale: "it-IT" });
  await ctx.route("**/sbfinto.supabase.co/**", (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
  await ctx.addInitScript(({ negozio }) => {
    try {
      window.localStorage.setItem("jm.mode", "local");
      window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
      window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
      window.localStorage.setItem("jm.premium.presentato", "1");
    } catch {}
    const ascolto = [];
    window.__jmNegozioFinto = {
      __chiamate: [],
      async prodotti({ ids }) { this.__chiamate.push({ m: "prodotti", ids }); return { prodotti: negozio.prodotti.filter((p) => ids.includes(p.id)) }; },
      async compra({ id }) { this.__chiamate.push({ m: "compra", id }); const t = negozio.transazioni.find((x) => x.productId === id); return t ? { esito: "ok", ...t } : { esito: "annullato" }; },
      async ripristina() { this.__chiamate.push({ m: "ripristina" }); return { transazioni: negozio.transazioni }; },
      async gestisci() { this.__chiamate.push({ m: "gestisci" }); },
      async finisci({ transactionId }) { this.__chiamate.push({ m: "finisci", transactionId }); },
      addListener(evento, f) { ascolto.push(f); return { remove() {} }; },
    };
  }, { negozio: { prodotti: NEGOZIO.prodotti, transazioni: [TRANS_OSPITE] } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error" && !/402 \(Payment Required\)/.test(m.text())) errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  const api = [];
  page.on("request", (r) => { const u = r.url(); if (u.startsWith(BASE) && new URL(u).pathname.startsWith("/api/")) api.push({ path: new URL(u).pathname, auth: r.headers()["authorization"] ?? null, braccialetto: r.headers()["x-jm-braccialetto"] ?? null }); });

  await page.goto(BASE + "/app/settings", { waitUntil: "domcontentloaded" });
  await page.getByText("Passa a Premium").first().waitFor({ state: "visible", timeout: 30_000 });
  await page.getByText("Passa a Premium").first().click();
  await page.locator(".jm-wall").waitFor({ state: "visible", timeout: 10_000 });
  await page.locator(".jm-wall-scheda[data-prodotto]").first().waitFor({ state: "visible", timeout: 15_000 });
  const muro = await page.locator(".jm-wall").innerText();
  check("ospite: il muro ha la scheda Mensile e NON 'Ho gia un account' (D1)", /Mensile/.test(muro) && !/Ho gia un account/.test(muro), muro.replace(/\s+/g, " ").slice(0, 100));
  await page.locator(".jm-wall .btn-primary").click();
  await page.locator(".jm-cong").waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
  check("ospite: dopo 'Prova gratis' si apre direttamente il foglio di Apple (compra) e poi il benvenuto premium, nessun login", (await page.evaluate(() => window.__jmNegozioFinto.__chiamate.some((c) => c.m === "compra"))) && (await page.locator(".jm-cong").count()) === 1 && !page.url().includes("/login"));
  const ver = api.filter((a) => a.path === "/api/apple/verifica");
  check("ospite: /api/apple/verifica chiamata SENZA gettone e CON il braccialetto", ver.length === 1 && ver[0].auth === null && typeof ver[0].braccialetto === "string", JSON.stringify(ver[0] ?? null));
  const br = sb.tab("braccialetti").find((b) => b.apple_original_transaction_id === "3000");
  check("ospite: il server ha scritto premium sul BRACCIALETTO (plan, scadenza, transazione), non su un profilo", !!br && br.plan === "premium" && br.plan_source === "apple" && !sb.tab("profiles").some((p) => p.apple_original_transaction_id === "3000"), JSON.stringify(br ?? null));
  check("ospite: la transazione e finita (finisci) dopo la risposta del server", await page.evaluate(() => window.__jmNegozioFinto.__chiamate.some((c) => c.m === "finisci" && c.transactionId === "3001")));
  check("ospite: il dispositivo ricorda la scadenza (jm.premium.dispositivo)", Boolean(await page.evaluate(() => localStorage.getItem("jm.premium.dispositivo"))));
  await page.locator(".jm-cong button, .jm-cong .btn-primary").first().click().catch(() => {});
  await page.goto(BASE + "/app/settings", { waitUntil: "domcontentloaded" });
  await page.getByText(/Premium fino al/).first().waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
  const imp = await page.locator("main").innerText();
  check("ospite premium: Impostazioni dice 'Premium fino al ...', 'Backup ogni notte: Spento', 'Gestisci abbonamento'; niente 'Passa a Premium'", /Premium fino al/.test(imp) && /Backup ogni notte/.test(imp) && /Gestisci abbonamento/.test(imp) && !/Passa a Premium/.test(imp), imp.replace(/\s+/g, " ").slice(0, 200));

  // L'AI lavora da premium: nessuna giornata del regalo spesa, ai_usage senza regalo.
  const giornatePrima = sb.tab("braccialetto_giornate").length;
  const stato = await fetch(BASE + "/api/ospite/stato", { headers: { "x-jm-braccialetto": ver[0].braccialetto } }).then((r) => r.json());
  check("ospite premium: /api/ospite/stato dice premiumFino", typeof stato.premiumFino === "string", JSON.stringify(stato));
  const rAI = await fetch(BASE + "/api/process-entry", { method: "POST", headers: { "Content-Type": "application/json", "x-jm-braccialetto": ver[0].braccialetto }, body: JSON.stringify({ transcript: "Una giornata da premium senza email." }) });
  check("ospite premium: una route AI risponde 200 e NON spende una giornata del regalo", rAI.status === 200 && sb.tab("braccialetto_giornate").length === giornatePrima, String(rAI.status));
  await new Promise((r) => setTimeout(r, 2000)); // logAiUsage e "void": scrive dopo la risposta
  const usoPremium = sb.tab("ai_usage").filter((u) => u.braccialetto_id === br.id);
  check("ospite premium: ai_usage ha la riga col braccialetto e regalo=false (non entra nel tetto)", usoPremium.length >= 1 && usoPremium.every((u) => u.regalo === false), JSON.stringify(usoPremium[0] ?? null));
  const rRecap = await fetch(BASE + "/api/recap/generate", { method: "POST", headers: { "Content-Type": "application/json", "x-jm-braccialetto": ver[0].braccialetto }, body: JSON.stringify({}) });
  check("ospite premium: anche il Recap (requirePremium) accetta il braccialetto premium (non 402)", rRecap.status !== 402 && rRecap.status !== 401, String(rRecap.status));
  const rRecapNo = await fetch(BASE + "/api/recap/generate", { method: "POST", headers: { "Content-Type": "application/json", "x-jm-braccialetto": "braccialetto-che-non-esiste-000000000000" }, body: JSON.stringify({}) });
  check("un braccialetto senza premium sul Recap: 402", rRecapNo.status === 402, String(rRecapNo.status));

  // La notifica di Apple sul braccialetto: EXPIRED -> free.
  const notifica = (uuid, tipo, sottotipo, t) => JSON.stringify({ signedPayload: jwsFinto({ notificationType: tipo, subtype: sottotipo, notificationUUID: uuid, data: { environment: "Sandbox", bundleId: BUNDLE, signedTransactionInfo: jwsFinto(t) } }) });
  apple.transazioni.set("3002", { transactionId: "3002", originalTransactionId: "3000", productId: MENSILE, bundleId: BUNDLE, environment: "Sandbox", expiresDate: Date.now() - 1000, type: "Auto-Renewable Subscription" });
  const rN = await fetch(BASE + "/api/apple/notifiche", { method: "POST", headers: { "Content-Type": "application/json" }, body: notifica("uuid-ospite-scaduto", "EXPIRED", "VOLUNTARY", { transactionId: "3002", originalTransactionId: "3000", productId: MENSILE }) });
  const jN = await rN.json();
  check("notifica EXPIRED sul braccialetto: applicata, il braccialetto torna free", rN.status === 200 && jN.applicata === true && jN.dove === "dispositivo" && br.plan === "free", JSON.stringify(jN));
  const statoDopo = await fetch(BASE + "/api/ospite/stato", { headers: { "x-jm-braccialetto": ver[0].braccialetto } }).then((r) => r.json());
  check("dopo la scadenza /api/ospite/stato non dice piu premiumFino", statoDopo.premiumFino === null, JSON.stringify(statoDopo));
  check("ospite: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));

  // L'adozione: l'ospite (di nuovo premium, rinnovato) mette l'email. Il
  // braccialetto si lega all'account e il premium passa al profilo.
  Object.assign(br, { plan: "premium", plan_source: "apple", current_period_end: new Date(fraUnMese).toISOString(), apple_original_transaction_id: "3000", apple_product_id: MENSILE, apple_environment: "Sandbox" });
  const NUOVO_UTENTE = "00000000-0000-4000-8000-000000000009";
  const TOKEN_NUOVO = jwtFinto(exp, NUOVO_UTENTE);
  sb.utenti.set(TOKEN_NUOVO, { id: NUOVO_UTENTE, email: "nuovo@dayalogue.test" });
  const rA = await fetch(BASE + "/api/ospite/adotta", { method: "POST", headers: { Authorization: `Bearer ${TOKEN_NUOVO}`, "x-jm-braccialetto": ver[0].braccialetto } });
  const jA = await rA.json();
  const profNuovo = sb.tab("profiles").find((p) => p.user_id === NUOVO_UTENTE);
  check("adozione: /api/ospite/adotta lega il braccialetto all'account e sposta il premium sul profilo", rA.status === 200 && jA.premium_spostato === true && br.user_id === NUOVO_UTENTE && profNuovo?.plan === "premium" && profNuovo?.apple_original_transaction_id === "3000" && br.plan === "free", JSON.stringify({ jA, profNuovo, br }));
  const rA2 = await fetch(BASE + "/api/ospite/adotta", { method: "POST", headers: { Authorization: `Bearer ${TOKEN_NUOVO}`, "x-jm-braccialetto": ver[0].braccialetto } });
  const jA2 = await rA2.json();
  check("adozione ripetuta: niente da spostare, nessun errore", rA2.status === 200 && jA2.premium_spostato === false, JSON.stringify(jA2));
  // La transazione ora e del profilo: un braccialetto che prova a prendersela riceve 409.
  const rV = await fetch(BASE + "/api/apple/verifica", { method: "POST", headers: { "Content-Type": "application/json", "x-jm-braccialetto": "altro-telefono-senza-email-0000000000000" }, body: JSON.stringify({ transactionId: "3001" }) });
  check("una transazione gia di un account non torna su un braccialetto: 409", rV.status === 409, String(rV.status));
  await ctx.close();
}

await browser.close();
await sb.ferma();
await oa.ferma();
await apple.ferma();

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} PASS`);
process.exit(passed === results.length ? 0 : 1);
