// Banco di scripts/ritocca-titoli-demo.mjs (9 settembre 2026).
//
// Si carica un mese piccolo coi finti (come verify-account-demo), poi si
// passa il ritocco dei titoli e si prova che: ogni giornata ha il titolo
// chiesto, col lucchetto; una gia col lucchetto e col titolo giusto non si
// tocca; una data vuota non rompe niente; ricaricando la pagina il titolo
// resta; il testo della giornata non e cambiato; nessuna parola in chiaro
// verso Supabase.
//
// Serve il dev server su :3100 coi finti (vedi verify-account-demo.mjs).
import { chromium } from "playwright-core";
import { OpenAIFinto, SupabaseFintoServer } from "./lib/finti-server.mjs";
import { SupabaseFinto, jwtFinto, montaSupabaseFinto, UTENTE_ID } from "./lib/supabase-finto.mjs";
import { caricaDemo } from "./carica-account-demo.mjs";
import { ritoccaTitoli, refertoHtml } from "./ritocca-titoli-demo.mjs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const DATI = {
  persona: { nome: "Giulia Ferrando" },
  giornate: [
    { data: "2026-08-01", obiettivi: ["corpo"], testo: "Saturday. Run at Nervi, six kilometres. Focaccia at Piero's. Zafferana." },
    { data: "2026-08-03", obiettivi: [], testo: "Monday. Mr Bruno did the stairs. Elena was late. Vespucci." },
    { data: "2026-08-04", obiettivi: [], titolo_suo: "Signed", testo: "We signed. Mrs Parodi gave us the keys. Ottaviano." },
  ],
  memo: [],
};
const TITOLI = {
  "2026-08-01": "Market day with friends and a run",
  "2026-08-02": "A day that does not exist",
  "2026-08-03": "Bruno walks without his cane",
  "2026-08-04": "Signed",
};
const SPIE = ["Zafferana", "Vespucci", "Ottaviano", "Market day", "without his cane"];

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
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: "en-GB" });
await montaSupabaseFinto(ctx, finto);
await ctx.addInitScript((token) => {
  try {
    localStorage.setItem("jm:lang", "en");
    const s = JSON.parse(localStorage.getItem("sb-sbfinto-auth-token") || "{}");
    s.access_token = token;
    localStorage.setItem("sb-sbfinto-auth-token", JSON.stringify(s));
  } catch {}
}, TOKEN);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

const carico = await caricaDemo({ page, base: BASE, dati: DATI, foto: null, saltaAccesso: true, log: () => {} });
check("premessa: il mese piccolo e caricato", carico.fase === "completa" && carico.giornate.every((g) => g.stato !== "errore"), carico.errori.join(" | "));
const cassettinePrima = JSON.stringify(finto.tab("cassettine").map((c) => c.giorno).sort());

const r = await ritoccaTitoli({ page, base: BASE, titoli: TITOLI, log: (m) => console.log("   . " + m) });
const per = Object.fromEntries(r.giornate.map((g) => [g.data, g]));
check("01: prima era il titolo dell'AI finta, dopo e quello chiesto", /giornata da ospite/i.test(per["2026-08-01"].prima) && per["2026-08-01"].dopo === TITOLI["2026-08-01"] && per["2026-08-01"].stato === "ritoccata", JSON.stringify(per["2026-08-01"]));
check("03: ritoccata", per["2026-08-03"].stato === "ritoccata" && per["2026-08-03"].dopo === TITOLI["2026-08-03"]);
check("04: gia col lucchetto e giusto, non si tocca", per["2026-08-04"].stato === "gia cosi");
check("02: data vuota, nessun errore", per["2026-08-02"].stato.startsWith("vuota") && !r.errori.some((e) => e.startsWith("2026-08-02")));
check("nessun errore nel referto", r.errori.length === 0, r.errori.join(" | "));

await page.goto(BASE + "/app/giorno?d=2026-08-01", { waitUntil: "domcontentloaded" });
await page.locator(".jm-fv-h").first().waitFor({ state: "visible", timeout: 30_000 });
const titoloRicaricato = await page.locator(".jm-fv-h").first().evaluate((h) => [...h.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join("").trim());
check("ricaricando l'1: il titolo nuovo resta, col lucchetto", titoloRicaricato === TITOLI["2026-08-01"] && (await page.locator(".jm-fv-tuo").count()) === 1, titoloRicaricato);
const testo = await page.locator("body").innerText();
check("ricaricando l'1: il testo della giornata non e cambiato", /Focaccia at Piero/.test(testo));
check("cassettine: stesse date di prima, nessuna nuova", JSON.stringify(finto.tab("cassettine").map((c) => c.giorno).sort()) === cassettinePrima);
const uscito = finto.tuttoCioCheEUscito();
check("cassaforte: ne il testo ne i titoli nuovi escono in chiaro verso Supabase", !SPIE.some((s) => uscito.includes(s)), SPIE.filter((s) => uscito.includes(s)).join(","));
check("nessun errore di pagina", errors.length === 0, errors.slice(0, 2).join(" | "));
check("referto html: contiene prima e dopo", (() => { const h = refertoHtml(r); return h.includes(TITOLI["2026-08-01"]) && /giornata da ospite/i.test(h); })());

await browser.close();
await sb.ferma();
await oa.ferma();
const ko = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - ko}/${results.length} verdi`);
process.exit(ko ? 1 : 0);
