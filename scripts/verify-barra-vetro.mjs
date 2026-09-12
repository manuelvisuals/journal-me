/**
 * LA BARRA DEL TELEFONO: VETRO SENZA FONDO, E IL MARCHIO CHE SI LEGGE
 * SEMPRE (12 settembre 2026).
 *
 * Manuel: "aggiusta il header: la voglio completamente trasparente, con
 * effetto blur sfocato". Tolto il fondo, la barra non ha piu niente che
 * garantisca la leggibilita del marchio: sopra le sezioni crema l'avorio
 * sparisce. La difesa e il colore che cambia (`data-tinta` sulle sezioni,
 * `data-sotto` sulla radice, il CSS che ne segue), e una difesa cosi si
 * rompe in silenzio — basta una sezione nuova che si dimentica
 * l'attributo, e il marchio ci passa sopra invisibile senza che niente
 * dia errore.
 *
 * Quindi questo banco misura tre cose, scendendo tutta la home a 393x852:
 *
 *  1. IL FONDO NON C'E'. Il colore di sfondo della barra ha alpha 0 a
 *     ogni altezza, e il backdrop-filter contiene `blur` e NON contiene
 *     `brightness` (era `brightness(.40)`, ed e proprio il rettangolo
 *     color cioccolato che Manuel ha respinto due volte).
 *  2. IL MARCHIO SI LEGGE. Non "il colore e giusto": si misura il
 *     CONTRASTO vero. Si fotografa la striscia della barra due volte, con
 *     e senza il marchio; i pixel che cambiano SONO il marchio, e si
 *     confronta la loro luminanza con quella del fondo li accanto. Sotto
 *     4,5 e rosso. E' l'unico modo onesto: il marchio e un'immagine, e
 *     nessun `getComputedStyle` sa dire di che colore esce.
 *  3. OGNI SEZIONE SI DICHIARA. Ogni figlio di <main> ha `data-tinta`, e
 *     la tinta dichiarata coincide con quella MISURATA sui pixel (media
 *     della striscia sotto la barra, col marchio nascosto). Una sezione
 *     che dice "chiaro" ed e scura e un difetto, non un'opinione.
 *
 * Il desktop non entra: sopra i 900px la barra e quella approvata, e la
 * guardia di /v7 (verify-v7.mjs) resta la sua.
 *
 *   npx next dev -p 3100   (o SITO=...)
 *   node scripts/verify-barra-vetro.mjs
 */
import { chromium } from "playwright-core";

const EXE = process.env.JM_CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? process.env.SITO ?? "http://localhost:3100";
const PASSO = 200;
const SOGLIA = 4.5;

const esiti = [];
function check(nome, ok, extra = "") {
  esiti.push({ nome, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${extra ? "  -- " + extra : ""}`);
}

/** Luminanza relativa WCAG di un canale 0..255. */
function canale(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function luminanza([r, g, b]) {
  return 0.2126 * canale(r) + 0.7152 * canale(g) + 0.0722 * canale(b);
}
function contrasto(a, b) {
  const la = luminanza(a);
  const lb = luminanza(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** PNG grezzo -> pixel RGB, senza dipendenze: si passa dal browser. */
async function pixel(pagina, dataUrl) {
  return pagina.evaluate(async (url) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    return { w: c.width, h: c.height, d: Array.from(d) };
  }, dataUrl);
}

const browser = await chromium.launch({ executablePath: EXE });
const pagina = await browser.newPage({ viewport: { width: 393, height: 852 } });
const errori = [];
pagina.on("console", (m) => {
  if (m.type() === "error") errori.push(m.text());
});
await pagina.goto(`${BASE}/`, { waitUntil: "networkidle" });
await pagina.waitForTimeout(1200);

// --- 3a. ogni figlio di <main> dichiara la sua tinta ---------------------
const senzaTinta = await pagina.evaluate(() =>
  [...document.querySelector("main").children]
    .filter((el) => !el.hasAttribute("data-tinta"))
    .map((el) => el.id || el.className || el.tagName),
);
check("ogni blocco di <main> dichiara data-tinta", senzaTinta.length === 0, senzaTinta.join(", "));

const barra = await pagina.evaluate(() => {
  const b = document.querySelector(".jm-sito-nav-in").getBoundingClientRect();
  return { h: Math.round(b.height) };
});

const altezza = await pagina.evaluate(() => document.body.scrollHeight);
const misure = [];
for (let y = 0; y < altezza - 852; y += PASSO) {
  await pagina.evaluate((v) => window.scrollTo(0, v), y);
  await pagina.waitForTimeout(240);

  const stato = await pagina.evaluate(() => {
    const inn = document.querySelector(".jm-sito-nav-in");
    const s = getComputedStyle(inn);
    const radice = document.querySelector(".jm-sito7");
    return {
      fondo: s.backgroundColor,
      filtro: s.backdropFilter || s.webkitBackdropFilter || "none",
      scorso: radice.hasAttribute("data-scorso"),
      sotto: radice.getAttribute("data-sotto") || "",
    };
  });

  const clip = { x: 0, y: 0, width: 393, height: barra.h };
  const con = await pagina.screenshot({ clip, type: "png" });
  await pagina.evaluate(() => {
    document.querySelector(".jm-sito-marchio").style.visibility = "hidden";
  });
  await pagina.waitForTimeout(60);
  const senza = await pagina.screenshot({ clip, type: "png" });
  await pagina.evaluate(() => {
    document.querySelector(".jm-sito-marchio").style.visibility = "";
  });

  const A = await pixel(pagina, `data:image/png;base64,${con.toString("base64")}`);
  const B = await pixel(pagina, `data:image/png;base64,${senza.toString("base64")}`);

  // I pixel che cambiano fra le due foto SONO il marchio.
  let ri = 0, gi = 0, bi = 0, n = 0;
  let rf = 0, gf = 0, bf = 0, m = 0;
  for (let i = 0; i < A.d.length; i += 4) {
    const dr = Math.abs(A.d[i] - B.d[i]);
    const dg = Math.abs(A.d[i + 1] - B.d[i + 1]);
    const db = Math.abs(A.d[i + 2] - B.d[i + 2]);
    if (dr + dg + db > 150) {
      // inchiostro del marchio: si prende il pixel della foto CON il marchio
      ri += A.d[i]; gi += A.d[i + 1]; bi += A.d[i + 2]; n++;
      // e il fondo che c'era li sotto, dalla foto SENZA
      rf += B.d[i]; gf += B.d[i + 1]; bf += B.d[i + 2]; m++;
    }
  }
  let rapporto = null;
  if (n > 40) {
    rapporto = contrasto([ri / n, gi / n, bi / n], [rf / m, gf / m, bf / m]);
  }

  // La tinta misurata del fondo della barra (foto senza marchio).
  let rs = 0, gs = 0, bs = 0, k = 0;
  for (let i = 0; i < B.d.length; i += 4) { rs += B.d[i]; gs += B.d[i + 1]; bs += B.d[i + 2]; k++; }
  const chiaro = luminanza([rs / k, gs / k, bs / k]) > 0.25;

  misure.push({ y, ...stato, rapporto, chiaro, punti: n });
}

// --- 1. il fondo non c'e ------------------------------------------------
const conFondo = misure.filter((r) => !/rgba\(0, 0, 0, 0\)|transparent/.test(r.fondo));
check("la barra non ha nessun fondo, a nessuna altezza", conFondo.length === 0,
  conFondo.slice(0, 3).map((r) => `${r.y}px ${r.fondo}`).join(" | "));

const senzaBlur = misure.filter((r) => r.scorso && !/blur\(/.test(r.filtro));
check("scendendo, la barra e sfocata (blur nel backdrop-filter)", senzaBlur.length === 0,
  senzaBlur.slice(0, 3).map((r) => `${r.y}px ${r.filtro}`).join(" | "));

const conBrightness = misure.filter((r) => /brightness\(/.test(r.filtro));
check("nessun brightness nel filtro (era la fascia di cioccolato)", conBrightness.length === 0,
  conBrightness.slice(0, 3).map((r) => `${r.y}px ${r.filtro}`).join(" | "));

// --- 2. il marchio si legge ---------------------------------------------
const letti = misure.filter((r) => r.rapporto !== null);
const bassi = letti.filter((r) => r.rapporto < SOGLIA);
const peggio = letti.reduce((a, r) => (a === null || r.rapporto < a.rapporto ? r : a), null);
check(`il marchio sta sopra ${SOGLIA} di contrasto a ogni altezza`, bassi.length === 0,
  bassi.length
    ? bassi.slice(0, 4).map((r) => `${r.y}px = ${r.rapporto.toFixed(2)}`).join(" | ")
    : `peggiore: ${peggio.y}px = ${peggio.rapporto.toFixed(2)}`);
check("il marchio si trova in tutte le strisce", letti.length === misure.length,
  `${letti.length} su ${misure.length}`);

// --- 3b. la tinta dichiarata e quella vera ------------------------------
const bugie = misure.filter((r) => r.sotto && (r.sotto === "chiaro") !== r.chiaro);
check("la tinta dichiarata coincide con quella misurata", bugie.length === 0,
  bugie.slice(0, 4).map((r) => `${r.y}px dice ${r.sotto}`).join(" | "));

check("zero errori in console", errori.length === 0, errori.slice(0, 2).join(" | "));

await browser.close();

const ko = esiti.filter((e) => !e.ok).length;
console.log(`\n${esiti.length - ko}/${esiti.length} passati su ${misure.length} altezze`);
process.exit(ko ? 1 : 0);
