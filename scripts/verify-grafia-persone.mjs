// La grafia delle persone (Manuel, 13 settembre 2026: "nel testo e scritto
// KARYA tutto maiuscolo, viene riconosciuta come Karya, ma nella pill c'e
// scritto KARYA: deve chiamarsi col nome salvato in memoria").
//
// Cosa deve essere vero:
//  1. indicizzaGrafie / grafiaUfficiale (src/lib/aliases.ts): un nome che in
//     rubrica c'e esce come sta in rubrica, uno che non c'e resta com'e;
//  2. risolviLista con le grafie: i soprannomi valgono ancora, i doppioni
//     restano uno, e la forma finale e quella della rubrica;
//  3. use-day-lists passa le grafie della rubrica per le persone (e non per i
//     luoghi), e today-client le usa nel passo delle persone.
//
//   node --experimental-strip-types scripts/verify-grafia-persone.mjs
import { readFileSync } from "node:fs";
import { indicizza, indicizzaGrafie, grafiaUfficiale, risolviLista } from "../src/lib/aliases.ts";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

/* ============ 1. la grafia, da sola ============ */
const rubrica = indicizzaGrafie(["Karya", "Josie", "  Hoda ", "Liana"]);
check("1 KARYA -> Karya", grafiaUfficiale("KARYA", rubrica) === "Karya");
check("1 karya -> Karya", grafiaUfficiale("karya", rubrica) === "Karya");
check("1 Karya resta Karya", grafiaUfficiale("Karya", rubrica) === "Karya");
check("1 accenti: JOSIÈ -> Josie (stessa chiave)", grafiaUfficiale("JOSIÈ", rubrica) === "Josie");
check("1 spazi in rubrica ripuliti: hoda -> Hoda", grafiaUfficiale("hoda", rubrica) === "Hoda");
check("1 chi non e in rubrica resta com'e scritto", grafiaUfficiale("MARCO", rubrica) === "MARCO");
check("1 senza rubrica non cambia niente", grafiaUfficiale("KARYA") === "KARYA");
check("1 in rubrica vince la prima grafia (la piu recente)", indicizzaGrafie(["Karya", "KARYA"]).get("karya") === "Karya");

/* ============ 2. dentro risolviLista ============ */
const alias = indicizza([
  { kind: "persona", alias: "mio fratello", labelKeys: ["Daniele"] },
  { kind: "persona", alias: "i miei amici", labelKeys: ["hoda", "LIANA"] },
  { kind: "luogo", alias: "da Charlie", labelKeys: ["Da Charlie"] },
]);
const fuori = risolviLista(["amici", "Josie", "KARYA", "mio fratello", "i miei amici", "karya", "da Charlie"], "persona", alias, rubrica);
check("2 KARYA esce Karya, una volta sola", fuori.filter((n) => n.toLowerCase() === "karya").length === 1 && fuori.includes("Karya"), fuori.join("|"));
check("2 il soprannome vale ancora (mio fratello -> Daniele)", fuori.includes("Daniele"), fuori.join("|"));
check("2 il soprannome a due nomi esce con la grafia della rubrica (hoda -> Hoda, LIANA -> Liana)", fuori.includes("Hoda") && fuori.includes("Liana"), fuori.join("|"));
check("2 un luogo fra le persone sparisce ancora", !fuori.some((n) => /charlie/i.test(n)), fuori.join("|"));
check("2 chi non e in rubrica resta (amici)", fuori.includes("amici"), fuori.join("|"));
check("2 senza grafie e tutto come prima", risolviLista(["KARYA"], "persona", alias).join() === "KARYA");

/* ============ 3. i chiamanti ============ */
const udl = readFileSync("src/lib/use-day-lists.ts", "utf8");
check("3 use-day-lists legge la rubrica (loadPersonaNames)", /loadPersonaNames\(mode\)/.test(udl));
check("3 use-day-lists passa le grafie SOLO per le persone", /kind === "persona" \? grafie : undefined/.test(udl));
const tc = readFileSync("src/modules/oggi/components/today-client.tsx", "utf8");
check("3 today-client usa la grafia della rubrica nel passo persone", /risolviLista\(found, "persona", indicizza\(aliasList\), indicizzaGrafie\(roster\)\)/.test(tc));

const ko = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - ko}/${results.length} verdi`);
process.exit(ko ? 1 : 0);
