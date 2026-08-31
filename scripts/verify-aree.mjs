// Verifica della separazione di Cibo e Movimento (21 agosto 2026).
//
// IL BUG. Manuel raccontava sia cosa aveva mangiato sia cosa aveva fatto in
// palestra, e nella giornata ne compariva UNO SOLO: un giorno il cibo, il
// giorno dopo gli esercizi. Causa: entrambi finivano in "Corpo", una
// casella sola con un tetto di 25 parole, e il modello ne buttava via uno.
// Non era il modello a essere debole: era la casella a essere una sola.
//
// Ora le aree sono sei e cibo e movimento hanno la loro. Qui si controlla
// cio che si PUO controllare senza chiamare l'AI (che costa, non e
// deterministica e in locale non gira): il contratto mandato al modello, e
// come la schermata disegna le aree quando arrivano.
//
// Serve il dev server su :3100.
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3100";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

/* ============ 1. il contratto mandato al modello ============
   Dal 28 agosto 2026 le aree sono DATI (tabella `aree`, contratto in
   src/lib/aree.ts): l'elenco non sta piu scritto dentro il prompt. Qui si
   controlla che la rete di sicurezza (AREE_DI_FABBRICA) sia intatta e che
   il server la legga davvero dal contratto, non da un elenco suo. */
{
  const contratto = readFileSync("src/lib/aree.ts", "utf8");
  for (const etichetta of ["Lavoro", "Relazioni", "Cibo", "Movimento", "Corpo", "Emozioni"]) {
    check(
      `la rete di sicurezza contiene "${etichetta}"`,
      contratto.includes(`chiave: "${etichetta}"`),
    );
  }
  check(
    "la rete di sicurezza dice cosa va in Cibo",
    /Cosa ha mangiato e bevuto/.test(contratto),
  );
  check(
    "la rete di sicurezza dice cosa resta in Corpo",
    /Il resto del corpo che non e ne cibo ne movimento/.test(contratto),
  );

  const src = readFileSync("src/modules/oggi/server/process-entry.ts", "utf8") /* passo E: la logica vive nel modulo, la rotta e un guscio */;
  check(
    "il riassunto legge le aree dal contratto (leggiAree)",
    /leggiAree/.test(src) && /areeAttive/.test(src),
  );
  check(
    "lo schema JSON usa le chiavi lette, non un elenco scritto qui",
    /enum: chiavi/.test(src) && !/"Lavoro"/.test(src),
  );
  check(
    "il prompt interpola cosa_ci_va parola per parola",
    /a\.cosaCiVa/.test(src),
  );
  check(
    "al modello e detto di NON scegliere fra cibo e movimento",
    /devono comparire ENTRAMBE/.test(src),
  );
  check(
    "ogni area una volta sola",
    /UNA SOLA VOLTA ciascuna/.test(src),
  );

  const chiar = readFileSync("src/modules/oggi/server/chiarimenti.ts", "utf8");
  check(
    "anche i chiarimenti leggono le aree dal contratto",
    /leggiAree/.test(chiar) && !/const AREE\b/.test(chiar),
  );
}

/* ============ 2. come la schermata le disegna ============ */
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
{
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: "it-IT" });
  await ctx.addInitScript(() => {
    try { window.localStorage.setItem("jm.mode", "local"); /* niente velo del saluto sui banchi */ window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco"); window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1"); } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));

  // Una giornata gia "lavorata dall'AI", scritta a mano nel database del
  // browser: e l'unico modo di provare il disegno senza chiamare l'AI.
  // Le aree arrivano in ordine sparso e con Corpo DUE volte, cioe i due
  // casi che prima rompevano la pagina.
  await page.goto(BASE + "/app", { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    const req = // senza numero di versione: apre quella che c'e. Fissarla a 1 rompeva
  // il test il giorno in cui il database e passato alla 2 (i fatti).
  indexedDB.open("journalme");
    const db = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const tx = db.transaction("entries", "readwrite");
    tx.objectStore("entries").put({
      id: "test-aree",
      entryDate: "2026-08-16",
      transcript: "Pizza con Christian e un'ora di palestra.",
      headline: "pizza e palestra",
      snippet: "Serata con Christian, prima allenamento.",
      areas: [
        { label: "Emozioni", text: "Serata leggera." },
        { label: "Movimento", text: "Un'ora di palestra: bicipiti e tricipiti, poi cyclette." },
        { label: "Corpo", text: "Dormito poco." },
        { label: "Cibo", text: "Pizza fuori con Christian." },
        { label: "Corpo", text: "Mal di schiena la sera." },
      ],
      metrics: { mood: null, weightKg: null, sleepHours: null },
      goalsOn: [],
      people: ["Christian"],
      durationSeconds: 0,
      createdAt: new Date("2026-08-16T21:00:00Z").toISOString(),
    });
    await new Promise((res) => { tx.oncomplete = res; });
    db.close();
  });

  await page.goto(BASE + "/app/giorno?d=2026-08-16", { waitUntil: "networkidle" });
  await page.waitForSelector(".jm-fv-area", { timeout: 20000 });
  await page.waitForTimeout(500);

  // Le etichette sono scritte in maiuscolo dal foglio di stile
  // (text-transform), non dal testo: si confronta il testo vero.
  const grezze = await page.locator(".jm-fv-area .l").allInnerTexts();
  const etichette = grezze.map((e) => {
    const t = e.trim().toLowerCase();
    return t.charAt(0).toUpperCase() + t.slice(1);
  });
  const testi = await page.locator(".jm-fv-area .x").allInnerTexts();

  // IL PUNTO: due righe distinte, e nessuna delle due mangia l'altra.
  check("il cibo ha la sua riga", etichette.includes("Cibo"), etichette.join(" | "));
  check("il movimento ha la sua riga", etichette.includes("Movimento"));
  check(
    "il cibo dice cosa ha mangiato",
    testi.some((t) => /pizza/i.test(t)),
    testi.join(" | ").slice(0, 90),
  );
  check(
    "il movimento dice cosa ha fatto",
    testi.some((t) => /palestra|cyclette/i.test(t)),
  );

  // Ordine fisso: la pagina non si riordina da sola fra un giorno e l'altro.
  const atteso = ["Cibo", "Movimento", "Corpo", "Emozioni"];
  check(
    "le aree sono sempre nello stesso ordine",
    JSON.stringify(etichette) === JSON.stringify(atteso),
    etichette.join(" > "),
  );

  // Doppioni: prima due "Corpo" si usavano come stessa chiave e una
  // spariva. Ora i testi si uniscono.
  check(
    "due aree con la stessa etichetta diventano una",
    etichette.filter((e) => e === "Corpo").length === 1,
    `Corpo x${etichette.filter((e) => e === "Corpo").length}`,
  );
  const corpo = testi[etichette.indexOf("Corpo")] ?? "";
  check(
    "unendole non si perde niente",
    /dormito poco/i.test(corpo) && /mal di schiena/i.test(corpo),
    corpo,
  );

  check("aree: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ 3. in inglese ============ */
{
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: "en-GB" });
  await ctx.addInitScript(() => {
    try {
      window.localStorage.setItem("jm.mode", "local"); /* niente velo del saluto sui banchi */ window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco"); window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
      window.localStorage.setItem("jm:lang", "en");
    } catch {}
  });
  const page = await ctx.newPage();
  await page.goto(BASE + "/app", { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    const req = // senza numero di versione: apre quella che c'e. Fissarla a 1 rompeva
  // il test il giorno in cui il database e passato alla 2 (i fatti).
  indexedDB.open("journalme");
    const db = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const tx = db.transaction("entries", "readwrite");
    tx.objectStore("entries").put({
      id: "test-aree-en",
      entryDate: "2026-08-15",
      transcript: "Pizza and gym.",
      headline: "pizza and gym",
      snippet: "Dinner out, training before.",
      areas: [
        { label: "Cibo", text: "Pizza out with Christian." },
        { label: "Movimento", text: "One hour at the gym." },
      ],
      metrics: { mood: null, weightKg: null, sleepHours: null },
      goalsOn: [],
      people: [],
      durationSeconds: 0,
      createdAt: new Date("2026-08-15T21:00:00Z").toISOString(),
    });
    await new Promise((res) => { tx.oncomplete = res; });
    db.close();
  });
  await page.goto(BASE + "/app/giorno?d=2026-08-15", { waitUntil: "networkidle" });
  await page.waitForSelector(".jm-fv-area", { timeout: 20000 });
  await page.waitForTimeout(500);
  const en = (await page.locator(".jm-fv-area .l").allInnerTexts()).map((e) =>
    e.trim().toLowerCase(),
  );
  check("in inglese: Food", en.includes("food"), en.join(" | "));
  check("in inglese: Movement", en.includes("movement"));
  await ctx.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
await browser.close();
process.exit(failed.length === 0 ? 0 : 1);
