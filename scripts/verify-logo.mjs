// Verifica del segno di dayalogue (src/components/brand/brand-mark.tsx).
// Locale, porta 3200.
//
// La promessa da difendere e una sola: UN FILE PER TUTTO IL SITO. Quindi
// si controlla che (a) il segno ci sia in ogni schermata dove compare la
// scritta, (b) tutte puntino allo stesso identico file, (c) quel file
// esista davvero, e (d) sui temi scuri sia leggibile e non un rettangolo
// nero su nero.
import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3200";
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

/* Il file esiste e viene servito. */
{
  const { ctx, page } = await open("/app/mese");
  const resp = await page.request.get(BASE + "/logo.png");
  check("public/logo.png viene servito", resp.status() === 200, `HTTP ${resp.status()}`);
  const len = Number(resp.headers()["content-length"] ?? 0);
  check("il file non e vuoto", len > 1000, `${len} byte`);
  await ctx.close();
}

/* C'e in ogni schermata dove compare la scritta, e punta sempre allo stesso file. */
for (const [dove, url, opts] of [
  ["rail desktop", "/app/mese", {}],
  ["login", "/login", { width: 430, height: 800 }],
]) {
  const { ctx, page, errors } = await open(url, opts);
  const n = await page.locator("img.jm-logo").count();
  check(`${dove}: il segno c'e`, n >= 1, `${n} trovati`);
  const srcs = await page.locator("img.jm-logo").evaluateAll((els) =>
    [...new Set(els.map((e) => new URL(e.getAttribute("src"), location.href).pathname))],
  );
  check(`${dove}: un solo file, ed e /logo.png`, srcs.length === 1 && srcs[0] === "/logo.png", JSON.stringify(srcs));
  const broken = await page.locator("img.jm-logo").evaluateAll((els) => els.filter((e) => !e.complete || e.naturalWidth === 0).length);
  check(`${dove}: l'immagine si carica davvero`, broken === 0, `${broken} rotte`);
  check(`${dove}: zero errori in console`, errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* Nella rail sta SOPRA la scritta (dal 2 settembre 2026: segno sopra,
   parola sotto) e non la sfonda. */
{
  const { ctx, page } = await open("/app/mese");
  const box = await page.locator(".jm-rail-brand img.jm-logo").boundingBox();
  const brand = await page.locator(".jm-rail-brand").boundingBox();
  check("rail: il segno e dentro il blocco del marchio", box.x >= brand.x - 1 && box.y >= brand.y - 1, JSON.stringify(box));
  const parola = await page.locator(".jm-rail-brand .jm-marchio-parola").boundingBox();
  check("rail: il segno sta SOPRA la scritta", box.y + box.height <= parola.y + 2, `segno finisce a y ${Math.round(box.y + box.height)}, parola inizia a y ${Math.round(parola.y)}`);
  check("rail: altezza sensata rispetto al testo", box.height > 18 && box.height < 60, `${Math.round(box.height)}px`);
  await ctx.close();
}

/* La misura e in em: cambiando "Dimensione del testo" il segno cresce. */
{
  const a = await open("/app/mese", { scale: 1 });
  const h1 = (await a.page.locator(".jm-rail-brand img.jm-logo").boundingBox()).height;
  await a.ctx.close();
  const b2 = await open("/app/mese", { scale: 1.5 });
  const h2 = (await b2.page.locator(".jm-rail-brand img.jm-logo").boundingBox()).height;
  await b2.ctx.close();
  check(
    "il segno segue la dimensione del testo",
    h2 > h1 * 1.35,
    `${Math.round(h1)}px -> ${Math.round(h2)}px`,
  );
}

/* Temi scuri: il segno viene schiarito, e resta un file solo. */
{
  const { ctx, page } = await open("/app/mese", { appearance: "dark" });
  const mode = await page.evaluate(() => document.documentElement.getAttribute("data-mode"));
  const f = await page.locator(".jm-rail-brand img.jm-logo").evaluate((el) => getComputedStyle(el).filter);
  check("scuro: il tema e davvero scuro", mode === "dark", String(mode));
  check("scuro: il segno viene schiarito", /invert/.test(f), f);
  const src = await page.locator(".jm-rail-brand img.jm-logo").getAttribute("src");
  check("scuro: e sempre lo stesso file, non un secondo logo", src === "/logo.png", String(src));
  await ctx.close();
}
{
  const { ctx, page } = await open("/app/mese", { appearance: "light" });
  const f = await page.locator(".jm-rail-brand img.jm-logo").evaluate((el) => getComputedStyle(el).filter);
  check("chiaro: nessun filtro, il colore e quello del file", f === "none", f);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length === 0 ? 0 : 1);
