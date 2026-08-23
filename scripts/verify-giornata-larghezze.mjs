// Le larghezze della giornata piena (22 agosto 2026). Locale, porta 3200.
//
// Perche esiste per una riga di CSS: un `max-width` che torna indietro non
// rompe niente e non fa fallire nessuna build. Si vede solo aprendo la
// pagina e accorgendosi che il paragrafo si ferma a meta mentre tutto il
// resto corre. Un controllo scritto costa sei righe e non dimentica.
import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3200";
const FIXTURE = new URL("./fixtures-icone-aree.json", import.meta.url).pathname;
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

for (const w of [1280, 1440]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 1000 }, locale: "it-IT" });
  await ctx.addInitScript(() => { try { localStorage.setItem("jm.mode", "local"); } catch {} });
  const page = await ctx.newPage();
  await page.goto(BASE + "/settings", { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  await page.waitForTimeout(2400);
  await page.goto(BASE + "/giorno?d=2026-03-14", { waitUntil: "networkidle" });
  await page.waitForTimeout(1600);

  const sn = await page.locator(".jm-fv-sn").boundingBox();
  const cards = await page.locator(".jm-fv-areas").boundingBox();
  check(`${w}px: la sintesi comincia dove cominciano le schede`,
    Math.abs(sn.x - cards.x) <= 1, `${Math.round(sn.x)} contro ${Math.round(cards.x)}`);
  check(`${w}px: e finisce dove finiscono`,
    Math.abs((sn.x + sn.width) - (cards.x + cards.width)) <= 1,
    `${Math.round(sn.x + sn.width)} contro ${Math.round(cards.x + cards.width)}`);

  // La riga di lettura non e sparita, e solo salita: oltre un certo punto
  // l'occhio perde il capo della riga tornando a sinistra.
  const chars = await page.locator(".jm-fv-sn").evaluate((e) => {
    const s = getComputedStyle(e);
    const probe = document.createElement("span");
    probe.style.font = s.font;
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.textContent = "x".repeat(100);
    document.body.appendChild(probe);
    const per = probe.getBoundingClientRect().width / 100;
    probe.remove();
    return Math.round(e.getBoundingClientRect().width / per);
  });
  check(`${w}px: la riga resta sotto i cento caratteri`, chars <= 100, `${chars} caratteri`);

  // La prosa della giornata gratis e un'altra cosa: piu paragrafi di fila,
  // e li la riga corta conta davvero. Non deve essere stata allargata.
  const proseMax = await page.evaluate(() => {
    const p = document.createElement("p");
    p.className = "jm-fv-prose";
    document.querySelector(".jm-fv-wrap").appendChild(p);
    const v = getComputedStyle(p).maxWidth;
    p.remove();
    return v;
  });
  check(`${w}px: la prosa resta stretta`, proseMax === "700px", proseMax);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length === 0 ? 0 : 1);
