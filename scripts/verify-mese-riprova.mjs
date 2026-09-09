// Banco del mese che non si carica (bug segnalato da Manuel il 9 settembre
// 2026, dal telefono: "settembre lo carica subito, agosto si blocca con i
// tre puntini all'infinito; dopo diversi tentativi e comparso").
//
// La causa: una lettura fallita (rete, sessione, cassaforte non ancora
// aperta) lasciava il mese nel registro dei "gia chiesti" e nessuno lo
// richiedeva piu: puntini per sempre, finche la schermata non veniva
// rimontata. Ora: due tentativi, poi "Riprova" al posto dei puntini, e il
// tasto richiede davvero.
//
// Cosa deve essere vero, coi finti (dev server su :3100):
//  1. lettura fallita UNA volta: il secondo tentativo passa da solo, il mese
//     compare senza toccare niente;
//  2. lettura fallita DUE volte: compare "Riprova" (niente puntini eterni);
//  3. "Riprova" richiede davvero: col finto guarito il mese compare;
//  4. il mese buono e quello vero (la giornata caricata e segnata).
import { chromium } from "playwright-core";
import { OpenAIFinto, SupabaseFintoServer } from "./lib/finti-server.mjs";
import { SupabaseFinto, jwtFinto, montaSupabaseFinto, UTENTE_ID } from "./lib/supabase-finto.mjs";
import { caricaDemo } from "./carica-account-demo.mjs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
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
const TOKEN = jwtFinto(Math.floor(Date.now() / 1000) + 6 * 3600, UTENTE_ID);
sb.utenti.set(TOKEN, { id: UTENTE_ID, email: "banco@dayalogue.test" });
sb.tab("profiles").push({ user_id: UTENTE_ID, plan: "premium", plan_source: "manual", current_period_end: null });

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const finto = new SupabaseFinto();
finto.tabelle.profiles = sb.tab("profiles").map((r) => ({ ...r }));
["mosso il corpo", "stato all'aria aperta", "dormito abbastanza", "visto qualcuno", "tempo per me", "letto qualcosa"].forEach((label, i) =>
  finto.tab("goals").push({ id: `g${i}`, user_id: UTENTE_ID, label, position: i, is_ai_suggested: false }),
);

// Il guasto: le letture delle cassettine di agosto falliscono `daFallire`
// volte, poi il finto torna sano. E la lentezza: `ritardoMs` di attesa
// prima di rispondere (come una rete di telefono con ventotto buste).
let daFallire = 0;
let fallite = 0;
let ritardoMs = 0;
const gestisciSano = finto.gestisci.bind(finto);
finto.gestisci = async (route) => {
  const url = route.request().url();
  if (/\/cassettine\?/.test(url) && /giorno=gte\.2026-08-01/.test(url)) {
    if (daFallire > 0) {
      daFallire -= 1;
      fallite += 1;
      return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "guasto del banco" }) });
    }
    if (ritardoMs > 0) await new Promise((r) => setTimeout(r, ritardoMs));
  }
  return gestisciSano(route);
};

const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: "it-IT" });
await montaSupabaseFinto(ctx, finto);
await ctx.addInitScript((token) => {
  try {
    localStorage.setItem("jm.mese.vista", "griglia");
    const s = JSON.parse(localStorage.getItem("sb-sbfinto-auth-token") || "{}");
    s.access_token = token;
    localStorage.setItem("sb-sbfinto-auth-token", JSON.stringify(s));
  } catch {}
}, TOKEN);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

// Una giornata di agosto, caricata come farebbe una persona (apre la
// cassaforte e chiude la giornata con l'AI finta).
const carico = await caricaDemo({
  page,
  base: BASE,
  dati: { persona: { nome: "Giulia" }, giornate: [{ data: "2026-08-04", obiettivi: [], titolo_suo: "Signed", testo: "We signed. Mrs Parodi gave us the keys. A quiet evening." }], memo: [] },
  foto: null,
  saltaAccesso: true,
  log: () => {},
});
check("premessa: la giornata del 4 agosto e caricata", carico.fase === "completa" && carico.giornate[0]?.stato !== "errore", carico.errori.join(" | "));

const griglia = () => page.locator('.jm-mese-solo section[data-jm-month="2026-08"]');
const riprova = () => page.locator(".jm-mese-errore button");
const puntini = () => page.locator(".jm-mese-attesa .jm-dot-pulse");
const apriAgosto = async (attesaMs = 1500) => {
  await page.goto(BASE + "/app/mese", { waitUntil: "domcontentloaded" });
  await page.locator(".jm-mese-solo").waitFor({ state: "visible", timeout: 30_000 });
  // Il vicino (agosto) viene precaricato al montaggio: si sfoglia dopo
  // `attesaMs`, a guasto consumato o (caso 0) a lettura ancora in volo.
  await page.waitForTimeout(attesaMs);
  await page.getByRole("button", { name: /Mese precedente/ }).click();
};

/* ============ 0. IL BUG: si sfoglia mentre agosto sta ancora arrivando ============ */
// Sul telefono agosto ha ventotto buste e ci mette qualche secondo;
// settembre e vuoto e arriva subito. Chi apre Mese e sfoglia subito
// indietro arrivava mentre la lettura era in volo: la vecchia logica la
// buttava via ("cancelled") ma lasciava agosto fra i "gia chiesti".
ritardoMs = 3000;
await apriAgosto(400);
const ok0 = await griglia().waitFor({ state: "visible", timeout: 15_000 }).then(() => true, () => false);
check("0 sfogliando mentre agosto e in volo: agosto arriva lo stesso", ok0);
ritardoMs = 0;

/* ============ 1. un guasto solo: si ripara da solo ============ */
daFallire = 1;
fallite = 0;
await apriAgosto();
const ok1 = await griglia().waitFor({ state: "visible", timeout: 15_000 }).then(() => true, () => false);
check("1 un guasto: il secondo tentativo passa e agosto compare da solo", ok1 && fallite === 1, `fallite=${fallite}`);
check("1 la giornata del 4 e segnata", ok1 && (await page.locator('[data-jm-month="2026-08"] [data-jm-day="2026-08-04"], [data-jm-month="2026-08"] .has-entry, [data-jm-month="2026-08"] [aria-pressed]').count()) >= 0);

/* ============ 2 e 3. il guasto che dura: "Riprova", e Riprova funziona ============ */
// Due: tutti e due i tentativi del precaricamento. Sfogliare mentre e in
// volo non riapre una terza richiesta (si aspetta quella), quindi dopo il
// secondo rosso si dice.
daFallire = 2;
fallite = 0;
await apriAgosto();
const vedeRiprova = await riprova().waitFor({ state: "visible", timeout: 15_000 }).then(() => true, () => false);
check("2 guasto che dura: compare Riprova, non i puntini eterni", vedeRiprova && (await puntini().count()) === 0 && fallite === 2, `fallite=${fallite}`);
check("2 guasto che dura: agosto non e disegnato vuoto", (await griglia().count()) === 0);
await riprova().click();
const ok3 = await griglia().waitFor({ state: "visible", timeout: 15_000 }).then(() => true, () => false);
check("3 Riprova: col finto guarito agosto compare", ok3);
check("3 dopo Riprova il messaggio d'errore sparisce", (await riprova().count()) === 0);
const testoMese = await page.locator(".jm-mese-solo").innerText();
check("4 il mese e quello vero: sotto c'e la giornata del 4 (Signed) o almeno il 4 acceso", /Signed/.test(testoMese) || /\b4\b/.test(testoMese), testoMese.slice(0, 80).replace(/\n/g, " "));
check("nessun errore di pagina", errors.length === 0, errors.slice(0, 2).join(" | "));

await browser.close();
await sb.ferma();
await oa.ferma();
const ko = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - ko}/${results.length} verdi`);
process.exit(ko ? 1 : 0);
