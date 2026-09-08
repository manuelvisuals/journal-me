// Banco del caricamento dell'account demo (scripts/carica-account-demo.mjs).
//
// Il caricatore vero gira sul Mac contro dayalogue.com; questo banco fa
// girare LO STESSO codice contro il dev server coi finti (Supabase e OpenAI
// in memoria), con una sessione cloud gia dentro e il piano premium. Quello
// che prova: che la cassaforte si apre da sola e da otto parole, che ogni
// giornata del json finisce nella sua data, chiusa dall'AI (finta) e con
// gli obiettivi giusti accesi, che i due titoli col lucchetto restano quelli
// di lei, che i memo entrano, e che tutto cio che e uscito verso Supabase e
// cifrato: nessuna parola del diario in chiaro sul filo.
//
// Serve il dev server su :3100 coi finti (vedi la testa di
// verify-abbonamento.mjs) e NEXT_PUBLIC_SUPABASE_URL=https://sbfinto.supabase.co.
import { chromium } from "playwright-core";
import { OpenAIFinto, SupabaseFintoServer } from "./lib/finti-server.mjs";
import { SupabaseFinto, jwtFinto, montaSupabaseFinto, UTENTE_ID } from "./lib/supabase-finto.mjs";
import { caricaDemo, OBIETTIVI_EN, refertoHtml } from "./carica-account-demo.mjs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

// Un mese piccolo, con le stesse forme del json vero: quattro giornate, una
// saltata, un titolo col lucchetto, tre memo.
const DATI = {
  persona: { nome: "Giulia Ferrando" },
  giornate: [
    { data: "2026-08-01", obiettivi: ["corpo", "aria"], testo: "Saturday. Slept seven hours, mood good. Run at Nervi, six kilometres. Focaccia at Piero's. Zafferana quarzite." },
    { data: "2026-08-02", vuota: true },
    { data: "2026-08-03", obiettivi: ["gente"], testo: "Monday. Mr Bruno did the stairs. Elena was late. Brunilde Vespucci called." },
    { data: "2026-08-04", obiettivi: ["corpo", "gente", "letto"], titolo_suo: "Signed", testo: "We signed. Mrs Parodi gave us the keys. Ottaviano clavicembali." },
    { data: "2026-08-05", obiettivi: [], testo: "A quiet day. Read a book on the terrace. Ortigia." },
  ],
  memo: [
    { tipo: "todo", testo: "Call Davide about the quote" },
    { tipo: "idea", testo: "A dog. Marco says no." },
    { tipo: "nota", testo: "Bruno: physiatrist on 10 September" },
  ],
};
const SPIE = ["Zafferana", "quarzite", "Brunilde", "Vespucci", "Ottaviano", "clavicembali", "Ortigia"];

const sb = new SupabaseFintoServer();
const oa = new OpenAIFinto();
await sb.avvia(3198);
await oa.avvia(3199);
const exp = Math.floor(Date.now() / 1000) + 6 * 3600;
const TOKEN = jwtFinto(exp, UTENTE_ID);
sb.utenti.set(TOKEN, { id: UTENTE_ID, email: "banco@dayalogue.test" });
sb.tab("profiles").push({ user_id: UTENTE_ID, plan: "premium", plan_source: "manual", current_period_end: null });

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const finto = new SupabaseFinto();
finto.tabelle.profiles = sb.tab("profiles").map((r) => ({ ...r }));
// I sei obiettivi di fabbrica, come li seminerebbe il trigger della migration 010.
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
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

const log = [];
const referto = await caricaDemo({
  page,
  base: BASE,
  dati: DATI,
  foto: null,
  saltaAccesso: true,
  log: (m) => {
    log.push(m);
    console.log("   . " + m);
  },
});

check("fase completa (piano premium letto dal finto)", referto.fase === "completa", referto.fase + " / " + referto.piano);
check("cassaforte: otto parole prese dalla schermata", referto.parole?.length === 8 && referto.parole.every((p) => /^[a-z]+$/.test(p)), (referto.parole ?? []).join(" "));
check("cassaforte: il server ha la prova, senza le parole", sb.tab("cassaforte_utente").length + finto.tab("cassaforte_utente").length >= 1);
check("profilo: nome salvato sul server", sb.tab("profiles")[0]?.display_name === "Giulia Ferrando" || finto.tab("profiles")[0]?.display_name === "Giulia Ferrando", JSON.stringify(sb.tab("profiles")[0]));
check("obiettivi: i sei inglesi, e basta", JSON.stringify([...referto.obiettivi].sort()) === JSON.stringify(Object.values(OBIETTIVI_EN).sort()), referto.obiettivi.join(", "));

const piene = DATI.giornate.filter((g) => !g.vuota);
check("giornate: una voce per giornata non vuota", referto.giornate.length === piene.length);
check("giornate: nessun errore", referto.giornate.every((g) => g.stato !== "errore") && referto.errori.length === 0, referto.errori.join(" | "));
const cassettine = finto.tab("cassettine");
check("cassettine: una per data, nessuna per il giorno saltato", piene.every((g) => cassettine.some((c) => c.giorno === g.data)) && !cassettine.some((c) => c.giorno === "2026-08-02"), cassettine.map((c) => c.giorno).join(","));
check("titolo dell'AI finta sulle giornate senza lucchetto", referto.giornate.filter((g) => !g.tuo).every((g) => /giornata da ospite/.test(g.titolo)), referto.giornate.map((g) => g.titolo).join(" | "));
check("lucchetto: il 4 ha il titolo di lei", referto.giornate.find((g) => g.data === "2026-08-04")?.tuo === true && referto.giornate.find((g) => g.data === "2026-08-04")?.titolo === "Signed");
check("obiettivi accesi come nel json", referto.giornate.every((g) => g.obiettivi.length === (piene.find((p) => p.data === g.data)?.obiettivi.length ?? 0)));

// Gli obiettivi accesi stanno nella cassettina (cifrata): si controlla riaprendo la giornata.
await page.goto(BASE + "/app/giorno?d=2026-08-04", { waitUntil: "domcontentloaded" });
await page.locator(".jm-goal-row").first().waitFor({ state: "visible", timeout: 30_000 });
const accesi = await page.$$eval(".jm-goal-row[aria-pressed=true] .jm-goal-lab", (l) => l.map((s) => s.textContent.trim()).sort());
check("riaprendo il 4: gli obiettivi accesi sono quelli", JSON.stringify(accesi) === JSON.stringify(["moved my body", "read something", "seen someone"]), accesi.join(", "));
check("riaprendo il 4: il titolo resta suo (tuo)", (await page.locator(".jm-fv-tuo").count()) === 1);

check("memo: tre entrati", referto.memo.length === 3 && finto.tab("remembers").length === 3, String(finto.tab("remembers").length));
const uscito = finto.tuttoCioCheEUscito();
check("cassaforte: nessuna parola del diario e uscita in chiaro verso Supabase", !SPIE.some((s) => uscito.includes(s)), SPIE.filter((s) => uscito.includes(s)).join(","));
check("recap: provato (bottone o motivo scritto)", referto.recap !== null, String(referto.recap));
check("nessun errore di pagina", pageErrors.length === 0, pageErrors.slice(0, 2).join(" | "));
check("referto html: contiene le parole e le giornate", (() => { const h = refertoHtml(referto, { email: "banco@dayalogue.test", base: BASE }); return referto.parole.every((p) => h.includes(p)) && h.includes("Signed"); })());

await browser.close();
await sb.ferma?.();
await oa.ferma?.();
const ko = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - ko}/${results.length} verdi`);
process.exit(ko ? 1 : 0);
