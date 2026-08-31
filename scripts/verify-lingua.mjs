// Verifica del bilingue in esecuzione (task 27). L'analisi statica sta in
// verify-i18n.mjs; qui si guarda l'app vera.
//
// Cosa deve reggere:
//  1. al primo avvio la lingua la decide il DISPOSITIVO, senza chiedere
//     niente: browser inglese -> app inglese, browser italiano -> italiano;
//  2. il cambio da Impostazioni si vede SUBITO, senza ricaricare, e resta
//     dopo un reload;
//  3. "Come il dispositivo" resta selezionabile anche dopo aver scelto a
//     mano (chi cambia telefono deve poter tornare all'automatico);
//  4. <html lang> segue, perche e cio che legge uno screen reader;
//  5. cambiano anche i NUMERI e le DATE: 81,4 kg in italiano, 81.4 in
//     inglese. Una virgola decimale in un'app inglese e un bug, non un
//     dettaglio;
//  6. ZERO errori in console in tutte e due le lingue. Questo e il vero
//     motivo per cui la traduzione si accende dopo l'idratazione: se il
//     client partisse in inglese sull'HTML italiano del server, React
//     urlerebbe qui.
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

async function open(locale, { path = "/settings", pref = null } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale,
  });
  await ctx.addInitScript(
    ([p]) => {
      try {
        window.localStorage.setItem("jm.mode", "local"); /* niente velo del saluto sui banchi */ window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco"); window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
        if (p) window.localStorage.setItem("jm:lang", p);
      } catch {}
    },
    [pref],
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  if (path === "/settings") await page.waitForSelector(".jm-st-group", { timeout: 15000 });
  await page.waitForTimeout(600);
  return { ctx, page, errors };
}

/* ============ 1. la lingua del dispositivo, da sola ============ */
{
  const { ctx, page, errors } = await open("en-GB");
  check(
    "browser inglese: l'app parte in inglese senza chiedere niente",
    (await page.locator(".jm-st-h1").innerText()).trim() === "Settings",
    await page.locator(".jm-st-h1").innerText(),
  );
  check(
    "browser inglese: <html lang> dice en",
    (await page.evaluate(() => document.documentElement.lang)) === "en",
  );
  const gruppi = (await page.locator(".jm-st-gl").allInnerTexts()).map((x) =>
    x.trim().toLowerCase(),
  );
  check(
    "browser inglese: anche i titoli dei gruppi sono tradotti",
    gruppi.includes("your data") && gruppi.includes("language and look"),
    gruppi.join(" . "),
  );
  check(
    "browser inglese: la riga Lingua dice English . automatic",
    (await page
      .locator(".jm-st-row", { hasText: "Language" })
      .first()
      .locator(".jm-st-val")
      .innerText()) === "English . automatic",
  );
  check("browser inglese: zero errori console", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}
{
  const { ctx, page, errors } = await open("it-IT");
  check(
    "browser italiano: l'app parte in italiano",
    (await page.locator(".jm-st-h1").innerText()).trim() === "Impostazioni",
  );
  check(
    "browser italiano: <html lang> dice it",
    (await page.evaluate(() => document.documentElement.lang)) === "it",
  );
  check("browser italiano: zero errori console", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

/* ============ 2-4. il cambio a mano ============ */
{
  const { ctx, page, errors } = await open("it-IT");

  await page.locator(".jm-st-row", { hasText: "Lingua" }).first().click();
  await page.waitForTimeout(300);
  const voci = await page.locator(".jm-st-t").allInnerTexts();
  check(
    "pannello Lingua: tre voci, con l'automatico fra queste",
    voci.includes("Italiano") && voci.includes("English") && voci.includes("Come il dispositivo"),
    voci.join(" . "),
  );
  check(
    "pannello Lingua: di default e selezionato 'Come il dispositivo'",
    (await page.locator(".jm-st-row", { hasText: "Come il dispositivo" }).innerText()).includes("✓"),
  );

  await page.locator(".jm-st-row", { hasText: "English" }).first().click();
  await page.waitForTimeout(400);
  check(
    "cambio a English: si vede subito, senza ricaricare",
    (await page.locator(".jm-st-phead .jm-st-h1").innerText()).trim() === "Language",
    await page.locator(".jm-st-phead .jm-st-h1").innerText(),
  );
  check(
    "cambio a English: <html lang> passa a en",
    (await page.evaluate(() => document.documentElement.lang)) === "en",
  );

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".jm-st-group");
  await page.waitForTimeout(500);
  check(
    "cambio a English: resta dopo un reload",
    (await page.locator(".jm-st-h1").innerText()).trim() === "Settings",
  );
  check(
    "cambio a English: la riga Lingua NON dice piu automatic",
    (await page
      .locator(".jm-st-row", { hasText: "Language" })
      .first()
      .locator(".jm-st-val")
      .innerText()) === "English",
  );

  // e si torna all'automatico
  await page.locator(".jm-st-row", { hasText: "Language" }).first().click();
  await page.waitForTimeout(300);
  await page.locator(".jm-st-row", { hasText: "Same as the device" }).click();
  await page.waitForTimeout(400);
  check(
    "si torna a 'come il dispositivo' e l'app riparla italiano",
    (await page.locator(".jm-st-phead .jm-st-h1").innerText()).trim() === "Lingua",
  );

  check("cambio lingua: zero errori console", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

/* ============ 5. numeri e date seguono la lingua ============ */
for (const [locale, atteso, sep] of [
  ["it-IT", "81,4", "virgola"],
  ["en-GB", "81.4", "punto"],
]) {
  const { ctx, page, errors } = await open(locale, { path: "/" });
  await page.waitForTimeout(1200);
  await page.locator(".jm-rm-row").nth(0).click(); // peso
  await page.waitForTimeout(350);
  await page.locator(".jm-rm-stepper input").fill("81,4");
  await page.locator(".jm-rm-ok").click();
  await page.waitForTimeout(700);
  const v = (await page.locator(".jm-rm-v").first().innerText()).replace(/\s/g, "");
  check(`${locale}: il peso si scrive con la ${sep}`, v.startsWith(atteso), v);
  check(`${locale}: zero errori console`, errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

/* ============ 6. le altre schermate, non solo Impostazioni ============ */
{
  const { ctx, page, errors } = await open("en-GB", { path: "/mese" });
  await page.waitForTimeout(1200);
  const testo = await page.locator("body").innerText();
  check(
    "Mese in inglese: intestazioni della griglia tradotte",
    /days told/i.test(testo) && !/giornate raccontate/i.test(testo),
  );
  check(
    "Mese in inglese: i nomi dei mesi arrivano da Intl, non da una lista italiana",
    !/(Gennaio|Febbraio|Marzo|Aprile|Maggio|Giugno|Luglio|Agosto|Settembre|Ottobre|Novembre|Dicembre)/.test(
      testo,
    ),
    testo.split("\n").slice(0, 3).join(" | "),
  );
  check("Mese in inglese: zero errori console", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}
{
  const { ctx, page, errors } = await open("en-GB", { path: "/remember" });
  await page.waitForTimeout(900);
  check(
    "Ricorda in inglese: titolo e filtri tradotti",
    (await page.locator(".jm-rem-h").innerText()).trim() === "Remember",
    await page.locator(".jm-rem-h").innerText(),
  );
  check("Ricorda in inglese: zero errori console", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
await browser.close();
process.exit(failed.length === 0 ? 0 : 1);
