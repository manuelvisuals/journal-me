// Il banco dei nove temi regalati (SPEC-temi-regalati.md, 5 settembre 2026).
//
// I nove temi sono DATI: nove file in src/themes/ pieni di stringhe esadecimali.
// Un dato sbagliato non da nessun errore a compilazione e nessuna schermata
// rotta: da solo testo grigio su fondo grigio, per meta degli utenti, e nessuno
// se ne accorge finche non e in produzione. Questo banco e la rete.
//
//   node scripts/verify-temi-regalati.mjs
//
// Cosa controlla, e perche:
//  1. i nove file esistono e si lasciano leggere come oggetto;
//  2. ognuno ha i diciotto valori nei DUE set (light e dark): un tema che
//     esiste solo al buio e rotto per chi tiene il telefono in chiaro;
//  3. le sei coppie di contrasto di validate.ts passano in tutti e due i modi
//     (4,5 per il testo, 3,0 per accent/bgApp): e la stessa aritmetica WCAG di
//     src/themes/validate.ts, riscritta qui perche il banco non compila TS;
//  4. i valori combaciano CARATTERE PER CARATTERE con i blocchi JSON della
//     spec: la spec e la fonte, i file sono la copia. Se qualcuno ritocca un
//     colore a mano senza passare dalla spec, qui si accorge;
//  5. tutti e nove sono importati e registrati in index.ts (un tema scritto e
//     non registrato non esiste per l'app);
//  6. DEFAULT_THEME_ID non e cambiato: i temi regalati si aggiungono, non
//     prendono il posto del tema di fabbrica;
//  7. gli obblighi di licenza sono scritti: Apache 2.0 di Tokyo Night con le
//     modifiche dichiarate, la provenienza per esteso di Ametista, e la OFL
//     dei font col suo avviso di copyright accanto ai woff2.
// Guardia PROVATA A MORDERE il 5 settembre 2026: riportato l'inkFaint scuro di
// Nord al valore originale (#95A0B3, contrasto 3,81) il banco e uscito rosso su
// due righe, contrasto e scostamento dalla spec; tolto "ocean" da THEMES, rosso
// sulla riga del registro. Ripristinati, 32/32 verde.
import { readFileSync, existsSync } from "node:fs";

const IDS = [
  "ardesia", "korall", "ametista", "tokyo", "nord",
  "gruvbox", "catppuccin", "grafit", "ocean",
];
const COLORI = [
  "bg", "bgApp", "surface", "surface2", "ink", "inkMuted", "inkFaint",
  "accent", "accentHi", "accentPressed", "onAccent", "success", "danger",
  "line", "shadow", "glow", "warmth", "grain",
];
const COPPIE = [
  ["ink", "bgApp", 4.5], ["ink", "surface", 4.5], ["inkMuted", "surface", 4.5],
  ["inkFaint", "surface", 4.5], ["onAccent", "accent", 4.5], ["accent", "bgApp", 3.0],
];

let pass = 0;
let fail = 0;
function say(ok, testo, extra) {
  if (ok) pass++; else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${testo}${extra ? `\n        ${extra}` : ""}`);
}

/* ---------------- WCAG, la stessa di validate.ts ---------------- */
function rgb(v) {
  const m = String(v).trim().match(/^#([0-9a-fA-F]{6})$/);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function canale(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminanza(c) {
  return 0.2126 * canale(c.r) + 0.7152 * canale(c.g) + 0.0722 * canale(c.b);
}
function rapporto(a, b) {
  const la = luminanza(a);
  const lb = luminanza(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/* ---------------- leggere un tema senza compilare TS ---------------- */
function leggiTema(id) {
  const testo = readFileSync(`src/themes/${id}.ts`, "utf8");
  const i = testo.indexOf(`export const ${id}: Theme = `);
  if (i < 0) return null;
  const corpo = testo.slice(testo.indexOf("{", i), testo.lastIndexOf("};") + 1);
  // Da letterale TypeScript a JSON: via i commenti, le chiavi fra virgolette,
  // via la virgola finale. Regge anche un file riformattato a mano (chiavi e
  // valori sulla stessa riga), che e il caso in cui un banco fragile mentirebbe.
  const json = corpo
    .replace(/\/\/[^\n]*/g, "")
    .replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g, '$1"$2":')
    .replace(/,(\s*[}\]])/g, "$1");
  try {
    return JSON.parse(json);
  } catch (e) {
    return { _errore: String(e.message) };
  }
}

/* ---------------- i blocchi JSON della spec ---------------- */
const spec = readFileSync("SPEC-temi-regalati.md", "utf8");
const dallaSpec = {};
for (const b of spec.split(/\n### /).slice(1)) {
  const m = b.match(/^\d+\.\s+.+?\s+\(`([a-z]+)`\)/);
  const j = b.match(/```json\n([\s\S]*?)\n```/);
  if (m && j) dallaSpec[m[1]] = JSON.parse(j[1]);
}
say(
  Object.keys(dallaSpec).length === 9,
  `la spec contiene nove blocchi di valori (trovati ${Object.keys(dallaSpec).length})`,
);

/* ---------------- 1-4: un tema per volta ---------------- */
for (const id of IDS) {
  if (!existsSync(`src/themes/${id}.ts`)) {
    say(false, `${id}: il file src/themes/${id}.ts non c'e`);
    continue;
  }
  const t = leggiTema(id);
  if (!t || t._errore) {
    say(false, `${id}: il file non si lascia leggere come oggetto`, t?._errore);
    continue;
  }

  const mancanti = [];
  for (const modo of ["light", "dark"]) {
    for (const k of COLORI) {
      if (t[modo]?.[k] === undefined) mancanti.push(`${modo}.${k}`);
    }
  }
  say(
    mancanti.length === 0 && t.author === "Nikita Rodionov" && t.id === id,
    `${id}: due set completi, id giusto, author "Nikita Rodionov"`,
    mancanti.length ? `mancano: ${mancanti.join(", ")}` : "",
  );

  const bassi = [];
  for (const modo of ["light", "dark"]) {
    for (const [a, b, soglia] of COPPIE) {
      const fg = rgb(t[modo]?.[a]);
      const bg = rgb(t[modo]?.[b]);
      if (!fg || !bg) continue;
      const r = rapporto(fg, bg);
      if (r < soglia) {
        bassi.push(`${modo} ${a}/${b} = ${r.toFixed(2)} (serve ${soglia})`);
      }
    }
  }
  say(bassi.length === 0, `${id}: le sei coppie di contrasto passano in chiaro e in scuro`, bassi.join(" | "));

  const atteso = dallaSpec[id];
  const diff = [];
  if (atteso) {
    for (const modo of ["light", "dark"]) {
      for (const k of COLORI) {
        if (String(t[modo]?.[k]) !== String(atteso[modo]?.[k])) {
          diff.push(`${modo}.${k}: "${t[modo]?.[k]}" invece di "${atteso[modo]?.[k]}"`);
        }
      }
    }
    if (JSON.stringify(t.typography) !== JSON.stringify(atteso.typography)) {
      diff.push("typography diversa dalla spec");
    }
  }
  say(Boolean(atteso) && diff.length === 0, `${id}: i valori sono quelli della spec`, diff.slice(0, 4).join(" | "));
}

/* ---------------- 5-6: il registro ---------------- */
const index = readFileSync("src/themes/index.ts", "utf8");
const nonRegistrati = IDS.filter(
  (id) => !new RegExp(`import \\{ ${id} \\} from "\\./${id}";`).test(index) ||
    !new RegExp(`\\b${id},`).test(index.slice(index.indexOf("THEMES"))),
);
say(nonRegistrati.length === 0, "tutti e nove importati e messi in THEMES", nonRegistrati.join(", "));

const contract = readFileSync("src/themes/contract.ts", "utf8");
const def = contract.match(/DEFAULT_THEME_ID = "([a-z]+)"/)?.[1];
say(def === "carta", `DEFAULT_THEME_ID non e cambiato (e "${def}", il tema di fabbrica del 4 settembre)`);

/* ---------------- 7: gli obblighi di licenza ---------------- */
const lic = existsSync("LICENZE-TERZE-PARTI.md")
  ? readFileSync("LICENZE-TERZE-PARTI.md", "utf8")
  : "";
say(
  /Apache License, Version 2\.0/.test(lic) && /Modifiche dichiarate/.test(lic) &&
    /tokyonight\.nvim/.test(lic),
  "Tokyo Night: avviso Apache 2.0 conservato e modifiche dichiarate",
);
say(
  /Alucard/.test(lic) && /Dracula PRO/.test(lic) && /senza alcun file di licenza/.test(lic),
  "Ametista: la provenienza dei valori chiari e scritta per esteso",
);

const ofl = existsSync("src/fonts/OFL.txt") ? readFileSync("src/fonts/OFL.txt", "utf8") : "";
const FAMIGLIE = ["Inter", "Newsreader", "Spectral", "EB Garamond", "DM Sans", "Cormorant Garamond", "IBM Plex Mono"];
const senzaAvviso = FAMIGLIE.filter((f) => !ofl.includes(f));
say(
  /SIL OPEN FONT LICENSE Version 1\.1/.test(ofl) && senzaAvviso.length === 0,
  "Font: la OFL e i sette avvisi di copyright viaggiano coi woff2 (src/fonts/OFL.txt)",
  senzaAvviso.length ? `senza avviso: ${senzaAvviso.join(", ")}` : "",
);

console.log(`\n${pass}/${pass + fail} PASS${fail ? ` . ${fail} FAIL` : ""}`);
process.exit(fail ? 1 : 0);
