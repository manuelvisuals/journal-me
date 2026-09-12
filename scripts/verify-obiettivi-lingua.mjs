// Gli obiettivi di fabbrica nascono nella lingua del dispositivo
// (Manuel, 12 settembre 2026, opzione 1: "devono essere O in inglese O in
// italiano"). Tre cose, e non una:
//
//   1. il contratto (src/lib/data/store/default-goals.ts): due liste, la
//      funzione che sceglie, e il riconoscimento in tutte e due le lingue;
//   2. l'OSPITE: un telefono inglese si trova "moved my body", uno
//      italiano "mosso il corpo" (LocalStore semina con getLang());
//   3. l'ACCOUNT: la rotta /api/account/obiettivi-di-fabbrica semina sei
//      etichette nella lingua chiesta, segna profiles.goals_seeded_at, e la
//      seconda volta non semina piu — nemmeno se nel frattempo la persona
//      li ha cancellati tutti (cancellarli e una scelta). Chi esisteva
//      prima della migration 029 ha gia il segno e non riceve niente.
//
// Dev server con i finti (come verify-ospite-schermate.mjs), poi:
//   node --experimental-strip-types scripts/verify-obiettivi-lingua.mjs
import { chromium } from "playwright-core";
import { SupabaseFintoServer, OpenAIFinto } from "./lib/finti-server.mjs";
import { jwtFinto } from "./lib/supabase-finto.mjs";
import {
  DEFAULT_GOAL_LABELS_EN,
  DEFAULT_GOAL_LABELS_IT,
  eDiFabbrica,
  etichetteDiFabbrica,
} from "../src/lib/data/store/default-goals.ts";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

/* ---------------- 1. il contratto ---------------- */
check("1 sei etichette per lingua", DEFAULT_GOAL_LABELS_IT.length === 6 && DEFAULT_GOAL_LABELS_EN.length === 6);
check("1 'en' da la lista inglese, tutto il resto quella italiana", etichetteDiFabbrica("en")[0] === "moved my body" && etichetteDiFabbrica("it")[0] === "mosso il corpo" && etichetteDiFabbrica(null)[0] === "mosso il corpo");
check("1 di fabbrica si riconoscono in tutte e due le lingue, senza maiuscole", eDiFabbrica("Moved my body") && eDiFabbrica(" stato all'aria aperta ") && !eDiFabbrica("play handpan"));

/* ---------------- 2. l'ospite, nelle due lingue ---------------- */
const sb = new SupabaseFintoServer();
const oa = new OpenAIFinto();
await sb.avvia(3198);
await oa.avvia(3199);
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
for (const [locale, attesa, altra] of [["en-US", "moved my body", "mosso il corpo"], ["it-IT", "mosso il corpo", "moved my body"]]) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 900 }, locale });
  await ctx.route(`**/sbfinto.supabase.co/**`, (r) => r.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
  await ctx.addInitScript(() => { try { localStorage.setItem("jm.saluto.dispositivo", "dev:banco"); localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1"); } catch {} });
  const page = await ctx.newPage();
  await page.goto(BASE + "/app/settings", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".jm-st-row", { timeout: 30_000 });
  await page.waitForTimeout(1200);
  await page.locator(".jm-st-row", { hasText: /^(Obiettivi|Goals)/ }).first().click();
  await page.waitForTimeout(800);
  const testo = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  check(`2 ospite ${locale}: gli obiettivi di fabbrica sono '${attesa}', non '${altra}'`, testo.includes(attesa) && !testo.includes(altra), testo.slice(0, 120));
  await ctx.close();
}
await browser.close();

/* ---------------- 3. l'account: la rotta del seme ---------------- */
const UTENTE = "00000000-0000-4000-8000-0000000000aa";
const TOKEN = jwtFinto(Math.floor(Date.now() / 1000) + 3600, UTENTE);
sb.utenti.set(TOKEN, { id: UTENTE, email: "nuovo@dayalogue.test" });
sb.tab("profiles").push({ user_id: UTENTE, plan: "free" });
const semina = (lingua) => fetch(BASE + "/api/account/obiettivi-di-fabbrica", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + TOKEN }, body: JSON.stringify({ lingua }) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const senza = await fetch(BASE + "/api/account/obiettivi-di-fabbrica", { method: "POST" });
check("3 senza gettone: 401", senza.status === 401, String(senza.status));
const prima = await semina("en");
const miei = () => sb.tab("goals").filter((g) => g.user_id === UTENTE);
check("3 primo accesso in inglese: 6 seminati", prima.status === 200 && prima.body?.seminati === 6 && miei().length === 6, JSON.stringify(prima.body));
check("3 ...e sono quelli inglesi, in ordine", JSON.stringify(miei().map((g) => g.label)) === JSON.stringify([...DEFAULT_GOAL_LABELS_EN]) && miei().map((g) => g.position).join(",") === "0,1,2,3,4,5", miei().map((g) => g.label).join(" | "));
const prof = sb.tab("profiles").find((p) => p.user_id === UTENTE);
check("3 il profilo porta il segno goals_seeded_at", typeof prof?.goals_seeded_at === "string", String(prof?.goals_seeded_at));
const seconda = await semina("it");
check("3 la seconda volta (anche in un'altra lingua) non semina: 0", seconda.body?.seminati === 0 && miei().length === 6, JSON.stringify(seconda.body));
// cancellati tutti: non tornano
sb.tabelle.goals = sb.tab("goals").filter((g) => g.user_id !== UTENTE);
const terza = await semina("en");
check("3 cancellati tutti gli obiettivi, al login dopo NON tornano", terza.body?.seminati === 0 && miei().length === 0, JSON.stringify(terza.body));
// chi esisteva prima della 029: segno gia messo dalla migration, niente seme
const VECCHIO = "00000000-0000-4000-8000-0000000000bb";
const TOKEN2 = jwtFinto(Math.floor(Date.now() / 1000) + 3600, VECCHIO);
sb.utenti.set(TOKEN2, { id: VECCHIO, email: "vecchio@dayalogue.test" });
sb.tab("profiles").push({ user_id: VECCHIO, plan: "free", goals_seeded_at: "2026-09-12T00:00:00.000Z" });
const vecchio = await fetch(BASE + "/api/account/obiettivi-di-fabbrica", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + TOKEN2 }, body: JSON.stringify({ lingua: "en" }) }).then((r) => r.json());
check("3 account nato prima della 029 (segno gia messo): niente seme", vecchio.seminati === 0 && sb.tab("goals").filter((g) => g.user_id === VECCHIO).length === 0, JSON.stringify(vecchio));
// la migrazione dell'ospite puo aver gia fatto salire un obiettivo suo: il seme aggiunge solo quelli che mancano
const TERZO = "00000000-0000-4000-8000-0000000000cc";
const TOKEN3 = jwtFinto(Math.floor(Date.now() / 1000) + 3600, TERZO);
sb.utenti.set(TOKEN3, { id: TERZO, email: "terzo@dayalogue.test" });
sb.tab("profiles").push({ user_id: TERZO, plan: "free" });
sb.tab("goals").push({ id: "g-suo", user_id: TERZO, label: "Play handpan", position: 0 }, { id: "g-gia", user_id: TERZO, label: "Slept enough", position: 1 });
const terzo = await fetch(BASE + "/api/account/obiettivi-di-fabbrica", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + TOKEN3 }, body: JSON.stringify({ lingua: "en" }) }).then((r) => r.json());
const suoi = sb.tab("goals").filter((g) => g.user_id === TERZO);
check("3 con obiettivi gia saliti: semina solo quelli che mancano, dopo i suoi", terzo.seminati === 5 && suoi.length === 7 && suoi[0].label === "Play handpan" && suoi.every((g, i) => g.position === i), suoi.map((g) => g.label).join(" | "));

await sb.ferma?.();
await oa.ferma?.();
const fails = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - fails}/${results.length} PASS`);
process.exit(fails ? 1 : 0);
