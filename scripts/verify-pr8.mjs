// Verifica PR 8 (scorciatoie + palette Cmd+K) — modalita locale.
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
    try { window.localStorage.setItem("jm.mode", "local"); } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  return { ctx, page, errors };
}

/* ============ DESKTOP 1440 ============ */
{
  const { ctx, page, errors } = await newPage(1440, 900);
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  // Cmd+K apre la palette
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(300);
  check("Cmd+K apre la palette", await page.locator(".jm-pal").isVisible());
  check("palette: input a fuoco", await page.locator(".jm-pal-input").evaluate((el) => el === document.activeElement));
  check("palette: voce Mese presente", (await page.locator(".jm-pal-item", { hasText: "Mese" }).count()) === 1);
  check("palette: Modalita focus presente su Oggi", (await page.locator(".jm-pal-item", { hasText: "Modalita focus" }).count()) === 1);
  check("palette: in locale 'Scrivi la giornata'", (await page.locator(".jm-pal-item", { hasText: "Scrivi la giornata" }).count()) === 1);

  // Esc chiude
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  check("Esc chiude la palette", !(await page.locator(".jm-pal").isVisible().catch(() => false)));

  // Cmd+K -> naviga a Mese con frecce+invio
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(300);
  await page.locator(".jm-pal-input").type("mese");
  await page.waitForTimeout(200);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  check("palette: naviga a /mese", page.url().includes("/mese"));

  // Cmd+K da /mese: niente 'Modalita focus'
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(300);
  check("palette: focus assente fuori da Oggi", (await page.locator(".jm-pal-item", { hasText: "Modalita focus" }).count()) === 0);

  // Cattura in Ricorda
  await page.locator(".jm-pal-input").type("comprare il latte domani");
  await page.waitForTimeout(200);
  const capture = page.locator(".jm-pal-item", { hasText: "Salva in Ricorda" });
  check("palette: voce cattura presente", (await capture.count()) === 1);
  await capture.click();
  await page.waitForTimeout(400);
  check("palette: feedback 'salvato in Ricorda'", await page.locator(".jm-pal-done").isVisible());
  await page.waitForTimeout(900);
  check("palette: si chiude da sola dopo la cattura", !(await page.locator(".jm-pal").isVisible().catch(() => false)));
  await page.goto(BASE + "/remember", { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  check("Ricorda: l'appunto catturato esiste", (await page.getByText("comprare il latte domani").count()) >= 1);

  // Cmd+Shift+R apre la scrittura (locale: mic -> editor)
  await page.keyboard.press("Control+Shift+r");
  await page.waitForTimeout(1000);
  check("Cmd+Shift+R: torna su Oggi in scrittura", page.url().endsWith("/") && (await page.locator(".jm-ed-ta").isVisible()));

  // Cmd+Shift+F focus on/off
  await page.keyboard.press("Control+Shift+f");
  await page.waitForTimeout(300);
  check("Cmd+Shift+F: focus mode on", await page.locator("html").evaluate((el) => el.getAttribute("data-focus") === "1"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  check("Esc: focus mode off", await page.locator("html").evaluate((el) => el.getAttribute("data-focus") !== "1"));

  // Cmd+S con fuoco FUORI dal textarea salva comunque
  await page.locator(".jm-ed-ta").click();
  await page.keyboard.type("Riga uno via scorciatoia globale.");
  await page.waitForTimeout(1000);
  await page.locator("body").click({ position: { x: 700, y: 60 } });
  await page.keyboard.press("Control+s");
  await page.waitForTimeout(1500);
  const h1 = await page.locator("h1").first().innerText();
  check("Cmd+S globale: giornata salvata", /Riga uno via scorciatoia globale/.test(h1), h1);

  // Hint nel footer editor (riapri la scrittura) e kbd nella rail
  check("rail: hint ⌘⇧R", await page.locator(".jm-rail-kbd").isVisible());

  check("desktop: zero errori console", errors.length === 0, errors.join(" | ").slice(0, 200));
  await ctx.close();
}

/* ============ TELEFONO 430 ============ */
{
  const { ctx, page, errors } = await newPage(430, 900);
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(300);
  check("phone: Cmd+K non fa nulla", !(await page.locator(".jm-pal").isVisible().catch(() => false)));
  check("phone: tab bar presente", await page.locator("nav.sticky").isVisible());
  check("phone: zero errori console", errors.length === 0, errors.join(" | ").slice(0, 200));
  await ctx.close();
}

await browser.close();
const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} PASS`);
process.exit(fails.length ? 1 : 0);
