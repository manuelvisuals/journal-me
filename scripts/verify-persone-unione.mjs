// Il bug del 21 agosto 2026: i nomi della giornata si sostituivano invece di
// sommarsi.
//
// Manuel racconta la mattina "lezione con Anna Katereta" e la sera aggiunge
// "cena con Francesco". Nella giornata restava SOLO Francesco. L'estrazione
// dei nomi gira sul testo appena aggiunto, e il salvataggio scriveva quel
// risultato al posto del precedente: la seconda aggiunta non aggiungeva una
// persona, la cancellava. Nessun errore, nessun avviso.
//
// Qui si prova la regola pura (src/lib/people-merge.ts), senza browser e
// senza chiamare l'AI: e una funzione di due elenchi, e va provata come
// tale.
// Si esegue con: node --experimental-strip-types scripts/verify-persone-unione.mjs
import { mergePeople } from "../src/lib/people-merge.ts";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

// Il caso di Manuel, parola per parola.
{
  const dopo = mergePeople(["Anna Katereta"], ["Francesco"]);
  check(
    "chi c'era prima non sparisce",
    dopo.includes("Anna Katereta") && dopo.includes("Francesco"),
    dopo.join(" | "),
  );
  check("e l'ordine tiene prima i vecchi", dopo[0] === "Anna Katereta", dopo.join(" | "));
}

// Due grafie della stessa persona non fanno due persone.
{
  const dopo = mergePeople(["Christian"], ["christian", "Luca"]);
  check("le maiuscole non creano un doppione", dopo.length === 2, dopo.join(" | "));
  check(
    "vince la grafia gia salvata",
    dopo[0] === "Christian",
    dopo.join(" | "),
  );
}

// Robustezza: spazi, vuoti, elenchi vuoti.
{
  check("gli spazi si tolgono", mergePeople([], ["  Mario  "])[0] === "Mario");
  check("i vuoti si scartano", mergePeople(["", "  "], []).length === 0);
  check("due elenchi vuoti danno vuoto", mergePeople([], []).length === 0);
  check(
    "senza niente da aggiungere non si perde niente",
    mergePeople(["Anna"], []).join() === "Anna",
  );
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length === 0 ? 0 : 1);
