// Banco di NOME E FOTO PER TUTTI (7 settembre 2026, deciso da Manuel):
// anche da ospite, e condivisi fra i dispositivi con l'account.
//
// La fonte locale e localStorage `jm.profilo` = { nome, foto, daOspite }
// (src/modules/impostazioni/profilo.ts). Cosa pretende questo banco:
//   1. l'OSPITE mette nome e foto, riapre: ci sono, e ZERO richieste al
//      server (ne /api/account/*, ne profiles);
//   2. sessione CLOUD con `profiles` vuoto e un locale segnato daOspite: alla
//      prima lettura partono i due POST (nome e avatar) e il segno sparisce;
//   3. `profiles` PIENO e locale diverso (senza segno): vince il server;
//   4. `profiles` VUOTO e locale senza segno: il locale si svuota (la
//      cancellazione fatta altrove attacca anche qui);
//   5. dopo il logout `jm.profilo` e vuoto.
//
// Serve il dev server su :3100 con i finti (come verify-abbonamento):
//   JM_SUPABASE_URL_SERVER=http://127.0.0.1:3198 OPENAI_BASE_URL=http://127.0.0.1:3199
//   SUPABASE_SERVICE_ROLE_KEY=finto OPENAI_API_KEY=finto ./node_modules/.bin/next dev -p 3100
// poi: node scripts/verify-profilo-ovunque.mjs
import { chromium } from "playwright-core";
import { OpenAIFinto, SupabaseFintoServer } from "./lib/finti-server.mjs";
import { SupabaseFinto, jwtFinto, montaSupabaseFinto, UTENTE_ID } from "./lib/supabase-finto.mjs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const SB_HOST = "sbfinto.supabase.co";

// Un PNG 2x2 rosso: basta al ritaglio, e il risultato e una data URL JPEG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAD0lEQVR4nGP4z8DwHwYABv4D/aCbBYYAAAAASUVORK5CYII=",
  "base64",
);
const FOTO_LOCALE = "data:image/png;base64," + PNG.toString("base64");
const FOTO_SERVER = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra && !ok ? "  -- " + extra : ""}`);
}

const sb = new SupabaseFintoServer();
const oa = new OpenAIFinto();
await sb.avvia(3198);
await oa.avvia(3199);

const exp = Math.floor(Date.now() / 1000) + 3600;
const TOKEN = jwtFinto(exp, UTENTE_ID);
sb.utenti.set(TOKEN, { id: UTENTE_ID, email: "manuel@dayalogue.test" });
sb.tab("profiles").push({ user_id: UTENTE_ID, plan: "free", plan_source: null, current_period_end: null, display_name: null, avatar_data: null });
const profilo = () => sb.tab("profiles").find((p) => p.user_id === UTENTE_ID);

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

/** Conta le richieste che escono verso il nostro server e verso Supabase. */
function contatore(page) {
  const viste = [];
  page.on("request", (r) => {
    const u = r.url();
    if (u.includes("/api/") || u.includes(SB_HOST)) viste.push(`${r.method()} ${u.replace(BASE, "")}`);
  });
  return viste;
}

/** Un ospite (modalita locale di fabbrica), senza nessuna sessione. */
async function ospite({ profiloLocale = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 900 }, locale: "it-IT" });
  await ctx.route(`**/${SB_HOST}/**`, (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
  await ctx.addInitScript(({ profiloLocale }) => {
    try {
      window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
      window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
      window.localStorage.setItem("jm.welcomeSeen", "1");
      // Solo la prima volta: lo script d'avvio gira a OGNI navigazione.
      if (profiloLocale && !window.sessionStorage.getItem("jm.banco.profilo")) {
        window.localStorage.setItem("jm.profilo", JSON.stringify(profiloLocale));
        window.sessionStorage.setItem("jm.banco.profilo", "1");
      }
    } catch {}
  }, { profiloLocale });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return { ctx, page, errors };
}

/** Un dispositivo con la sessione cloud dell'utente; `profiles` specchia il server. */
async function cloud({ profiloLocale = null } = {}) {
  const finto = new SupabaseFinto();
  finto.tabelle.profiles = [];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "it-IT" });
  await montaSupabaseFinto(ctx, finto);
  await ctx.route(`**/${SB_HOST}/rest/v1/profiles**`, (route) => {
    finto.tabelle.profiles = sb.tab("profiles").map((r) => ({ ...r }));
    return finto.gestisci(route);
  });
  await ctx.addInitScript(({ token, profiloLocale }) => {
    try {
      window.localStorage.setItem("jm.plan", "free");
      const s = JSON.parse(window.localStorage.getItem("sb-sbfinto-auth-token") || "{}");
      s.access_token = token;
      window.localStorage.setItem("sb-sbfinto-auth-token", JSON.stringify(s));
      if (profiloLocale && !window.sessionStorage.getItem("jm.banco.profilo")) {
        window.localStorage.setItem("jm.profilo", JSON.stringify(profiloLocale));
        window.sessionStorage.setItem("jm.banco.profilo", "1");
      }
    } catch {}
  }, { token: TOKEN, profiloLocale });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return { ctx, page, errors };
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
    // gia dentro
  }
  await page.waitForTimeout(1200);
}

/** Va a una schermata e aspetta un elemento; se l'app ha rimandato altrove, riprova una volta. */
async function vai(page, path, locator, timeout = 60_000) {
  for (let i = 0; i < 2; i++) {
    await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
    try {
      await locator.waitFor({ state: "visible", timeout });
      return;
    } catch (e) {
      console.log(`  (vai ${path}: url=${page.url()} tentativo ${i + 1}: ${(await page.locator("body").innerText().catch(() => "")).slice(0, 160).replace(/\n+/g, " / ")})`);
      if (i === 1) throw e;
    }
  }
}

const leggiLocale = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("jm.profilo") || "null"));

/* ================= 1. L'ospite: nome e foto, solo sul dispositivo ================= */
{
  const { ctx, page, errors } = await ospite();
  const viste = contatore(page);
  await vai(page, "/app", page.getByRole("button", { name: /Racconta a voce/ }));
  const rigaNome = page.getByRole("button", { name: /^Nome/ }).locator("visible=true").first();
  await vai(page, "/app/settings", rigaNome);
  check("1 ospite: in Impostazioni ci sono le righe Foto profilo e Nome", (await page.locator(".jm-foto-mini, .jm-foto-avbtn").count()) >= 1);
  await rigaNome.click();
  const campo = page.locator(".jm-nome-campo");
  await campo.waitFor({ state: "visible", timeout: 10_000 });
  const lede = await page.locator(".jm-st-lede").innerText();
  check("1 ospite: la schermata del nome non parla di email", !/email/i.test(lede), lede);
  await campo.fill("Manuel");
  await page.locator(".jm-nome-salva").click();
  await page.waitForTimeout(600);
  // La foto: dal foglio, con un file dalla libreria, poi il ritaglio.
  await page.getByRole("button", { name: /Foto profilo/ }).locator("visible=true").first().click();
  await page.locator("input[type=file][accept='image/*']:not([capture])").first().setInputFiles({ name: "io.png", mimeType: "image/png", buffer: PNG });
  await page.locator(".jm-foto-usa").waitFor({ state: "visible", timeout: 10_000 });
  await page.locator(".jm-foto-usa").click();
  await page.waitForTimeout(800);
  let loc = await leggiLocale(page);
  check("1 ospite: jm.profilo ha nome, foto e daOspite: true", loc?.nome === "Manuel" && typeof loc?.foto === "string" && loc.foto.startsWith("data:image/") && loc.daOspite === true, JSON.stringify(loc)?.slice(0, 120));
  // Riapre: tutto c'e, e nessuna richiesta.
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const nomeNelMenu = await page.locator(".jm-acct-btn, [aria-label*='account' i]").first().count();
  await vai(page, "/app/settings", page.getByRole("button", { name: /^Nome/ }).locator("visible=true").first());
  const testo = await page.locator("main").innerText();
  check("1 ospite: riaperta l'app, il nome scelto e a schermo al posto di 'Questo dispositivo'", /Manuel/.test(testo) && !/Questo dispositivo/.test(testo), testo.slice(0, 200));
  check("1 ospite: la foto e nel pallino", (await page.locator(".jm-foto-mini img, .jm-foto-avbtn img").count()) >= 1);
  const alServer = viste.filter((v) => /account\/|profiles/.test(v));
  check("1 ospite: ZERO richieste per il profilo al server", alServer.length === 0, alServer.join(" | "));
  check("1 ospite: zero errori di pagina", errors.length === 0, errors.slice(0, 2).join(" | "));
  void nomeNelMenu;
  await ctx.close();
}

/* ================= 2. Poi l'account: il locale segnato daOspite sale, una volta ================= */
{
  const { ctx, page, errors } = await cloud({ profiloLocale: { nome: "Manuel", foto: FOTO_LOCALE, daOspite: true } });
  const viste = contatore(page);
  const risposte = Promise.all([
    page.waitForResponse((r) => /\/api\/account\/nome$/.test(r.url()), { timeout: 90_000 }),
    page.waitForResponse((r) => /\/api\/account\/avatar$/.test(r.url()), { timeout: 90_000 }),
  ]);
  await entra(page);
  const [rn, ra] = await risposte;
  check("2 account: i due POST rispondono 200", rn.status() === 200 && ra.status() === 200, `${rn.status()} ${ra.status()}`);
  // Il segno si toglie DOPO le due risposte: un istante prima di cambiare pagina.
  await page.waitForTimeout(800);
  await vai(page, "/app/settings", page.locator(".jm-st-acct"));
  await page.waitForTimeout(1500);
  const p = profilo();
  const post = viste.filter((v) => /^POST \/api\/account\/(nome|avatar)/.test(v));
  check("2 account: alla prima lettura partono i POST di nome e avatar", post.some((v) => /nome/.test(v)) && post.some((v) => /avatar/.test(v)), post.join(" | "));
  // Una volta sola: alla prossima apertura il segno non c'e piu e non parte niente.
  const prima = post.length;
  await vai(page, "/app/settings", page.locator(".jm-st-acct"));
  await page.waitForTimeout(2000);
  const dopo = viste.filter((v) => /^POST \/api\/account\/(nome|avatar)/.test(v)).length;
  check("2 account: alla riapertura NON si rimanda niente (il segno e sparito)", dopo === prima, `${prima} -> ${dopo}`);
  check("2 account: il server ha nome e foto dell'ospite", p.display_name === "Manuel" && p.avatar_data === FOTO_LOCALE, JSON.stringify({ n: p.display_name, f: (p.avatar_data || "").slice(0, 30) }));
  const loc = await leggiLocale(page);
  check("2 account: il segno daOspite sparisce dal locale", loc && loc.daOspite === false && loc.nome === "Manuel", JSON.stringify(loc)?.slice(0, 120));
  check("2 account: la rail mostra il nome", /Manuel/.test(await page.locator(".jm-st-acct").innerText()));
  check("2 account: zero errori di pagina", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ================= 3. profiles pieno e locale diverso: vince il server ================= */
{
  Object.assign(profilo(), { display_name: "Manu", avatar_data: FOTO_SERVER });
  const { ctx, page } = await cloud({ profiloLocale: { nome: "Vecchio", foto: FOTO_LOCALE, daOspite: false } });
  const viste = contatore(page);
  await entra(page);
  await vai(page, "/app/settings", page.locator(".jm-st-acct"));
  await page.waitForTimeout(2500);
  const loc = await leggiLocale(page);
  check("3 server pieno: il locale prende nome e foto del server", loc?.nome === "Manu" && loc?.foto === FOTO_SERVER && loc.daOspite === false, JSON.stringify(loc)?.slice(0, 120));
  check("3 server pieno: a schermo c'e il nome del server", /Manu\b/.test(await page.locator(".jm-st-acct").innerText()) && !/Vecchio/.test(await page.locator(".jm-st-acct").innerText()));
  check("3 server pieno: nessun POST (il server non si tocca)", viste.filter((v) => /^POST \/api\/account/.test(v)).length === 0, viste.join(" | "));
  await ctx.close();
}

/* ================= 4. profiles vuoto e locale senza segno: il locale si svuota ================= */
{
  Object.assign(profilo(), { display_name: null, avatar_data: null });
  const { ctx, page } = await cloud({ profiloLocale: { nome: "Manu", foto: FOTO_SERVER, daOspite: false } });
  await entra(page);
  await vai(page, "/app/settings", page.locator(".jm-st-acct"));
  await page.waitForTimeout(2500);
  const loc = await leggiLocale(page);
  check("4 server vuoto: il locale si svuota (la cancellazione fatta altrove attacca)", loc && loc.nome === null && loc.foto === null, JSON.stringify(loc));
  {
    // L'email della sessione finta del browser e banco@dayalogue.test.
    const rail = await page.locator(".jm-st-acct").innerText();
    check("4 server vuoto: a schermo torna il nome dell'email", /\bbanco\b/.test(rail) && !/Manu\b/.test(rail), rail.slice(0, 80));
  }

  /* ================= 5. Il logout svuota jm.profilo ================= */
  await page.evaluate(() => localStorage.setItem("jm.profilo", JSON.stringify({ nome: "Manuel", foto: null, daOspite: false })));
  await page.getByRole("button", { name: /Esci dall'account/ }).first().click();
  await page.waitForTimeout(1500);
  const dopo = await page.evaluate(() => localStorage.getItem("jm.profilo"));
  check("5 logout: jm.profilo e vuoto", dopo === null, String(dopo));
  await ctx.close();
}

await browser.close();
await sb.ferma();
await oa.ferma();

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} PASS`);
process.exit(passed === results.length ? 0 : 1);
