// La porta del giorno (10 settembre 2026, modulo accesso, porta-giorno.tsx).
//
// Una schermata sola all'ingresso, una volta al giorno. Qui si misura, in un
// browser vero contro il dev server con i finti:
//   1. primo avvio nel guscio: la lettera CON il regalo in testa ("10
//      giornate, con l'AI accesa"), "Comincia a scrivere", "Ho gia un
//      account" (B5), la lettera di Manuel sotto, NESSUNA casella "non
//      mostrare piu", nessuna frase su AES; il velo blocca i tocchi; chiusa,
//      scrive jm.porta.lettera e jm.porta.giorno e ricaricando non torna;
//   2. primo avvio sul web: la lettera senza il regalo;
//   3. il giorno dopo con il conto cambiato: "N giornate AI ancora in regalo", i
//      pallini, "Passa a premium" apre il muro dell'email e lascia il
//      promemoria jm.muro.riapri;
//   4. il giorno dopo con il conto uguale: il titolo e il giorno, non il
//      numero; "Continua" chiude e scrive jm.porta.rimaste;
//   5. giornate finite: "sono finite", "Continua senza AI";
//   6. sopra il tetto: "in pausa", non "finite";
//   7. dopo un logout (jm.saluto.uscito) la porta tace anche al primo avvio;
//   8. "Ho gia un account" porta a /login.
//
// Serve il dev server su :3100 con i finti (stessa riga di verify-ospite).
// poi: node scripts/verify-porta-giorno.mjs
import { chromium } from "playwright-core";
import { OpenAIFinto, SupabaseFintoServer } from "./lib/finti-server.mjs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const SB_HOST = "sbfinto.supabase.co";

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

/**
 * Un dispositivo: contesto nuovo. `memoria` sono le chiavi localStorage da
 * piantare prima del caricamento (la porta legge jm.porta.*); `native` finge
 * il guscio come fa verify-appstore (CapacitorCustomPlatform); `seme` mette
 * un braccialetto gia noto nel portachiavi finto, cosi il server risponde il
 * conto di QUEL braccialetto.
 */
async function dispositivo({ memoria = {}, native = true, seme = null, negozio = false } = {}) {
  // Con il guscio finto il portachiavi e il plugin nativo (che qui non c'e):
  // un seme si puo piantare solo in IndexedDB, cioe sul web. Il negozio di
  // Apple si finge a parte (window.__jmNegozioFinto, come in verify-abbonamento),
  // cosi il muro e quello del guscio anche con il portachiavi del web.
  if (seme) native = false;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "it-IT" });
  await ctx.route(`**/${SB_HOST}/**`, (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
  await ctx.addInitScript(({ memoria, native, negozio }) => {
    try {
      for (const [k, v] of Object.entries(memoria)) window.localStorage.setItem(k, v);
    } catch {}
    if (native) window.CapacitorCustomPlatform = { name: "iosprova" };
    if (negozio) {
      window.__jmNegozioFinto = {
        async prodotti() { return { prodotti: [{ id: "com.manuelvisuals.journalme.premium.mensile", prezzo: "4,99 EUR", periodo: "mese", provaGiorni: 14, provaDisponibile: true }] }; },
        async compra() { return { esito: "annullato" }; },
        async ripristina() { return { transazioni: [] }; },
        async gestisci() {},
        async finisci() {},
        addListener() { return { remove() {} }; },
      };
    }
  }, { memoria, native, negozio });
  const page = await ctx.newPage();
  const errors = [];
  const api = [];
  page.on("response", (r) => {
    if (!r.url().includes("/api/")) return;
    r.text().then((t) => api.push(`${r.status()} ${new URL(r.url()).pathname} b=${(r.request().headers()["x-jm-braccialetto"] ?? "-").slice(0, 6)} ${t.slice(0, 90)}`)).catch(() => {});
  });
  // Il guscio finto non ha i plugin veri (Abbonamento, notifiche): quelle
  // eccezioni sono del finto, non della porta.
  page.on("pageerror", (e) => { if (!/CapacitorException/.test(String(e))) errors.push(String(e)); });
  if (seme) {
    // Il seme si scrive in IndexedDB da una pagina che NON e l'app (un file
    // statico della stessa origine), aspettando che la scrittura finisca:
    // dentro l'app il cancello legge il portachiavi subito e, se lo trova
    // vuoto, ne crea uno nuovo sopra quello del banco.
    await page.goto(BASE + "/robots.txt", { waitUntil: "domcontentloaded" });
    await page.evaluate((seme) => new Promise((resolve, reject) => {
      const req = indexedDB.open("journalme-chiave", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("semi");
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const tx = req.result.transaction("semi", "readwrite");
        tx.objectStore("semi").put(seme, "braccialetto");
        tx.oncomplete = () => { req.result.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    }), seme);
  }
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  return { ctx, page, errors, api };
}

const porta = (page) => page.locator(".jm-benv-sal");
async function attendiPorta(page, ms = 30_000) {
  try {
    await porta(page).waitFor({ state: "visible", timeout: ms });
    return true;
  } catch {
    return false;
  }
}
const testo = async (page) => (await porta(page).innerText().catch(() => "")).replace(/\s+/g, " ");
const oggi = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();
const ieri = "2000-01-01";

/* ---- un braccialetto con un conto noto sul server finto ---- */
// 32 byte in base64 (il formato del portachiavi finto), come verify-ospite.
const semeBytes = new Uint8Array(32).map((_, i) => (i * 7 + 3) & 255);
const seme = Buffer.from(semeBytes).toString("base64");
const segreto = Buffer.from(semeBytes).toString("base64url");
const { createHash } = await import("node:crypto");
const hash = createHash("sha256").update(segreto, "utf8").digest("hex");
sb.tab("braccialetti").push({ id: "br-porta-0001", segreto_hash: hash, user_id: null, devicecheck: false, created_at: new Date().toISOString() });
const rigaOggiRoma = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
function giornateSpese(n) {
  sb.tabelle.braccialetto_giornate = [];
  for (let i = 0; i < n; i++) {
    sb.tab("braccialetto_giornate").push({ braccialetto_id: "br-porta-0001", giorno: `2026-08-${String(i + 1).padStart(2, "0")}`, chiamate: 1, creato_il: new Date().toISOString() });
  }
}
void rigaOggiRoma;

/* 1. primo avvio nel guscio */
{
  const { ctx, page, errors } = await dispositivo({ native: true });
  check("1 primo avvio (guscio): la porta si apre", await attendiPorta(page));
  const t1 = await testo(page);
  check("1 la lettera porta il regalo in testa: '10 giornate, con l'AI accesa'", /10 giornate,\s*con l'AI accesa/.test(t1), t1.slice(0, 120));
  check("1 il tasto e 'Comincia a scrivere'", /Comincia a scrivere/.test(t1));
  check("1 c'e 'Ho gia un account' (B5)", /Ho gia un account/.test(t1));
  check("1 la lettera di Manuel e sotto (la firma)", /Manuel/.test(t1) && /scrivimi/i.test(t1));
  check("1 niente casella 'non mostrare piu' e niente promessa AES", !/Non mostrare piu/.test(t1) && !/AES/.test(t1));
  check("1 la frase vera sui dati: restano sul dispositivo, nel cloud solo chiuse a chiave", /restano su questo dispositivo/.test(t1) && /chiuse a chiave/.test(t1));
  check("1 la porta e un dialog modale (aria-modal)", (await porta(page).getAttribute("aria-modal")) === "true");
  check("1 il dock si e ritirato sotto la porta", (await page.locator(".jm-dock:visible, .jm-dock-pillola:visible").count()) === 0);
  await page.getByRole("button", { name: /Comincia a scrivere/ }).click();
  await page.waitForTimeout(500);
  check("1 chiusa: sparisce", (await porta(page).count()) === 0);
  const mem = await page.evaluate(() => ({ l: localStorage.getItem("jm.porta.lettera"), g: localStorage.getItem("jm.porta.giorno") }));
  check("1 chiusa: scrive jm.porta.lettera (versione) e jm.porta.giorno (oggi)", mem.l === "1" && mem.g === oggi, JSON.stringify(mem));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".jm-ed-ta").waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
  check("1 ricaricando oggi non torna", !(await attendiPorta(page, 2500)));
  check("1 nessun errore di pagina", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* 2. primo avvio sul web: solo la lettera */
{
  const { ctx, page } = await dispositivo({ native: false });
  check("2 primo avvio (web): la porta si apre", await attendiPorta(page));
  const t2 = await testo(page);
  check("2 sul web la lettera NON promette il regalo", !/con l'AI accesa/.test(t2) && /Manuel/.test(t2), t2.slice(0, 100));
  check("2 sul web c'e comunque 'Ho gia un account'", /Ho gia un account/.test(t2));
  await ctx.close();
}

/* 3. il giorno dopo, conto cambiato */
{
  giornateSpese(3);
  const { ctx, page, api } = await dispositivo({ seme, negozio: true, memoria: { "jm.porta.lettera": "1", "jm.porta.giorno": ieri, "jm.porta.rimaste": "9" } });
  check("3 giorno nuovo, conto cambiato (9 -> 7): la porta si apre", await attendiPorta(page), api.join(" || ") + " IDB=" + JSON.stringify(await page.evaluate(async () => { const req = indexedDB.open("journalme-chiave"); return await new Promise((res) => { req.onsuccess = () => { const db = req.result; try { const tx = db.transaction("semi", "readonly"); const g = tx.objectStore("semi").get("braccialetto"); g.onsuccess = () => res({ v: db.version, seme: (g.result ?? "").slice(0, 8) }); } catch (e) { res({ v: db.version, err: String(e) }); } }; req.onerror = () => res("err"); }); })));
  const t3 = await testo(page);
  // Parole di Manuel del 12 settembre 2026: un regalo, non un conto alla rovescia.
  check("3 dice '7 giornate AI ancora in regalo' e spiega che e un regalo dello sviluppatore", /7 giornate AI\s*ancora in regalo/.test(t3) && /regalo dello sviluppatore/.test(t3) && /ne restano ancora 7/.test(t3), t3.slice(0, 120));
  check("3 i pallini: 10, di cui 3 spesi", (await page.locator(".jm-benv-sal-pallino").count()) === 10 && (await page.locator(".jm-benv-sal-pallino.spesa").count()) === 3);
  check("3 i tasti: 'Passa a premium' e 'Continua gratis'", /Passa a premium/.test(t3) && /Continua gratis/.test(t3));
  check("3 i pallini hanno aria sotto, prima del tasto (margin-bottom > 0)", parseFloat(await page.locator(".jm-benv-sal-pallini").evaluate((e) => getComputedStyle(e).marginBottom)) >= 16);
  await page.getByRole("button", { name: /Passa a premium/ }).click();
  await page.locator(".jm-wall").waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
  const muro = (await page.locator(".jm-wall").innerText().catch(() => "")).replace(/\s+/g, " ");
  check("3 'Passa a premium' chiude la porta e apre il muro (da ospite: la porta dell'email)", (await porta(page).count()) === 0 && /Entra con la tua email/.test(muro), muro.slice(0, 80));
  await page.getByRole("button", { name: /Entra con la tua email/ }).click();
  await page.waitForURL("**/login**", { timeout: 10_000 }).catch(() => {});
  const riapri = await page.evaluate(() => localStorage.getItem("jm.muro.riapri"));
  check("3 verso il login il muro lascia il promemoria jm.muro.riapri (C1)", /\/login/.test(page.url()) && riapri === "aiSummary", `${page.url()} ${riapri}`);
  await ctx.close();
}

/* 4. il giorno dopo, conto uguale */
{
  giornateSpese(3);
  const { ctx, page } = await dispositivo({ seme, memoria: { "jm.porta.lettera": "1", "jm.porta.giorno": ieri, "jm.porta.rimaste": "7" } });
  check("4 giorno nuovo, conto uguale: la porta si apre", await attendiPorta(page));
  const t4 = await testo(page);
  check("4 il titolo NON e il numero: non c'e 'ancora in regalo' come titolo", !/giornate AI\s*ancora in regalo/.test(t4), t4.slice(0, 80));
  check("4 il conto c'e in piccolo: 'Hai ancora 7 giornate'", /Hai ancora 7 giornate/.test(t4));
  check("4 il tasto pieno e 'Continua', premium e la riga piccola", /Continua/.test(t4) && /Passa a premium/.test(t4) && (await page.locator(".jm-benv-sal-quieto").innerText()).includes("Passa a premium"));
  check("4 la variante e marcata 'uguale' (pallini piccoli via CSS)", (await porta(page).getAttribute("data-variante")) === "uguale");
  await page.locator(".jm-benv-sal-b").click();
  await page.waitForTimeout(400);
  check("4 'Continua' chiude e scrive jm.porta.rimaste = 7 e il giorno", (await page.evaluate(() => localStorage.getItem("jm.porta.rimaste") + "|" + localStorage.getItem("jm.porta.giorno"))) === `7|${oggi}`);
  await ctx.close();
}

/* 5. finite */
{
  giornateSpese(10);
  const { ctx, page } = await dispositivo({ seme, memoria: { "jm.porta.lettera": "1", "jm.porta.giorno": ieri, "jm.porta.rimaste": "1" } });
  check("5 giornate finite: la porta si apre", await attendiPorta(page));
  const t5 = await testo(page);
  check("5 dice 'Le 10 giornate sono finite' e 'resta tutto'", /Le 10 giornate\s*sono finite/.test(t5) && /Il diario resta tutto/.test(t5), t5.slice(0, 100));
  check("5 i tasti: 'Passa a premium' e 'Continua senza AI'", /Passa a premium/.test(t5) && /Continua senza AI/.test(t5));
  await ctx.close();
}

/* 6. sopra il tetto */
{
  giornateSpese(4);
  sb.tab("ai_usage").push({ braccialetto_id: "br-porta-0001", regalo: true, costo_usd: 999, created_at: new Date().toISOString() });
  // Il server tiene la spesa in memoria un minuto: si aspetta che la rilegga.
  const inizio = Date.now();
  for (;;) {
    const r = await fetch(BASE + "/api/ospite/stato", { headers: { "x-jm-braccialetto": segreto } });
    const j = await r.json();
    if (j.sopraIlTetto === true) break;
    if (Date.now() - inizio > 75_000) { check("6 il server vede il tetto", false, JSON.stringify(j)); break; }
    await new Promise((res) => setTimeout(res, 2000));
  }
  const { ctx, page } = await dispositivo({ seme, memoria: { "jm.porta.lettera": "1", "jm.porta.giorno": ieri, "jm.porta.rimaste": "6" } });
  check("6 sopra il tetto: la porta si apre", await attendiPorta(page));
  const t6 = await testo(page);
  check("6 dice 'in pausa' e che le 6 giornate restano, NON 'finite' (C4)", /e in pausa/.test(t6) && /6 giornate restano/.test(t6) && !/sono finite/.test(t6), t6.slice(0, 120));
  await ctx.close();
  sb.tabelle.ai_usage = [];
}

/* 7. dopo il logout la porta tace */
{
  const { ctx, page } = await dispositivo({ memoria: { "jm.saluto.uscito": "1" } });
  await page.locator(".jm-ed-ta").waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
  check("7 dopo 'Esci' (jm.saluto.uscito) nessuna porta, nemmeno la lettera", !(await attendiPorta(page, 2500)));
  await ctx.close();
}

/* 8. Ho gia un account */
{
  const { ctx, page } = await dispositivo({ native: true });
  await attendiPorta(page);
  await page.getByRole("button", { name: /Ho gia un account/ }).click();
  await page.waitForURL("**/login**", { timeout: 10_000 }).catch(() => {});
  check("8 'Ho gia un account' porta a /login e la porta e chiusa", /\/login/.test(page.url()) && (await porta(page).count()) === 0, page.url());
  await ctx.close();
}

await browser.close();
await sb.ferma();
await oa.ferma();

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} PASS`);
process.exit(passed === results.length ? 0 : 1);
