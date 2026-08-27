// Verifica PR 10 (gating-ui: muro premium, giornata gratis, larghezze) — locale.
import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3100";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

async function newPage(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: "it-IT" });
  await ctx.addInitScript(() => {
    try { window.localStorage.setItem("jm.mode", "local"); /* niente velo del saluto sui banchi */ window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco"); window.localStorage.setItem("jm.saluto.silenzio", "dev:banco"); } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  const external = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("request", (r) => {
    const u = r.url();
    if (!u.startsWith(BASE) && !u.startsWith("data:") && !u.startsWith("blob:")) external.push(u);
  });
  return { ctx, page, errors, external };
}

/* ============ DESKTOP 1440, modalita locale ============ */
{
  const { ctx, page, errors, external } = await newPage(1440, 900);
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // Larghezze: editor a riga leggibile in colonna larga
  const mainW = (await page.locator("main").first().boundingBox())?.width;
  check("oggi: contenitore fluido (>=900)", (mainW ?? 0) >= 900, String(mainW));
  // Larghezza dell'editor: FLUIDA (regola di Manuel del 20 ago). L'unica
  // cosa fissa e il margine di 28px per lato dal bordo della colonna, e il
  // testo deve partire dalla stessa verticale della data nell'header.
  const scrollBox = await page.locator(".jm-ed-scroll").boundingBox();
  const taBox = await page.locator(".jm-ed-ta").boundingBox();
  const headBox = await page.locator(".jm-col-head span").first().boundingBox();
  check(
    "oggi: editor fluido con margini 28px",
    Math.round(taBox.x - scrollBox.x) === 28 &&
      Math.round(scrollBox.x + scrollBox.width - (taBox.x + taBox.width)) === 28,
    `left=${Math.round(taBox.x - scrollBox.x)} right=${Math.round(scrollBox.x + scrollBox.width - (taBox.x + taBox.width))} w=${Math.round(taBox.width)}`,
  );
  check(
    "oggi: testo allineato alla data dell'header",
    Math.round(taBox.x) === Math.round(headBox.x),
    `${Math.round(taBox.x)} vs ${Math.round(headBox.x)}`,
  );

  // Salva una giornata senza AI -> vista gratis con prosa e nudge
  await page.locator(".jm-ed-ta").click();
  await page.keyboard.type("Prima riga come titolo della giornata.\n\nSecondo paragrafo con il resto del racconto scritto a mano.");
  await page.keyboard.press("Control+Enter");
  await page.waitForTimeout(1500);
  check("gratis: prosa visibile", (await page.locator(".jm-fv-prose p").count()) === 2);
  check("gratis: sub 'scritta alle'", /scritta alle \d{1,2}:\d{2}/.test(await page.locator(".jm-fv-sub").innerText()));
  check("gratis: nudge premium presente", await page.locator(".jm-fv-nudge").isVisible());
  check("gratis: niente 'aree macro non ancora estratte'", (await page.locator(".jm-fv-noareas").count()) === 0);

  // 'vedi' -> muro premium
  await page.locator(".jm-fv-nudge .btn-ghost").click();
  await page.waitForTimeout(300);
  check("nudge: apre il muro", await page.locator(".jm-wall").isVisible());
  check("muro: titolo aiSummary", (await page.locator(".jm-wall-t").innerText()).includes("titolo"));
  await page.locator(".jm-wall .btn-ghost").click();
  await page.waitForTimeout(300);
  check("muro: 'non ora' chiude", !(await page.locator(".jm-wall").isVisible().catch(() => false)));

  // Mic dell'header (Registra di nuovo) -> muro voice, 'non ora' -> editor
  await page.locator('[aria-label="Registra di nuovo"]').click();
  await page.waitForTimeout(300);
  check("mic: apre il muro voice", (await page.locator(".jm-wall-t").innerText().catch(() => "")).includes("raccontare a voce"));
  await page.locator(".jm-wall .btn-ghost").click();
  await page.waitForTimeout(400);
  check("mic: uscita gratuita = scrittura", await page.locator(".jm-ed-ta").isVisible());
  // 'prova premium' -> /login (in locale)
  await page.locator('.jm-ed-foot .btn-ghost').first().click(); // annulla -> filled
  await page.waitForTimeout(300);
  await page.locator('[aria-label="Registra di nuovo"]').click();
  await page.waitForTimeout(300);
  await page.locator(".jm-wall .btn-primary").click();
  await page.waitForTimeout(900);
  try { await page.waitForURL("**/login**", { timeout: 8000 }); } catch {}
  check("muro: 'prova premium' porta al login", page.url().includes("/login"));

  // Recap: Genera -> muro recap
  await page.goto(BASE + "/recap", { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  const gen = page.locator(".jm-gen-btn");
  if ((await gen.count()) > 0) {
    await gen.click();
    await page.waitForTimeout(300);
    check("recap: Genera apre il muro", (await page.locator(".jm-wall-t").innerText().catch(() => "")).includes("recap"));
    await page.keyboard.press("Escape");
  } else {
    check("recap: card Genera presente", false, "manca jm-gen-btn");
  }

  // Mese: pill premium su Pattern + larghezza griglia
  await page.goto(BASE + "/mese", { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  check("mese: pill premium su Pattern", await page.locator(".jm-railr-pill").isVisible());
  const meseW = (await page.locator("main").first().boundingBox())?.width;
  check("mese: contenitore largo (>=900)", (meseW ?? 0) >= 900, String(meseW));

  // Ricorda: classificazione NON parte in locale (zero richieste esterne piu sotto)
  await page.goto(BASE + "/remember", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const remW = (await page.locator("main").first().boundingBox())?.width;
  check("ricorda: contenitore fluido (>=1200, niente rail destra)", (remW ?? 0) >= 1200, String(remW));

  check("locale: ZERO richieste esterne", external.length === 0, external.slice(0, 3).join(" | "));
  check("desktop: zero errori console", errors.length === 0, errors.join(" | ").slice(0, 200));
  await ctx.close();
}

/* ============ TELEFONO 430, modalita locale ============ */
{
  const { ctx, page, errors, external } = await newPage(430, 900);
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const mainW = (await page.locator("main").first().boundingBox())?.width;
  check("phone: contenitore max 440 invariato", (mainW ?? 0) <= 440, String(mainW));

  // Scrivi e salva dalla ManualWrite -> vista gratis con prosa
  await page.locator(".mic-big-btn").click(); // writeFirst: penna
  await page.waitForTimeout(400);
  await page.locator(".jm-editor-textarea").fill("Titolo dal telefono.\nRacconto del giorno scritto dal telefono.");
  await page.locator(".jm-editor-btn.save").click();
  await page.waitForTimeout(500);
  // ReviewScreen -> conferma
  const confirm = page.locator("button", { hasText: /conferma|continua|elabora/i }).first();
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.click();
  }
  await page.waitForTimeout(1500);
  check("phone gratis: prosa visibile", (await page.locator(".jm-fv-prose").count()) === 1);
  check("phone gratis: nudge presente", await page.locator(".jm-fv-nudge").isVisible());

  // Mic in header -> muro anche sotto lg
  await page.locator('[aria-label="Registra di nuovo"]').click();
  await page.waitForTimeout(300);
  check("phone: muro voice visibile", await page.locator(".jm-wall").isVisible());
  await page.locator(".jm-wall .btn-ghost").click();
  await page.waitForTimeout(300);
  check("phone: 'non ora' apre la scrittura", await page.locator(".jm-editor-textarea").isVisible());

  check("phone locale: ZERO richieste esterne", external.length === 0, external.slice(0, 3).join(" | "));
  check("phone: zero errori console", errors.length === 0, errors.join(" | ").slice(0, 200));
  await ctx.close();
}

await browser.close();
const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} PASS`);
process.exit(fails.length ? 1 : 0);
