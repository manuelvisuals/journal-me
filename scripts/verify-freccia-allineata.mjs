// LA FRECCIA "<" NON SALTA FRA DIARIO E MESE (2 settembre 2026, screenshot
// di Manuel: "il pallino con il chevron si sposta tra una schermata e
// l'altra"). Il re e la riga del giorno (day-nav: vive su Diario e su
// /giorno, e allinea il cerchio ai comandi della barra, 24 dal bordo);
// la riga del Mese in griglia si adegua. Qui si MISURANO i due cerchi sul
// telefono e si pretende lo stesso rettangolo. Porta 3100 (JM_BASE).
import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("jm.mode", "local");
    localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
    localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
    localStorage.setItem("jm.mese.vista", "griglia");
  } catch {}
});
const page = await ctx.newPage();

async function misura(url, sel) {
  await page.goto(BASE + url, { waitUntil: "networkidle" });
  await page.waitForSelector(sel, { timeout: 20000 });
  await page.waitForTimeout(600);
  return page.locator(sel).first().boundingBox();
}
const diario = await misura("/app", ".jm-day-nav-arw");
const giorno = await misura("/app/giorno?d=2026-08-27", ".jm-day-nav-arw");
const mese = await misura("/app/mese", ".jm-month-header.nav .jm-mese-nav");
const r = (b) => `${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)}`;
const uguali = (a, b) =>
  Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1 &&
  Math.abs(a.width - b.width) <= 1 && Math.abs(a.height - b.height) <= 1;

check("Diario e /giorno: la freccia sta nello stesso pixel", uguali(diario, giorno), `${r(diario)} vs ${r(giorno)}`);
check("Diario e Mese (griglia): la freccia sta nello stesso pixel", uguali(diario, mese), `${r(diario)} vs ${r(mese)}`);
check("la freccia parte a 24px dal bordo, come i comandi della barra", Math.round(diario.x) === 24, String(Math.round(diario.x)));

await browser.close();
const passati = results.filter((x) => x.ok).length;
console.log(`\n${passati}/${results.length} PASS`);
process.exit(passati === results.length ? 0 : 1);
