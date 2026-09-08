// Banco del titolo in Sentence case (decisione di Manuel del 9 settembre
// 2026, guardando l'account demo sul telefono).
//
// Prima il prompt chiedeva il titolo "in minuscolo tranne nomi propri" e il
// modello scriveva minuscoli anche i nomi ("marco measures shop for new
// layout"): accanto ai titoli scritti a mano ("Signed") sembrava un refuso.
//
// Cosa deve essere vero:
//  1. la funzione titoloInSentenceCase mette la maiuscola iniziale, non tocca
//     il resto (i nomi propri li conosce il modello) e toglie il punto finale;
//  2. la route /api/process-entry la applica DAVVERO: l'OpenAI finto risponde
//     con un titolo tutto minuscolo e la route lo restituisce con la maiuscola;
//  3. il prompt chiede la maiuscola iniziale e i nomi propri maiuscoli, e non
//     chiede piu "in minuscolo tranne nomi propri".
//
// Serve il dev server su :3100 coi finti (vedi verify-ospite-schermate.mjs).
import { readFileSync } from "node:fs";
import { OpenAIFinto, SupabaseFintoServer } from "./lib/finti-server.mjs";
import { jwtFinto, UTENTE_ID } from "./lib/supabase-finto.mjs";

const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

/* ============ 1. la funzione, da sola ============ */
// La route e un modulo server di Next: si prova la funzione ricopiandone il
// contratto dal sorgente, cosi se qualcuno la cambia il banco se ne accorge.
const sorgente = readFileSync("src/modules/oggi/server/process-entry.ts", "utf8");
const corpo = sorgente.match(/export function titoloInSentenceCase\(titolo: string\): string \{([\s\S]*?)\n\}/)?.[1];
check("1 la funzione titoloInSentenceCase esiste ed e esportata", typeof corpo === "string");
const titoloInSentenceCase = new Function("titolo", corpo ?? "return titolo;");
check("1 maiuscola iniziale", titoloInSentenceCase("marco measures shop for new layout") === "Marco measures shop for new layout");
check("1 il resto non si tocca (nomi propri e maiuscole del modello restano)", titoloInSentenceCase("cena a Boccadasse con Marco") === "Cena a Boccadasse con Marco");
check("1 il punto finale cade", titoloInSentenceCase("giornata piena.") === "Giornata piena");
check("1 lettera accentata iniziale", titoloInSentenceCase("è arrivato il divano") === "È arrivato il divano");
check("1 vuoto resta vuoto", titoloInSentenceCase("   ") === "");

/* ============ 2. la route coi finti ============ */
const sb = new SupabaseFintoServer();
const oa = new OpenAIFinto();
await sb.avvia(3198);
await oa.avvia(3199);
const TOKEN = jwtFinto(Math.floor(Date.now() / 1000) + 3600, UTENTE_ID);
sb.utenti.set(TOKEN, { id: UTENTE_ID, email: "banco@dayalogue.test" });
sb.tab("profiles").push({ user_id: UTENTE_ID, plan: "premium", plan_source: "manual", current_period_end: null });

const r = await fetch(BASE + "/api/process-entry", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}`, "x-jm-lang": "en" },
  body: JSON.stringify({ transcript: "Marco arrived at noon and wanted to see the shop. We had dinner in Boccadasse." }),
});
const out = r.ok ? await r.json() : { errore: r.status, testo: await r.text() };
check("2 la route risponde 200", r.status === 200, JSON.stringify(out).slice(0, 160));
check("2 il finto risponde minuscolo, la route restituisce la maiuscola", out.headline === "Giornata da ospite, AI accesa", out.headline);

/* ============ 3. il prompt ============ */
check("3 il prompt non chiede piu 'in minuscolo tranne nomi propri' per il titolo", !/headline:[^\n]*in minuscolo tranne nomi propri/.test(sorgente));
check("3 il prompt chiede maiuscola iniziale e nomi propri maiuscoli", /headline:[^\n]*Maiuscola iniziale[^\n]*nomi propri[^\n]*SEMPRE con la maiuscola/.test(sorgente));
check("3 il titolo di ripiego (testo cortissimo) ha la maiuscola", /"Day told" : "Giornata raccontata"/.test(sorgente));

await sb.ferma();
await oa.ferma();
const ko = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - ko}/${results.length} verdi`);
process.exit(ko ? 1 : 0);
