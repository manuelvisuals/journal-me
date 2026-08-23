// Verifica PR 9 (Mese a griglia + stats rail + aree a card) — modalita locale.
import { chromium } from "playwright-core";
import { scalaUi, eAllaScala, spiega } from "./lib/misure.mjs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3100";
// L'etichetta va presa dai micro-goal di default REALI (vedi
// src/lib/data/store/default-goals.ts): la statistica "giorni con X" si
// calcola incrociando i goalsOn salvati con le DEFINIZIONI in archivio,
// quindi un'etichetta che non e piu un obiettivo non produce nessuna riga.
// Prima qui c'era "camminato" scritto a mano, che la lista nuova non ha.
const GOAL = "mosso il corpo";
const GOAL_2 = "dormito abbastanza";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

const now = new Date();
const Y = now.getFullYear(), M = now.getMonth() + 1, D = now.getDate();
const iso = (d) => `${Y}-${String(M).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

async function newPage(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: "it-IT" });
  await ctx.addInitScript(() => {
    try {
      window.localStorage.setItem("jm.mode", "local");
    } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  return { ctx, page, errors };
}

// Seed: due giornate nel mese corrente (oggi e il giorno 1) direttamente in IDB.
async function seed(page) {
  await page.evaluate(({ e1, e2 }) => new Promise((resolve) => {
    const req = indexedDB.open("journalme");
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("entries", "readwrite");
      tx.objectStore("entries").put(e1);
      tx.objectStore("entries").put(e2);
      tx.oncomplete = () => resolve(1);
      tx.onerror = () => resolve(0);
    };
    req.onerror = () => resolve(0);
  }), {
    e1: {
      id: crypto.randomUUID(), entryDate: iso(D), transcript: "Giornata di prova con dieci parole scritte qui dentro oggi.",
      headline: "Titolo di oggi per la cella", snippet: "", areas: [
        { label: "Lavoro", text: "Testo area lavoro." },
        { label: "Relazioni", text: "Testo area relazioni." },
      ],
      metrics: { weightKg: null, sleepHours: null, mood: "good" },
      goalsOn: [GOAL], people: [], durationSeconds: 0, createdAt: new Date().toISOString(),
    },
    e2: {
      id: crypto.randomUUID(), entryDate: iso(1), transcript: "Prima giornata del mese con qualche parola.",
      headline: "Primo del mese", snippet: "", areas: [],
      metrics: { weightKg: null, sleepHours: null, mood: "neutral" },
      goalsOn: [GOAL, GOAL_2], people: [], durationSeconds: 0, createdAt: new Date().toISOString(),
    },
  });
}

/* ============ DESKTOP 1440 ============ */
{
  const { ctx, page, errors } = await newPage(1440, 900);
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await seed(page);
  await page.goto(BASE + "/mese", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  check("griglia visibile", await page.locator(".jm-mese-grid").isVisible());
  check("feed verticale nascosto", await page.locator(".jm-day-list").evaluate((el) => getComputedStyle(el).display === "none"));
  const cells = await page.locator(".jm-mese-cell").count();
  check("celle multiple di 7", cells % 7 === 0 && cells >= 28, String(cells));
  const cellH = (await page.locator(".jm-mese-cell").first().boundingBox())?.height;
  check("cella alta 112px", cellH === 112, String(cellH));
  check("oggi evidenziato", (await page.locator(".jm-mese-cell.today").count()) === 1);
  check("cella di oggi col titolo", await page.locator(".jm-mese-cell.today", { hasText: "Titolo di oggi" }).isVisible());
  check("giorno 1 pieno", await page.locator(".jm-mese-cell.full", { hasText: "Primo del mese" }).isVisible());
  if (D > 2) {
    check("giorni passati vuoti: 'vuota' in corsivo", (await page.locator(".jm-mese-cell.empty .jm-mese-ch", { hasText: "vuota" }).count()) > 0);
  }
  const lastDay = new Date(Y, M, 0).getDate();
  if (D < lastDay) {
    const fut = page.locator(".jm-mese-cell.future").first();
    check("giorni futuri al 30%", (await fut.evaluate((el) => getComputedStyle(el).opacity)) === "0.3");
  }

  // Stats nella rail
  check("rail: Il mese", await page.locator(".jm-railr-l", { hasText: "Il mese" }).isVisible());
  const statDone = await page.locator(".jm-railr-stat").first().innerText();
  check("rail: giornate raccontate 2/N", /^2\s*\/\s*\d+/.test(statDone.replace(/\n/g, " ")), statDone);
  check("rail: umore medio 3,5", (await page.locator(".jm-railr-stat", { hasText: "umore medio" }).innerText()).includes("3,5"));
  check(`rail: giorni con ${GOAL} = 2`, (await page.locator(".jm-railr-stat", { hasText: GOAL }).innerText()).includes("2"));
  check("rail: card Pattern presente", await page.locator(".jm-railr-locked").isVisible());

  // Click su una giornata piena -> /giorno
  await page.locator(".jm-mese-cell.full", { hasText: "Primo del mese" }).click();
  await page.waitForTimeout(1200);
  check("click cella -> /giorno", page.url().includes("/giorno?d=" + iso(1)));

  // Click su una giornata PASSATA E VUOTA -> la sua schermata, dove
  // "Aggiungi a questa giornata" la fa compilare. Fino al 23 agosto 2026 la
  // cella vuota era un <div> inerte: dalla griglia desktop un giorno saltato
  // non si poteva piu recuperare, mentre dal feed del telefono si poteva da
  // sempre (day-row.tsx: ogni riga e cliccabile, piena o no).
  if (D > 2) {
    await page.goto(BASE + "/mese", { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    const vuota = page.locator(".jm-mese-cell.empty").first();
    const num = Number((await vuota.locator(".jm-mese-cn").innerText()).trim());
    check("giorno vuoto: e un bottone", (await vuota.evaluate((el) => el.tagName)) === "BUTTON");
    check("giorno vuoto: cursore a mano", (await vuota.evaluate((el) => getComputedStyle(el).cursor)) === "pointer");
    // L'highlight deve essere LO STESSO dei giorni pieni, non uno suo: si
    // confronta il colore calcolato all'hover, non la classe.
    const pieno = page.locator(".jm-mese-cell.full").first();
    await pieno.hover();
    await page.waitForTimeout(150);
    const hoverPieno = await pieno.evaluate((el) => getComputedStyle(el).backgroundColor);
    const riposo = await vuota.evaluate((el) => getComputedStyle(el).backgroundColor);
    await vuota.hover();
    await page.waitForTimeout(150);
    const hoverVuoto = await vuota.evaluate((el) => getComputedStyle(el).backgroundColor);
    check("giorno vuoto: l'hover accende qualcosa", hoverVuoto !== riposo, `${riposo} -> ${hoverVuoto}`);
    check("giorno vuoto: stesso highlight dei pieni", hoverVuoto === hoverPieno, `${hoverVuoto} vs ${hoverPieno}`);
    await vuota.click();
    await page.waitForTimeout(1200);
    check("click giorno vuoto -> /giorno di QUEL giorno", page.url().includes("/giorno?d=" + iso(num)), page.url());
  }

  // Titolo -> JumpPicker
  await page.goto(BASE + "/mese", { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await page.locator(".jm-mese-t").click();
  await page.waitForTimeout(400);
  const pickerVisible = await page.locator("[role=dialog]").first().isVisible().catch(() => false);
  check("titolo apre il picker dei mesi", pickerVisible);

  // FilledView desktop: aree a due colonne. Dalla PR 10 in locale le aree
  // non si mostrano piu (vista gratis = prosa): si verifica il CSS su DOM
  // iniettato — la vista premium usa queste stesse classi.
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const areaCss = await page.evaluate(() => {
    const d = document.createElement("div");
    d.className = "jm-fv-areas";
    d.innerHTML = '<div class="jm-fv-area"><div class="l">L</div><div class="x">x</div></div>';
    document.querySelector("main")?.appendChild(d);
    const s = getComputedStyle(d);
    const a = getComputedStyle(d.firstElementChild);
    const out = {
      display: s.display,
      cols: s.gridTemplateColumns.split(" ").length,
      pad: a.paddingLeft,
      radius: a.borderRadius,
    };
    d.remove();
    return out;
  });
  check("oggi: aree in griglia 2 colonne", areaCss.display === "grid" && areaCss.cols === 2, JSON.stringify(areaCss));
  check("oggi: area a card (surface)", areaCss.radius !== "0px" && areaCss.pad === "16px", JSON.stringify(areaCss));

  check("desktop: zero errori console", errors.length === 0, errors.join(" | ").slice(0, 200));
  await ctx.close();
}

/* ============ TELEFONO 430: feed intatto, stili phone invariati ============ */
{
  const { ctx, page, errors } = await newPage(430, 900);
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await seed(page);
  await page.goto(BASE + "/mese", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  check("phone: griglia nascosta", await page.locator(".jm-mese-wrap").evaluate((el) => getComputedStyle(el).display === "none").catch(() => false));
  check("phone: feed visibile", await page.locator(".jm-day-list").isVisible());
  check("phone: header sticky visibile", await page.locator(".jm-month-header").isVisible());

  // FilledView phone: valori storici esatti
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const h = await page.locator(".jm-fv-h").evaluate((el) => {
    const s = getComputedStyle(el);
    return `${s.fontSize}|${s.fontWeight}|${s.letterSpacing}`;
  });
  // 26px e 10/14px qui sotto sono le misure A SCALA 1. L'app parte da 1,15
  // dal 22 agosto 2026, e un test che pretende il numero assoluto diventa
  // rosso senza che niente sia rotto. Vedi scripts/lib/misure.mjs.
  const scalaTel = await scalaUi(page);
  const [hSize, hPeso] = h.split("|");
  check(
    "phone: headline 26/650 alla misura corrente",
    eAllaScala(hSize, 26, scalaTel) && hPeso === "650",
    spiega(hSize, 26, scalaTel) + " . " + h,
  );
  // Dalla PR 10 in locale le aree non si renderizzano (vista gratis =
  // prosa): CSS verificato su DOM iniettato, come sopra.
  const phoneArea = await page.evaluate(() => {
    const d = document.createElement("div");
    d.className = "jm-fv-areas";
    d.innerHTML = '<div class="jm-fv-area"><div class="l">L</div><div class="x">x</div></div>';
    document.querySelector("main")?.appendChild(d);
    const wrap = getComputedStyle(d);
    const s = getComputedStyle(d.firstElementChild);
    const label = getComputedStyle(d.querySelector(".l"));
    const text = getComputedStyle(d.querySelector(".x"));
    const out = `${wrap.display}|${s.paddingTop}|${s.paddingLeft}|${s.borderRadius}|${label.fontSize}|${text.fontSize}|${text.fontWeight}`;
    d.remove();
    return out;
  });
  {
    const [disp, padT, padL, raggio, lSize, xSize, xPeso] = phoneArea.split("|");
    check(
      "phone: aree in pila, 14px 0, senza raccordo",
      disp === "block" && padT === "14px" && padL === "0px" && raggio === "0px",
      phoneArea,
    );
    check(
      "phone: etichetta 10 e testo 14/500 alla misura corrente",
      eAllaScala(lSize, 10, scalaTel) &&
        eAllaScala(xSize, 14, scalaTel) &&
        xPeso === "500",
      `${spiega(lSize, 10, scalaTel)} ; ${spiega(xSize, 14, scalaTel)}`,
    );
  }

  // --- Mese a griglia sul telefono (23 agosto 2026, mockup
  // mese-griglia-mobile.html): l'icona nell'intestazione scambia lista e
  // griglia, i quadratini prendono il colore dell'umore, il tocco mostra
  // il titolo invece di portare via.
  {
    const icona = page.locator(".jm-mese-vista");
    check("phone: c'e l'icona lista/griglia", (await icona.count()) === 1);
    const areaIcona = await icona.boundingBox();
    check(
      "phone: l'icona e toccabile (44 punti)",
      Math.round(areaIcona?.width ?? 0) >= 44 && Math.round(areaIcona?.height ?? 0) >= 44,
      `${Math.round(areaIcona?.width ?? 0)}x${Math.round(areaIcona?.height ?? 0)}`,
    );
    check("phone: si parte dalla lista", (await page.locator(".jm-mese-mini").count()) === 0);

    await icona.click();
    await page.waitForTimeout(400);
    check("phone: l'icona accende la griglia", (await page.locator(".jm-mese-mini").count()) > 0);
    check("phone: la lista sparisce", (await page.locator(".jm-day-row").count()) === 0);
    const celle = await page.locator(".jm-mese-mini .jm-mese-mini-c").count();
    check("phone: celle multiple di 7", celle % 7 === 0 && celle >= 28, String(celle));

    // Oggi ha umore "good" (il seed): quarto gradino su cinque.
    check(
      "phone: il quadratino di oggi prende il colore dell'umore",
      (await page.locator(".jm-mese-mini-c.today.m4").count()) === 1,
    );

    // Un tocco NON naviga: seleziona e mostra il titolo.
    const primo = page.locator(".jm-mese-mini-c.full").first();
    await primo.click();
    await page.waitForTimeout(300);
    check("phone: il tocco non porta via", page.url().includes("/mese"), page.url());
    const anteprima = page.locator(".jm-mese-mini-prev").first();
    check("phone: il tocco mostra il titolo", await anteprima.isVisible());

    // La riga di anteprima apre la giornata.
    await anteprima.click();
    await page.waitForTimeout(1200);
    check("phone: l'anteprima apre la giornata", page.url().includes("/giorno?d="), page.url());

    // La scelta si ricorda.
    await page.goto(BASE + "/mese", { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    check(
      "phone: la griglia si ricorda dopo un giro",
      (await page.locator(".jm-mese-mini").count()) > 0,
    );
    await page.locator(".jm-mese-vista").click();
    await page.waitForTimeout(400);
    check("phone: l'icona riporta alla lista", (await page.locator(".jm-day-row").count()) > 0);
  }

  check("phone: zero errori console", errors.length === 0, errors.join(" | ").slice(0, 200));
  await ctx.close();
}

await browser.close();
const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} PASS`);
process.exit(fails.length ? 1 : 0);
