// Il bug del 21 agosto 2026, e perche questo test esiste.
//
// Manuel apre Oggi e trova, al posto del riassunto della sua giornata:
// titolo "giornata raccontata", nessuna area, e come sintesi il suo stesso
// testo. Il transcript era perfettamente leggibile ("cantato lezione con
// Anna Katereta, lavorato, stasera cena con amici"). Chiamando la stessa
// rotta un minuto dopo, con la stessa identica frase, e uscito un riassunto
// perfetto.
//
// Causa: il prompt conteneva una via di fuga ("se il transcript e troppo
// breve o incomprensibile, restituisci una headline generica") e la
// decisione era lasciata al modello, a temperatura 0,4. Su un racconto
// telegrafico - cioe su come parla chiunque a voce - quella via di fuga si
// apriva a caso. Un salvataggio su N cancellava la giornata.
//
// Questo test la chiama PIU VOLTE con lo stesso testo: un difetto che si
// presenta a intermittenza, provato una volta sola, sembra assente.
//
// Serve: JM_TEST_TOKEN (access token di un utente premium) e JM_TEST_BASE
// (per esempio https://journal-me-weld.vercel.app). Senza, si salta: e un
// test che chiama l'AI vera e costa, quindi non gira da solo a ogni giro.
const BASE = process.env.JM_TEST_BASE ?? "";
const TOKEN = process.env.JM_TEST_TOKEN ?? "";
const GIRI = Number(process.env.JM_TEST_GIRI ?? "5");

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

if (!BASE || !TOKEN) {
  console.log(
    "SKIP  servono JM_TEST_BASE e JM_TEST_TOKEN (chiama l'AI vera, e costa)",
  );
  process.exit(0);
}

// La frase esatta che aveva fatto rinunciare il modello.
const TESTO =
  "Cantato lezione con Anna Katereta. Lavorato. Riletto diario e pensieri. " +
  "Eccitato stasera vedo amici alla cena social. Vorrei andare in palestra e essere fiero di me.";

async function chiedi(transcript, lang = "it") {
  const r = await fetch(`${BASE}/api/process-entry`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${TOKEN}`,
      "x-jm-lang": lang,
    },
    body: JSON.stringify({ transcript }),
  });
  if (!r.ok) return { errore: r.status };
  return r.json();
}

let rinunce = 0;
let senzaAree = 0;
for (let i = 0; i < GIRI; i++) {
  const out = await chiedi(TESTO);
  const generico = /^giornata raccontata$/i.test((out.headline ?? "").trim());
  if (generico) rinunce += 1;
  if (!out.areas || out.areas.length === 0) senzaAree += 1;
  console.log(
    `  giro ${i + 1}: "${(out.headline ?? out.errore ?? "").toString().slice(0, 60)}" ` +
      `(${out.areas?.length ?? 0} aree)`,
  );
}

check(`in ${GIRI} giri non rinuncia mai`, rinunce === 0, `rinunce: ${rinunce}`);
check(`in ${GIRI} giri trova sempre almeno un'area`, senzaAree === 0, `vuote: ${senzaAree}`);

// Il caso in cui rinunciare e GIUSTO: un testo che non dice niente. Qui la
// decisione non passa piu dal modello, la prende il codice con un righello.
{
  const out = await chiedi("asd");
  check(
    "su un testo senza fatti resta il titolo generico",
    /giornata raccontata/i.test(out.headline ?? ""),
    JSON.stringify(out).slice(0, 120),
  );
  check("e non chiama l'AI per niente", (out.areas ?? []).length === 0);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length === 0 ? 0 : 1);
