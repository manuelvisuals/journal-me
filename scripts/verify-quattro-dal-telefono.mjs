// Le quattro richieste di Manuel dal telefono, 9 settembre 2026 sera.
//
//   1. CHIARIMENTI, IL NOME A MANO: quando l'AI chiede "chi era il tuo primo
//      cliente?" deve esserci la strada per NON dirlo (riservatezza): "Lascialo
//      cosi" tiene il ruolo come nome e chiude la domanda per sempre. Prima
//      c'era solo "Non adesso", che la ripresentava all'infinito.
//   2. LA BOZZA RECUPERATA SI PUO SCARTARE: tasto "scarta la bozza", conferma
//      in riga, e la bozza sparisce dal disco (non torna al prossimo avvio).
//   3. "AGGIUNGI A QUESTA GIORNATA" STA SUBITO SOTTO LA SINTESI, non in
//      fondo dopo gli obiettivi.
//   4. LA SINTESI DELL'AI: stelline davanti, corsivo, matita alla fine, e si
//      riscrive a mano come il titolo; riscritta e "tua" e l'AI non la tocca.
//
// Statico sul codice + vivo in modalita locale sul dev server :3100.
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}
const leggi = (p) => readFileSync(p, "utf8");

/* ================= statico ================= */
{
  const ch = leggi("src/modules/oggi/components/chiarimenti-screen.tsx");
  const lascia = ch.split('t("Lascialo cosi")').length - 1;
  check("1. chiarimenti: 'Lascialo cosi' c'e sia col campo a mano sia con le opzioni", lascia === 2, String(lascia));
  check("1. 'Lascialo cosi' risponde col soggetto stesso (il ruolo resta il nome)", /avanti\(\[d\.soggetto\]\)/.test(ch));

  const mw = leggi("src/modules/oggi/components/manual-write.tsx");
  check("2. la bozza ha il tasto per scartarla, con l'avviso iOS prima", /<AlertIos/.test(mw) && /Scartare la bozza\?/.test(mw) && /clearDraft\(targetDate\)/.test(mw));
  const tc = leggi("src/modules/oggi/components/today-client.tsx");
  check("2. Oggi cancella la bozza su disco e chiude l'editor", /handleDiscardDraft/.test(tc) && /onDiscard=\{draftNotice \? handleDiscardDraft : undefined\}/.test(tc));

  const fv = leggi("src/modules/oggi/components/filled-view.tsx");
  const iFooter = fv.indexOf("{footer}");
  const iFoto = fv.indexOf("{fotoSlot}", fv.indexOf("<SnippetEditable"));
  const iGoals = fv.indexOf("<GoalList");
  check("3. il tasto 'aggiungi' sta subito dopo la sintesi, prima delle foto", iFooter > 0 && iFoto > 0 && iFooter < iFoto);
  check("3. e non piu in fondo dopo gli obiettivi", fv.indexOf("{footer}", iGoals) === -1);

  check("4. la sintesi e un componente riscrivibile (SnippetEditable)", /<SnippetEditable/.test(fv) && /jm-fv-ai/.test(fv));
  const se = leggi("src/modules/oggi/components/snippet-editable.tsx");
  check("4. stelline + matita + targhetta 'tuo' come il titolo", /jm-fv-ai/.test(se) && /jm-fv-hpen/.test(se) && /jm-fv-tuo/.test(se));
  const css = leggi("src/modules/oggi/styles.css");
  check("4. la sintesi e in corsivo, sans, nel colore pieno del testo", /\.jm-fv-sn \{[^}]*font-family: var\(--font-sans\)[^}]*font-style: italic[^}]*color: var\(--color-ink\)/.test(css));
  check("4. le stelline prendono il colore del testo (nere in chiaro, chiare in scuro)", /\.jm-fv-ai \{[^}]*fill: var\(--color-ink\)/.test(css));
  const cloud = leggi("src/lib/data/store/cloud.ts");
  const local = leggi("src/lib/data/store/local.ts");
  check("4. saveSnippet blocca la sintesi in entrambi gli store", /async saveSnippet/.test(cloud) && /snippetLocked: true/.test(cloud) && /async saveSnippet/.test(local) && /snippetLocked: true/.test(local));
  check("4. la rianalisi rispetta la sintesi bloccata (cloud e locale)", /snippet: c\.snippetLocked \? c\.snippet : ai\.snippet/.test(cloud) && /existing\?\.snippetLocked \? \{\} : \{ snippet: ai\.snippet \}/.test(local));
}

/* ================= vivo ================= */
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

async function apri(path, { seme = null, bozza = null, ospite = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: "it-IT" });
  // L'ospite (regalo AI) e l'unico modo, in locale, di avere una giornata
  // con sintesi e aree: in gratis puro la giornata e prosa e basta.
  await ctx.addInitScript(([ospite]) => {
    try {
      window.localStorage.setItem("jm.mode", "local");
      window.localStorage.setItem("jm.ospite", ospite ? "1" : "0");
      window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
      window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
    } catch {}
  }, [ospite]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + "/app", { waitUntil: "networkidle" });
  if (seme || bozza) {
    await page.evaluate(async ({ seme, bozza }) => {
      const req = indexedDB.open("journalme");
      const db = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
      const tx = db.transaction(["entries", "drafts"], "readwrite");
      if (seme) tx.objectStore("entries").put(seme);
      if (bozza) tx.objectStore("drafts").put(bozza);
      await new Promise((res) => { tx.oncomplete = res; });
      db.close();
    }, { seme, bozza });
  }
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  return { ctx, page, errors };
}

const oggi = new Date();
const ISO = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, "0")}-${String(oggi.getDate()).padStart(2, "0")}`;
const GIORNATA = {
  id: "test-quattro",
  entryDate: ISO,
  transcript: "Mattina al lavoro, poi cena con Luca al mare.",
  headline: "Lavoro e cena al mare",
  snippet: "Una giornata piena, chiusa da una cena con Luca sulla spiaggia.",
  areas: [{ label: "Lavoro", text: "Mattina di lavoro." }, { label: "Relazioni", text: "Cena con Luca." }],
  metrics: { mood: null, weightKg: null, sleepHours: null },
  goalsOn: [],
  people: ["Luca"],
  durationSeconds: 0,
  createdAt: new Date(Date.now() - 3600_000).toISOString(),
};

/* ---- 3 + 4: la giornata piena ---- */
{
  const { ctx, page, errors } = await apri("/app", { seme: GIORNATA, ospite: true });
  await page.waitForSelector(".jm-fv-sn", { timeout: 20000 });
  const geo = await page.evaluate(() => {
    const sn = document.querySelector(".jm-fv-sn");
    const add = document.querySelector(".jm-day-add");
    const aree = document.querySelector(".jm-fv-areas");
    const goals = document.querySelector(".jm-goal, .jm-goals, [class*='goal']");
    const cs = sn ? getComputedStyle(sn) : null;
    return {
      corsivo: cs?.fontStyle,
      stelline: !!sn?.querySelector(".jm-fv-ai"),
      matita: !!sn?.querySelector(".jm-fv-hpen"),
      addTop: add?.getBoundingClientRect().top ?? null,
      snBottom: sn?.getBoundingClientRect().bottom ?? null,
      areeTop: aree?.getBoundingClientRect().top ?? null,
      goalsTop: goals?.getBoundingClientRect().top ?? null,
    };
  });
  check("4. vivo: la sintesi e in corsivo", geo.corsivo === "italic", String(geo.corsivo));
  check("4. vivo: le stelline davanti e la matita in fondo", geo.stelline && geo.matita);
  check("3. vivo: 'aggiungi' sta sotto la sintesi e sopra le aree", geo.addTop !== null && geo.snBottom !== null && geo.areeTop !== null && geo.addTop >= geo.snBottom - 1 && geo.addTop < geo.areeTop, JSON.stringify(geo));

  // Si riscrive: tocco, testo nuovo, tocco fuori, e la targhetta "tuo".
  await page.locator(".jm-fv-sntap").click();
  const area = page.locator(".jm-fv-snedit");
  await area.waitFor({ state: "visible", timeout: 5000 });
  await area.fill("La mia sintesi, scritta da me.");
  await page.locator(".jm-fv-h").first().click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.mouse.click(5, 5);
  await page.waitForTimeout(800);
  const dopo = await page.evaluate(() => {
    const sn = document.querySelector(".jm-fv-sn");
    return { testo: sn?.textContent ?? "", tuo: !!sn?.querySelector(".jm-fv-tuo"), matita: !!sn?.querySelector(".jm-fv-hpen") };
  });
  check("4. vivo: la sintesi riscritta si vede e porta la targhetta 'tuo'", /La mia sintesi, scritta da me\./.test(dopo.testo) && dopo.tuo && !dopo.matita, JSON.stringify(dopo));
  const rec = await page.evaluate(async (iso) => {
    const req = indexedDB.open("journalme");
    const db = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
    const r = await new Promise((res) => { const g = db.transaction("entries").objectStore("entries").get(iso); g.onsuccess = () => res(g.result); });
    db.close();
    return r;
  }, ISO);
  check("4. vivo: sul disco la sintesi e bloccata (snippetLocked)", rec?.snippetLocked === true && rec?.snippet === "La mia sintesi, scritta da me.");
  check("3+4. vivo: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ---- 2: la bozza recuperata si scarta ---- */
{
  const bozza = { entryDate: ISO, text: "Fanco", updatedAt: new Date().toISOString() };
  const { ctx, page, errors } = await apri("/app", { bozza });
  const editor = page.locator(".jm-editor-overlay");
  let aperto = true;
  try { await editor.waitFor({ state: "visible", timeout: 10000 }); } catch { aperto = false; }
  check("2. vivo: la bozza recuperata riapre l'editor", aperto);
  const scarta = page.locator(".jm-editor-scarta");
  check("2. vivo: c'e il tasto 'scarta'", (await scarta.count()) === 1);
  await scarta.click();
  const alert = page.locator(".jm-alert");
  let avviso = true;
  try { await alert.waitFor({ state: "visible", timeout: 5000 }); } catch { avviso = false; }
  check("2. vivo: prima chiede conferma con l'avviso iOS", avviso);
  // "Tienila" chiude l'avviso e la bozza resta.
  await page.locator(".jm-alert-btn.forte").click();
  await page.waitForTimeout(300);
  check("2. vivo: 'Tienila' chiude l'avviso e l'editor resta", (await alert.count()) === 0 && (await editor.count()) === 1);
  await scarta.click();
  await alert.waitFor({ state: "visible", timeout: 5000 });
  await page.locator(".jm-alert-btn.rosso").click();
  await page.waitForTimeout(600);
  check("2. vivo: dopo 'Scarta' l'editor e chiuso", (await editor.count()) === 0);
  const resta = await page.evaluate(async (iso) => {
    const req = indexedDB.open("journalme");
    const db = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
    const r = await new Promise((res) => { const g = db.transaction("drafts").objectStore("drafts").get(iso); g.onsuccess = () => res(g.result ?? null); });
    db.close();
    return r;
  }, ISO);
  check("2. vivo: la bozza non c'e piu sul disco", resta === null);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  check("2. vivo: dopo un reload l'editor non torna", (await editor.count()) === 0);
  check("2. vivo: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

await browser.close();
const passati = results.filter((r) => r.ok).length;
console.log(`\n${passati}/${results.length} PASS`);
process.exit(passati === results.length ? 0 : 1);
