// I punti da revisione Apple (PIANO-APPSTORE, e l'audit del 10 settembre
// 2026: AUDIT-premium-vuole-account.html) - porta 3100.
//
// Riscritto il 10 settembre 2026: la versione di agosto misurava il modello
// opposto (il web vendeva, il guscio no, e il bivio /benvenuto). Il modello
// di oggi: si compra SOLO nel guscio con In-App Purchase, premium vuole un
// account, sul web non si vende, il bivio non esiste.
//
// 1. Guscio iOS, account gratis (il revisore, decisione 1A): il muro ha le
//    schede con il prezzo di Apple e "Ripristina acquisti"; in Impostazioni
//    "Passa a Premium" e "Ripristina acquisti" ci sono (2.1(b): l'acquisto
//    e raggiungibile e visibile; 3.1.1: il ripristino c'e).
// 2. Guscio iOS, ospite: il muro non vende senza account, dice il prezzo di
//    Apple sotto la porta dell'email (3A), e "Ho gia un abbonamento" e il
//    ripristino di chi non ha ancora l'account.
// 3. Browser: nessun tasto d'acquisto, si rimanda all'app (niente Stripe).
// 4. Cloud: "Elimina l'account" apre un avviso che chiede di SCRIVERE la
//    parola (ELIMINA / DELETE); finche non e quella il tasto rosso e spento
//    e nessuna API viene chiamata (5.1.1(v), e Manuel il 10 settembre 2026:
//    un secondo tocco dove prima c'era la riga si preme per sbaglio).
// 5. /api/review-login senza le variabili risponde {review:false}.
// 6. /app/benvenuto non e piu un bivio: porta dentro.
import { chromium } from "playwright-core";
import { SupabaseFinto, montaSupabaseFinto } from "./lib/supabase-finto.mjs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3100";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

async function open({ native = false, mode = "local", negozio = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 932 },
    locale: "it-IT",
  });
  if (mode === "cloud") {
    // Il Supabase finto nel browser (scripts/lib/supabase-finto.mjs): la
    // sessione e vera per il client, il profilo e GRATIS (il revisore,
    // decisione 1A del 10 settembre 2026).
    const finto = new SupabaseFinto();
    finto.tabelle.profiles = [];
    await montaSupabaseFinto(ctx, finto, {});
    await ctx.addInitScript(() => {
      try {
        window.localStorage.setItem("jm.plan", "free");
      } catch {}
    });
  }
  await ctx.addInitScript(
    ({ native, mode, negozio }) => {
      try {
        window.localStorage.setItem("jm.mode", mode);
        // La porta del giorno (10 settembre 2026): lettera gia vista e giorno
        // gia passato, cosi nessun velo intercetta i click del banco.
        window.localStorage.setItem("jm.porta.lettera", "1");
        const d = new Date();
        window.localStorage.setItem("jm.porta.giorno", `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
        // Il saluto all'avvio (modulo accesso) e un velo aria-modal che
        // intercetta i click: qui si pianta il suo "non mostrare piu",
        // legato all'identita giusta (saluto-stato.ts: in locale e l'id di
        // dispositivo, in cloud "usr:<id>" perche il JWT finto non si
        // decodifica e si ripiega sull'utente).
        if (mode === "local") {
          window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
          window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
        } else {
          window.localStorage.setItem(
            "jm.saluto.silenzio",
            "usr:00000000-0000-4000-8000-000000000001#v1",
          );
        }
        if (mode === "cloud" && false) {
          // (Superato: la sessione la monta montaSupabaseFinto qui sopra.)
          // Sessione finta (stessa ricetta dei banchi Stoqfolio): il client
          // Supabase la legge da localStorage e l'app si crede dentro. Il
          // ref "example" viene da NEXT_PUBLIC_SUPABASE_URL del sandbox.
          const fra = Math.floor(Date.now() / 1000) + 3600;
          window.localStorage.setItem(
            "sb-example-auth-token",
            JSON.stringify({
              access_token: "dummy.dummy.dummy",
              token_type: "bearer",
              expires_in: 3600,
              expires_at: fra,
              refresh_token: "dummy",
              user: {
                id: "00000000-0000-4000-8000-000000000001",
                aud: "authenticated",
                role: "authenticated",
                email: "prova@example.com",
                app_metadata: { provider: "email" },
                user_metadata: {},
                created_at: "2026-01-01T00:00:00Z",
              },
            }),
          );
        }
      } catch {}
      if (negozio) {
        // Il negozio di Apple finto (stessa forma del plugin, come in
        // verify-abbonamento): prezzo e prova come li direbbe StoreKit.
        window.__jmNegozioFinto = {
          async prodotti() { return { prodotti: [{ id: "com.manuelvisuals.journalme.premium.mensile", prezzo: "4,99 EUR", periodo: "mese", provaGiorni: 14, provaDisponibile: true }] }; },
          async compra() { return { esito: "annullato" }; },
          async ripristina() { return { transazioni: [] }; },
          async gestisci() {},
          async finisci() {},
          addListener() { return { remove() {} }; },
        };
      }
      if (native) {
        // Il core di Capacitor RISCRIVE i metodi di window.Capacitor, quindi
        // uno stub li non serve. La leva vera e CapacitorCustomPlatform:
        // getPlatform() restituisce il suo nome (basta che non sia "web" perche
        // isNativePlatform() dica si), e OGNI plugin ripiega sulla sua
        // implementazione web (core, riga 80): cosi il Face ID non blocca il
        // banco. Con name "ios" i plugin proverebbero il bridge nativo e
        // "diverso da web". Letto in node_modules/@capacitor/core, non
        // dedotto. Se un aggiornamento cambia questa meccanica, il banco
        // diventa rosso qui e non in revisione.
        window.CapacitorCustomPlatform = { name: "iosprova" };
      }
    },
    { native, mode, negozio },
  );
  const page = await ctx.newPage();
  return { ctx, page };
}

/**
 * Con un account nuovo il cancello della cassaforte chiede di salvare le
 * otto parole: si passa come una persona (spunta e "Ho capito, continua").
 * Il guscio si finge SOLO con il negozio finto, non con CapacitorCustomPlatform:
 * con quello il portachiavi vorrebbe il plugin nativo, che qui non c'e.
 */
async function passaCancello(page) {
  const parole = page.locator(".jm-login-cassa-check input");
  try {
    await parole.waitFor({ state: "visible", timeout: 20000 });
    await parole.check();
    await page.locator("button.btn-primary").click();
  } catch {
    // gia dentro
  }
  await page.waitForTimeout(800);
}

/* ---- 1. guscio iOS, account gratis: l'acquisto e raggiungibile ---- */
{
  const { ctx, page } = await open({ native: false, mode: "cloud", negozio: true });
  await page.goto(BASE + "/app/settings", { waitUntil: "domcontentloaded" });
  await passaCancello(page);
  await page.waitForSelector(".jm-st-row", { timeout: 25000 });
  await page.waitForTimeout(2500);
  const righe = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  check("1 guscio, account gratis: in Impostazioni c'e 'Passa a Premium' (2.1(b))", /Passa a Premium/.test(righe));
  // 12 settembre 2026: col regalo AI ancora in corso la card "Il diario a
  // voce e spento" non c'e (sarebbe falsa: l'AI lavora), e Premium e una
  // riga dell'Account con la prova e il prezzo di Apple.
  check("1 guscio, account gratis col regalo in corso: niente card 'Il diario a voce e spento', la riga dice la prova e il prezzo di Apple", !/Il diario a voce e spento/.test(righe) && /14 giorni gratis/.test(righe) && /Poi 4,99 EUR al mese/.test(righe) && !/Si attiva dall'app/.test(righe), righe.match(/Passa a Premium[\s\S]{0,90}/)?.[0]);
  check("1 guscio, account gratis: in Impostazioni c'e 'Ripristina acquisti' (3.1.1)", /Ripristina acquisti/.test(righe));
  check("1 guscio, account gratis: nessuna riga 'Ho gia un abbonamento' (quella e da ospite)", !/Ho gia un abbonamento/.test(righe));
  await page.locator("button", { hasText: "Passa a Premium" }).first().click();
  await page.locator(".jm-wall").waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(600);
  const muro = (await page.locator(".jm-wall").innerText().catch(() => "")).replace(/\s+/g, " ");
  check("1 guscio, account gratis: il muro ha la scheda con il prezzo di Apple", (await page.locator("[data-testid='jm-wall-schede']").count()) === 1 && /4,99 EUR/.test(muro), muro.slice(0, 120));
  check("1 guscio, account gratis: il tasto e la prova gratis (Apple), non un prezzo a mano", /Prova gratis 14 giorni/.test(muro));
  check("1 guscio, account gratis: 'Ripristina acquisti' nel muro", /Ripristina acquisti/.test(muro));
  check("1 guscio, account gratis: niente porta dell'email (ha gia l'account)", !/Entra con la tua email/.test(muro));
  await ctx.close();
}

/* ---- 2. guscio iOS, ospite: senza account non si compra, ma si sa il prezzo ---- */
{
  const { ctx, page } = await open({ native: false, mode: "local", negozio: true });
  await page.goto(BASE + "/app/settings", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".jm-st-row", { timeout: 25000 });
  await page.waitForTimeout(2500);
  const righe = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  check("2 guscio, ospite: 'Passa a Premium' con il prezzo di Apple, non quello a mano", /Passa a Premium/.test(righe) && /4,99 EUR/.test(righe) && !/4,99 \u20ac/.test(righe), righe.match(/Passa a Premium[\s\S]{0,80}/)?.[0]?.replace(/\s+/g, " "));
  // 12 settembre 2026: da ospite la porta all'email e UNA sola, "Ho gia un
  // account" (la riga "Ho gia un abbonamento" portava allo stesso /login).
  // Il ripristino di Apple resta nel muro e nell'account.
  check("2 guscio, ospite: una porta sola, 'Ho gia un account' (niente 'Ho gia un abbonamento' ne 'Ripristina acquisti')", /Ho gia un account/.test(righe) && !/Ho gia un abbonamento/.test(righe) && !/Ripristina acquisti/.test(righe), righe.match(/Ho gia un[\s\S]{0,60}/)?.[0]);
  await page.locator(".jm-st-row", { hasText: "Passa a Premium" }).first().click();
  await page.locator(".jm-wall").waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(600);
  const muro = (await page.locator(".jm-wall").innerText().catch(() => "")).replace(/\s+/g, " ");
  check("2 guscio, ospite: il muro non vende: nessuna scheda, 'Entra con la tua email'", (await page.locator("[data-testid='jm-wall-schede']").count()) === 0 && /Entra con la tua email/.test(muro), muro.slice(0, 120));
  check("2 guscio, ospite: il prezzo di Apple e detto PRIMA dell'email (3A)", /14 giorni gratis, poi 4,99 EUR al mese/.test(muro), muro.slice(0, 200));
  check("2 guscio, ospite: 'Ho gia un abbonamento' nel muro", /Ho gia un abbonamento/.test(muro));
  await ctx.close();
}

/* ---------------- 3. browser: non si compra ---------------- */
{
  const { ctx, page } = await open({ native: false, mode: "cloud" });
  await page.goto(BASE + "/app/settings", { waitUntil: "domcontentloaded" });
  await passaCancello(page);
  await page.waitForSelector(".jm-st-row", { timeout: 25000 });
  await page.waitForTimeout(900);
  const testo = await page.locator("main").innerText();
  // 12 settembre 2026: col regalo in corso la card non c'e; resta la riga
  // "Passa a Premium" (apre il muro, che sul web dice che si attiva dall'app).
  check("3 browser, account gratis: nessun tasto di acquisto (niente 'Abbonati' ne 'Prova gratis'), c'e la riga 'Passa a Premium'", /Passa a Premium/.test(testo) && !/Abbonati/.test(testo) && !/Prova gratis/.test(testo) && !/Il diario a voce e spento/.test(testo), testo.replace(/\s+/g, " ").match(/Passa a Premium[\s\S]{0,80}/)?.[0]);
  await page.locator("button", { hasText: "Passa a Premium" }).first().click().catch(() => {});
  await page.locator(".jm-wall").waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  const muro = (await page.locator(".jm-wall").innerText().catch(() => "")).replace(/\s+/g, " ");
  check("3 browser: il muro rimanda all'app ('Scarica dayalogue per iPhone'), niente checkout", /Scarica dayalogue per iPhone/.test(muro) && !/Abbonati/.test(muro) && !/stripe/i.test(muro), muro.slice(0, 100));
  await ctx.close();
}

/* --- 4. cloud: Elimina l'account, si scrive la parola, zero chiamate --- */
{
  const { ctx, page } = await open({ native: false, mode: "cloud" });
  const chiamate = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/account/delete")) chiamate.push(r.url());
  });
  await page.goto(BASE + "/app/settings", { waitUntil: "domcontentloaded" });
  await passaCancello(page);
  // La sessione finta si idrata lato client: le righe arrivano dopo.
  await page.waitForSelector(".jm-st-row", { timeout: 25000 });
  await page.waitForTimeout(900);
  const rows = await page.locator(".jm-st-row").allInnerTexts();
  const blob = rows.join("\n");
  check("cloud: la riga Elimina l'account esiste", blob.includes("Elimina l'account"));
  check(
    "cloud: la cancellazione locale non c'e (e roba della modalita locale)",
    !blob.includes("Cancella tutte le giornate"),
  );
  const row = page.locator(".jm-st-row", { hasText: "Elimina l'account" }).first();
  await row.click();
  await page.waitForSelector(".jm-alert", { timeout: 5000 });
  const avviso = (await page.locator(".jm-alert").innerText()).replace(/\s+/g, " ");
  check("cloud: il tocco apre l'avviso che chiede di scrivere ELIMINA", /ELIMINA/.test(avviso), avviso.slice(0, 90));
  const rosso = page.locator(".jm-alert-btn.rosso");
  check("cloud: con il campo vuoto il tasto rosso e spento", await rosso.isDisabled());
  await page.locator(".jm-alert-campo").fill("qualcosa");
  check("cloud: con la parola sbagliata resta spento", await rosso.isDisabled());
  check("cloud: fin qui nessuna API chiamata", chiamate.length === 0);
  await page.locator(".jm-alert-campo").fill("elimina");
  check("cloud: con la parola giusta (anche minuscola) il tasto si accende", !(await rosso.isDisabled()));
  // Annulla: l'avviso sparisce e non e successo niente.
  await page.locator(".jm-alert-btn.forte").click();
  await page.waitForTimeout(300);
  check("cloud: Annulla chiude l'avviso senza chiamare niente", (await page.locator(".jm-alert").count()) === 0 && chiamate.length === 0);
  await ctx.close();
}

/* --------- 5. la porta del revisore spenta risponde di no --------- */
{
  const { ctx, page } = await open({ native: false, mode: "local" });
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  const r = await page.evaluate(async (base) => {
    const resp = await fetch(base + "/api/review-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "reviewer@example.com" }),
    });
    return { status: resp.status, body: await resp.json() };
  }, BASE);
  check(
    "porta revisore spenta: {review:false}",
    r.status === 200 && r.body.review === false,
    JSON.stringify(r.body),
  );
  const r2 = await page.evaluate(async (base) => {
    const resp = await fetch(base + "/api/review-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "reviewer@example.com", code: "000000" }),
    });
    return resp.status;
  }, BASE);
  check("porta revisore spenta: il codice fisso viene rifiutato", r2 === 401);
  await ctx.close();
}

/* ---- 6. /app/benvenuto non e piu un bivio: porta dentro ---- */
{
  const { ctx, page } = await open({ native: false, mode: "cloud" });
  await page.goto(BASE + "/app/benvenuto", { waitUntil: "domcontentloaded" });
  await page.waitForURL("**/app", { timeout: 15000 }).catch(() => {});
  check("6 /app/benvenuto porta dentro, nessun bivio FREE/PREMIUM", /\/app$/.test(page.url()) && !/Come vuoi iniziare/.test(await page.locator("body").innerText()), page.url());
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS${failed.length ? ` . ${failed.length} FAIL` : ""}`);
process.exit(failed.length ? 1 : 0);
