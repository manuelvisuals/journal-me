// Verifica di Impostazioni (ex "Altro") — mockup impostazioni.html §03/§04,
// implementato il 20 agosto 2026.
//
// Cosa deve reggere, e perche:
//  1. il nome e "Impostazioni" ovunque: pagina, rail sinistra, tab bar,
//     palette comandi. "Altro" era il nome di un cassetto;
//  2. l'elenco e a gruppi e OGNI riga dice la cosa e il suo valore: il
//     numero di obiettivi, il tema attivo, quante giornate ci sono;
//  3. ogni riga e alta almeno 56px (brandbook cap. 05 chiede 44);
//  4. i pannelli si aprono e il tasto indietro riporta all'elenco;
//  5. cambiare tema o chiaro/scuro si vede SUBITO nella riga dell'elenco;
//  6. la rail destra tiene l'identita e non sborda a nessuna larghezza;
//  7. sul telefono la card Recap c'e, su desktop no (li Recap e nella rail
//     sinistra) — e viceversa per l'identita;
//  8. "Zona pericolosa" esiste solo in modalita locale.
//
// Serve il dev server su :3100.
import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3100";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

async function newPage(width, height, { local = true } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    locale: "it-IT",
  });
  if (local) {
    await ctx.addInitScript(() => {
      try { window.localStorage.setItem("jm.mode", "local"); } catch {}
    });
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + "/settings", { waitUntil: "networkidle" });
  await page.waitForSelector(".jm-st-group", { timeout: 15000 });
  await page.waitForTimeout(400);
  return { ctx, page, errors };
}

/* ============ 1. il nome ============ */
{
  const { ctx, page, errors } = await newPage(1440, 900);
  check(
    "desktop: il titolo dice Impostazioni",
    (await page.locator(".jm-st-h1").innerText()).trim() === "Impostazioni",
  );
  const railLabels = await page.locator(".jm-rail-l").allInnerTexts();
  check(
    "rail sinistra: la voce si chiama Impostazioni",
    railLabels.join(" ").includes("Impostazioni") && !railLabels.join(" ").includes("Altro"),
    railLabels.join(" ").replace(/\n/g, " "),
  );
  check("desktop: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ 2-3. gruppi, valori, bersagli ============ */
for (const w of [1280, 1440, 1728, 2600]) {
  const { ctx, page, errors } = await newPage(w, 1000);

  const groups = (await page.locator(".jm-st-gl").allInnerTexts()).map((t) =>
    t.trim().toLowerCase(),
  );
  check(
    `${w}: i gruppi ci sono tutti`,
    ["il diario", "lingua e aspetto", "i tuoi dati", "zona pericolosa"].every((g) =>
      groups.includes(g),
    ),
    groups.join(" . "),
  );

  // Ogni riga dice il suo valore.
  const goalsRow = page.locator(".jm-st-row", { hasText: "Obiettivi" }).first();
  check(
    `${w}: la riga Obiettivi dice quanti sono`,
    /\d+ attiv[oi]/.test(await goalsRow.innerText()),
    (await goalsRow.innerText()).replace(/\n/g, " "),
  );
  const themeRow = page.locator(".jm-st-row", { hasText: "Tema" }).first();
  check(
    `${w}: la riga Tema dice quale`,
    (await themeRow.locator(".jm-st-val").innerText()).trim().length > 0,
    await themeRow.locator(".jm-st-val").innerText(),
  );
  const exportRow = page.locator(".jm-st-row", { hasText: "Esporta un backup" }).first();
  check(
    `${w}: la riga Esporta dice quante giornate`,
    /giornat[ae]/.test(await exportRow.innerText()),
    (await exportRow.innerText()).replace(/\n/g, " "),
  );

  // Bersagli: nessuna riga sotto i 56px.
  const heights = await page.locator(".jm-st-row").evaluateAll((els) =>
    els
      .filter((e) => e.getClientRects().length > 0)
      .map((e) => Math.round(e.getBoundingClientRect().height)),
  );
  check(
    `${w}: ogni riga >= 56px`,
    heights.length > 0 && heights.every((h) => h >= 56),
    `min=${Math.min(...heights)} n=${heights.length}`,
  );

  // La rail destra non sborda mai.
  const railOk = await page.evaluate(() => {
    const r = document.querySelector(".jm-rail-r");
    return !!r && r.scrollWidth === r.clientWidth;
  });
  check(`${w}: rail destra senza sbordamento`, railOk);

  check(`${w}: zero errori console`, errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ 4. i pannelli si aprono e si chiudono ============ */
{
  const { ctx, page, errors } = await newPage(1440, 900);

  for (const [rowText, title] of [
    ["Obiettivi", "Obiettivi"],
    ["Tema", "Tema"],
    ["Dove sono le mie giornate", "Dove sono le mie giornate"],
  ]) {
    await page.locator(".jm-st-row", { hasText: rowText }).first().click();
    await page.waitForTimeout(250);
    check(
      `pannello ${title}: si apre`,
      (await page.locator(".jm-st-phead .jm-st-h1").innerText()).trim() === title,
    );
    await page.locator(".jm-st-back").click();
    await page.waitForTimeout(250);
    check(
      `pannello ${title}: l'indietro torna all'elenco`,
      (await page.locator(".jm-st-h1").innerText()).trim() === "Impostazioni",
    );
  }

  // Aggiungere un obiettivo aggiorna il contatore dell'elenco.
  const before = Number(
    (await page.locator(".jm-st-row", { hasText: "Obiettivi" }).first().innerText())
      .match(/(\d+) attiv/)?.[1] ?? "0",
  );
  await page.locator(".jm-st-row", { hasText: "Obiettivi" }).first().click();
  await page.waitForTimeout(250);
  await page.locator(".jm-st-add input").fill("prova verifica");
  await page.locator(".jm-st-add button").click();
  await page.waitForTimeout(700);
  await page.locator(".jm-st-back").click();
  await page.waitForTimeout(300);
  const after = Number(
    (await page.locator(".jm-st-row", { hasText: "Obiettivi" }).first().innerText())
      .match(/(\d+) attiv/)?.[1] ?? "0",
  );
  check("obiettivi: il contatore dell'elenco si aggiorna", after === before + 1, `${before} -> ${after}`);

  check("pannelli: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ 5. tema e chiaro/scuro si vedono subito ============ */
{
  const { ctx, page, errors } = await newPage(1440, 900);

  const themeVal = () =>
    page.locator(".jm-st-row", { hasText: "Tema" }).first().locator(".jm-st-val").innerText();
  const before = (await themeVal()).trim();

  await page.locator(".jm-st-row", { hasText: "Tema" }).first().click();
  await page.waitForTimeout(250);
  const cards = page.locator(".jm-theme-card");
  const n = await cards.count();
  check("tema: la griglia mostra tutti i temi", n >= 5, String(n));
  // Il primo tema che NON e quello attivo.
  let picked = null;
  for (let i = 0; i < n; i += 1) {
    const name = (await cards.nth(i).locator(".jm-theme-name").innerText()).trim();
    if (name !== before) { picked = name; await cards.nth(i).click(); break; }
  }
  await page.waitForTimeout(400);
  await page.locator(".jm-st-back").click();
  await page.waitForTimeout(300);
  check(
    "tema: la riga dell'elenco mostra subito il tema nuovo",
    (await themeVal()).trim() === picked,
    `${before} -> ${(await themeVal()).trim()} (atteso ${picked})`,
  );

  // Chiaro/scuro dalla riga, senza entrare da nessuna parte.
  const seg = page.locator(".jm-st-seg button");
  check("chiaro/scuro: tre opzioni in linea", (await seg.count()) === 3);
  await seg.nth(1).click(); // Scuro
  await page.waitForTimeout(350);
  check(
    "chiaro/scuro: 'Scuro' applica il tema scuro",
    (await page.evaluate(() => document.documentElement.getAttribute("data-mode"))) === "dark",
  );
  check(
    "chiaro/scuro: l'opzione scelta e marcata",
    (await seg.nth(1).getAttribute("aria-checked")) === "true",
  );
  await seg.nth(0).click();
  await page.waitForTimeout(350);
  check(
    "chiaro/scuro: si torna al chiaro",
    (await page.evaluate(() => document.documentElement.getAttribute("data-mode"))) === "light",
  );

  check("tema: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ 6-7. rail destra su desktop, Recap sul telefono ============ */
{
  const { ctx, page } = await newPage(1728, 1000);
  check(
    "desktop: l'identita e nella rail destra",
    await page.locator(".jm-rail-r .jm-st-acct").isVisible(),
  );
  check(
    "desktop: la card Recap NON e nella colonna",
    !(await page.locator(".jm-st-recap").isVisible()),
  );
  check(
    "desktop: la rail dice piano e versione",
    (await page.locator(".jm-rail-r").innerText()).includes("Versione"),
  );
  await ctx.close();
}
{
  const { ctx, page } = await newPage(430, 932);
  check(
    "telefono: la card Recap c'e",
    await page.locator(".jm-st-recap").isVisible(),
  );
  check(
    "telefono: il gruppo Account e nella colonna",
    (await page.locator(".jm-st-gl").allInnerTexts())
      .map((t) => t.trim().toLowerCase())
      .includes("account"),
  );
  const box = await page.locator(".jm-st-box").first().boundingBox();
  check(
    "telefono: l'elenco sta dentro i 430px",
    box.x >= 20 && box.x + box.width <= 410,
    `x=${Math.round(box.x)} w=${Math.round(box.width)}`,
  );
  const tab = await page.locator("nav a", { hasText: "Impost." }).count();
  check("telefono: la tab bar dice Impost.", tab === 1, String(tab));
  await ctx.close();
}

/* ============ 8. la zona pericolosa chiede conferma ============ */
// Nota: la variante cloud non e verificabile qui. Senza sessione /settings
// rimanda a /login, e questo harness gira senza account: il ramo cloud
// (niente "Zona pericolosa") resta verificato leggendo il codice, come per
// clearPlanCache. Quello che si puo provare davvero e che in locale la
// cancellazione non parte al primo tocco.
{
  const { ctx, page } = await newPage(1440, 900);
  const row = page.locator(".jm-st-row", { hasText: "Cancella tutte le giornate" }).first();
  check(
    "zona pericolosa: il primo tocco non cancella niente",
    !(await row.innerText()).includes("si, cancella"),
  );
  await row.click();
  await page.waitForTimeout(250);
  check(
    "zona pericolosa: il primo tocco chiede conferma",
    (await row.innerText()).includes("Sicuro?") && (await row.innerText()).includes("si, cancella"),
    (await row.innerText()).replace(/\n/g, " "),
  );
  await ctx.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
await browser.close();
process.exit(failed.length === 0 ? 0 : 1);
