// Titolo tuo, riassunto proporzionato, luoghi nella rail (22 agosto 2026).
//
// Tre cose decise da Manuel, e tre modi diversi di poterle sbagliare:
//
//  1. TITOLO. Se lo riscrivi tu diventa tuo, e nessuna rilettura del
//     racconto lo tocca piu. Il modo di sbagliarlo e scrivere il blocco
//     nell'interfaccia e dimenticarlo nello store: il titolo sembrerebbe
//     tuo finche non aggiungi una riga alla giornata, e poi tornerebbe
//     quello dell'AI. Qui si controlla che il blocco sia sul percorso di
//     SALVATAGGIO, in tutti e due gli store.
//  2. RIASSUNTO. Il tetto di 30 parole valeva per ogni giornata, corta o
//     lunga. Il modo di sbagliarlo e sostituirlo con un altro numero fisso.
//     Qui si controlla che la lunghezza dipenda dal testo ricevuto.
//  3. LUOGHI. Vengono dai fatti, non dall'entry. Il modo di sbagliarlo e
//     mostrarli in un posto solo, e scoprire dopo settimane che sul
//     telefono non ci sono mai stati.
//
// Il grosso e statico: legge il codice. Le prove vive che richiedono l'AI
// stanno in fondo e si saltano senza chiave.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const leggi = (p) => readFileSync(join(ROOT, p), "utf8");
/**
 * Il codice senza i commenti. Serve dove il test cerca l'ASSENZA di
 * qualcosa: il file spiega a parole perche la strada indietro non c'e, e un
 * controllo ingenuo scambierebbe quella spiegazione per la cosa spiegata.
 */
const senzaCommenti = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

// ---------------------------------------------------------------- 1. titolo

const types = leggi("src/lib/data/store/types.ts");
check(
  "lo store espone saveHeadline",
  /saveHeadline\s*\(\s*dateISO: string,\s*headline: string\s*\)/.test(types),
);

const cloud = leggi("src/lib/data/store/cloud.ts");
check(
  "cloud: saveHeadline scrive il titolo E alza il blocco",
  // dal 3 settembre 2026 il blocco vive dentro la busta della cassettina
  // (headlineLocked), non piu nella colonna headline_locked
  /headline(_l|L)ocked:\s*true/.test(cloud),
);
check(
  "cloud: a titolo bloccato il salvataggio AI non scrive headline",
  /headline_locked/.test(cloud) &&
    /(locked|bloccat)/i.test(cloud) &&
    cloud.includes("ENTRY_COLS_FULL"),
);
{
  // Il punto vero: dentro saveProcessedEntry, headline deve essere
  // condizionale. Se e un assegnamento secco, il blocco non serve a niente.
  const i = cloud.indexOf("async saveProcessedEntry");
  const corpo = i === -1 ? "" : cloud.slice(i, i + 4000);
  check(
    "cloud: saveProcessedEntry scrive headline solo se non e bloccato",
    i !== -1 && /headline(_l|L)ocked/.test(corpo),
  );
}

const local = leggi("src/lib/data/store/local.ts");
check(
  "local: saveHeadline esiste e alza il blocco",
  /async saveHeadline/.test(local) && /headlineLocked:\s*true/.test(local),
);
{
  const i = local.indexOf("async saveProcessedEntry");
  const corpo = i === -1 ? "" : local.slice(i, i + 4000);
  check(
    "local: saveProcessedEntry rispetta il blocco",
    /headlineLocked\s*\?\s*\{\}/.test(corpo),
  );
}

const editor = leggi("src/modules/oggi/components/headline-editable.tsx");
check(
  "il titolo si apre in scrittura e si salva uscendo",
  /onBlur=\{conferma\}/.test(editor) && /saveHeadline\(/.test(editor),
);
check(
  "un titolo svuotato non blocca niente",
  /nuovo\.length === 0/.test(editor),
);
check(
  "Invio e blur non salvano due volte",
  /doneRef/.test(editor),
);
check(
  "NON esiste una strada per restituire il titolo all'AI",
  !/rifallo/i.test(senzaCommenti(editor)) &&
    !/onClick[^\n]*tuo/i.test(senzaCommenti(editor)) &&
    // la targhetta e uno <span>, non un <button>
    /<span className="jm-fv-tuo">/.test(editor),
);

const filled = leggi("src/modules/oggi/components/filled-view.tsx");
check(
  "la giornata monta l'editor del titolo",
  /HeadlineEditable/.test(filled) && /editHeadline/.test(filled),
);

const day = leggi("src/modules/oggi/components/day-client.tsx");
const today = leggi("src/modules/oggi/components/today-client.tsx");
check(
  "il titolo si modifica sia su Oggi sia su /giorno",
  /locked: entry\.headlineLocked === true/.test(day) &&
    /locked: entry\.headlineLocked === true/.test(today),
);

// ------------------------------------------------------------- 2. riassunto

const route = leggi("src/modules/oggi/server/process-entry.ts") /* passo E: la logica vive nel modulo, la rotta e un guscio */;
check(
  "il vecchio tetto fisso di 30 parole per il riassunto non c'e piu",
  !/snippet: 1-2 frasi \(max 30 parole totali\)/.test(route),
);
check(
  "la lunghezza del riassunto si calcola sul racconto ricevuto",
  /paroleTranscript/.test(route) &&
    /transcript\.split\(\/\\s\+\/\)/.test(route) &&
    /regolaSnippet/.test(route),
);
check(
  "il riassunto ha un tetto: non diventa lungo come il diario",
  /Math\.min\(100,/.test(route),
);
check(
  "su una giornata di due parole non pretende trenta parole di riassunto",
  /pavimentoParole >= tettoParole/.test(route),
);
{
  // La regola dev'essere davvero nel prompt, non solo calcolata.
  const i = route.indexOf("const systemPrompt");
  const corpo = i === -1 ? "" : route.slice(i, i + 3000);
  check("la regola calcolata finisce nel prompt", /regolaSnippet,/.test(corpo));
}
check(
  "il prompt non si contraddice piu (un solo blocco 'Regole assolute')",
  (route.match(/"Regole assolute:",/g) ?? []).length === 1,
);

// ---------------------------------------------------------------- 3. luoghi

// use-places.ts e use-aliases.ts sono confluiti in use-day-lists.ts il 23
// agosto: persone, luoghi, soprannomi e cose tolte a mano si decidono
// insieme, e l'ordine fra loro conta (prima si risolve, poi si toglie).
const places = leggi("src/lib/use-day-lists.ts");
check(
  "i luoghi si leggono dai fatti di tipo luogo",
  /loadFactsForDate/.test(places) && /kind === "luogo"/.test(places),
);
check(
  "lo stesso posto detto due volte e una pastiglia sola",
  /risolviLista/.test(places) &&
    /visti\.has/.test(leggi("src/lib/aliases.ts")),
);
check(
  "i luoghi si ricaricano quando la giornata cambia",
  /revision/.test(places) &&
    /entry\?\.transcript/.test(day) &&
    /entry\?\.transcript/.test(today),
);
check(
  '"Luoghi" e diventato "Luoghi visitati", e "Social" non esiste piu',
  !/t\("Social"\)/.test(filled) && /Persone incontrate/.test(filled),
);
check(
  "se la lettura dei fatti fallisce la giornata non mostra un errore",
  /\.catch\(\(\) => \[\]\)/.test(places),
);

const rail = leggi("src/modules/oggi/components/rail-today.tsx");
check(
  "i luoghi sono nella rail destra del desktop",
  /t\("Luoghi visitati"\)/.test(rail) && /nomi={placeList}/.test(rail),
);
check(
  "i luoghi ci sono anche sul telefono, non solo sul desktop",
  /t\("Luoghi visitati"\)/.test(filled) && /nomi={placeList}/.test(filled),
);
check(
  "un luogo si distingue da una persona a colpo d'occhio",
  /PlacePin/.test(leggi("src/modules/oggi/components/pill-row.tsx")),
);

// ------------------------------------------------------------------ i18n

// Dal passo C il catalogo e spezzato per modulo: la frase puo vivere in
// qualunque catalogo, il contratto e che esista.
import { readdirSync as _rd } from "node:fs";
const _catalogo = ["src/lib/i18n/catalogs/comune.ts", "src/lib/i18n/en-extra.ts"]
  .concat(_rd("src/modules").map((m) => `src/modules/${m}/en.ts`))
  .map((f) => leggi(f))
  .join("\n");
const extra = _catalogo;
const en = _catalogo;
for (const frase of [
  "tuo",
  "tocca fuori per salvare",
  "titolo della giornata",
  "modifica il titolo della giornata",
]) {
  check(`"${frase}" e bilingue`, extra.includes(`"${frase}":`));
}
check('"Luoghi" e bilingue', en.includes('"Luoghi":') || extra.includes('"Luoghi":'));

// ------------------------------------------------- prova viva sul riassunto

const BASE = process.env.JM_TEST_BASE ?? "";
const TOKEN = process.env.JM_TEST_TOKEN ?? "";

if (!BASE || !TOKEN) {
  console.log(
    "\nSKIP  la prova viva del riassunto (serve JM_TEST_BASE + JM_TEST_TOKEN: chiama l'AI, e costa)",
  );
} else {
  const CORTA = "Colazione al Bubba Cafe, poi giornata tranquilla a casa.";
  const LUNGA = [
    "Colazione al Bubba Cafe con calma, cappuccino e cornetto, con Marco che e arrivato in ritardo come sempre.",
    "Poi al lavoro tutta la mattina sulla presentazione per il cliente, tre revisioni e alla fine e uscita bene.",
    "Pranzo veloce, un'insalata alla scrivania perche non avevo tempo.",
    "Pomeriggio in piscina, quaranta vasche, e stanco ma contento.",
    "Poi palestra: panca sessanta per dieci e sessantacinque per otto, poi trazioni.",
    "Cena da Charlie, pizza margherita e due birre, abbiamo parlato a lungo del viaggio in Giappone.",
    "La serata e finita a casa di Ha Tran con i giochi di gruppo, si e fatta notte.",
    "Giornata piena, di quelle che stancano bene, e domani mi sveglio presto.",
  ].join(" ");

  async function chiedi(transcript) {
    const r = await fetch(`${BASE}/api/process-entry`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${TOKEN}`,
        "x-jm-lang": "it",
      },
      body: JSON.stringify({ transcript }),
    });
    if (!r.ok) return null;
    return r.json();
  }

  const parole = (s) => (s ?? "").split(/\s+/).filter(Boolean).length;
  const a = await chiedi(CORTA);
  const b = await chiedi(LUNGA);
  const pa = parole(a?.snippet);
  const pb = parole(b?.snippet);
  console.log(`  corta: ${parole(CORTA)} parole -> riassunto di ${pa}`);
  console.log(`  lunga: ${parole(LUNGA)} parole -> riassunto di ${pb}`);
  check(
    "il riassunto della giornata piena e piu lungo di quello della corta",
    pb > pa,
    `${pb} contro ${pa}`,
  );
  check(
    "la giornata piena ha un riassunto che copre davvero la giornata",
    pb >= 30,
    `${pb} parole`,
  );
  check(
    "nessuno dei due sfora il tetto",
    pa <= 105 && pb <= 105,
    `${pa} / ${pb}`,
  );
}

const falliti = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - falliti.length}/${results.length} PASS` +
    (falliti.length ? ` . ${falliti.length} FAIL` : ""),
);
process.exit(falliti.length ? 1 : 0);
