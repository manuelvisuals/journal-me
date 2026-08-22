// La prova dell'estrazione dei fatti (SPEC-fatti.md §11.1).
//
// PERCHE ESISTE, e perche va scritta PRIMA di scegliere il modello: senza
// una misura, "questo modello e piu intelligente" e un'opinione presa da un
// blog. Qui ci sono 15 racconti scritti a mano nello stile in cui si parla
// davvero, con accanto i fatti che DEVONO uscire e quelli che non devono
// uscire per nessun motivo.
//
// COSA MISURA, in ordine di importanza:
//
//   1. INVENZIONI. Un fatto inventato entra nei conteggi e non si distingue
//      da uno vero: "quante volte ho mangiato la pizza" diventa un numero
//      falso detto con sicurezza. Un'app che non conta e meglio di un'app
//      che conta male.
//   2. FATTI PERSI. Cio che hai detto e che l'app non ha visto.
//   3. NORMALIZZAZIONE. "panca" e "panca piana" devono dare la stessa
//      chiave, o i progressi si spezzano in due meta che non si sommano.
//
// COME SI ESEGUE. Serve un token di un utente premium e l'indirizzo del
// sito, perche la chiave OpenAI vive solo sul server:
//
//   JM_TEST_BASE=https://journal-me-weld.vercel.app \
//   JM_TEST_TOKEN=... JM_TEST_MODEL=gpt-4o-mini \
//   node scripts/eval-fatti.mjs
//
// Il modello si passa da fuori apposta: la stessa prova, due modelli, due
// numeri da confrontare.
import { readFileSync } from "node:fs";

const BASE = process.env.JM_TEST_BASE ?? "";
const TOKEN = process.env.JM_TEST_TOKEN ?? "";
const MODEL = process.env.JM_TEST_MODEL ?? "";

if (!BASE || !TOKEN) {
  console.log("SKIP  servono JM_TEST_BASE e JM_TEST_TOKEN (chiama l'AI vera, e costa)");
  process.exit(0);
}

const { casi } = JSON.parse(readFileSync("scripts/eval-fatti-casi.json", "utf8"));

/** Confronto morbido: le chiavi si confrontano senza accenti e senza plurali banali. */
function norma(s) {
  return String(s ?? "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

const risultati = [];
let inputTot = 0;
let outputTot = 0;

for (const caso of casi) {
  const r = await fetch(`${BASE}/api/extract-facts`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${TOKEN}`,
      "x-jm-lang": "it",
    },
    body: JSON.stringify({ transcript: caso.testo, model: MODEL || undefined }),
  });
  if (!r.ok) {
    console.log(`ERRORE  ${caso.id}: ${r.status} ${(await r.text()).slice(0, 160)}`);
    risultati.push({ caso, facts: [], errore: true });
    continue;
  }
  const j = await r.json();
  inputTot += j.usage?.input ?? 0;
  outputTot += j.usage?.output ?? 0;
  risultati.push({ caso, facts: j.facts ?? [], modello: j.model });
}

let trovati = 0;
let attesiTot = 0;
let inventati = 0;
let vietatiUsciti = 0;

console.log("");
for (const { caso, facts, errore } of risultati) {
  if (errore) continue;
  const chiavi = facts.map((f) => norma(f.label_key));
  const attesi = caso.attesi ?? [];
  attesiTot += attesi.length;

  const persi = [];
  for (const a of attesi) {
    const ok = facts.some(
      (f) => norma(f.label_key) === norma(a.label_key) && f.kind === a.kind,
    );
    if (ok) trovati += 1;
    else persi.push(`${a.kind}:${a.label_key}`);
  }

  // Inventati: fatti che non corrispondono a nessun atteso. Non e sempre un
  // errore (il racconto puo contenere piu di quello che ho elencato), ma un
  // numero alto qui e il segnale che il modello riempie i buchi da solo.
  const extra = facts.filter(
    (f) => !attesi.some((a) => norma(a.label_key) === norma(f.label_key)),
  );
  inventati += extra.length;

  const vietati = (caso.vietati ?? []).filter((v) =>
    chiavi.some((k) => k.includes(norma(v))),
  );
  vietatiUsciti += vietati.length;

  const stato = persi.length === 0 && vietati.length === 0 ? "OK  " : "FAIL";
  console.log(
    `${stato} ${caso.id.padEnd(26)} ${facts.length} fatti` +
      (persi.length ? `  PERSI: ${persi.join(", ")}` : "") +
      (vietati.length ? `  VIETATI USCITI: ${vietati.join(", ")}` : "") +
      (extra.length ? `  in piu: ${extra.map((e) => e.label_key).join(", ")}` : ""),
  );
}

/* ---- la normalizzazione: due racconti diversi, stessa chiave ---- */
console.log("");
let normOk = 0;
let normTot = 0;
for (const { caso, facts } of risultati) {
  if (!caso.stessa_chiave_di) continue;
  normTot += 1;
  const altro = risultati.find((x) => x.caso.id === caso.stessa_chiave_di);
  const mie = new Set(facts.map((f) => norma(f.label_key)));
  const sue = new Set((altro?.facts ?? []).map((f) => norma(f.label_key)));
  const comune = [...mie].filter((k) => sue.has(k));
  const ok = comune.length > 0;
  if (ok) normOk += 1;
  console.log(
    `${ok ? "OK  " : "FAIL"} normalizzazione ${caso.id} = ${caso.stessa_chiave_di}` +
      `  ${ok ? `chiave comune: ${comune.join(", ")}` : `[${[...mie]}] vs [${[...sue]}]`}`,
  );
}

/* ---- il conto finale ---- */
const modello =
  risultati.find((r) => r.modello)?.modello ?? (MODEL === "" ? "(default)" : MODEL);
console.log(`\n=== ${modello} ===`);
console.log(`fatti attesi trovati: ${trovati}/${attesiTot} (${Math.round((trovati / attesiTot) * 100)}%)`);
console.log(`fatti in piu (possibili invenzioni): ${inventati}`);
console.log(`fatti VIETATI usciti: ${vietatiUsciti}  <- deve essere 0`);
console.log(`normalizzazione: ${normOk}/${normTot}`);
console.log(`token: ${inputTot} in, ${outputTot} out su ${casi.length} racconti`);
