// La prova della BARRA MEMO di vetro — sorella del dock.
//
// Mockup: design/mockups/restyling-liquid-glass.html §01, approvato da
// Manuel il 1 settembre 2026. Il contratto che questo banco difende:
//   1. la capsula ha la STESSA larghezza della pillola del dock e le
//      sta sopra con 14px d'aria (le distanze si ripetono);
//   2. e vetro vero: velo + sfocatura, mai un rettangolo opaco;
//   3. i bersagli sono bersagli: mic e "+" almeno 44x44;
//   4. le FUNZIONI sono vive: scrivere e premere "+" aggiunge la riga,
//      il tipo si sceglie ancora dal selettore;
//   5. l'ultima riga della lista non dorme sotto la capsula.
//
// Gira in modalita locale: non tocca il database vero e non chiama l'AI.

import { chromium } from "playwright-core";

const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  locale: "it-IT",
  colorScheme: "dark",
});
await ctx.addInitScript(() => {
  try {
    window.localStorage.setItem("jm.mode", "local");
    window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
    window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
  } catch {}
});
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(BASE + "/app/remember", { waitUntil: "networkidle" });
await page.waitForSelector(".jm-qc-card", { timeout: 20000 });
await page.waitForTimeout(400);

/* ---- 1. la geometria di famiglia ---- */
const geo = await page.evaluate(() => {
  const barra = document.querySelector(".jm-qc-card").getBoundingClientRect();
  const dock = document.querySelector(".jm-dock").getBoundingClientRect();
  return {
    stessaLarghezza: Math.abs(barra.width - dock.width) <= 1,
    stessoAsse: Math.abs(barra.left - dock.left) <= 1,
    aria: dock.top - barra.bottom,
  };
});
check("la capsula e larga come il dock, sullo stesso asse", geo.stessaLarghezza && geo.stessoAsse);
check(
  "e gli lascia i 14px d'aria del contratto",
  Math.abs(geo.aria - 14) <= 2,
  `${Math.round(geo.aria)}px`,
);

/* ---- 2. il vetro ---- */
const vetro = await page.evaluate(() => {
  const s = getComputedStyle(document.querySelector(".jm-qc-card"));
  return {
    filtro: s.backdropFilter || s.webkitBackdropFilter,
    fondo: s.backgroundColor,
    raggio: parseFloat(s.borderTopLeftRadius),
  };
});
check(
  "la capsula e di vetro (sfocatura e saturazione)",
  /blur/.test(vetro.filtro) && /saturate/.test(vetro.filtro),
  vetro.filtro,
);
check(
  "col velo del tema, non il vuoto",
  vetro.fondo !== "rgba(0, 0, 0, 0)" && vetro.fondo !== "transparent",
  vetro.fondo,
);
check("ed e una capsula, non un rettangolo", vetro.raggio >= 28, `${vetro.raggio}px`);

/* ---- 3. i bersagli ---- */
const piccoli = await page.evaluate(() => {
  const fuori = [];
  for (const sel of [".jm-qc-mic", ".jm-qc-add"]) {
    const r = document.querySelector(sel).getBoundingClientRect();
    if (r.width < 44 || r.height < 44) fuori.push(`${sel} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  return fuori;
});
check("mic e + sono bersagli veri (44x44)", piccoli.length === 0, piccoli.join(", "));

/* ---- 4. le funzioni sopravvivono al vestito ---- */
await page.fill(".jm-qc-card input", "comprare la sbarra per le trazioni");
await page.click(".jm-qc-add");
await page.waitForTimeout(600);
const salvata = await page.getByText("comprare la sbarra per le trazioni").count();
check("scrivere e premere + aggiunge la riga", salvata >= 1, `${salvata} trovate`);

await page.click(".jm-qc-kind");
await page.waitForTimeout(250);
const pop = await page.evaluate(() => {
  const p = document.querySelector(".jm-qc-kind-pop");
  if (!p) return null;
  const r = p.getBoundingClientRect();
  const barra = document.querySelector(".jm-qc-card").getBoundingClientRect();
  return { righe: p.querySelectorAll(".row").length, sopra: r.bottom <= barra.top };
});
check(
  "il selettore del tipo si apre, sopra la capsula",
  Boolean(pop && pop.righe >= 5 && pop.sopra),
  pop ? `${pop.righe} voci` : "non si apre",
);
await page.keyboard.press("Escape");
await page.click(".jm-rem-list");

/* ---- 5. l'ultima riga non dorme sotto il vetro ---- */
const fondo = await page.evaluate(() => {
  const lista = document.querySelector(".jm-rem-list");
  lista.scrollTop = lista.scrollHeight;
  const barra = document.querySelector(".jm-qc-card").getBoundingClientRect();
  const righe = lista.querySelectorAll(".jm-rem-item, .jm-rem-row, li, [class*='jm-rem-']");
  let ultima = null;
  for (const el of righe) {
    const r = el.getBoundingClientRect();
    if (r.height > 0 && (!ultima || r.bottom > ultima)) ultima = r.bottom;
  }
  return { ultima, sopraBarra: ultima !== null && ultima <= barra.top + 1 };
});
check(
  "a fondo lista, l'ultima riga resta sopra la capsula",
  fondo.sopraBarra,
  fondo.ultima ? `fondo riga ${Math.round(fondo.ultima)}` : "lista vuota",
);

check("nessun errore in console", errors.length === 0, errors.slice(0, 2).join(" | "));

await browser.close();
const falliti = results.filter((r) => !r.ok);
console.log(`\n${falliti.length === 0 ? "VERDE" : "ROSSO"}: ${results.length - falliti.length}/${results.length} controlli passati`);
process.exit(falliti.length === 0 ? 0 : 1);
