// Banco del titolo del recap in Sentence case (9 settembre 2026, come le
// giornate: PR #88). L'OpenAI finto risponde "un mese finto" tutto minuscolo:
// la route deve restituire "Un mese finto". Piu il prompt e la funzione.
// Serve il dev server su :3100 coi finti.
import { readFileSync } from "node:fs";
import { OpenAIFinto, SupabaseFintoServer } from "./lib/finti-server.mjs";
import { jwtFinto, UTENTE_ID } from "./lib/supabase-finto.mjs";

const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}
const src = readFileSync("src/modules/recap/server/generate.ts", "utf8");
const corpo = src.match(/export function titoloInSentenceCase\(titolo: string\): string \{([\s\S]*?)\n\}/)?.[1];
const fn = new Function("titolo", corpo ?? "return titolo;");
check("1 la funzione esiste", typeof corpo === "string");
check("1 maiuscola iniziale, resto intatto, punto via", fn("agosto: un mese di decisioni con Elena.") === "Agosto: un mese di decisioni con Elena");
check("2 il prompt non chiede piu 'in minuscolo tranne nomi propri'", !/title:[^\n]*in minuscolo tranne nomi propri/.test(src));
check("2 il prompt chiede la maiuscola iniziale e i nomi propri maiuscoli", /title:[^\n]*Maiuscola iniziale[^\n]*SEMPRE con la maiuscola/.test(src));

const sb = new SupabaseFintoServer();
const oa = new OpenAIFinto();
await sb.avvia(3198);
await oa.avvia(3199);
const TOKEN = jwtFinto(Math.floor(Date.now() / 1000) + 3600, UTENTE_ID);
sb.utenti.set(TOKEN, { id: UTENTE_ID, email: "banco@dayalogue.test" });
sb.tab("profiles").push({ user_id: UTENTE_ID, plan: "premium", plan_source: "manual", current_period_end: null });
const r = await fetch(BASE + "/api/recap/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}`, "x-jm-lang": "en" },
  body: JSON.stringify({ periodType: "month", periodStart: "2026-08-01", periodEnd: "2026-08-31", entries: [{ entryDate: "2026-08-01", transcript: "Market day with friends and a run at Nervi. Focaccia at Piero's place." }] }),
});
const out = r.ok ? await r.json() : { errore: r.status, testo: (await r.text()).slice(0, 200) };
check("3 la route risponde 200", r.status === 200, JSON.stringify(out).slice(0, 160));
check("3 il finto risponde minuscolo, la route restituisce la maiuscola", out.title === "Un mese finto", String(out.title));
await sb.ferma();
await oa.ferma();
const ko = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - ko}/${results.length} verdi`);
process.exit(ko ? 1 : 0);
