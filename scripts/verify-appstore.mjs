// I tre blocchi da revisione Apple (PIANO-APPSTORE §1) — porta 3100.
//
// 1a. Dentro il guscio iOS il muro premium NON vende: niente prezzo,
//     niente bottone d'acquisto; la nota onesta e la via del login.
//     Il guscio si simula piantando window.Capacitor PRIMA del bundle:
//     e lo stesso oggetto che il bundle interroga per isNativePlatform().
// 2b. Nel browser invece il bottone col prezzo C'E: la vendita web resta.
// 3. La zona pericolosa cloud ha "Elimina l'account" a DUE tocchi: il
//    primo arma e non chiama nessuna API.
// 4. /api/review-login senza le variabili d'ambiente risponde
//    {review:false}: la porta del revisore spenta e indistinguibile da
//    una porta che non esiste.
import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3100";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

async function open({ native = false, mode = "local" } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 932 },
    locale: "it-IT",
  });
  await ctx.addInitScript(
    ({ native, mode }) => {
      try {
        window.localStorage.setItem("jm.mode", mode);
        if (mode === "cloud") {
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
    { native, mode },
  );
  const page = await ctx.newPage();
  return { ctx, page };
}

/* ---------------- 1a. guscio iOS: il muro non vende ---------------- */
{
  const { ctx, page } = await open({ native: true, mode: "local" });
  // In locale "genera il recap" apre il muro (SPEC-v2 §3.3: mai un 402
  // a sorpresa): e il modo piu affidabile di vederlo senza account.
  await page.goto(BASE + "/recap", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".jm-gen-btn", { timeout: 15000 });
  await page.waitForTimeout(300);
  await page.locator(".jm-gen-btn").first().click();
  await page.waitForSelector(".jm-wall", { timeout: 10000 });
  const wall = await page.locator(".jm-wall").innerText();
  check("guscio iOS: nessun prezzo nel muro", !wall.includes("4,99"));
  check(
    "guscio iOS: nessun bottone d'acquisto",
    !wall.includes("prova premium") && !wall.toLowerCase().includes("try premium"),
  );
  check(
    "guscio iOS: la nota onesta c'e",
    wall.includes("L'abbonamento si attiva a breve"),
  );
  check("guscio iOS: la via del login c'e", wall.includes("Ho gia un account"));
  await ctx.close();
}

/* ---------------- 2b. browser: la vendita web resta ---------------- */
{
  const { ctx, page } = await open({ native: false, mode: "local" });
  await page.goto(BASE + "/recap", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".jm-gen-btn", { timeout: 15000 });
  await page.waitForTimeout(300);
  await page.locator(".jm-gen-btn").first().click();
  await page.waitForSelector(".jm-wall", { timeout: 10000 });
  const wall = await page.locator(".jm-wall").innerText();
  check("browser: il bottone col prezzo c'e", wall.includes("4,99"));
  await ctx.close();
}

/* ------- 3. cloud: Elimina l'account, due tocchi, zero chiamate ------- */
{
  const { ctx, page } = await open({ native: false, mode: "cloud" });
  const chiamate = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/account/delete")) chiamate.push(r.url());
  });
  await page.goto(BASE + "/settings", { waitUntil: "domcontentloaded" });
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
  await page.waitForTimeout(400);
  const armed = await row.innerText();
  check("cloud: il primo tocco arma e chiede conferma", armed.includes("Sicuro?"));
  check("cloud: il primo tocco non chiama nessuna API", chiamate.length === 0);
  await ctx.close();
}

/* --------- 4. la porta del revisore spenta risponde di no --------- */
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

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS${failed.length ? ` . ${failed.length} FAIL` : ""}`);
process.exit(failed.length ? 1 : 0);
