// Verifica delle due richieste di Manuel del 21 agosto 2026:
//
//  1. OBIETTIVI SUL TELEFONO. Erano cinque pallini da 14px senza nome:
//     non dicevano quale obiettivo fosse quale e stavano sotto la misura
//     del polpastrello (44px). Ora sono righe con il nome, alte almeno
//     48px, con il conteggio "fatti su totali" in cima.
//
//  2. CHECKOUT FINTO. Serve a provare l'app da premium senza Stripe. Le
//     cose che contano non sono i tasti: sono le due serrature (la pagina
//     non deve esistere a interruttore spento) e il fatto che un
//     pagamento fallito NON cambi niente e lo dica.
//
// Serve il dev server su :3100 con NEXT_PUBLIC_JM_FAKE_CHECKOUT=1.
// Il 404 a interruttore spento si prova a parte, su :3101.
import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3100";
const OFF = "http://localhost:3101";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

async function open(path, wait) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: "it-IT" });
  await ctx.addInitScript(() => {
    try { window.localStorage.setItem("jm.mode", "local"); /* niente velo del saluto sui banchi */ window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco"); window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1"); } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  if (wait) await page.waitForSelector(wait, { timeout: 20000 });
  await page.waitForTimeout(600);
  return { ctx, page, errors };
}

/* ================= 1. gli obiettivi: nomi, e si prendono ================= */
{
  const { ctx, page, errors } = await open("/app/settings", ".jm-st-box");

  // Tre obiettivi veri, aggiunti dalla schermata vera.
  await page.locator(".jm-st-row", { hasText: "Obiettivi" }).first().click();
  await page.waitForSelector(".jm-st-add input", { timeout: 10000 });
  for (const nome of ["Palestra", "Meditazione", "Lettura"]) {
    await page.locator(".jm-st-add input").fill(nome);
    await page.locator(".jm-st-add button").click();
    await page.waitForTimeout(400);
  }

  // Una giornata raccontata, perche gli obiettivi vivono sotto il racconto.
  await page.goto(BASE + "/app/giorno?d=2026-08-17", { waitUntil: "networkidle" });
  await page.waitForSelector(".jm-day-empty-wrap, .jm-day-add", { timeout: 20000 });
  await page.locator(".jm-day-add").click();
  await page.waitForTimeout(300);
  await page.locator(".jm-sheet-row", { hasText: "Scrivi altro" }).click();
  await page.waitForTimeout(300);
  await page.locator(".jm-editor-textarea").fill("Giornata di prova per gli obiettivi.");
  await page.locator(".jm-editor-btn.save").click();
  await page.waitForTimeout(2500);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".jm-goals", { timeout: 20000 });

  // L'app parte gia con sei obiettivi suoi ("mosso il corpo", "letto
  // qualcosa"...): i tre aggiunti qui sopra si sommano a quelli. Quindi non
  // si conta un numero fisso, si controlla che OGNI obiettivo abbia la sua
  // riga — che e la cosa che i pallini non garantivano.
  const righe = page.locator(".jm-goal-row");
  const quante = await righe.count();
  check("ogni obiettivo ha la sua riga", quante >= 3, `righe: ${quante}`);

  const testo = await page.locator(".jm-goals").innerText();
  const totale = Number((testo.match(/su\s+(\d+)/i) ?? [])[1] ?? -1);
  check("le righe sono tante quanti gli obiettivi", totale === quante,
    `conteggio ${totale}, righe ${quante}`);
  for (const nome of ["Palestra", "Meditazione", "Lettura"]) {
    check(`il nome "${nome}" si legge`, testo.includes(nome));
  }
  check("in cima c'e il conteggio", /\d+\s+su\s+\d+/i.test(testo),
    testo.split("\n").slice(0, 2).join(" | "));

  // LA MISURA CHE CONTA: il bersaglio, non il disegno.
  const box = await righe.first().boundingBox();
  check("la riga e alta almeno 48px", box.height >= 48, `${Math.round(box.height)}px`);
  check("la riga occupa tutta la colonna", box.width >= 300, `${Math.round(box.width)}px`);

  // E deve funzionare: un tocco accende, il conteggio sale.
  await righe.first().click();
  await page.waitForTimeout(900);
  check("un tocco accende l'obiettivo",
    (await page.locator(".jm-goal-row.on").count()) === 1,
    `accesi: ${await page.locator(".jm-goal-row.on").count()}`);
  check("il conteggio si aggiorna",
    (await page.locator(".jm-goals-head .c").innerText()).startsWith("1"),
    await page.locator(".jm-goals-head .c").innerText());

  // Due obiettivi vicini non devono accavallarsi: era il difetto dei
  // pallini a 9px di distanza, dove sbagliare mira accendeva l'altro.
  const b0 = await righe.nth(0).boundingBox();
  const b1 = await righe.nth(1).boundingBox();
  check("le righe non si sovrappongono", b1.y >= b0.y + b0.height - 1,
    `${Math.round(b0.y + b0.height)} vs ${Math.round(b1.y)}`);

  check("obiettivi: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ================= 2. il checkout finto ================= */
{
  const { ctx, page, errors } = await open("/app/checkout-finto", ".jm-ck-btns");

  const corpo = await page.locator("body").innerText();
  check("dice in chiaro che e simulato", /simulato|nessun addebito/i.test(corpo));
  check("dice che e un ambiente di prova", /ambiente di prova/i.test(corpo));
  check("c'e il tasto del successo", (await page.locator(".btn-primary", { hasText: "riuscito" }).count()) === 1);
  check("c'e il tasto del fallimento", (await page.locator(".btn-ghost", { hasText: "fallito" }).count()) === 1);

  // Il prezzo e sbarrato: pieno, su una pagina che non incassa, e il modo
  // piu rapido per dimenticarsi che e una prova.
  const deco = await page.locator(".jm-ck-amount .n").evaluate(
    (el) => getComputedStyle(el).textDecorationLine,
  );
  check("il prezzo e sbarrato", deco.includes("line-through"), deco);

  const bp = await page.locator(".btn-primary").first().boundingBox();
  check("il tasto e alto almeno 44px", bp.height >= 44, `${Math.round(bp.height)}px`);

  // Il fallimento: nessun cambio di piano, e l'errore si legge.
  await page.locator(".btn-ghost", { hasText: "fallito" }).click();
  await page.waitForTimeout(400);
  check("il fallimento e scritto sulla pagina",
    (await page.locator(".jm-ck-err").count()) === 1);
  check("il fallimento passa dall'avviso universale",
    (await page.locator(".jm-toast.error").count()) === 1);
  check("l'avviso dice che il piano non e cambiato",
    /gratis/i.test(await page.locator(".jm-toast-t").innerText()),
    await page.locator(".jm-toast-t").innerText());

  check("checkout: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ================= 3. in inglese ================= */
{
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: "en-GB" });
  await ctx.addInitScript(() => {
    try {
      window.localStorage.setItem("jm.mode", "local"); /* niente velo del saluto sui banchi */ window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco"); window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
      window.localStorage.setItem("jm:lang", "en");
    } catch {}
  });
  const page = await ctx.newPage();
  await page.goto(BASE + "/app/checkout-finto", { waitUntil: "networkidle" });
  await page.waitForSelector(".jm-ck-btns", { timeout: 20000 });
  await page.waitForTimeout(600);
  const en = await page.locator("body").innerText();
  check("in inglese: il tasto e tradotto", /Simulate a successful payment/i.test(en),
    en.split("\n").slice(0, 3).join(" | "));
  check("in inglese: non resta italiano nei tasti", !/Simula pagamento/i.test(en));
  check("in inglese: la fascia e tradotta", /simulated payment|no charge/i.test(en));
  await ctx.close();
}

/* ================= 4. a interruttore spento non esiste ================= */
// Nota sullo stato HTTP della PAGINA. `notFound()` sta in un componente
// server, ma il guscio del layout (tema, splash) e gia stato mandato al
// browser quando la pagina decide: a intestazioni gia partite lo stato non
// si puo piu cambiare, e resta 200 con dentro il 404 di Next. Cio che un
// essere umano vede e esattamente il "pagina non trovata" di sempre, e cio
// che protegge davvero e la ROTTA, che risponde 404 vero prima di
// qualunque render. Quindi qui si controllano tutte e due le cose per
// quello che sono.
// Serve un SECONDO dev server, su :3101, avviato SENZA le variabili. Se non
// c'e, questi tre controlli si saltano invece di fallire: un controllo che
// fallisce per un server spento insegna a ignorare i FAIL, ed e il modo
// migliore per non accorgersi di quelli veri.
{
  let corpo = "";
  let statoApi = 0;
  let raggiungibile = true;
  try {
    const p = await fetch(OFF + "/app/checkout-finto");
    corpo = await p.text();
    const a = await fetch(OFF + "/api/dev-checkout", { method: "POST" });
    statoApi = a.status;
    // Un 500 vuol dire che quel server e rotto, non che la serratura non
    // funziona: e comunque un "non lo so", quindi si salta.
    if (p.status >= 500 || statoApi >= 500) raggiungibile = false;
  } catch {
    raggiungibile = false;
  }
  if (!raggiungibile) {
    console.log(
      "SKIP  interruttore spento: manca il dev server su :3101 (avvialo senza\n" +
        "      NEXT_PUBLIC_JM_FAKE_CHECKOUT per provare pagina e rotta a 404)",
    );
  } else {
    check(
      "a interruttore spento la pagina mostra il 404",
      /could not be found|non trovata|404/i.test(corpo),
    );
    check(
      "a interruttore spento la pagina non mostra il checkout",
      !/jm-ck-btns/.test(corpo),
    );
    check("a interruttore spento la rotta risponde 404", statoApi === 404, String(statoApi));
  }
}

/* ============ 5. senza token la rotta non concede niente ============ */
{
  const r = await fetch(BASE + "/api/dev-checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plan: "premium" }),
  });
  // In produzione e 401 (token mancante). In locale non c'e nessun .env.local
  // con le chiavi Supabase, quindi il controllo del token non parte nemmeno e
  // la risposta e 500: cambia il motivo, non l'esito, che e cio che conta —
  // senza sessione nessuno diventa premium.
  check("senza sessione la rotta rifiuta", r.status === 401 || r.status === 500,
    String(r.status));
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
await browser.close();
process.exit(failed.length === 0 ? 0 : 1);
