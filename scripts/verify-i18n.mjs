// Verifica del bilingue (task 27).
//
// Il modello scelto — la chiave di traduzione E la frase italiana — ha un
// difetto noto: se qualcuno riscrive la frase italiana nel componente e si
// dimentica del catalogo, la traduzione inglese resta li orfana e a schermo
// esce italiano dentro un'app inglese, senza nessun errore. Questo script
// e la rete: confronta le frasi passate davvero a t() con le chiavi di
// src/lib/i18n/en.ts e fallisce nei due sensi.
//
// Le chiavi che il codice passa a t() attraverso una VARIABILE
// (t(item.label), t(area.label), t(KIND_LABEL[k])...) non sono visibili a
// un'analisi statica: stanno nell'elenco DINAMICHE qui sotto, con scritto
// da dove vengono. Aggiungere un'etichetta in una di quelle liste senza
// aggiungerla qui e l'unico buco che resta, ed e per questo che l'elenco
// dice sempre il file di provenienza.
//
// Non serve il dev server: e analisi statica.
import { readFileSync, readdirSync } from "node:fs";
import { collectKeys } from "./i18n-keys.mjs";

/** Chiavi passate a t() tramite variabile, con la loro provenienza. */
const DINAMICHE = {
  "modules/oggi/components/attesa-elaborazione.tsx (PASSI: i tre passi dell'attesa)": [
    "Leggo il racconto", "Salvo la giornata", "Controllo cosa non e chiaro",
  ],
  "components/ui/tab-bar.tsx (SIDE_TABS)": ["Diario", "Mese", "Memo", "Impost."],
  "components/ui/app-bar.tsx (TITOLI: il nome della schermata nella barra)": [
    "Diario", "Mese", "Memo", "Recap", "Impostazioni",
    "Persona", "Palestra",
  ],
  "components/desktop/rail-left.tsx (NAV_ITEMS, account)": [
    "Diario", "Mese", "Memo", "Recap", "Impostazioni",
    "questo dispositivo", "Locale", "Cloud", "Premium",
  ],
  "modules/impostazioni/components/settings-client.tsx (APPEARANCE_OPTIONS, PANEL_TITLES)": [
    "Chiaro", "Scuro", "Sistema", "Ch", "Sc", "Sist",
    "Obiettivi", "Tema", "Dove sono le mie giornate", "Lingua",
    "Questo dispositivo",
  ],
  "modules/abbonamento/components/premium-wall.tsx (TITLES, FEATURES, PERIODI)": [
    "Per raccontare a voce\nserve premium",
    "Per il titolo e la sintesi\nserve premium",
    "Per i recap del mese\nserve premium",
    "Per le letture sui pattern\nserve premium",
    "Le giornate con l'AI\nin regalo sono finite",
    "Racconti e basta",
    "Voce, titolo, sintesi, aree, persone, recap.",
    "Su tutti i dispositivi",
    "Chiuso a chiave, con backup ogni notte.",
    "al mese",
    "all'anno",
    "alla settimana",
    "al giorno",
  ],
  "modules/abbonamento/components/premium-welcome.tsx (FEATURES)": [
    "Racconti a voce, il testo si scrive da solo",
    "Titolo, sintesi e macro-aree di ogni giornata",
    "Recap del mese e letture sui pattern",
  ],
  "app/checkout-finto/client.tsx (PREMIUM_PRICE_PERIOD da lib/pricing.ts)": [
    "al mese",
  ],
  "lib/modules.ts (MODULES: nomi e descrizioni)": [
    "Palestra", "Cibo", "Sonno", "Meditazione",
    "Allenamenti, serie e progressi",
    "Cosa mangi, quanto spesso, e come cambia",
    "Ore, regolarita, e come va il giorno dopo",
    "Minuti, costanza, e cosa cambia nei giorni in cui la fai",
  ],
  "modules/impostazioni/components/settings-client.tsx (PANEL_TITLES, moduli)": ["Moduli"],
    "modules/recap/components/recap-client.tsx (PERIODS)": ["Mensili", "Semestrali", "Annuali"],
  "modules/ricorda/components/quick-capture.tsx (KIND_OPTIONS)": [
    "Nota", "Persona", "Todo", "Luogo", "Idea",
  ],
  "modules/ricorda/components/remember-client.tsx (FILTERS, bande)": [
    "Tutti", "Persone", "Todo", "Note", "Luoghi", "Idee",
    "Oggi", "Ieri", "Settimana scorsa", "Mese scorso", "Più indietro",
  ],
  "modules/mese/components/mese-grid.tsx (WEEKDAYS)": [
    "lun", "mar", "mer", "gio", "ven", "sab", "dom",
  ],
  "modules/oggi/components/metric-cards.tsx + rail-metrics.tsx (MOOD_OPTIONS)": [
    "molto bene", "bene", "cosi cosi", "giu", "male",
  ],
  // Le etichette delle macro-aree NON passano piu da t(): il nome visibile
  // (nome / nome_en) viene dalla tabella `aree` via src/lib/aree.ts.
  "lib/ui-scale.ts (UI_SCALE_LABELS)": [
    "Molto piccolo", "Piccolo", "Normale", "Grande", "Molto grande",
  ],
};

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "\n      " + extra : ""}`);
}

/* ---- il catalogo: un file per modulo (passo C) + en-extra (innesto) ---- */
const CATALOG = new Map();
const OWNER = new Map(); // chiave -> [file che la definiscono]
const catalogFiles = readdirSync("src/lib/i18n/catalogs")
  .filter((f) => f.endsWith(".ts"))
  .map((f) => `src/lib/i18n/catalogs/${f}`)
  .concat(
    readdirSync("src/modules").map((m) => `src/modules/${m}/en.ts`),
    ["src/lib/i18n/en-extra.ts"],
  );
for (const file of catalogFiles) {
  const src = readFileSync(file, "utf8");
  const body = src.slice(src.indexOf("{", src.indexOf("export const")));
  for (const m of body.matchAll(/^\s*("(?:[^"\\]|\\.)*")\s*:\s*("(?:[^"\\]|\\.)*")\s*,\s*$/gm)) {
    const k = JSON.parse(m[1]);
    CATALOG.set(k, JSON.parse(m[2]));
    if (!OWNER.has(k)) OWNER.set(k, []);
    OWNER.get(k).push(file);
  }
}
check("catalogo: si legge e non e vuoto", CATALOG.size > 200, `${CATALOG.size} voci in ${catalogFiles.length} file`);

/* ---- nessuna chiave definita in due cataloghi ----
   Con lo spread in en.ts vincerebbe in silenzio l'ultimo import (e a
   runtime EN_EXTRA su tutti): due definizioni della stessa frase sono un
   conflitto che nessun merge segnala. Qui diventa rosso. */
const doppie = [...OWNER.entries()].filter(([, files]) => files.length > 1);
check(
  "nessuna chiave definita in due cataloghi",
  doppie.length === 0,
  doppie.slice(0, 8).map(([k, files]) => `${JSON.stringify(k)} in ${files.join(" e ")}`).join("\n      "),
);

/* ---- chiavi usate ---- */
const statiche = collectKeys("src");
const dinamiche = new Set(Object.values(DINAMICHE).flat());
const usate = new Set([...statiche.keys(), ...dinamiche]);

const mancanti = [...usate].filter((k) => !CATALOG.has(k));
check(
  "ogni frase passata a t() ha una traduzione inglese",
  mancanti.length === 0,
  mancanti.slice(0, 12).map((k) => JSON.stringify(k)).join("\n      "),
);

const orfane = [...CATALOG.keys()].filter((k) => !usate.has(k));
check(
  "nessuna traduzione orfana (frase italiana cambiata e catalogo non aggiornato)",
  orfane.length === 0,
  orfane.slice(0, 12).map((k) => JSON.stringify(k)).join("\n      "),
);

/* ---- i segnaposto devono corrispondere ---- */
const placeholders = (s) => (s.match(/\{(\w+)\}/g) ?? []).sort().join(",");
const segnapostoRotti = [...CATALOG.entries()].filter(
  ([it, en]) => placeholders(it) !== placeholders(en),
);
check(
  "i segnaposto {nome} sono gli stessi in italiano e in inglese",
  segnapostoRotti.length === 0,
  segnapostoRotti.slice(0, 8).map(([it, en]) => `${it}  ->  ${en}`).join("\n      "),
);

/* ---- gli a capo devono corrispondere ---- */
const acapoRotti = [...CATALOG.entries()].filter(
  ([it, en]) => (it.match(/\n/g)?.length ?? 0) !== (en.match(/\n/g)?.length ?? 0),
);
check(
  "le frasi su due righe restano su due righe",
  acapoRotti.length === 0,
  acapoRotti.map(([it]) => JSON.stringify(it)).join("\n      "),
);

/* ---- nessuna traduzione uguale all'originale per sbaglio ---- */
// Alcune SONO uguali di proposito (Premium, Email, Account, Idea, Recap...).
const UGUALI_OK = new Set([
  "Premium", "premium", "Email", "Account", "Idea", "Recap", "Todo",
  "mood", "Mood", "ok", "Cloud", "Snippet", "Feedback", "Admin",
  // Il nome della sezione Memo (1 settembre 2026): uguale nelle due lingue.
  "Memo", "Memo...",
  // Nome proprio Apple: si scrive uguale nelle due lingue.
  "Face ID",
  // Nome del prodotto: si scrive uguale nelle due lingue.
  "dayalogue\nPremium",
]);
const sospette = [...CATALOG.entries()].filter(
  ([it, en]) => it === en && !UGUALI_OK.has(it),
);
check(
  "nessuna riga del catalogo e italiano copiato in inglese",
  sospette.length === 0,
  sospette.map(([it]) => JSON.stringify(it)).join("\n      "),
);

/* ---- copertura ---- */
console.log(
  `\n${usate.size} frasi in uso (${statiche.size} statiche + ${dinamiche.size} dinamiche), ${CATALOG.size} tradotte.`,
);

const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length === 0 ? 0 : 1);
