// Verifica PR 7 (editor desktop, bozze, focus mode) — modalita locale.
// Uso: node scripts/verify-pr7.mjs
import { chromium } from "playwright-core";
import { scalaUi, eAllaScala, spiega } from "./lib/misure.mjs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3100";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok, extra });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({
  executablePath: EXE,
  args: ["--no-sandbox"],
});

async function newPage(width, height) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    locale: "it-IT",
  });
  await ctx.addInitScript(() => {
    try {
      window.localStorage.setItem("jm.mode", "local"); /* niente velo del saluto sui banchi */ window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco"); window.localStorage.setItem("jm.saluto.silenzio", "dev:banco");
    } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  return { ctx, page, errors };
}

async function idbDraft(page, date) {
  return page.evaluate(
    (d) =>
      new Promise((resolve) => {
        const req = indexedDB.open("journalme");
        req.onerror = () => resolve(null);
        req.onsuccess = () => {
          const db = req.result;
          try {
            const tx = db.transaction("drafts", "readonly");
            const get = tx.objectStore("drafts").get(d);
            get.onsuccess = () => resolve(get.result ?? null);
            get.onerror = () => resolve(null);
          } catch {
            resolve(null);
          }
        };
      }),
    date,
  );
}

const today = new Date();
const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

/* ============ 1. DESKTOP 1440 ============ */
{
  const { ctx, page, errors } = await newPage(1440, 900);
  await page.goto(BASE + "/app", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const ta = page.locator(".jm-ed-ta");
  check("desktop: editor inline visibile", await ta.isVisible());
  check(
    "desktop: placeholder serif",
    (await ta.getAttribute("placeholder")) === "Com'e andata oggi?",
  );
  const taStyle = await ta.evaluate((el) => {
    const s = getComputedStyle(el);
    return { size: s.fontSize, weight: s.fontWeight, lh: s.lineHeight, caret: s.caretColor, family: s.fontFamily };
  });
  // 17px E' LA MISURA A SCALA 1, non un numero assoluto: se l'utente (o il
  // default dell'app) ingrandisce l'interfaccia, l'editor deve crescere con
  // lei. Vedi scripts/lib/misure.mjs.
  const scalaDesktop = await scalaUi(page);
  check(
    "desktop: tipografia Inter 17/400 alla misura corrente (conforme, no Spectral)",
    eAllaScala(taStyle.size, 17, scalaDesktop) &&
      taStyle.weight === "400" &&
      !/Spectral/i.test(taStyle.family),
    spiega(taStyle.size, 17, scalaDesktop) + " . " + JSON.stringify(taStyle),
  );
  check("desktop: EmptyState mobile assente", (await page.locator("text=Racconta la tua giornata").count()) === 0);
  check("desktop: rail destra Obiettivi", await page.locator(".jm-railr-l", { hasText: "Obiettivi" }).isVisible());
  const btnPrimary = page.locator(".jm-ed-acts .btn-primary");
  check(
    "desktop locale: un solo bottone 'salva la giornata'",
    (await btnPrimary.count()) === 1 && /salva la giornata/i.test(await btnPrimary.innerText()),
  );
  check("desktop: footer azioni 74px", (await page.locator(".jm-ed-foot").boundingBox())?.height === 74);

  // --- autosave 800ms ---
  await ta.click();
  await page.keyboard.type("Prova bozza desktop.\nSeconda riga del testo.");
  await page.waitForTimeout(1300);
  const draft = await idbDraft(page, iso);
  check("autosave: bozza in IndexedDB dopo 800ms", !!draft && draft.text.includes("Prova bozza desktop"), JSON.stringify(draft)?.slice(0, 80));
  const meta = await page.locator(".jm-ed-meta span").first().innerText();
  check("header: contatore parole + salvato", /parole/.test(meta) && /salvato/.test(meta), meta);

  // --- reload: ripresa bozza ---
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const ta2 = page.locator(".jm-ed-ta");
  check("ripresa: testo recuperato dopo reload", (await ta2.inputValue()).includes("Prova bozza desktop"));
  check("ripresa: avviso bozza", await page.locator(".jm-ed-notice", { hasText: "bozza non salvata" }).isVisible());

  // --- focus mode ---
  await page.locator(".jm-focus-btn").click();
  await page.waitForTimeout(300);
  const railHidden = await page.locator(".jm-rail-l").evaluate((el) => getComputedStyle(el).display === "none");
  const headHidden = await page.locator(".jm-col-head").evaluate((el) => getComputedStyle(el).display === "none");
  check("focus: rail e header nascosti", railHidden && headHidden);
  check("focus: nota 'esc per uscire'", await page.locator(".jm-focus-note").isVisible());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  check("focus: Esc esce", await page.locator(".jm-rail-l").evaluate((el) => getComputedStyle(el).display !== "none"));

  // --- Cmd+S salva (in locale = senza AI comunque) ---
  await page.locator(".jm-ed-ta").click();
  await page.keyboard.press("Meta+s");
  await page.waitForTimeout(1500);
  const headline = await page.locator("h1").first().innerText();
  check("salva: giornata salvata, prima riga come titolo", /Prova bozza desktop/.test(headline), headline);
  const draftAfter = await idbDraft(page, iso);
  check("salva: bozza cancellata a salvataggio riuscito", !draftAfter);

  check("desktop: zero errori console", errors.length === 0, errors.join(" | ").slice(0, 200));
  await ctx.close();
}

/* ============ 2. TELEFONO 430 (nessuna regressione) ============ */
{
  const { ctx, page, errors } = await newPage(430, 900);
  await page.goto(BASE + "/app", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  check("phone: editor desktop NON visibile", !(await page.locator(".jm-ed-wrap").isVisible().catch(() => false)));
  // Il primo <nav> del DOM e la rail sinistra (nascosta sotto lg): il dock
  // e il nav in fondo. Dal 29 agosto 2026 non e piu "sticky": e una
  // pillola sospesa (jm-dock-wrap), e il selettore vecchio non trovava
  // piu niente.
  check("phone: tab bar presente", await page.locator("nav.jm-dock-wrap").isVisible());
  check(
    "phone: rail desktop nascosta",
    await page.locator(".jm-rail-l").evaluate((el) => getComputedStyle(el).display === "none"),
  );
  // La giornata salvata al passo 1 e in un altro context (IDB separato?) —
  // stesso origin, stesso IDB: la entry esiste, quindi vista filled.
  const anyH1 = await page.locator("h1").first().innerText().catch(() => "");
  check("phone: pagina Oggi renderizza", anyH1.length > 0, anyH1);

  // Bozza a mano: scrivi, chiudi, riapri -> overlay con testo recuperato.
  await page.evaluate((d) => new Promise((resolve) => {
    const req = indexedDB.open("journalme");
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("drafts", "readwrite");
      tx.objectStore("drafts").put({ entryDate: d, text: "Bozza dal telefono", updatedAt: new Date(Date.now() + 60000).toISOString() });
      tx.oncomplete = () => resolve(1);
      tx.onerror = () => resolve(0);
    };
    req.onerror = () => resolve(0);
  }), iso);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const overlayTa = page.locator(".jm-editor-textarea");
  check("phone: bozza riapre l'overlay di scrittura", await overlayTa.isVisible());
  if (await overlayTa.isVisible()) {
    check("phone: testo bozza recuperato", (await overlayTa.inputValue()).includes("Bozza dal telefono"));
  }
  check("phone: zero errori console", errors.length === 0, errors.join(" | ").slice(0, 200));
  await ctx.close();
}

await browser.close();
const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} PASS`);
process.exit(fails.length ? 1 : 0);
