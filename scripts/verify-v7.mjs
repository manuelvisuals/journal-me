/**
 * IL GUARDIANO DI /v7.
 *
 * L'11 settembre 2026 Manuel ha approvato il sito desktop e ha chiesto di
 * congelarne una copia: e /v7. Da quel giorno si lavora solo sulla versione
 * telefono, e ogni regola nuova deve escludere l'archivio —
 * `.jm-sito7:not(.jm-sito4-archivio-v7)`. Dimenticarsene non da errore da
 * nessuna parte: /v7 semplicemente comincia a somigliare alla home viva
 * invece che a se stessa, e nessuno se ne accorge finche non serve.
 *
 * Questo banco impronta /v7 — posizione e misura di una ventina di pezzi, a
 * due larghezze — e la confronta con l'impronta salvata accanto
 * (verify-v7.impronta.json). Se qualcosa si e mosso, lo dice e mostra cosa.
 *
 *   node scripts/verify-v7.mjs            confronta
 *   node scripts/verify-v7.mjs --scrivi   risalva l'impronta (solo se il
 *                                         cambiamento e voluto)
 *
 * Vuole il sito gia in ascolto: `npx next start -p 3100` (o SITO=...), e
 * usa lo stesso Chrome di verify-sito (JM_CHROME per cambiarlo).
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const BASE = process.env.SITO || "http://localhost:3100";
const IMPRONTA = path.join(import.meta.dirname, "verify-v7.impronta.json");
const scrivi = process.argv.includes("--scrivi");

/** I pezzi guardati: se uno di questi si sposta, il desktop congelato e cambiato. */
const PEZZI = [
  ".jm-sito2-eroe", ".jm-sito2-eroe-t", ".jm-sito2-eroe .jm-sito-h1",
  ".jm-sito2-sotto", ".jm-sito2-eroe .jm-sito-cta", ".jm-sito10-garanzie",
  ".jm-sito10-rituale-vivo", ".jm-sito4-rituale", ".jm-sito13-pista",
  ".jm-sito12", ".jm-sito12-pista", ".jm-sito12-carta", ".jm-sito12-telefono",
  ".jm-sito9-chiave", ".jm-sito8-giornata", ".jm-sito8-pista", ".jm-sito8-blocco",
  ".jm-sito8-testa", ".jm-sito8-scena", ".jm-sito8-persona", ".jm-sito8-marchio",
  ".jm-sito-foto-sez", ".jm-sito-fine",
];

const MISURE = [[1440, 900], [393, 852]];

async function impronta(browser) {
  const out = {};
  for (const [w, h] of MISURE) {
    const p = await browser.newPage({ viewport: { width: w, height: h } });
    await p.goto(`${BASE}/v7`, { waitUntil: "networkidle" });
    await p.waitForTimeout(700);
    out[`${w}x${h}`] = await p.evaluate((pezzi) => {
      const r = { altezza: document.body.scrollHeight };
      for (const q of pezzi) {
        const e = document.querySelector(q);
        if (!e) { r[q] = null; continue; }
        const b = e.getBoundingClientRect();
        r[q] = [Math.round(b.left), Math.round(b.top + scrollY), Math.round(b.width), Math.round(b.height)];
      }
      return r;
    }, PEZZI);
    await p.close();
  }
  return out;
}

const EXE = process.env.JM_CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const adesso = await impronta(browser);
await browser.close();

if (scrivi || !fs.existsSync(IMPRONTA)) {
  fs.writeFileSync(IMPRONTA, JSON.stringify(adesso, null, 1) + "\n");
  console.log(`Impronta di /v7 salvata in ${path.basename(IMPRONTA)}.`);
  process.exit(0);
}

const prima = JSON.parse(fs.readFileSync(IMPRONTA, "utf8"));
let diversi = 0;
for (const misura of Object.keys(adesso)) {
  for (const [q, v] of Object.entries(adesso[misura])) {
    const p = prima[misura]?.[q];
    const uguale = JSON.stringify(p) === JSON.stringify(v);
    if (!uguale) {
      diversi++;
      console.log(`DIVERSO  ${misura}  ${q}`);
      console.log(`   prima: ${JSON.stringify(p)}`);
      console.log(`   ora:   ${JSON.stringify(v)}`);
    }
  }
}
if (diversi === 0) {
  console.log(`/v7 e identico all'impronta salvata (${MISURE.length} misure, ${PEZZI.length} pezzi).`);
} else {
  console.log(`\n${diversi} pezzi di /v7 si sono mossi.`);
  console.log('Se NON era voluto: la regola nuova non esclude l\'archivio — aggiungi :not(.jm-sito4-archivio-v7).');
  console.log("Se era voluto: node scripts/verify-v7.mjs --scrivi");
}
process.exit(diversi === 0 ? 0 : 1);
