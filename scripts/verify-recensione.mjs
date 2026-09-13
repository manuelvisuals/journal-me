// Verifica della RECENSIONE dormiente (13 settembre 2026; mockup
// design/mockups/admin-iscritti.html, sezione 04):
//
//   1  di fabbrica e SPENTA: GET /api/recensione risponde attiva=false;
//   2  /admin > Recensione: la voce c'e, si accende e si mette "2 giornate",
//      Salva scrive sul server, e GET /api/recensione lo vede subito;
//   3  sul telefono (finto): la prima giornata salvata NON chiede, la
//      seconda chiede (una volta), la terza no (120 giorni); il contatore
//      sul server sale di uno e /admin lo mostra;
//   4  spenta sul server, un telefono nuovo non chiede mai;
//   5  sul web senza plugin non succede niente;
//   6  chi non e admin riceve 404 dalle rotte admin;
//   7  zero errori pagina.
//
// Dev server come per verify-ospite-schermate.mjs (finti su 3198/3199);
// poi: node scripts/verify-recensione.mjs
import { chromium } from "playwright-core";
import { SupabaseFintoServer, OpenAIFinto } from "./lib/finti-server.mjs";
import { SupabaseFinto, jwtFinto, montaSupabaseFinto, UTENTE_ID } from "./lib/supabase-finto.mjs";

const EXE = process.env.JM_CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
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
sb.tab("recensione").push({ id: 1, attiva: false, giornate_minime: 5, updated_at: new Date().toISOString() });

const exp = Math.floor(Date.now() / 1000) + 6 * 3600;
const TOKEN = jwtFinto(exp, UTENTE_ID);
sb.utenti.set(TOKEN, { id: UTENTE_ID, email: "madh52@gmail.com" });
sb.tab("profiles").push({ user_id: UTENTE_ID, plan: "premium", plan_source: "manual", current_period_end: null });
const ALTRO = "00000000-0000-4000-8000-000000000077";
const TOKEN_ALTRO = jwtFinto(exp, ALTRO);
sb.utenti.set(TOKEN_ALTRO, { id: ALTRO, email: "altro@esempio.it" });

const leggi = () => fetch(BASE + "/api/recensione", { cache: "no-store" }).then((r) => r.json());

/* ---------------- 1, 6: le rotte ---------------- */
{
  const r = await leggi();
  check("1 di fabbrica la richiesta e SPENTA (attiva=false, 5 giornate)", r.attiva === false && r.giornateMinime === 5, JSON.stringify(r));
  const no = await fetch(BASE + "/api/admin/recensione", { headers: { authorization: "Bearer " + TOKEN_ALTRO } });
  check("6 chi non e admin riceve 404", no.status === 404, String(no.status));
  const noPut = await fetch(BASE + "/api/admin/recensione", { method: "PUT", headers: { authorization: "Bearer " + TOKEN_ALTRO, "content-type": "application/json" }, body: JSON.stringify({ attiva: true }) });
  check("6 ...anche in scrittura", noPut.status === 404 && sb.tab("recensione")[0].attiva === false, String(noPut.status));
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

/* ---------------- 2: /admin > Recensione ---------------- */
{
  const finto = new SupabaseFinto();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "it-IT" });
  await montaSupabaseFinto(ctx, finto);
  await ctx.addInitScript(({ token }) => {
    try {
      const s = JSON.parse(window.localStorage.getItem("sb-sbfinto-auth-token") || "{}");
      s.access_token = token;
      window.localStorage.setItem("sb-sbfinto-auth-token", JSON.stringify(s));
      window.localStorage.setItem("jm.mode", "cloud");
    } catch {}
  }, { token: TOKEN });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + "/admin", { waitUntil: "domcontentloaded" });
  const parole = page.locator(".jm-login-cassa-check input");
  try {
    await parole.waitFor({ state: "visible", timeout: 8_000 });
    await parole.check();
    await page.locator("button.btn-primary").click();
    await page.goto(BASE + "/admin", { waitUntil: "domcontentloaded" });
  } catch {}
  const nav = page.locator(".jm-adm-nav");
  await nav.waitFor({ state: "visible", timeout: 30_000 });
  check("2 la voce 'Recensione' e nella rail", /Recensione/.test(await nav.innerText()));
  await nav.getByRole("button", { name: "Recensione" }).click();
  const rec = page.locator(".jm-adm-rec");
  await rec.waitFor({ state: "visible", timeout: 20_000 });
  check("2 di fabbrica: 'Spenta' scelta, campo a 5, 0 richieste", (await rec.getByRole("radio", { name: "Spenta" }).getAttribute("aria-checked")) === "true" && (await rec.locator(".jm-adm-rec-campo input").inputValue()) === "5" && /0/.test(await rec.locator(".jm-adm-isc-numeri.tre .n").first().innerText()));
  check("2 'Salva' spento finche non cambi niente", await rec.getByRole("button", { name: /Salva le modifiche/ }).isDisabled());
  await rec.getByRole("radio", { name: "Accesa" }).click();
  await rec.locator(".jm-adm-rec-campo input").fill("2");
  await rec.getByRole("button", { name: /Salva le modifiche/ }).click();
  await page.locator(".jm-adm-esito.ok").waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
  check("2 salvato: il server ha attiva=true e 2 giornate", sb.tab("recensione")[0].attiva === true && sb.tab("recensione")[0].giornate_minime === 2, JSON.stringify(sb.tab("recensione")[0]));
  const r = await leggi();
  check("2 GET /api/recensione lo vede subito (cache dimenticata)", r.attiva === true && r.giornateMinime === 2, JSON.stringify(r));
  check("7 zero errori pagina (admin)", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ---------------- 3, 4, 5: il telefono (finto) ---------------- */
async function telefono({ conPlugin }) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "it-IT" });
  await ctx.route("**/sbfinto.supabase.co/**", (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
  await ctx.addInitScript(({ conPlugin }) => {
    try {
      window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
      window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
      window.localStorage.setItem("jm.mode", "local");
      window.localStorage.setItem("jm.ospite", "1");
    } catch {}
    if (conPlugin) {
      window.__jmRecensioneChiamate = 0;
      window.__jmRecensioneFinto = { chiedi: async () => { window.__jmRecensioneChiamate += 1; return { chiesto: true }; } };
    }
  }, { conPlugin });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  return { ctx, page, errors };
}

async function salvaGiornata(page, testo) {
  await page.locator(".jm-ed-ta").waitFor({ state: "visible", timeout: 30_000 });
  await page.locator(".jm-ed-ta").click();
  await page.keyboard.type(testo);
  await page.keyboard.press("Control+s");
  await page.locator(".jm-fv-h").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(1500);
}

async function aggiungi(page, testo) {
  // Dalla giornata piena si torna all'editor con "scrivi altro" (desktop: il bottone nella colonna).
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  await page.locator(".jm-ed-ta, .jm-fv-h").first().waitFor({ state: "visible", timeout: 30_000 });
  if ((await page.locator(".jm-ed-ta").count()) === 0) {
    const tasto = page.getByRole("button", { name: /scrivi altro|aggiungi|Aggiungi/i }).first();
    await tasto.click();
  }
  await salvaGiornata(page, testo);
}

{
  const richiestePrima = sb.tab("recensione_richieste").length;
  const { ctx, page, errors } = await telefono({ conPlugin: true });
  await salvaGiornata(page, "Prima giornata, tutto bene.");
  const chiamate = () => page.evaluate(() => window.__jmRecensioneChiamate);
  check("3 dopo la PRIMA giornata salvata non si chiede (servono 2)", (await chiamate()) === 0, String(await chiamate()));
  check("3 il contatore locale dice 1", (await page.evaluate(() => localStorage.getItem("jm.recensione.giornate"))) === "1");
  await aggiungi(page, " Seconda giornata, ancora meglio.");
  check("3 dopo la SECONDA si chiede il foglio (una chiamata al plugin)", (await chiamate()) === 1, String(await chiamate()));
  await page.waitForTimeout(800);
  check("3 il server ha contato la richiesta (recensione_richieste +1)", sb.tab("recensione_richieste").length === richiestePrima + 1, String(sb.tab("recensione_richieste").length));
  await aggiungi(page, " Terza giornata.");
  check("3 alla TERZA non si chiede piu (una ogni 120 giorni)", (await chiamate()) === 1, String(await chiamate()));
  check("7 zero errori pagina (telefono)", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();

  // Il pannello mostra il contatore.
  const r = await fetch(BASE + "/api/admin/recensione", { headers: { authorization: "Bearer " + TOKEN } }).then((x) => x.json());
  check("3 /admin legge il contatore: 1 da sempre, 1 questo mese, un'ultima", r.richieste?.totali === 1 && r.richieste?.mese === 1 && !!r.richieste?.ultima, JSON.stringify(r.richieste));
}

{
  // 4: spenta sul server, telefono nuovo con 3 giornate: mai.
  sb.tab("recensione")[0].attiva = false;
  await fetch(BASE + "/api/admin/recensione", { method: "PUT", headers: { authorization: "Bearer " + TOKEN, "content-type": "application/json" }, body: JSON.stringify({ attiva: false }) });
  const { ctx, page } = await telefono({ conPlugin: true });
  await salvaGiornata(page, "Uno.");
  await aggiungi(page, " Due.");
  await aggiungi(page, " Tre.");
  check("4 con l'interruttore spento un telefono nuovo non chiede mai", (await page.evaluate(() => window.__jmRecensioneChiamate)) === 0);
  await ctx.close();
}

{
  // 5: sul web (senza plugin) non succede niente, anche con l'interruttore acceso.
  sb.tab("recensione")[0].attiva = true;
  await fetch(BASE + "/api/admin/recensione", { method: "PUT", headers: { authorization: "Bearer " + TOKEN, "content-type": "application/json" }, body: JSON.stringify({ attiva: true, giornate_minime: 1 }) });
  const prima = sb.tab("recensione_richieste").length;
  const { ctx, page, errors } = await telefono({ conPlugin: false });
  await salvaGiornata(page, "Dal browser.");
  await page.waitForTimeout(800);
  check("5 sul web senza plugin nessuna richiesta parte", sb.tab("recensione_richieste").length === prima && (await page.evaluate(() => localStorage.getItem("jm.recensione.ultima"))) === null);
  check("7 zero errori pagina (web)", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

await browser.close();
await sb.ferma();
await oa.ferma();
const pass = results.filter((r) => r.ok).length;
console.log(`\n${pass}/${results.length} PASS`);
process.exit(pass === results.length ? 0 : 1);
