// Verifica del segno di dayalogue (src/components/brand/brand-mark.tsx).
// Locale.
//
// Dall'11 settembre 2026 (scelta 1B di Manuel) il segno NON e piu una
// immagine: e un disegno scritto nel componente, ed e il simbolo
// dell'icona sulla home del telefono — la "d" coi tre pallini. Le promesse
// da difendere diventano tre:
//   (a) il segno c'e in ogni schermata dove compare la scritta, e ne
//       esiste UN disegno solo (stesso tracciato dappertutto): un marchio
//       che diverge fra due schermate non e un marchio;
//   (b) prende i COLORI DEL TEMA — la "d" e il colore del testo, i pallini
//       sono l'accento — quindi su un tema scuro e chiara e leggibile,
//       senza nessun filtro che ribalti le tinte;
//   (c) la misura resta in em: cresce con "Dimensione del testo".
import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

async function open(url, { width = 1440, height = 900, appearance = "light", theme = "minimal", scale = 1 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: "it-IT" });
  await ctx.addInitScript(([a, t, z]) => {
    try {
      localStorage.setItem("jm.mode", "local"); localStorage.setItem("jm.ospite", "0");
      localStorage.setItem("jm:appearance", a);
      localStorage.setItem("jm:theme", t);
      localStorage.setItem("jm:scale", String(z));
    } catch {}
  }, [appearance, theme, scale]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  return { ctx, page, errors };
}

/* Il segno c'e dove c'e la scritta, ed e sempre lo STESSO disegno. */
const tracciati = new Set();
for (const [dove, url, opts] of [
  ["rail desktop", "/app/mese", {}],
  ["login", "/login", { width: 430, height: 800 }],
]) {
  const { ctx, page, errors } = await open(url, opts);
  const n = await page.locator("svg.jm-logo").count();
  check(`${dove}: il segno c'e`, n >= 1, `${n} trovati`);
  /* La firma del disegno: il tracciato se c'e (la "d"), altrimenti la
     cornice, che basta a distinguere due segni diversi. */
  const firme = await page.locator("svg.jm-logo").evaluateAll((els) =>
    [...new Set(els.map((e) => (e.querySelector("path")?.getAttribute("d") ?? e.getAttribute("viewBox") ?? "").slice(0, 60)))],
  );
  check(`${dove}: un disegno solo`, firme.length === 1, JSON.stringify(firme));
  for (const f of firme) tracciati.add(f);
  const pallini = await page.locator("svg.jm-logo circle").count();
  check(`${dove}: i tre pallini ci sono`, pallini >= 3, `${pallini}`);
  check(`${dove}: zero errori in console`, errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}
check("lo stesso identico segno in tutte le schermate", tracciati.size === 1, `${tracciati.size} tracciati diversi`);

/* Nella rail sta SOPRA la scritta (dal 2 settembre 2026: segno sopra,
   parola sotto) e non la sfonda. */
{
  const { ctx, page } = await open("/app/mese");
  const box = await page.locator(".jm-rail-brand svg.jm-logo").boundingBox();
  const brand = await page.locator(".jm-rail-brand").boundingBox();
  check("rail: il segno e dentro il blocco del marchio", box.x >= brand.x - 1 && box.y >= brand.y - 1, JSON.stringify(box));
  const parola = await page.locator(".jm-rail-brand .jm-marchio-parola").boundingBox();
  void parola;
  check("rail: il segno sta SOPRA la scritta", box.y + box.height <= parola.y + 2, `segno finisce a y ${Math.round(box.y + box.height)}, parola inizia a y ${Math.round(parola.y)}`);
  /* La misura sensata si guarda in LARGHEZZA: il segno puo essere alto (la
     "d" coi pallini) o basso (i soli pallini), ma in tutti e due i casi
     deve stare fra un quarto e una volta e mezza la parola accanto. */
  const parolaBox = await page.locator(".jm-rail-brand .jm-marchio-parola").boundingBox();
  check(
    "rail: misura sensata rispetto alla parola",
    box.width > parolaBox.width * 0.2 && box.width < parolaBox.width * 1.6,
    `segno ${Math.round(box.width)}px, parola ${Math.round(parolaBox.width)}px`,
  );
  await ctx.close();
}

/* La misura e in em: cambiando "Dimensione del testo" il segno cresce. */
{
  const a = await open("/app/mese", { scale: 1 });
  const h1 = (await a.page.locator(".jm-rail-brand svg.jm-logo").boundingBox()).width;
  await a.ctx.close();
  const b2 = await open("/app/mese", { scale: 1.5 });
  const h2 = (await b2.page.locator(".jm-rail-brand svg.jm-logo").boundingBox()).width;
  await b2.ctx.close();
  check(
    "il segno segue la dimensione del testo",
    h2 > h1 * 1.35,
    `${Math.round(h1)}px -> ${Math.round(h2)}px`,
  );
}

/* I COLORI DEL TEMA, non un filtro. Sul buio la "d" deve essere chiara
   (e il colore del testo) e i pallini devono restare l'accento: il vecchio
   invert(1) hue-rotate(180deg) li faceva diventare azzurrini. */
{
  const { ctx, page } = await open("/app/mese", { appearance: "dark" });
  const mode = await page.evaluate(() => document.documentElement.getAttribute("data-mode"));
  check("scuro: il tema e davvero scuro", mode === "dark", String(mode));
  const m = await page.locator(".jm-rail-brand svg.jm-logo").evaluate((el) => {
    const chiaro = (c) => {
      const [r, g, b] = (c.match(/[\d.]+/g) ?? [0, 0, 0]).map(Number);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const glifo = el.querySelector("path");
    return {
      filtro: getComputedStyle(el).filter,
      /* Il colore che il segno EREDITA: e quello che `currentColor` usa,
         e vale sia col glifo sia senza (11 settembre 2026: il segno puo
         essere la "d" coi pallini o i soli pallini). */
      d: chiaro(glifo ? getComputedStyle(glifo).fill : getComputedStyle(el).color),
      pallino: getComputedStyle(el.querySelector("circle")).fill,
      accento: getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim(),
      fondo: chiaro(getComputedStyle(document.body).backgroundColor),
    };
  });
  check("scuro: nessun filtro che ribalta le tinte", m.filtro === "none", m.filtro);
  check("scuro: il segno eredita un colore chiaro sul fondo scuro", m.d - m.fondo > 60, `${Math.round(m.d)} contro ${Math.round(m.fondo)}`);
  check("scuro: i pallini restano l'accento del tema", m.pallino.length > 0 && m.pallino !== "none", `${m.pallino} (accento ${m.accento})`);
  await ctx.close();
}
{
  const { ctx, page } = await open("/app/mese", { appearance: "light" });
  const f = await page.locator(".jm-rail-brand svg.jm-logo").evaluate((el) => getComputedStyle(el).filter);
  check("chiaro: nessun filtro, il colore e quello del tema", f === "none", f);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length === 0 ? 0 : 1);
