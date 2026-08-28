// Banco della FOTO PROFILO (modulo impostazioni, 28 agosto 2026).
// Mockup: design/mockups/foto-profilo-flusso.html, approvato da Manuel.
//
// PERCHE QUESTO BANCO NON APRE UN BROWSER, a differenza degli altri.
// Il foglio, il trascinamento e il pallino che cambia si guardano soltanto
// (e vanno guardati: vedi la nota in fondo). Ma le due cose che possono
// sbagliare IN SILENZIO non sono visive: sono l'aritmetica del ritaglio —
// una foto tagliata storta sembra una scelta di disegno — e la convalida di
// cio che si puo scrivere nel profilo. Per questo vivono in
// src/modules/impostazioni/avatar-contract.ts, un file senza nessun import,
// e questo banco le ESEGUE davvero invece di leggerne il testo. Il resto
// sono controlli statici sulle cose che si possono affermare guardando i
// file: le misure, i punti di innesto, la sicurezza della migration.
//
// Si esegue con: node --experimental-strip-types scripts/verify-foto-profilo.mjs
// (lo strip dei tipi serve perche il contratto e un .ts).
import { readFileSync } from "node:fs";
import {
  avatarValido,
  calcolaRitaglio,
  LATO_AVATAR,
  limitaSpostamento,
  MAX_AVATAR_LEN,
  scalaBase,
} from "../src/modules/impostazioni/avatar-contract.ts";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra && !ok ? "  -- " + extra : ""}`);
}
const leggi = (p) => readFileSync(p, "utf8");
const vicino = (a, b, eps = 0.0001) => Math.abs(a - b) < eps;

/* =====================================================================
   1. L'ARITMETICA DEL RITAGLIO — eseguita, non letta
   ===================================================================== */

// Una foto orizzontale 1200x800 in un cerchio da 300, senza zoom e senza
// spostamento: si deve prendere il QUADRATO CENTRALE, cioe 800x800 con
// sx = 200. E il caso piu comune che esista, ed e anche quello in cui un
// segno sbagliato non si nota a occhio.
{
  const k = scalaBase(1200, 800, 300);
  check("la scala riempie il cerchio sul lato corto", vicino(k, 300 / 800), String(k));
  const r = calcolaRitaglio({ larghezza: 1200, altezza: 800, lato: 300, k, off: { x: 0, y: 0 } });
  check(
    "foto orizzontale, centrata: prende il quadrato centrale (800x800, sx=200)",
    vicino(r.lato, 800) && vicino(r.sx, 200) && vicino(r.sy, 0),
    `sx=${r.sx} sy=${r.sy} lato=${r.lato}`,
  );
}

// Una foto verticale: lo stesso, ma il taglio e sopra e sotto.
{
  const k = scalaBase(800, 1200, 300);
  const r = calcolaRitaglio({ larghezza: 800, altezza: 1200, lato: 300, k, off: { x: 0, y: 0 } });
  check(
    "foto verticale, centrata: quadrato centrale (800x800, sy=200)",
    vicino(r.lato, 800) && vicino(r.sx, 0) && vicino(r.sy, 200),
    `sx=${r.sx} sy=${r.sy} lato=${r.lato}`,
  );
}

// Ingrandire deve prendere MENO immagine, non di piu. E il senso del segno
// che, invertito, produce un ritaglio che si allarga quando zoomi.
{
  const k1 = scalaBase(1000, 1000, 300);
  const r1 = calcolaRitaglio({ larghezza: 1000, altezza: 1000, lato: 300, k: k1, off: { x: 0, y: 0 } });
  const r2 = calcolaRitaglio({ larghezza: 1000, altezza: 1000, lato: 300, k: k1 * 2, off: { x: 0, y: 0 } });
  check(
    "zoom 2x: il ritaglio prende meta immagine, non il doppio",
    vicino(r2.lato, r1.lato / 2),
    `${r1.lato} -> ${r2.lato}`,
  );
}

// Trascinare a destra deve spostare la finestra a SINISTRA nell'immagine.
// Invertito, la foto scapperebbe dalla parte sbagliata sotto il dito.
{
  const k = scalaBase(1000, 1000, 300);
  const fermo = calcolaRitaglio({ larghezza: 1000, altezza: 1000, lato: 300, k, off: { x: 0, y: 0 } });
  const spostato = calcolaRitaglio({ larghezza: 1000, altezza: 1000, lato: 300, k, off: { x: 30, y: 0 } });
  check(
    "trascinando a destra, la finestra si sposta a sinistra nell'immagine",
    spostato.sx < fermo.sx,
    `${fermo.sx} -> ${spostato.sx}`,
  );
}

// Il ritaglio non deve MAI uscire dall'immagine: con lo spostamento gia
// limitato, gli angoli restano dentro. Provato su tutti e quattro gli
// estremi e con due zoom.
{
  let dentro = true;
  let dove = "";
  for (const [w, h] of [[1200, 800], [800, 1200], [1000, 1000], [1600, 900]]) {
    for (const zoom of [1, 1.7, 3]) {
      const k = scalaBase(w, h, 300) * zoom;
      for (const [x, y] of [[9999, 0], [-9999, 0], [0, 9999], [0, -9999], [9999, 9999]]) {
        const off = limitaSpostamento({ larghezza: w, altezza: h, lato: 300, k, x, y });
        const r = calcolaRitaglio({ larghezza: w, altezza: h, lato: 300, k, off });
        const ok =
          r.sx >= -0.001 &&
          r.sy >= -0.001 &&
          r.sx + r.lato <= w + 0.001 &&
          r.sy + r.lato <= h + 0.001;
        if (!ok) {
          dentro = false;
          dove = `${w}x${h} zoom ${zoom} off ${x},${y} -> sx=${r.sx} sy=${r.sy} lato=${r.lato}`;
        }
      }
    }
  }
  check("trascinando fino in fondo il ritaglio resta dentro l'immagine", dentro, dove);
}

/* =====================================================================
   2. LA CONVALIDA — eseguita, non letta
   ===================================================================== */
{
  const jpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ==";
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
  check("accetta un JPEG in data URL", avatarValido(jpeg));
  check("accetta un PNG in data URL", avatarValido(png));
  check("accetta null (togliere la foto)", avatarValido(null));
  check("rifiuta un indirizzo http", !avatarValido("https://esempio.it/foto.jpg"));
  check("rifiuta un SVG (puo contenere script)", !avatarValido("data:image/svg+xml;base64,PHN2Zz4="));
  check("rifiuta testo qualunque", !avatarValido("ciao"));
  check("rifiuta un numero", !avatarValido(42));
  check("rifiuta undefined", !avatarValido(undefined));
  check(
    "rifiuta oltre il tetto dello schema",
    !avatarValido("data:image/jpeg;base64," + "A".repeat(MAX_AVATAR_LEN)),
  );
  check("il tetto e lo stesso del vincolo nella migration 016", MAX_AVATAR_LEN === 65536);
  check("il quadrato che parte e 256px", LATO_AVATAR === 256);
}

/* =====================================================================
   3. LA MISURA DEL PALLINO — il difetto segnalato da Manuel
   ===================================================================== */
{
  const base = leggi("src/styles/base.css");
  const oggi = leggi("src/modules/oggi/styles.css");

  const disco = base.match(/\.jm-hd-av i \{[\s\S]*?\}/);
  check("il disco del pallino e 44px, come i suoi due vicini",
    !!disco && /width:\s*44px/.test(disco[0]) && /height:\s*44px/.test(disco[0]),
    disco ? disco[0].slice(0, 90) : "regola non trovata");
  check("...e non e piu 32px", !!disco && !/32px/.test(disco[0]));
  check("il disco ritaglia la foto invece di sbordare",
    !!disco && /overflow:\s*hidden/.test(disco[0]));

  const fratello = oggi.match(/\.jm-rerecord-btn \{[\s\S]*?\}/);
  check("i due bottoni vicini sono davvero 44px (il metro del confronto)",
    !!fratello && /width:\s*44px/.test(fratello[0]));
  check("il pallino ha lo stesso fondo dei vicini",
    !!disco && /background:\s*var\(--color-surface\)/.test(disco[0]));
  check("niente margini negativi che lo tirino fuori griglia",
    /\.jm-hd-av \{[\s\S]*?margin:\s*0;/.test(base));
  check("l'immagine riempie il cerchio in tutti e tre i posti",
    /\.jm-hd-av i img,[\s\S]*?\.jm-acct-sheet-head \.av img,[\s\S]*?\.jm-rail-avatar img \{[\s\S]*?object-fit:\s*cover/.test(base));
}

/* =====================================================================
   4. GLI INNESTI — chi mostra, chi cambia, e la porta fra i due
   ===================================================================== */
{
  const porta = leggi("src/modules/impostazioni/index.ts");
  check("la porta del modulo esporta useFotoProfilo", /export \{ useFotoProfilo \}/.test(porta));
  check("la porta NON esporta il salvataggio (cambia solo il modulo)",
    !/salvaFotoProfilo/.test(porta));

  const menu = leggi("src/components/ui/account-menu.tsx");
  check("lo scheletro legge la foto DALLA PORTA, non dall'interno del modulo",
    /from "@\/modules\/impostazioni"/.test(menu) &&
    !/from "@\/modules\/impostazioni\//.test(menu));
  check("il pallino mostra la foto in tutti e tre i posti",
    (menu.match(/\{ritratto\}/g) ?? []).length === 3,
    String((menu.match(/\{ritratto\}/g) ?? []).length));
  check("quando la foto manca resta l'iniziale",
    /const ritratto = foto \?[\s\S]*?iniziale/.test(menu));

  const client = leggi("src/modules/impostazioni/components/settings-client.tsx");
  check("sul telefono la riga Foto profilo e nel gruppo Account",
    /<FotoProfiloRow\s+iniziale=/.test(client));
  check("sul computer la porta e il ritratto della rail",
    /<FotoProfiloRow\s+variant="avatar"/.test(client));
  check("in locale il ritratto NON e cliccabile (non c'e nessun account)",
    /isLocal \? \([\s\S]{0,200}className="jm-st-av"/.test(client));

  const store = leggi("src/modules/impostazioni/foto-profilo.ts");
  check("la foto si legge una volta sola anche con tre pallini montati",
    /if \(lettura\) return lettura;/.test(store));
  check("in modalita locale non si interroga nessun server",
    /=== "local"[\s\S]{0,80}foto = null/.test(store));
  check("se il salvataggio fallisce, il pallino torna com'era",
    /catch \(err\) \{[\s\S]{0,120}foto = prima;/.test(store));
}

/* =====================================================================
   5. LA MIGRATION — e soprattutto cio che NON contiene
   ===================================================================== */
{
  const m = leggi("supabase/migrations/016_profile_avatar.sql");
  check("aggiunge la colonna della foto", /add column if not exists avatar_data text/.test(m));
  check("e si puo rieseguire senza rompere niente", /if not exists/.test(m));
  check("mette un tetto alla taglia nello schema, non solo nel client",
    /check \(avatar_data is null or length\(avatar_data\) <= 65536\)/.test(m));
  // Il punto di sicurezza: una policy di update su profiles darebbe
  // all'utente il permesso di scriversi plan = 'premium', perche le policy
  // di Postgres valgono per riga e non per colonna.
  check("NON crea nessuna policy di update su profiles (si darebbe il premium da solo)",
    !/create policy[\s\S]*?for update/i.test(m));

  const server = leggi("src/modules/impostazioni/server/avatar.ts");
  check("la scrittura passa dal service role", /getAdminClient/.test(server));
  check("si scrive solo la riga di chi ha presentato il token",
    /\.eq\("user_id", user\.userId\)/.test(server));
  check("il corpo della richiesta non contiene nessun id da fidarsi",
    !/body[\s\S]{0,200}user_id/.test(server));
  check("il server usa la convalida del contratto, non una copia",
    /avatarValido/.test(server) && /avatar-contract/.test(server));

  const guscio = leggi("src/app/api/account/avatar/route.ts");
  check("la rotta e un guscio di poche righe", guscio.split("\n").length <= 5);
}

/* ===================================================================== */
const rossi = results.filter((r) => !r.ok);
console.log(`\n${results.length - rossi.length}/${results.length} PASS`);
if (rossi.length) {
  console.log("\nRESTA DA GUARDARE IN UN BROWSER (questo banco non lo fa):");
}
console.log(
  "\nNOTA: il foglio, il trascinamento e il pallino che cambia vanno visti\n" +
    "in un browser vero. Questo banco copre l'aritmetica, la convalida, le\n" +
    "misure e gli innesti — non il rendering.",
);
process.exit(rossi.length ? 1 : 0);
