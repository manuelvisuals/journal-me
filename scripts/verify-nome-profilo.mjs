// Banco del NOME MOSTRATO (modulo impostazioni, 28 agosto 2026).
// Mockup: design/mockups/nome-profilo.html — pennina in linea sul computer,
// pennina nel menu sul telefono (strada A), scelto da Manuel.
//
// Come per la foto, questo banco non apre un browser: esegue in Node le
// regole che sbagliano in silenzio (profilo-contract.ts non ha import
// proprio per questo) e controlla staticamente il resto. Cio che si vede —
// la pennina che compare al passaggio del mouse, il campo che prende il
// posto del nome — va guardato con gli occhi.
//
// node --experimental-strip-types scripts/verify-nome-profilo.mjs
import { readFileSync } from "node:fs";
import {
  NOME_MAX,
  nomeMostrato,
  nomeValido,
  normalizzaNome,
} from "../src/modules/impostazioni/profilo-contract.ts";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra && !ok ? "  -- " + extra : ""}`);
}
const leggi = (p) => readFileSync(p, "utf8");

/* =====================================================================
   1. LA REGOLA DEL NOME MOSTRATO — eseguita
   Questa e la funzione che esiste per NON avere due nomi diversi nella
   stessa schermata. Se sbaglia, sbaglia dappertutto insieme.
   ===================================================================== */
check("senza nome scelto si usa l'email tagliata alla chiocciola",
  nomeMostrato(null, "madh52@gmail.com") === "madh52",
  nomeMostrato(null, "madh52@gmail.com"));
check("il nome scelto vince sull'email",
  nomeMostrato("Manuel", "madh52@gmail.com") === "Manuel");
check("un nome fatto di soli spazi non vince: si torna all'email",
  nomeMostrato("   ", "madh52@gmail.com") === "madh52");
check("senza nome e senza email resta 'ospite'",
  nomeMostrato(null, null) === "ospite");
check("l'etichetta 'ospite' e traducibile dal chiamante",
  nomeMostrato(null, null, "guest") === "guest");
check("un'email malformata non produce un nome a meta",
  nomeMostrato(null, "non-e-una-email") === "ospite",
  nomeMostrato(null, "non-e-una-email"));

/* =====================================================================
   2. LA NORMALIZZAZIONE — eseguita
   ===================================================================== */
check("via gli spazi ai bordi", normalizzaNome("  Manuel  ") === "Manuel");
check("gli a capo incollati per sbaglio diventano spazi",
  normalizzaNome("Manuel\nRossi") === "Manuel Rossi",
  JSON.stringify(normalizzaNome("Manuel\nRossi")));
check("i doppi spazi in mezzo si stringono",
  normalizzaNome("Manuel    Rossi") === "Manuel Rossi");
check("il vuoto diventa null (= torna il nome dell'email)",
  normalizzaNome("") === null && normalizzaNome("   ") === null);
check("cio che non e testo diventa null",
  normalizzaNome(42) === null && normalizzaNome(undefined) === null &&
  normalizzaNome(null) === null);
check(`si taglia a ${NOME_MAX} caratteri`,
  normalizzaNome("x".repeat(80))?.length === NOME_MAX,
  String(normalizzaNome("x".repeat(80))?.length));
check("gli accenti e gli spazi dentro il nome restano",
  normalizzaNome("Niccolò De Angelis") === "Niccolò De Angelis");

/* =====================================================================
   3. LA CONVALIDA DEL SERVER — eseguita
   ===================================================================== */
check("accetta un nome normale", nomeValido("Manuel"));
check("accetta null (togliere il nome scelto)", nomeValido(null));
check("rifiuta il vuoto", !nomeValido("") && !nomeValido("   "));
check("rifiuta cio che non e testo", !nomeValido(42) && !nomeValido(undefined) && !nomeValido({}));
check("rifiuta oltre il tetto dello schema", !nomeValido("x".repeat(NOME_MAX + 1)));
check("il tetto e 30, come il vincolo nella migration 017", NOME_MAX === 30);

/* =====================================================================
   4. UNA REGOLA SOLA, IN UN POSTO SOLO
   Il difetto che questo lavoro doveva chiudere: la regola viveva in due
   file, e un nome scelto che ne raggiungesse uno solo avrebbe mostrato
   due nomi diversi nella stessa schermata.
   ===================================================================== */
{
  const menu = leggi("src/components/ui/account-menu.tsx");
  const client = leggi("src/modules/impostazioni/components/settings-client.tsx");

  check("account-menu non taglia piu l'email da solo", !/split\("@"\)/.test(menu));
  check("settings-client non taglia piu l'email da solo", !/split\("@"\)/.test(client));
  check("tutti e due passano dalla stessa regola",
    /useNomeMostrato/.test(menu) && /useNomeMostrato/.test(client));
  check("l'iniziale del pallino segue il NOME, non l'email",
    /iniziale = account \? mostrato\.slice\(0, 1\)/.test(menu));

  const porta = leggi("src/modules/impostazioni/index.ts");
  check("la porta esporta la regola e l'apertura del pannello",
    /useNomeMostrato/.test(porta) && /apriPannelloNome/.test(porta));
  check("la porta NON esporta il salvataggio del nome", !/salvaNomeProfilo/.test(porta));
  check("lo scheletro importa dalla PORTA, non dall'interno del modulo",
    /from "@\/modules\/impostazioni"/.test(menu) &&
    !/from "@\/modules\/impostazioni\//.test(menu));
}

/* =====================================================================
   5. DOVE SI TOCCA — le due superfici scelte da Manuel
   ===================================================================== */
{
  const menu = leggi("src/components/ui/account-menu.tsx");
  const riga = leggi("src/modules/impostazioni/components/nome-riga.tsx");
  const client = leggi("src/modules/impostazioni/components/settings-client.tsx");

  check("telefono (strada A): la pennina e nella testata del menu",
    /jm-acct-penna/.test(menu));
  check("...e NON modifica li: porta alla schermata del nome",
    /apriPannelloNome\(\);[\s\S]{0,60}router\.push\("\/settings"\)/.test(menu));
  check("...e non compare in modalita locale (non c'e nessun account)",
    /\{!locale && \([\s\S]{0,200}jm-acct-penna/.test(menu));

  check("computer: la pennina sta accanto al nome nella rail",
    /<NomeRiga\s+mostrato=/.test(client));
  check("computer: Invio salva", /e\.key === "Enter"\) void conferma\(\)/.test(riga));
  check("computer: Esc annulla senza salvare",
    /e\.key === "Escape"\) setAperto\(false\)/.test(riga));
  check("computer: se non e cambiato niente non si scrive sul server",
    /Niente da fare se non e cambiato niente/.test(riga));
  check("il campo si ferma a NOME_MAX", (riga.match(/maxLength=\{NOME_MAX\}/g) ?? []).length === 2);
  check("svuotando il campo, la schermata dice su cosa si ricade",
    /Senza nome l'app ti chiama \{n\}/.test(riga));
  check("in locale il nome non e modificabile (non c'e un account)",
    /isLocal \? \([\s\S]{0,120}jm-st-nm/.test(client));
}

/* =====================================================================
   6. LO STORE E IL SERVER
   ===================================================================== */
{
  const store = leggi("src/modules/impostazioni/profilo.ts");
  check("nome e foto arrivano dalla STESSA lettura (nessuna richiesta in piu)",
    /select\("display_name, avatar_data"\)/.test(store));
  check("una lettura sola anche con cinque pallini montati",
    /if \(lettura\) return lettura;/.test(store));
  check("se il salvataggio del nome fallisce, il nome torna com'era",
    /salvaNomeProfilo[\s\S]{0,400}catch \(err\) \{[\s\S]{0,80}profilo = prima;/.test(store));
  check("si salva il nome NORMALIZZATO, non quello grezzo",
    /const pulito = normalizzaNome\(nuovo\)/.test(store));
  check("la richiesta di aprire il pannello e un contatore, non un booleano",
    /richiestaNome\+\+/.test(store));

  const server = leggi("src/modules/impostazioni/server/nome.ts");
  check("la scrittura passa dal service role", /getAdminClient/.test(server));
  check("si scrive solo la riga di chi ha presentato il token",
    /\.eq\("user_id", user\.userId\)/.test(server));
  check("il server normalizza a sua volta, senza fidarsi del client",
    /normalizzaNome\(nome\)/.test(server));
  check("il server usa la convalida del contratto, non una copia",
    /nomeValido/.test(server) && /profilo-contract/.test(server));

  const guscio = leggi("src/app/api/account/nome/route.ts");
  check("la rotta e un guscio di poche righe", guscio.split("\n").length <= 5);
}

/* =====================================================================
   7. LA MIGRATION — e soprattutto cio che NON contiene
   ===================================================================== */
{
  const m = leggi("supabase/migrations/017_profile_name.sql");
  check("aggiunge la colonna del nome",
    /add column if not exists display_name text/.test(m));
  check("si puo rieseguire senza rompere niente", /if not exists/.test(m));
  check("il limite di 30 sta nello schema, non solo nel client",
    /char_length\(display_name\) between 1 and 30/.test(m));
  check("NON crea nessuna policy di update su profiles (si darebbe il premium da solo)",
    !/create policy[\s\S]*?for update/i.test(m));
}

/* ===================================================================== */
const rossi = results.filter((r) => !r.ok);
console.log(`\n${results.length - rossi.length}/${results.length} PASS`);
console.log(
  "\nNOTA: la pennina che compare al passaggio del mouse e il campo che\n" +
    "prende il posto del nome vanno visti in un browser. Questo banco copre\n" +
    "le regole, gli innesti e la sicurezza — non il rendering.",
);
process.exit(rossi.length ? 1 : 0);
