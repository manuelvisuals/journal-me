// Banco dell'umore non detto (Manuel, 13 settembre 2026: "se non dici il tuo
// mood, automaticamente diventa so-so").
//
// Cosa deve essere vero:
//  1. il righello umoreDetto() (src/modules/oggi/server/umore-detto.ts)
//     riconosce un racconto che parla di come ci si sente e uno che non ne
//     parla, in italiano e in inglese, senza farsi ingannare da "bene" e
//     "good" usati per le cose invece che per la persona;
//  2. la route /api/process-entry lo applica DAVVERO: l'OpenAI finto risponde
//     'neutral' su un testo senza umore e la route restituisce null; sullo
//     stesso finto con un testo che dice "sereno" l'umore resta;
//  3. il prompt non descrive piu 'neutral' come "normale" e dice che una
//     giornata senza parole sull'umore e null.
//
// Serve il dev server su :3100 coi finti (vedi verify-ospite-schermate.mjs)
// e Node con --experimental-strip-types:
//   node --experimental-strip-types scripts/verify-umore-non-detto.mjs
import { readFileSync } from "node:fs";
import { umoreDetto, umoreDaSalvare } from "../src/modules/oggi/server/umore-detto.ts";
import { OpenAIFinto, SupabaseFintoServer } from "./lib/finti-server.mjs";
import { jwtFinto, UTENTE_ID } from "./lib/supabase-finto.mjs";

const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

/* ============ 1. il righello, da solo ============ */
const senza = [
  "Riunione alle 9, pranzo con Marco, poi spesa e cena a casa.",
  "E andata bene la presentazione, il cliente ha detto di si.",
  "Ho dormito 7 ore, pesavo 83,3 kg, mattina in ufficio.",
  "Meeting at 9, lunch with Marco, groceries, dinner at home.",
  "The demo went well and the client said yes. Good day for the shop.",
  "Ho spento la luce e ho caricato il telefono.",
  "",
];
for (const t of senza) check(`1 non parla dell'umore: ${JSON.stringify(t).slice(0, 50)}`, umoreDetto(t) === false);

const con = [
  "Mi sono svegliato sereno, poi ufficio.",
  "Oggi ero un po' giu di morale, non so perche.",
  "Sto bene, giornata tranquilla.",
  "Così così oggi, niente di che.",
  "Stanco morto, ma contento.",
  "Umore alle stelle dopo la telefonata.",
  "Stavo male stamattina, poi meglio.",
  "I felt great this morning, then work.",
  "Feeling so-so today.",
  "I was anxious about the meeting all day.",
  "Tired and a bit sad after the call.",
];
for (const t of con) check(`1 parla dell'umore: ${JSON.stringify(t).slice(0, 50)}`, umoreDetto(t) === true);

check("1 umoreDaSalvare: modello 'neutral' + testo senza umore -> null", umoreDaSalvare("neutral", senza[0]) === null);
check("1 umoreDaSalvare: modello 'good' + testo con umore -> resta", umoreDaSalvare("good", con[0]) === "good");
check("1 umoreDaSalvare: modello null -> null", umoreDaSalvare(null, con[0]) === null);

/* ============ 2. la route coi finti ============ */
const sb = new SupabaseFintoServer();
const oa = new OpenAIFinto();
await sb.avvia(3198);
await oa.avvia(3199);
const TOKEN = jwtFinto(Math.floor(Date.now() / 1000) + 3600, UTENTE_ID);
sb.utenti.set(TOKEN, { id: UTENTE_ID, email: "banco@dayalogue.test" });
sb.tab("profiles").push({ user_id: UTENTE_ID, plan: "premium", plan_source: "manual", current_period_end: null });

async function chiedi(transcript) {
  const r = await fetch(BASE + "/api/process-entry", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}`, "x-jm-lang": "it" },
    body: JSON.stringify({ transcript }),
  });
  return { status: r.status, out: r.ok ? await r.json() : { errore: await r.text() } };
}

oa.mood = "neutral";
const a = await chiedi("Riunione alle 9, pranzo con Marco, poi spesa e cena a casa.");
check("2 la route risponde 200", a.status === 200, JSON.stringify(a.out).slice(0, 160));
check("2 il finto dice 'neutral' su un testo senza umore: la route restituisce null", a.out?.metrics?.mood === null, String(a.out?.metrics?.mood));

const b = await chiedi("Mi sono svegliato sereno, poi riunione alle 9 e pranzo con Marco.");
check("2 stesso finto, testo che dice 'sereno': l'umore resta", b.out?.metrics?.mood === "neutral", String(b.out?.metrics?.mood));

oa.mood = null;
const c = await chiedi("Mi sono svegliato sereno, poi riunione alle 9 e pranzo con Marco.");
check("2 il finto dice null: resta null", c.out?.metrics?.mood === null, String(c.out?.metrics?.mood));

/* ============ 3. il prompt ============ */
const sorgente = readFileSync("src/modules/oggi/server/process-entry.ts", "utf8");
check("3 il prompt non descrive piu 'neutral' come \"normale, cosi cosi\"", !/'neutral' \(normale, cosi cosi\)/.test(sorgente));
check("3 il prompt dice che senza parole sull'umore il mood e null", /senza nessuna parola su come si sente NON e 'neutral'/.test(sorgente));
check("3 la route applica umoreDaSalvare", /umoreDaSalvare\(parsed\.metrics\.mood, transcript\)/.test(sorgente));

await sb.ferma?.();
await oa.ferma?.();
const ko = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - ko}/${results.length} PASS${ko ? `, ${ko} FAIL` : ""}`);
process.exit(ko ? 1 : 0);
