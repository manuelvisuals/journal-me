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
import { readFileSync } from "node:fs";
import { collectKeys } from "./i18n-keys.mjs";

/** Chiavi passate a t() tramite variabile, con la loro provenienza. */
const DINAMICHE = {
  "components/ui/tab-bar.tsx (SIDE_TABS)": ["Oggi", "Mese", "Ricorda", "Impost."],
  "components/desktop/rail-left.tsx (NAV_ITEMS, account)": [
    "Oggi", "Mese", "Ricorda", "Recap", "Impostazioni",
    "questo dispositivo", "Locale", "Cloud", "Premium",
  ],
  "components/settings/settings-client.tsx (APPEARANCE_OPTIONS, PANEL_TITLES)": [
    "Chiaro", "Scuro", "Sistema", "Ch", "Sc", "Sist",
    "Obiettivi", "Tema", "Dove sono le mie giornate", "Lingua",
    "Questo dispositivo",
  ],
  "components/premium-wall.tsx (TITLES, FEATURES)": [
    "Per raccontare a voce\nserve premium",
    "Per il titolo e la sintesi\nserve premium",
    "Per i recap del mese\nserve premium",
    "Per le letture sui pattern\nserve premium",
    "Racconti e basta",
    "Parli in italiano, il testo si scrive da solo. Correggi i nomi e sei a posto.",
    "Titolo, sintesi, macro-aree",
    "Ogni giornata riassunta in una riga e divisa fra lavoro, relazioni, corpo, emozioni.",
    "Recap e pattern",
    "Il racconto del mese, e cosa cambia davvero quando cammini o dormi di piu.",
    "Su tutti i dispositivi",
    "Le giornate che hai gia scritto qui salgono nel cloud al primo accesso.",
  ],
  "components/recap/recap-client.tsx (PERIODS)": ["Mensili", "Semestrali", "Annuali"],
  "components/remember/quick-capture.tsx (KIND_OPTIONS)": [
    "Nota", "Persona", "Todo", "Luogo", "Idea",
  ],
  "components/remember/remember-client.tsx (FILTERS, bande)": [
    "Tutti", "Persone", "Todo", "Note", "Luoghi", "Idee",
    "Oggi", "Ieri", "Settimana scorsa", "Mese scorso", "Più indietro",
  ],
  "components/mese/mese-grid.tsx (WEEKDAYS)": [
    "lun", "mar", "mer", "gio", "ven", "sab", "dom",
  ],
  "components/today/metric-cards.tsx + rail-metrics.tsx (MOOD_OPTIONS)": [
    "molto bene", "bene", "cosi cosi", "giu", "male",
  ],
  "components/today/filled-view.tsx (etichette delle macro-aree, enum a DB)": [
    "Lavoro", "Relazioni", "Corpo", "Emozioni",
  ],
  "lib/ui-scale.ts (UI_SCALE_LABELS)": [
    "Piccolo", "Normale", "Grande", "Molto grande", "Massimo",
  ],
};

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "\n      " + extra : ""}`);
}

/* ---- il catalogo ---- */
const src = readFileSync("src/lib/i18n/en.ts", "utf8");
const body = src.slice(src.indexOf("{", src.indexOf("export const EN")));
const CATALOG = new Map();
for (const m of body.matchAll(/^\s*("(?:[^"\\]|\\.)*")\s*:\s*("(?:[^"\\]|\\.)*")\s*,\s*$/gm)) {
  CATALOG.set(JSON.parse(m[1]), JSON.parse(m[2]));
}
check("catalogo: si legge e non e vuoto", CATALOG.size > 200, `${CATALOG.size} voci`);

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
  "mood", "Mood", "ok", "Cloud", "Snippet",
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
