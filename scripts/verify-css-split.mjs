// La guardia del passo B (ARCHITETTURA.md §3): lo spacchettamento di
// globals.css NON deve cambiare nemmeno un pixel di come l'app si disegna.
//
// Come funziona. Si fotografano gli STILI CALCOLATI di ogni elemento delle
// schermate principali, telefono e desktop, e si confrontano con la
// fotografia fatta prima dello spacchettamento:
//
//   node scripts/verify-css-split.mjs base    scatta la fotografia (baseline)
//   node scripts/verify-css-split.mjs check   confronta con la baseline
//
// La baseline (scripts/css-baseline.json) e un artefatto di lavoro: si
// scatta, si spacchetta, si confronta, e a lavoro chiuso si puo buttare.
// Non e un contratto eterno sui pixel: per quello ci sono i banchi tematici.
//
// Dettagli che contano:
//  - si confrontano TUTTE le proprieta calcolate di TUTTI gli elementi
//    (~340 proprieta l'uno), non un campione: e il motivo per cui ci si
//    puo fidare;
//  - animazioni e transizioni vengono spente al momento dello scatto, se no
//    getComputedStyle fotografa il fotogramma corrente (uno spinner a meta
//    giro) e due scatti identici non esistono;
//  - modalita locale (jm.mode=local): niente rete, dati deterministici;
//  - l'identita di un elemento fra i due scatti e posizione nel DOM + tag +
//    classi: lo spacchettamento muove CSS, non elementi. Se il numero di
//    elementi cambia, il confronto lo dice subito.
//
// Guardia PROVATA A MORDERE il 23 agosto 2026: cambiato il border-radius
// di .jm-st-box dopo la baseline, il check e uscito rosso ESATTAMENTE sui
// 5 elementi giusti di /settings (phone e desktop) col diff leggibile;
// ripristinato, 18/18 verde.
//
// ATTENZIONE, trappola scoperta provandola: in sandbox il dev server puo servire CSS
// VECCHIO dopo una modifica su disco (Turbopack non se ne accorge, nemmeno
// col touch — filesystem lento, niente inotify). Il primo morso era un
// falso verde per questo. Procedura obbligatoria per il passo B:
// RIAVVIARE il dev server fra la baseline e ogni check, sempre.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3100";
const BASELINE = "scripts/css-baseline.json";

const MODE = process.argv[2];
if (MODE !== "base" && MODE !== "check") {
  console.error("Uso: node scripts/verify-css-split.mjs base|check");
  process.exit(2);
}

/** Le schermate fotografate. via = path, poi si aspetta rete ferma + 900ms. */
const PAGES = [
  "/app",
  "/app/giorno?d=2026-08-15",
  "/app/mese",
  "/app/remember",
  "/app/recap",
  "/app/settings",
  "/app/benvenuto",
  "/login",
  "/app/palestra",
];

const VIEWPORTS = [
  { name: "phone", width: 430, height: 932 },
  { name: "desktop", width: 1680, height: 1000 },
];

/**
 * Proprieta instabili fra due scatti identici, escluse dal confronto.
 * -webkit-locale segue l'attributo lang; le custom property jm arrivano
 * comunque nelle proprieta derivate (font-size calcolato ecc.).
 */
const SKIP_PROPS = new Set(["-webkit-locale"]);

/**
 * Il nucleo leggibile: un sottoinsieme di proprieta salvato per intero
 * nella baseline, cosi un FAIL sa dire COSA e cambiato (il confronto vero
 * resta sull'hash di tutte le proprieta). Tenerle tutte peserebbe centinaia
 * di MB; queste quindici spiegano il 95% dei difetti da spacchettamento.
 */
const CORE_PROPS = [
  "display", "position", "font-size", "font-weight", "font-family",
  "line-height", "color", "background-color", "padding", "margin",
  "border", "border-radius", "width", "height", "gap",
];

async function snapshotPage(page, path) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  // Fermo il mondo: senza, uno spinner fotografa il suo fotogramma.
  await page.addStyleTag({
    content:
      "*,*::before,*::after{animation:none !important;transition:none !important;caret-color:transparent !important}",
  });
  await page.waitForTimeout(120);
  return page.evaluate(() => {
    const out = [];
    const all = document.querySelectorAll("*");
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (el.tagName === "SCRIPT" || el.tagName === "STYLE") continue;
      // L'overlay degli strumenti di sviluppo di Next: non e l'app, e
      // cambia stile da un lancio all'altro (6 falsi rossi su 18 scatti).
      if (el.tagName === "NEXTJS-PORTAL" || el.closest("nextjs-portal")) continue;
      const cs = getComputedStyle(el);
      const props = {};
      for (let j = 0; j < cs.length; j++) {
        const p = cs[j];
        props[p] = cs.getPropertyValue(p);
      }
      out.push({
        sig: `${i}:${el.tagName.toLowerCase()}.${(typeof el.className === "string" ? el.className : "")
          .trim()
          .replace(/\s+/g, ".")}`,
        props,
      });
    }
    return out;
  });
}

function hashProps(props) {
  const h = createHash("sha1");
  for (const k of Object.keys(props).sort()) {
    if (SKIP_PROPS.has(k)) continue;
    h.update(k).update("=").update(props[k]).update(";");
  }
  return h.digest("hex");
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

/** { "phone /mese": { count, els: { sig: hash } } } — e per il diff i props. */
const shot = {};
const rawProps = {}; // solo in memoria, per spiegare i mismatch in check

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    locale: "it-IT",
  });
  await ctx.addInitScript(() => {
    try {
      window.localStorage.setItem("jm.mode", "local"); /* niente velo del saluto sui banchi */ window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco"); window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
    } catch {}
  });
  const page = await ctx.newPage();
  for (const p of PAGES) {
    const key = `${vp.name} ${p}`;
    const els = await snapshotPage(page, p);
    shot[key] = { count: els.length, els: {} };
    rawProps[key] = {};
    for (const el of els) {
      const core = {};
      for (const cp of CORE_PROPS) core[cp] = el.props[cp];
      shot[key].els[el.sig] = { h: hashProps(el.props), core };
      rawProps[key][el.sig] = el.props;
    }
    console.log(`  scatto  ${key}  (${els.length} elementi)`);
  }
  await ctx.close();
}
await browser.close();

if (MODE === "base") {
  writeFileSync(BASELINE, JSON.stringify(shot));
  console.log(`\nBaseline scritta in ${BASELINE}. Ora spacchetta, poi "check".`);
  process.exit(0);
}

// ------------------------------- check -------------------------------
if (!existsSync(BASELINE)) {
  console.error(`Manca ${BASELINE}: prima "base", poi lo spacchettamento, poi "check".`);
  process.exit(2);
}
const base = JSON.parse(readFileSync(BASELINE, "utf8"));

let pass = 0;
let fail = 0;
const say = (ok, name, extra = "") => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
};

for (const key of Object.keys(base)) {
  const b = base[key];
  const s = shot[key];
  if (!s) {
    say(false, `${key}: la schermata non e stata fotografata`);
    continue;
  }
  if (b.count !== s.count) {
    say(false, `${key}: numero di elementi`, `prima ${b.count}, ora ${s.count}`);
    continue;
  }
  const diffs = [];
  for (const sig of Object.keys(b.els)) {
    if (!s.els[sig] || s.els[sig].h !== b.els[sig].h) diffs.push(sig);
  }
  if (diffs.length === 0) {
    say(true, `${key}: ${b.count} elementi identici`);
  } else {
    say(false, `${key}: ${diffs.length} elementi cambiati`, diffs.slice(0, 3).join(" | "));
    // Il perche, per i primi tre: il diff sul nucleo leggibile.
    for (const sig of diffs.slice(0, 3)) {
      const wasCore = b.els[sig]?.core ?? {};
      const nowAll = rawProps[key][sig] ?? {};
      const changed = CORE_PROPS.filter((cp) => wasCore[cp] !== nowAll[cp]);
      if (changed.length === 0) {
        console.log(`        ${sig}: cambiata una proprieta fuori dal nucleo (hash diverso)`);
      }
      for (const cp of changed) {
        console.log(`        ${sig}  ${cp}: "${wasCore[cp]}" -> "${nowAll[cp]}"`);
      }
    }
  }
}

console.log(`\n${pass}/${pass + fail} PASS${fail ? ` . ${fail} FAIL` : ""}`);
process.exit(fail ? 1 : 0);
