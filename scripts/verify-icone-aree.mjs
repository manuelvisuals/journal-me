// Verifica delle icone delle aree (mockup icone-aree.html §01).
// Locale, porta 3200. Serve una giornata con delle aree: la suite ne
// scrive una a mano in modalita locale, cosi non dipende da nessun dato.
//
// Le due cose che contano davvero: che i CINQUE filtri a pennello siano
// cinque e non uno solo (gli id di un SVG inline sono globali al
// documento: se restassero tutti "s", ogni icona userebbe il primo), e
// che il tratto segua il colore del testo, perche il marrone del file
// originale su un tema scuro sparirebbe.
import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3200";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const DATA = "2026-03-14";
const FIXTURE = new URL("./fixtures-icone-aree.json", import.meta.url).pathname;

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

async function open({ width = 1440, height = 950, appearance = "light", theme = "minimal" } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: "it-IT" });
  await ctx.addInitScript(([a, t]) => {
    try {
      window.localStorage.setItem("jm.mode", "local"); window.localStorage.setItem("jm.ospite", "0"); /* niente velo del saluto sui banchi */ window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco"); window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
      window.localStorage.setItem("jm:appearance", a);
      window.localStorage.setItem("jm:theme", t);
    } catch {}
  }, [appearance, theme]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  // La giornata di prova entra dalla porta principale: importa un backup,
  // che e la sola strada che l'app garantisce. Scrivere a mano in IndexedDB
  // funzionava finche lo schema non cambiava, ed e esattamente il genere di
  // prova che si rompe da sola sei mesi dopo.
  await page.goto(BASE + "/app/settings", { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  await page.waitForTimeout(2600);

  await page.goto(BASE + "/app/giorno?d=" + DATA, { waitUntil: "networkidle" });
  await page.waitForTimeout(1600);
  return { ctx, page, errors };
}

/* ---- ci sono, e sono cinque su sei ---- */
{
  const { ctx, page, errors } = await open();
  const cards = await page.locator(".jm-fv-area").count();
  check("la giornata di prova mostra sei aree", cards === 6, String(cards));

  const icons = await page.locator(".jm-fv-area .l svg.jm-area-ic").count();
  check("cinque icone su sei aree: Corpo resta senza", icons === 5, String(icons));

  const corpo = await page.locator(".jm-fv-area").filter({ hasText: "CORPO" }).locator("svg.jm-area-ic").count();
  check("ed e proprio Corpo quella senza", corpo === 0, String(corpo));

  /* Il punto vero: cinque filtri distinti, non cinque riferimenti al primo. */
  const ids = await page.locator(".jm-fv-area .l svg.jm-area-ic filter").evaluateAll((els) =>
    [...new Set(els.map((e) => e.id))]);
  check("i cinque filtri a pennello hanno cinque id diversi", ids.length === 5, ids.join(" "));

  const usati = await page.locator(".jm-fv-area .l svg.jm-area-ic g").evaluateAll((els) =>
    [...new Set(els.map((e) => e.getAttribute("filter")))]);
  check("e ogni disegno usa il suo", usati.length === 5, usati.join(" "));

  /* Misura e posizione */
  // La misura e in em: cresce con il testo, quindi si controlla il RAPPORTO
  // con l'etichetta accanto, non un numero di pixel che cambia con la
  // dimensione dell'interfaccia scelta in Impostazioni.
  const box = await page.locator(".jm-fv-area .l svg.jm-area-ic").first().boundingBox();
  const fs = await page.locator(".jm-fv-area .l").first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  check("larga poco meno di due volte l'etichetta accanto",
    box.width / fs > 1.7 && box.width / fs < 1.95,
    `${box.width.toFixed(1)}px su testo da ${fs.toFixed(1)}px`);
  // NON sta dentro la riga: le esce sopra e sotto apposta, per non alzarla
  // (vedi features.css). Cio che deve valere e che sia CENTRATA su di lei.
  const lab = await page.locator(".jm-fv-area").first().locator(".l").boundingBox();
  const dIcona = box.y + box.height / 2;
  const dRiga = lab.y + lab.height / 2;
  check("centrata sulla riga dell'etichetta",
    Math.abs(dIcona - dRiga) <= 2, `${dIcona.toFixed(1)} contro ${dRiga.toFixed(1)}`);

  check("zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ---- la scheda non e cresciuta: e il senso della collocazione scelta ---- */
{
  const { ctx, page } = await open();
  const hCon = (await page.locator(".jm-fv-area").first().boundingBox()).height;
  await page.locator(".jm-area-icw").evaluateAll((e) => e.forEach((x) => x.remove()));
  await page.waitForTimeout(300);
  const hSenza = (await page.locator(".jm-fv-area").first().boundingBox()).height;
  check("con e senza icona la scheda e alta uguale",
    Math.abs(hCon - hSenza) <= 1, `${Math.round(hCon)}px contro ${Math.round(hSenza)}px`);
  await ctx.close();
}

/* ---- il colore segue il tema, il punto no ---- */
for (const [nome, appearance, theme] of [
  ["minimal chiaro", "light", "minimal"],
  ["minimal scuro", "dark", "minimal"],
  ["wine scuro", "dark", "wine"],
]) {
  const { ctx, page } = await open({ appearance, theme });
  const ic = page.locator(".jm-fv-area .l svg.jm-area-ic").first();
  const stroke = await ic.locator("g").first().evaluate((e) => getComputedStyle(e).stroke);
  const ink = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--color-ink").trim());
  check(`${nome}: il tratto NON e il marrone del file`, !/43, *23, *16/.test(stroke), stroke);
  check(`${nome}: il tratto ha il colore del testo`, stroke.length > 0 && ink.length > 0, `${stroke} / ink ${ink}`);
  // Il punto caldo non e sempre un cerchio: in "Lavoro" e una scintilla
  // disegnata con un path. Si cerca per riempimento, non per forma.
  const dot = await ic.locator("circle, path[fill]").first().evaluate((e) => getComputedStyle(e).fill);
  check(`${nome}: il punto resta terracotta`, dot.replace(/\s/g, "") === "rgb(201,111,74)", dot);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length === 0 ? 0 : 1);
