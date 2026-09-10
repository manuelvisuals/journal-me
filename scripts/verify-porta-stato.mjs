// La porta del giorno: la logica pura (src/modules/accesso/porta-stato.ts),
// eseguita in Node con --experimental-strip-types, come verify-foto-profilo.
//
//   node --experimental-strip-types scripts/verify-porta-stato.mjs
import { variantePorta, giornoLocale, SOGLIA_POCHE } from "../src/modules/accesso/porta-stato.ts";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const oggi = "2026-09-10";
const base = {
  oggi,
  versioneLettera: 3,
  memoria: { lettera: 3, giorno: "2026-09-09", rimaste: 7 },
  dopoUscita: false,
  modalita: "local",
  premium: false,
  regalo: { attivo: true, sopraIlTetto: false, rimaste: 7, max: 10, registrato: true },
};
const con = (patch) => ({ ...base, ...patch, memoria: { ...base.memoria, ...(patch.memoria ?? {}) }, regalo: patch.regalo === null ? null : { ...base.regalo, ...(patch.regalo ?? {}) } });

check("primo avvio (nessuna lettera vista): lettera", variantePorta(con({ memoria: { lettera: null } })) === "lettera");
check("lettera riscritta dal pannello (versione nuova): lettera, anche se oggi e gia passata", variantePorta(con({ memoria: { lettera: 2, giorno: oggi } })) === "lettera");
check("la lettera vince sul server assente", variantePorta(con({ memoria: { lettera: null }, regalo: null })) === "lettera");
check("dopo il logout: niente, anche al primo avvio", variantePorta(con({ dopoUscita: true, memoria: { lettera: null } })) === "niente");
check("gia mostrata oggi: niente", variantePorta(con({ memoria: { giorno: oggi } })) === "niente");
check("premium in cloud: niente", variantePorta(con({ modalita: "cloud", premium: true })) === "niente");
check("server non ancora letto: niente (si riprova)", variantePorta(con({ regalo: null })) === "niente");
check("il conto e uguale a ieri: uguale", variantePorta(con({})) === "uguale");
check("il conto e sceso (7 -> 6): cambiata", variantePorta(con({ regalo: { rimaste: 6 } })) === "cambiata");
check("mai detto prima (memoria vuota): cambiata", variantePorta(con({ memoria: { rimaste: null } })) === "cambiata");
check(`poche (${SOGLIA_POCHE}) anche se uguali a ieri: cambiata`, variantePorta(con({ memoria: { rimaste: 2 }, regalo: { rimaste: 2 } })) === "cambiata");
check("zero: finite", variantePorta(con({ regalo: { rimaste: 0 } })) === "finite");
check("sopra il tetto con giornate: pausa, non finite", variantePorta(con({ regalo: { sopraIlTetto: true } })) === "pausa");
check("regalo spento con giornate: pausa", variantePorta(con({ regalo: { attivo: false } })) === "pausa");
check("zero E sopra il tetto: finite (la verita piu grande)", variantePorta(con({ regalo: { rimaste: 0, sopraIlTetto: true } })) === "finite");
check("ospite non registrato (web con DeviceCheck): niente", variantePorta(con({ regalo: { registrato: false } })) === "niente");
check("account gratis non registrato (web): proposta", variantePorta(con({ modalita: "cloud", regalo: { registrato: false } })) === "proposta");
check("account gratis con il regalo: come l'ospite (cambiata)", variantePorta(con({ modalita: "cloud", regalo: { rimaste: 4 } })) === "cambiata");
check("giornoLocale e YYYY-MM-DD del dispositivo", /^\d{4}-\d{2}-\d{2}$/.test(giornoLocale(new Date(2026, 8, 10, 23, 59))) && giornoLocale(new Date(2026, 8, 10, 23, 59)) === "2026-09-10");

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} PASS`);
process.exit(passed === results.length ? 0 : 1);
