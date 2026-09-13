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

/**
 * DOVE GUARDARE: si CERCA, non si scrive a mano.
 *
 * La prima versione aveva due valori di --s fissi (0.13 e 0.33). Il 13
 * settembre la pista e passata da 660 a 920svh per fare posto all'ultimo
 * atto, tutti i tempi si sono spostati, e quei due numeri sono finiti in
 * momenti in cui non si muoveva piu niente: il banco e diventato rosso
 * senza che ci fosse un difetto. Adesso il momento buono lo trova lui,
 * scorrendo la pista finche il pezzo non si muove davvero.
 */
async function primoMovimento(selettore, da, a) {
  for (let s = da; s <= a; s += 0.02) {
    await pagina.evaluate((v) => window.scrollTo(0, v), aS(s));
    await pagina.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const y1 = await pagina.evaluate((q) => [
      document.querySelector(q).getBoundingClientRect().y,
      document.querySelector(".jm-sito12-scena").getBoundingClientRect().y,
    ], selettore);
    await pagina.evaluate((v) => window.scrollTo(0, v), aS(s) + 8);
    await pagina.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const y2 = await pagina.evaluate((q) => [
      document.querySelector(q).getBoundingClientRect().y,
      document.querySelector(".jm-sito12-scena").getBoundingClientRect().y,
    ], selettore);
    // La scena deve essere gia incollata: prima di allora si muove tutta la
    // pagina, il pezzo "avanza di 1 pixel per pixel" e la misura non dice
    // niente sull'animazione.
    if (Math.abs(y2[1] - y1[1]) > 0.5) continue;
    if (Math.abs(y2[0] - y1[0]) > 1) return s;
  }
  return null;
}

const casi = [
  ["il telefono, mentre esce", ".jm-sito12-telefono", 0.06, 0.30],
  ["la carta, mentre sale", ".jm-sito12-carta", 0.16, 0.40],
];

/**
 * IL BORDO DISEGNATO, NON QUELLO DEL DOM (12 settembre 2026).
 *
 * Il controllo qui sopra guarda `getBoundingClientRect`, e quello puo
 * essere liscio mentre lo schermo non lo e: un elemento mosso con `top`
 * viene DIPINTO su pixel interi, quindi avanza 0, 1, 0, 1 mentre il DOM
 * dice 0,69 ogni volta. E' un tremolio che nessuna misura del DOM vede.
 *
 * Qui si guardano i pixel: si fotografa una finestrella attorno al bordo
 * alto della carta, si stima dove sta il bordo col baricentro del
 * gradiente verticale (sotto il pixel), e si pretende che avanzi a OGNI
 * fotogramma. Un fotogramma fermo seguito da uno che salta un pixel intero
 * e esattamente cio che l'occhio chiama tremolio.
 *
 * Misura del 12 settembre: con `top` il bordo stava fermo in 4 fotogrammi
 * su 12 e saltava 1,03 pixel negli altri; con `transform` si muove sempre,
 * fra 0,25 e 0,86.
 */
async function bordoFermo(s0, passi) {
  await pagina.evaluate((v) => window.scrollTo(0, v), aS(s0));
  await pagina.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const y = await pagina.evaluate(() => document.querySelector(".jm-sito12-carta").getBoundingClientRect().y);
  const clip = { x: 1000, y: Math.round(y) - 24, width: 60, height: 60 };
  const posizioni = [];
  for (let i = 0; i < passi; i++) {
    await pagina.evaluate((v) => window.scrollTo(0, v), aS(s0) + i);
    await pagina.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const png = await pagina.screenshot({ clip, type: "png" });
    posizioni.push(await pagina.evaluate(async (url) => {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const righe = [];
      for (let y = 0; y < c.height; y++) {
        let s = 0;
        for (let x = 0; x < c.width; x++) {
          const i = (y * c.width + x) * 4;
          s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        }
        righe.push(s / c.width);
      }
      let tot = 0;
      let acc = 0;
      for (let y = 0; y < righe.length - 1; y++) {
        const g = Math.abs(righe[y + 1] - righe[y]);
        tot += g;
        acc += (y + 0.5) * g;
      }
      return tot > 1e-6 ? acc / tot : null;
    }, `data:image/png;base64,${png.toString("base64")}`));
  }
  const buoni = posizioni.filter((v) => v !== null);
  const d = buoni.slice(1).map((v, i) => Math.abs(v - buoni[i]));
  return { fermi: d.filter((v) => v < 0.02).length, totale: d.length, max: Math.max(...d), min: Math.min(...d) };
}
for (const [nome, sel, da, a] of casi) {
  const s0 = await primoMovimento(sel, da, a);
  check(`${nome}: si muove da qualche parte fra ${da} e ${a}`, s0 !== null,
    s0 === null ? "mai" : `da --s ${s0.toFixed(2)}`);
  if (s0 === null) continue;
  const d = await delta(sel, s0);
  const mossi = d.filter((v) => Math.abs(v) > 0.001);
  const min = Math.min(...mossi.map(Math.abs));
  const max = Math.max(...mossi.map(Math.abs));
  const inversioni = d.slice(1).filter((v, i) => v * d[i] < 0).length;
  check(`${nome}: passo regolare (scarto sotto ${SOGLIA}px)`, max - min < SOGLIA,
    `min ${min.toFixed(3)}px, max ${max.toFixed(3)}px, scarto ${(max - min).toFixed(3)}px`);
  check(`${nome}: nessuna inversione di marcia`, inversioni === 0, String(inversioni));
}

/**
 * I BLOCCHI DI TESTO SENZA TRANSIZIONE NON DEVONO DERIVARE (13 settembre).
 *
 * La regola generale di [data-fx] fa derivare il testo di 14px mentre
 * attraversa lo schermo. Con la sua transizione di 0,9s quella deriva non
 * insegue lo scorrimento e non si vede. Se pero qualcuno spegne la
 * transizione — e a volte serve — la deriva diventa un movimento legato
 * allo scorrimento, scritto dal JavaScript, che arriva un fotogramma dopo
 * quello della pagina: il blocco balla contro il resto. E' successo il 13
 * settembre col paragrafo della cassaforte, e Manuel l'ha visto subito.
 *
 * Qui si misura la cosa giusta: un blocco che non deve muoversi da solo
 * avanza di ESATTAMENTE un pixel per ogni pixel di rotella. Se avanza di
 * 0,993 sta derivando.
 */
async function derive() {
  const elenco = await pagina.evaluate(() =>
    [...document.querySelectorAll("[data-fx]")]
      .map((e, i) => {
        e.dataset.jmSonda = String(i);
        return { i, fermo: getComputedStyle(e).transitionDuration === "0s" };
      })
      .filter((x) => x.fermo)
      .map((x) => x.i),
  );
  const colpevoli = [];
  for (const i of elenco) {
    const y0 = await pagina.evaluate(
      (k) => document.querySelector(`[data-jm-sonda="${k}"]`).getBoundingClientRect().top + scrollY,
      i,
    );
    const passi = [];
    for (let j = 0; j < 6; j++) {
      await pagina.evaluate((v) => window.scrollTo(0, v), Math.round(y0) - 300 + j);
      await pagina.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      passi.push(await pagina.evaluate(
        (k) => document.querySelector(`[data-jm-sonda="${k}"]`).getBoundingClientRect().y,
        i,
      ));
    }
    const d = passi.slice(1).map((v, k) => v - passi[k]);
    const peggio = Math.max(...d.map((v) => Math.abs(v + 1)));
    if (peggio > 0.02) colpevoli.push(`blocco ${i}: ${(-1 - peggio).toFixed(3)}px per pixel`);
  }
  return { quanti: elenco.length, colpevoli };
}
const der = await derive();
check(`i blocchi [data-fx] senza transizione non derivano (${der.quanti} controllati)`,
  der.colpevoli.length === 0, der.colpevoli.slice(0, 3).join(" | "));

const sCarta = await primoMovimento(".jm-sito12-carta", 0.16, 0.40);
const bordo = await bordoFermo(sCarta === null ? 0.33 : sCarta, 14);
check("il bordo DISEGNATO della carta avanza a ogni fotogramma (niente scatto al pixel intero)",
  bordo.fermi === 0,
  `fermi ${bordo.fermi} su ${bordo.totale}, passo fra ${bordo.min.toFixed(3)} e ${bordo.max.toFixed(3)}px`);

/* ---------------------------------------------------------------------
   IL CURSORE E' NATIVO, E DA' GLI STESSI NUMERI DI PRIMA.

   Dal 13 settembre 2026 `--s` e `--p` non li scrive piu il JavaScript ma
   il browser, con `animation-timeline` (vedi styles.css). E' la cura del
   tremolio su Safari: il numero viene calcolato per la posizione di
   scorrimento del fotogramma che si sta disegnando, non per quella di uno
   o due fotogrammi fa.

   Due cose vanno difese, e sono diverse fra loro:
   1. che le animazioni ci siano davvero. Basta una regola nuova che
      dichiari `animation` su quei selettori per spegnerle senza un
      errore, e si tornerebbe al tremolio senza che niente diventi rosso.
   2. che il numero coincida con la formula di prima. Se la finestra
      (`animation-range`) e sbagliata la coreografia si sposta tutta, e a
      occhio non si vede finche non e tardi.

   I quattro blocchi dentro le scene incollate sono esclusi apposta e
   restano al JavaScript: la spiegazione sta in styles.css.
   --------------------------------------------------------------------- */
const nat = await pagina.evaluate(() => {
  const NOMI = ["jm-sito7-cursore", "jm-sito7-corsa"];
  const r = document.querySelector(".jm-sito7");
  const ha = (el) => el.getAnimations().some((a) => NOMI.includes(a.animationName));
  const piste = [...r.querySelectorAll("[data-pista]")];
  const blocchi = [...r.querySelectorAll("[data-fx]")].filter(
    // Le due esclusioni volute: chi vive dentro una scena incollata, e
    // `.ft` dentro la banda, che e incollata anche lei.
    (el) =>
      el.getBoundingClientRect().height > 0 &&
      !el.closest("[data-pista]") &&
      !el.closest(".jm-sito-banda .ft"),
  );
  return {
    piste: piste.length,
    pisteNat: piste.filter(ha).length,
    blocchi: blocchi.length,
    blocchiNat: blocchi.filter(ha).length,
  };
});
check("il cursore --s delle piste lo muove il browser, non il JavaScript",
  nat.pisteNat === nat.piste && nat.piste === 4, `${nat.pisteNat}/${nat.piste} piste`);
check("il cursore --p dei blocchi fuori dalle scene incollate e nativo",
  nat.blocchiNat === nat.blocchi && nat.blocchi > 8, `${nat.blocchiNat}/${nat.blocchi} blocchi`);

let scartoS = 0;
let doveS = "";
const alto = await pagina.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < alto - 1000; y += 211) {
  await pagina.evaluate((v) => window.scrollTo(0, v), y);
  await pagina.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const peggio = await pagina.evaluate(() => {
    const H = innerHeight;
    let max = 0;
    let chi = "";
    for (const el of document.querySelectorAll(".jm-sito7 [data-pista]")) {
      const q = el.getBoundingClientRect();
      const av = el.dataset.pista === "avanti" ? H * 0.55 : 0;
      let atteso = (av - q.top) / (q.height - H + av);
      atteso = atteso < 0 ? 0 : atteso > 1 ? 1 : atteso;
      const vero = parseFloat(getComputedStyle(el).getPropertyValue("--s"));
      const e = Math.abs(vero - atteso);
      if (e > max) { max = e; chi = String(el.className).split(" ")[0]; }
    }
    return { max, chi };
  });
  if (peggio.max > scartoS) { scartoS = peggio.max; doveS = `${peggio.chi} a y=${y}`; }
}
check("il cursore nativo coincide con la formula di prima (scarto sotto 0,0005)",
  scartoS < 0.0005, `scarto massimo ${scartoS.toFixed(6)} (${doveS})`);

await browser.close();
const ko = esiti.filter((e) => !e.ok).length;
console.log(`\n${esiti.length - ko}/${esiti.length} passati`);
process.exit(ko ? 1 : 0);
