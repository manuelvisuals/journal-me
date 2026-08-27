// Verifica della schermata "Consumi AI" (ramo consumi-ai) — locale, porta 3200.
//
// Cosa prova, in ordine di importanza:
//
//  1. In modalita LOCALE la riga non esiste e NON parte nessuna richiesta
//     esterna, ne verso /api/usage. E la prova che conta: la promessa della
//     modalita locale e "nemmeno una richiesta di rete", e una schermata dei
//     consumi e esattamente il tipo di funzione che la romperebbe per
//     distrazione.
//  2. Con un account cloud, totale e voci corrispondono a una risposta finta
//     di /api/usage: le percentuali, i conteggi umani, l'ordine dalla voce
//     piu cara, e i nomi delle ATTIVITA al posto dei nomi delle route.
//  3. Lo stato vuoto dice perche e vuoto.
//  4. Un 500 si vede scritto, e non viene spacciato per "zero speso".
//
// La sessione cloud e finta: un token non scaduto in localStorage basta a
// getSession() per rispondere senza rete, e tutte le chiamate a Supabase
// sono intercettate. Cosi il ramo cloud diventa verificabile in sandbox,
// che finora non lo era (vedi la nota in scripts/verify-impostazioni.mjs).
import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3200";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

/** La risposta finta: gli stessi numeri del mockup, cosi si confrontano. */
const USAGE_FULL = {
  monthStart: "2026-08-01T00:00:00.000Z",
  byRoute: {
    transcribe: { calls: 12, inputTokens: 21600, outputTokens: 0, audioSeconds: 2160, estUsd: 0.22 },
    recap: { calls: 1, inputTokens: 9000, outputTokens: 2400, estUsd: 0.04, audioSeconds: 0 },
    "process-entry": { calls: 17, inputTokens: 60000, outputTokens: 12000, audioSeconds: 0, estUsd: 0.02 },
    "split-by-date": { calls: 20, inputTokens: 20000, outputTokens: 2000, audioSeconds: 0, estUsd: 0.005 },
    "extract-people": { calls: 12, inputTokens: 12000, outputTokens: 1200, audioSeconds: 0, estUsd: 0.003 },
    classify: { calls: 9, inputTokens: 9000, outputTokens: 900, audioSeconds: 0, estUsd: 0.002 },
  },
  totalUsd: 0.29,
};

const USAGE_EMPTY = {
  monthStart: "2026-08-01T00:00:00.000Z",
  byRoute: {},
  totalUsd: 0,
};

const FAKE_SESSION = {
  access_token: "fake-access-token",
  token_type: "bearer",
  expires_in: 3600,
  // Molto in la: se scadesse, auth-js proverebbe un refresh e quello si
  // vedrebbe come richiesta di rete vera.
  expires_at: 4102444800,
  refresh_token: "fake-refresh-token",
  user: {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "manuel@journal.me",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
  },
};

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

/**
 * @param {{width:number,height:number,mode:"local"|"cloud",usage?:object,usageStatus?:number}} opts
 */
async function open(opts) {
  const ctx = await browser.newContext({
    viewport: { width: opts.width, height: opts.height },
    locale: "it-IT",
  });

  const session = JSON.stringify(FAKE_SESSION);
  await ctx.addInitScript(
    ([mode, sess]) => {
      try {
        if (mode === "local") {
          window.localStorage.setItem("jm.mode", "local");
          /* niente velo del saluto sui banchi */
          window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
          window.localStorage.setItem("jm.saluto.silenzio", "dev:banco");
        }
        else {
          window.localStorage.removeItem("jm.mode");
          window.localStorage.setItem("jm.saluto.silenzio", "usr:00000000-0000-4000-8000-000000000001");
          // La chiave la deriva supabase-js dall'host del progetto:
          // https://example.supabase.co -> sb-example-auth-token.
          window.localStorage.setItem("sb-example-auth-token", sess);
        }
      } catch {}
    },
    [opts.mode, session],
  );

  const page = await ctx.newPage();
  const errors = [];
  const external = [];
  const apiUsage = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("request", (r) => {
    const u = r.url();
    if (u.includes("/api/usage")) apiUsage.push(u);
    if (!u.startsWith(BASE) && !u.startsWith("data:") && !u.startsWith("blob:")) {
      external.push(u);
    }
  });

  // Supabase: mai davvero in rete. In locale non deve nemmeno servire.
  await page.route("**example.supabase.co/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/auth/v1/user")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FAKE_SESSION.user) });
    }
    if (url.includes("/rest/v1/profiles")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ plan: "premium", plan_source: "stripe", current_period_end: null }]) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.route("**/api/usage**", async (route) => {
    if (opts.usageStatus && opts.usageStatus >= 400) {
      return route.fulfill({
        status: opts.usageStatus,
        contentType: "application/json",
        body: JSON.stringify({ error: "Server non configurato" }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(opts.usage ?? USAGE_FULL),
    });
  });

  await page.goto(BASE + "/settings", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  return { ctx, page, errors, external, apiUsage };
}

// Due forme della stessa riga: SetRow nel gruppo Account (telefono) e riga
// della rail destra (desktop). Solo una delle due e visibile per volta.
const visibleRow = (page) =>
  page
    .locator(".jm-st-row:visible, .jm-cs-rrow:visible")
    .filter({ hasText: "Consumi AI" });

/* ================= 1. MODALITA LOCALE: la riga non c'e ================= */
for (const [w, h, dove] of [[1440, 900, "desktop"], [390, 780, "telefono"]]) {
  const { ctx, page, external, apiUsage } = await open({ width: w, height: h, mode: "local" });
  const count = await page.locator(":text('Consumi AI')").count();
  check(`locale ${dove}: nessuna riga Consumi AI`, count === 0, `trovate ${count}`);
  check(`locale ${dove}: nessuna chiamata a /api/usage`, apiUsage.length === 0, apiUsage.join(" "));
  check(
    `locale ${dove}: nessuna richiesta esterna`,
    external.length === 0,
    external.slice(0, 4).join(" "),
  );
  await ctx.close();
}

/* ================= 2. CLOUD, mese pieno ================= */
{
  const { ctx, page, errors } = await open({ width: 1440, height: 900, mode: "cloud" });

  const row = visibleRow(page);
  check("cloud desktop: la riga c'e, una sola", (await row.count()) === 1);
  const rowText = await row.first().innerText();
  check(
    "cloud desktop: la riga vive nella rail destra, sotto Piano",
    (await page.locator(".jm-st-rr .jm-cs-rrow").count()) === 1 &&
      (await page.locator(".jm-cs-deskonly").count()) === 0,
  );
  check("riga: il totale e gia sulla riga", rowText.includes("circa 0,29 $"), rowText.replace(/\n/g, " | "));

  await row.first().click();
  await page.waitForTimeout(600);

  check("pannello: titolo", (await page.locator(".jm-st-h1").innerText()) === "Consumi AI");
  check("pannello: il mese", (await page.locator(".jm-cs-sub").innerText()) === "Agosto 2026, dal giorno 1");

  const total = await page.locator(".jm-cs-total-v").innerText();
  check("totale grosso = 0,29 $", total.replace(/\s+/g, "") === "0,29$", JSON.stringify(total));

  const kicker = (await page.locator(".jm-cs-total-k").innerText()).replace(/\n/g, " ");
  check(
    "sotto il totale: giornate, voce, centesimi al giorno",
    kicker.includes("Stima su 17 giornate, di cui 12 raccontate a voce.") &&
      kicker.includes("Circa 1,7 centesimi a giornata."),
    kicker,
  );

  const titles = await page.locator(".jm-cs-t").allInnerTexts();
  check(
    "quattro voci, in ordine dalla piu cara",
    JSON.stringify(titles) ===
      JSON.stringify([
        "Trascrizione della voce",
        "Recap del mese",
        "Titoli e sintesi delle giornate",
        "Persone, date e note di Ricorda",
      ]),
    JSON.stringify(titles),
  );

  const details = await page.locator(".jm-cs-d").allInnerTexts();
  check(
    "conteggi umani sotto ogni voce",
    JSON.stringify(details) ===
      JSON.stringify([
        "12 registrazioni . 36 minuti",
        "1 recap . il modello grande",
        "17 giornate",
        "41 chiamate in tutto",
      ]),
    JSON.stringify(details),
  );

  const values = (await page.locator(".jm-cs-v").allInnerTexts()).map((v) => v.replace(/\n/g, " "));
  check(
    "importi e quote coerenti con la risposta",
    JSON.stringify(values) ===
      JSON.stringify(["0,22 $ 76%", "0,04 $ 14%", "0,02 $ 7%", "0,01 $ 3%"]),
    JSON.stringify(values),
  );

  const bodyText = await page.locator(".jm-cs").innerText();
  const routeNames = ["transcribe", "process-entry", "split-by-date", "extract-people", "classify"];
  check(
    "nessun nome di route a schermo",
    !routeNames.some((r) => bodyText.includes(r)),
    routeNames.filter((r) => bodyText.includes(r)).join(" "),
  );

  const note = await page.locator(".jm-cs-note").innerText();
  check(
    "la nota dice esatto il conteggio, stima il prezzo, e rimanda a OpenAI",
    note.includes("ufficiali") &&
      note.includes("il conteggio e esatto") &&
      note.includes("ai-usage.ts") &&
      note.includes("pannello OpenAI"),
    note.replace(/\n/g, " ").slice(0, 120),
  );

  // Le barre: larghezza proporzionale, e la piu cara e la piu lunga.
  const bars = await page.locator(".jm-cs-bar i").evaluateAll((els) =>
    els.map((e) => Math.round(e.getBoundingClientRect().width)),
  );
  check(
    "le barre scendono con il costo",
    bars.length === 4 && bars[0] > bars[1] && bars[1] > bars[2] && bars[2] > bars[3],
    JSON.stringify(bars),
  );

  check("cloud: zero errori in console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ================= 3. CLOUD sul telefono ================= */
{
  const { ctx, page } = await open({ width: 390, height: 780, mode: "cloud" });
  const row = visibleRow(page);
  check("cloud telefono: la riga c'e, una sola", (await row.count()) === 1);
  const phoneRow = (await row.first().innerText()).replace(/\n/g, " | ");
  check("cloud telefono: descrizione e totale del mockup",
    phoneRow.includes("Quanto e costato questo mese") && phoneRow.includes("circa 0,29 $"),
    phoneRow);
  await row.first().click();
  await page.waitForTimeout(600);
  check("cloud telefono: il pannello si apre", await page.locator(".jm-cs-total-v").isVisible());
  const w = (await page.locator(".jm-cs").boundingBox())?.width ?? 0;
  check("cloud telefono: il pannello sta nello schermo", w > 0 && w <= 390, String(Math.round(w)));
  await ctx.close();
}

/* ================= 4. Mese vuoto ================= */
{
  const { ctx, page } = await open({ width: 1440, height: 900, mode: "cloud", usage: USAGE_EMPTY });
  const row = visibleRow(page);
  check("vuoto: la riga dice circa 0,00 $", (await row.first().innerText()).includes("circa 0,00 $"));
  await row.first().click();
  await page.waitForTimeout(600);
  const empty = await page.locator(".jm-cs-empty").innerText();
  check(
    "vuoto: dice PERCHE e vuoto, non 'nessun dato'",
    empty.includes("Questo mese l'AI non l'hai ancora usata") &&
      empty.includes("Il conto riparte da zero") &&
      !/nessun dato/i.test(empty),
    empty.replace(/\n/g, " ").slice(0, 100),
  );
  check("vuoto: niente elenco delle voci", (await page.locator(".jm-cs-row").count()) === 0);
  check("vuoto: la nota resta", await page.locator(".jm-cs-note").isVisible());
  await ctx.close();
}

/* ================= 5. Errore ================= */
{
  const { ctx, page } = await open({ width: 1440, height: 900, mode: "cloud", usageStatus: 500 });
  const row = visibleRow(page);
  check("errore: la riga non inventa un totale", (await row.first().innerText()).includes("non disponibile"));
  await row.first().click();
  await page.waitForTimeout(600);
  const err = await page.locator(".jm-cs-err").innerText();
  check(
    "errore: si vede scritto, e dice che non vuol dire zero",
    err.includes("Non sono riuscito a leggere i consumi") && err.includes("non vuol dire che non hai speso"),
    err.replace(/\n/g, " ").slice(0, 120),
  );
  check("errore: nessun totale a schermo", (await page.locator(".jm-cs-total-v").count()) === 0);
  check("errore: c'e il bottone riprova", await page.locator(".jm-cs-retry").isVisible());
  await ctx.close();
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length === 0 ? 0 : 1);
