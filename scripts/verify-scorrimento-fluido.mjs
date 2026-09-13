/**
 * LO SCORRIMENTO NON DEVE TREMOLARE (12 settembre 2026).
 *
 * Manuel, guardando l'anteprima della scena "come funziona" nuova: "quando
 * scrollo, tremola in su e giu, un CLS di pochi pixel, fastidioso".
 *
 * Non era CLS — l'altezza del documento non cambiava di un pixel lungo
 * tutta la pagina, misurato. Era la PRECISIONE di `--s`. `scorrimento.tsx`
 * scriveva il cursore con quattro decimali; su una pista di 660svh (6574
 * pixel) uno scatto di --s vale 0,66 pixel di scorrimento, mentre la carta
 * dentro la scena si sposta di 0,42 pixel per scatto. Risultato: un pixel
 * di rotella avanzava di UNO o di DUE scatti a seconda dell'arrotondamento,
 * e la carta si muoveva alternando 0,42 e 0,84 pixel. Non uno scatto: un
 * tremolio.
 *
 * Questo banco lo misura come lo vede l'occhio: scorre di UN pixel per
 * volta dentro le finestre in cui qualcosa si muove, e guarda quanto si e
 * spostato ogni volta. Se il movimento per pixel di scorrimento cambia da
 * un passo all'altro piu di una soglia, e rosso — perche e esattamente
 * cosi che si vede il tremolio.
 *
 * La soglia e 0,10 pixel: sotto quel valore lo scarto e la
 * quantizzazione di rendering del browser (1/64 di pixel e i suoi
 * multipli), che non si vede. Sopra, si vede.
 *
 * REGOLA GENERALE, per chi tocca le piste: la precisione di --s deve stare
 * sotto il pixel PER LA PISTA PIU LUNGA del sito, non per quella media.
 * Allungare una pista senza rifare questo conto rimette il tremolio.
 *
 *   npx next dev -p 3100   (o JM_BASE=...)
 *   node scripts/verify-scorrimento-fluido.mjs
 */
import { chromium } from "playwright-core";

const EXE = process.env.JM_CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const SOGLIA = 0.10;
const PASSI = 50;

const esiti = [];
function check(nome, ok, extra = "") {
  esiti.push({ nome, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({ executablePath: EXE });
const pagina = await browser.newPage({ viewport: { width: 1728, height: 996 } });
await pagina.goto(`${BASE}/`, { waitUntil: "networkidle" });
await pagina.waitForTimeout(1200);

// --- 1. l'altezza del documento non cambia scorrendo (il CLS vero) -------
const totale = await pagina.evaluate(() => document.body.scrollHeight);
const altezze = new Set();
for (let y = 0; y < totale - 1000; y += 250) {
  await pagina.evaluate((v) => window.scrollTo(0, v), y);
  await pagina.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  altezze.add(await pagina.evaluate(() => document.body.scrollHeight));
}
check("l'altezza della pagina non cambia mentre si scorre", altezze.size === 1,
  [...altezze].join(" / "));

// --- 2. il movimento per pixel di scorrimento e costante -----------------
const pista = await pagina.evaluate(() => {
  const e = document.querySelector(".jm-sito12-pista");
  const r = e.getBoundingClientRect();
  return { top: r.top + scrollY, h: r.height, vh: innerHeight };
});
const aS = (s) => Math.round(pista.top - pista.vh * 0.55 + s * (pista.h - pista.vh + pista.vh * 0.55));

/** Scorre di un pixel per volta e torna i delta verticali del pezzo. */
async function delta(selettore, s0) {
  const y = [];
  for (let i = 0; i < PASSI; i++) {
    await pagina.evaluate((v) => window.scrollTo(0, v), aS(s0) + i);
    await pagina.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    y.push(await pagina.evaluate((q) => document.querySelector(q).getBoundingClientRect().y, selettore));
  }
  return y.slice(1).map((v, i) => v - y[i]);
}

const casi = [
  ["il telefono, mentre esce", ".jm-sito12-telefono", 0.13],
  ["la carta, mentre sale", ".jm-sito12-carta", 0.33],
];
for (const [nome, sel, s0] of casi) {
  const d = await delta(sel, s0);
  const mossi = d.filter((v) => Math.abs(v) > 0.001);
  const min = Math.min(...mossi.map(Math.abs));
  const max = Math.max(...mossi.map(Math.abs));
  const inversioni = d.slice(1).filter((v, i) => v * d[i] < 0).length;
  check(`${nome}: passo regolare (scarto sotto ${SOGLIA}px)`, max - min < SOGLIA,
    `min ${min.toFixed(3)}px, max ${max.toFixed(3)}px, scarto ${(max - min).toFixed(3)}px`);
  check(`${nome}: nessuna inversione di marcia`, inversioni === 0, String(inversioni));
}

await browser.close();
const ko = esiti.filter((e) => !e.ok).length;
console.log(`\n${esiti.length - ko}/${esiti.length} passati`);
process.exit(ko ? 1 : 0);
