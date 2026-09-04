// Verifica delle SCHERMATE dell'ospite (4 settembre 2026, branch
// ospite-schermate). Mockup approvato: design/mockups/ospite-primo-avvio.html
// (Manuel: "approvo tutte le tue proposte in verde"). La parte invisibile
// (braccialetto, quota, tetto) e in verify-ospite.mjs: qui si guarda cio che
// una persona VEDE.
//
//   01  primo avvio: dritto su Oggi, il pallino non dice "Locale";
//   02  l'avviso discreto sotto la giornata appena chiusa, quando ne
//       restano 3 o meno: una riga con la X, "Prova premium" apre il muro,
//       la X lo chiude e per quella giornata non torna;
//   03  a regalo finito la giornata chiusa senza AI e la vista gratis
//       (titolo = prima riga) con la frase del regalo, non quella di premium;
//   04  Impostazioni: "Dove sono le mie giornate", "AI in regalo" con il
//       conto vero (letto dal server), "Passa a Premium", "Accedi"; il
//       pannello "AI in regalo" con usate/rimaste; il pannello "Dove" con
//       le parole dell'ospite (niente "nemmeno una richiesta di rete");
//   05  /admin: la voce "Regalo AI" al posto di "Piani e limiti", si legge
//       e si salva (giornate, tetto, interruttori) sul server.
//
// Il server parla con un Supabase FINTO e un OpenAI FINTO (finti-server.mjs),
// porte 3198 e 3199. Dev server come per verify-ospite.mjs:
//
//   JM_SUPABASE_URL_SERVER=http://127.0.0.1:3198 OPENAI_BASE_URL=http://127.0.0.1:3199 \
//   SUPABASE_SERVICE_ROLE_KEY=finto OPENAI_API_KEY=finto \
//   NEXT_PUBLIC_SUPABASE_URL=https://sbfinto.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=finto-anon-key \
//   ./node_modules/.bin/next dev -p 3100
//
// poi: node scripts/verify-ospite-schermate.mjs
import { chromium } from "playwright-core";
import { SupabaseFintoServer, OpenAIFinto } from "./lib/finti-server.mjs";
import { SupabaseFinto, jwtFinto, montaSupabaseFinto, UTENTE_ID } from "./lib/supabase-finto.mjs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const SB_HOST = "sbfinto.supabase.co";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const sb = new SupabaseFintoServer();
const oa = new OpenAIFinto();
await sb.avvia(3198);
await oa.avvia(3199);

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

async function dispositivo({ seme = null, viewport = { width: 430, height: 900 } } = {}) {
  const ctx = await browser.newContext({ viewport, locale: "it-IT" });
  await ctx.route(`**/${SB_HOST}/**`, (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
  await ctx.addInitScript(({ seme }) => {
    try {
      window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
      window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
    } catch {}
    if (seme) {
      const req = indexedDB.open("journalme-chiave", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("semi");
      req.onsuccess = () => {
        const tx = req.result.transaction("semi", "readwrite");
        tx.objectStore("semi").put(seme, "braccialetto");
      };
    }
  }, { seme });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error" && !/402 \(Payment Required\)/.test(m.text())) errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  return { ctx, page, errors };
}

async function semeDelBraccialetto(page) {
  return page.evaluate(() => new Promise((resolve) => {
    const req = indexedDB.open("journalme-chiave", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("semi");
    req.onsuccess = () => {
      const tx = req.result.transaction("semi", "readonly");
      const g = tx.objectStore("semi").get("braccialetto");
      g.onsuccess = () => resolve(g.result ?? null);
      g.onerror = () => resolve(null);
    };
    req.onerror = () => resolve(null);
  }));
}

async function scriviEChiudi(page, testo, { conAI }) {
  await page.locator(".jm-ed-ta").waitFor({ state: "visible", timeout: 30_000 });
  await page.locator(".jm-ed-ta").click();
  await page.keyboard.type(testo);
  await page.keyboard.press(conAI ? "Control+Enter" : "Control+s");
  await page.locator(".jm-fv-h").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(1200);
  return page.locator(".jm-fv-h").innerText();
}

async function nuovaGiornata(page) {
  await page.evaluate(() => new Promise((resolve) => {
    const req = indexedDB.deleteDatabase("journalme");
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  }));
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
}

/** Aspetta che il server abbia riletto i limiti del regalo (cache 30 s). */
async function aspettaRegalo(pred) {
  const inizio = Date.now();
  for (;;) {
    const r = await fetch(BASE + "/api/ospite/stato").then((x) => x.json());
    if (pred(r)) return r;
    if (Date.now() - inizio > 70_000) { console.log("il server non rilegge il regalo: " + JSON.stringify(r)); process.exit(1); }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

await aspettaRegalo((s) => s.attivo === true && s.max === 10 && s.sopraIlTetto === false);

let semeA = null;

/* ================= 01 + 04: primo avvio e Impostazioni con la quota piena ================= */
{
  const { ctx, page, errors } = await dispositivo();
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Racconta a voce/ }).waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(800);
  semeA = await semeDelBraccialetto(page);
  check("01 primo avvio: su Oggi, microfono acceso, braccialetto nato", !page.url().includes("/login") && typeof semeA === "string");

  // Il pallino in alto a destra: il foglio dell'account.
  await page.getByRole("button", { name: "Il tuo account" }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  const foglio = await page.locator("body").innerText();
  // Il foglio del pallino (mockup premium-senza-password 01): il sottotitolo
  // dice il regalo che resta (letto dal server all'apertura), la voce
  // "Premium" c'e anche per l'ospite, "Ho gia un account" al posto di "Accedi".
  await page.getByText(/giornate con l'AI in regalo/).waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
  const foglio2 = await page.locator("body").innerText();
  check("01 il pallino non dice 'Locale' e dice quante giornate restano in regalo", !/\bLocale\b/.test(foglio2) && /10 giornate con l'AI in regalo/.test(foglio2), foglio2.replace(/\s+/g, " ").slice(0, 160));
  check("01 il menu ha la voce 'Premium' e 'Ho gia un account' (non 'Accedi al tuo account')", /\bPremium\b/.test(foglio2) && /Ho gia un account/.test(foglio2) && !/Accedi al tuo account/.test(foglio2));
  void foglio;
  await page.keyboard.press("Escape");

  // Impostazioni.
  await page.goto(BASE + "/app/settings", { waitUntil: "domcontentloaded" });
  await page.getByText("AI in regalo").first().waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(1500);
  const testo = await page.locator("main").innerText();
  check("04 Impostazioni: 'Dove sono le mie giornate' con 'Solo su questo dispositivo'", /Dove sono le mie giornate/.test(testo) && /Solo su questo dispositivo/.test(testo));
  check("04 Impostazioni: 'AI in regalo' dice il conto vero letto dal server: 10 giornate su 10", /AI in regalo\s*\n?\s*10 giornate su 10/.test(testo), testo.match(/AI in regalo[\s\S]{0,40}/)?.[0]?.replace(/\s+/g, " "));
  check("04 Impostazioni: 'Passa a Premium' con '14 giorni gratis' e il prezzo dopo", /Passa a Premium/.test(testo) && /14 giorni gratis/.test(testo) && /Poi .*al mese/.test(testo));
  check("04 Impostazioni: 'Ho gia un account' e 'Backup ogni notte: Spento' (la porta all'email, C1)", /Ho gia un account/.test(testo) && /Backup ogni notte[\s\S]{0,160}Spento/.test(testo) && !/Accedi al tuo account/.test(testo), testo.match(/Backup ogni notte[\s\S]{0,30}/)?.[0]?.replace(/\s+/g, " "));
  check("04 Impostazioni: la parola 'Locale' non compare", !/\bLocale\b/.test(testo));

  await page.getByText("AI in regalo").first().click();
  await page.waitForTimeout(800);
  const pannello = await page.locator("main").innerText();
  check("04 pannello 'AI in regalo': '10 giornate su 10, ancora con l'AI.' e le tre frasi", /10 giornate su 10, ancora con l'AI\./.test(pannello) && /Un regalo/.test(pannello) && /Reinstallare non lo azzera/.test(pannello), pannello.replace(/\s+/g, " ").slice(0, 100));
  check("04 pannello 'AI in regalo': Usate 0, Rimaste 10", /Usate\s*\n?\s*0/.test(pannello) && /Rimaste\s*\n?\s*10/.test(pannello));
  check("04 pannello 'AI in regalo': nessun tasto per comprare qui dentro", !/Prova gratis|Abbonati/.test(pannello));
  await page.goBack().catch(() => {});
  await page.goto(BASE + "/app/settings", { waitUntil: "domcontentloaded" });
  await page.getByText("Dove sono le mie giornate").first().waitFor({ state: "visible", timeout: 30_000 });
  await page.getByText("Dove sono le mie giornate").first().click();
  await page.waitForTimeout(800);
  const dove = await page.locator("main").innerText();
  check("04 pannello 'Dove': le parole dell'ospite (server chiuso a chiave, il testo esce quando l'AI lavora)", /Solo su questo dispositivo\. Senza backup/.test(dove) && /Anche sul server, chiuso a chiave/.test(dove) && /quando l'AI ci lavora/.test(dove), dove.replace(/\s+/g, " ").slice(0, 100));
  check("04 pannello 'Dove': NON promette 'nemmeno una richiesta di rete' (divieto 7)", !/nemmeno una richiesta di rete/.test(dove));
  check("01-04 zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ================= 04 desktop: la rail destra ================= */
{
  const { ctx, page, errors } = await dispositivo({ seme: semeA, viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + "/app/settings", { waitUntil: "domcontentloaded" });
  await page.locator(".jm-st-rr").waitFor({ state: "visible", timeout: 30_000 });
  await page.locator(".jm-st-rr").getByText(/giornate su/).waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
  const rail = await page.locator(".jm-st-rr").innerText().catch(() => "");
  check("04 desktop: la rail ha 'AI in regalo' con il conto e 'Passa a Premium'", /AI in regalo/.test(rail) && /10 giornate su 10/.test(rail) && /Passa a Premium/.test(rail), rail.replace(/\s+/g, " ").slice(0, 120));
  check("04 desktop: niente pill 'Locale' sopra la rail", (await page.locator(".jm-st-pill").count()) === 0);
  check("04 desktop: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ================= 02: l'avviso discreto ================= */
{
  // Regalo a 3 giornate: chiudere oggi con l'AI ne lascia 2.
  sb.regalo.giornate_per_ospite = 3;
  await aspettaRegalo((s) => s.max === 3);
  // Desktop: l'editor e gia nella colonna (sul telefono ci vuole un tocco).
  const { ctx, page, errors } = await dispositivo({ seme: semeA, viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  const avvisoPrima = await page.locator(".jm-avviso-regalo").count();
  const t1 = await scriviEChiudi(page, "Oggi ho chiuso una giornata con l'AI e ne restano poche.", { conAI: true });
  check("02 la giornata e chiusa dall'AI (titolo del modello finto)", /giornata da ospite/.test(t1), t1);
  // A2 (mockup premium-senza-password): la PRIMA giornata chiusa dall'AI su
  // questo dispositivo apre il foglio "L'AI ha chiuso questa giornata per
  // te", una volta sola, con la scheda e "non ora".
  const foglioA2 = page.locator(".jm-wall");
  await foglioA2.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
  const testoA2 = await foglioA2.innerText().catch(() => "");
  check("A2 dopo la prima giornata chiusa dall'AI si apre il foglio 'L'AI ha chiuso questa giornata per te' con 'Ne hai altre 2 giornate'", /L'AI ha chiuso\s*questa giornata per te/.test(testoA2) && /altre 2 in regalo/.test(testoA2), testoA2.replace(/\s+/g, " ").slice(0, 120));
  check("A2 il foglio NON chiede l'account: niente 'Ho gia un account', c'e 'non ora'", !/Ho gia un account/.test(testoA2) && /non ora/.test(testoA2));
  check("A2 e segnato come gia presentato (localStorage jm.premium.presentato)", (await page.evaluate(() => localStorage.getItem("jm.premium.presentato"))) === "1");
  await page.locator(".jm-wall .btn-ghost").click().catch(() => {});
  await page.waitForTimeout(500);
  const avviso = page.locator(".jm-avviso-regalo");
  await avviso.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
  const testoAvviso = await avviso.innerText().catch(() => "");
  check("02 sotto la giornata chiusa compare l'avviso: 'Ti restano 2 giornate con l'AI in regalo'", /Ancora 2 giornate con l'AI in regalo/.test(testoAvviso) && /Prova premium/.test(testoAvviso), testoAvviso.slice(0, 80));
  check("02 l'avviso non c'era all'avvio (prima della chiusura)", avvisoPrima === 0);
  check("02 l'avviso non e un popup: nessun dialog, nessun muro", (await page.locator(".jm-wall, [role='dialog']").count()) === 0);
  await avviso.getByRole("button", { name: /Prova premium/ }).click();
  await page.locator(".jm-wall").waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
  const muro = await page.locator(".jm-wall").innerText().catch(() => "");
  check("02 'Prova premium' apre il muro a schede (non quello del regalo finito), senza chiedere l'account", /serve premium/.test(muro) && !/Ho gia un account/.test(muro) && !/in regalo sono finite/.test(muro), muro.replace(/\s+/g, " ").slice(0, 80));
  await page.keyboard.press("Escape");
  await page.locator(".jm-wall .btn-ghost").click().catch(() => {});
  await page.waitForTimeout(400);
  await avviso.getByRole("button", { name: /Chiudi l'avviso/ }).click();
  await page.waitForTimeout(300);
  check("02 la X chiude l'avviso", (await page.locator(".jm-avviso-regalo").count()) === 0);
  const oggi = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  check("02 la chiusura resta per questa giornata (localStorage)", (await page.evaluate((k) => localStorage.getItem(k), `jm.ospite.avviso.${oggi}`)) === "1");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".jm-fv-h").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(1500);
  check("02 dopo la riapertura l'avviso non torna (mai all'avvio)", (await page.locator(".jm-avviso-regalo").count()) === 0);
  check("02 zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ================= 03: regalo finito, la giornata senza AI e la vista gratis ================= */
{
  // Il braccialetto A ha 1 giornata (oggi) su 3: tolgo quella di oggi e ne
  // metto 3 nel passato: quota finita, oggi non coperta.
  const idA = sb.tab("braccialetti")[0].id;
  const oggi = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  sb.tabelle.braccialetto_giornate = sb.tab("braccialetto_giornate").filter((g) => !(g.braccialetto_id === idA && g.giorno === oggi));
  for (const g of ["2026-08-01", "2026-08-02", "2026-08-03"]) sb.tab("braccialetto_giornate").push({ braccialetto_id: idA, giorno: g, creato_il: g + "T10:00:00Z" });

  const { ctx, page, errors } = await dispositivo({ seme: semeA, viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await nuovaGiornata(page);
  await scriviEChiudi(page, "Chiusa con l'AI a regalo finito.\n\nIl resto del racconto scritto a mano.", { conAI: true });
  await page.locator(".jm-wall").waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
  const muro = await page.locator(".jm-wall").innerText().catch(() => "");
  check("03 a regalo finito si apre il muro del regalo ('Le 3 giornate ... sono finite', 'Continua senza AI')", /Le 3 giornate con l'AI\s*in regalo sono finite/.test(muro) && /Continua senza AI/.test(muro), muro.replace(/\s+/g, " ").slice(0, 80));
  await page.locator(".jm-wall .btn-ghost").click();
  await page.waitForTimeout(1500);
  const giornata = await page.locator("main").innerText();
  check("03 la giornata e la vista gratis: titolo = prima riga, testo come prosa", /Chiusa con l'AI a regalo finito/.test(await page.locator(".jm-fv-h").innerText()) && (await page.locator(".jm-fv-prose p").count()) >= 1);
  check("03 la frase in fondo e quella del regalo, non quella di premium", /Le 3 giornate con l'AI sono finite\. Il diario continua/.test(giornata) && !/Con premium questa giornata avrebbe/.test(giornata), giornata.match(/Le 3 giornate con l'AI[\s\S]{0,80}/)?.[0]?.replace(/\s+/g, " "));
  check("03 nessun avviso discreto a regalo finito (c'e gia il muro e la frase)", (await page.locator(".jm-avviso-regalo").count()) === 0);

  await page.goto(BASE + "/app/settings", { waitUntil: "domcontentloaded" });
  await page.locator(".jm-st-rr").waitFor({ state: "visible", timeout: 30_000 });
  await page.locator(".jm-st-rr").getByText(/^finito$/).waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
  const testo = await page.locator(".jm-st-rr").innerText();
  check("03 Impostazioni: 'AI in regalo' dice 'finito'", /AI in regalo\s*\n?\s*finito/.test(testo), testo.match(/AI in regalo[\s\S]{0,30}/)?.[0]?.replace(/\s+/g, " "));
  check("03 zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
  sb.regalo.giornate_per_ospite = 10;
}

/* ================= 05: /admin, la voce "Regalo AI" ================= */
{
  const exp = Math.floor(Date.now() / 1000) + 6 * 3600;
  const TOKEN = jwtFinto(exp, UTENTE_ID);
  sb.utenti.set(TOKEN, { id: UTENTE_ID, email: "madh52@gmail.com" });
  sb.tab("profiles").push({ user_id: UTENTE_ID, plan: "premium", plan_source: "manual", current_period_end: null });

  const finto = new SupabaseFinto();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "it-IT" });
  await montaSupabaseFinto(ctx, finto);
  await ctx.addInitScript(({ token }) => {
    try {
      const s = JSON.parse(window.localStorage.getItem("sb-sbfinto-auth-token") || "{}");
      s.access_token = token;
      window.localStorage.setItem("sb-sbfinto-auth-token", JSON.stringify(s));
      window.localStorage.setItem("jm.mode", "cloud");
    } catch {}
  }, { token: TOKEN });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(BASE + "/admin", { waitUntil: "domcontentloaded" });
  // Il cancello della cassaforte, se compare.
  const parole = page.locator(".jm-login-cassa-check input");
  try {
    await parole.waitFor({ state: "visible", timeout: 8_000 });
    await parole.check();
    await page.locator("button.btn-primary").click();
    await page.goto(BASE + "/admin", { waitUntil: "domcontentloaded" });
  } catch {}
  const nav = page.locator(".jm-adm-nav");
  await nav.waitFor({ state: "visible", timeout: 30_000 });
  const navTesto = await nav.innerText();
  check("05 /admin: la voce 'Regalo AI' c'e, 'Piani e limiti' no", /Regalo AI/.test(navTesto) && !/Piani e limiti/.test(navTesto), navTesto.replace(/\s+/g, " "));
  await nav.getByRole("button", { name: "Regalo AI" }).click();
  await page.locator(".jm-adm-speso").waitFor({ state: "visible", timeout: 20_000 });
  const schermata = await page.locator(".jm-adm-main").innerText();
  const pezzi = ["Il regalo", "Giornate per ospite", "Tetto mensile", "Speso questo mese", "Annuale in vendita"].filter((k) => !schermata.toLowerCase().includes(k.toLowerCase()));
  check("05 Regalo AI: le quattro cose (interruttore, giornate, tetto, speso) e l'annuale", pezzi.length === 0, "mancano: " + pezzi.join(", "));
  const giornate = page.locator(".jm-adm-f-num input").first();
  check("05 Regalo AI: le giornate per ospite mostrano il valore del server (10)", (await giornate.inputValue()) === "10");
  check("05 Regalo AI: lo speso del mese viene dal server (ai_usage), non da zero", Number(await page.locator(".jm-adm-speso").getAttribute("data-speso-eur")) > 0, await page.locator(".jm-adm-speso").innerText());
  check("05 Regalo AI: 'Salva' spento finche non cambi niente", await page.getByRole("button", { name: /Salva le modifiche/ }).isDisabled());
  await giornate.fill("7");
  await page.locator(".jm-adm-f-num input").nth(1).fill("250");
  await page.getByRole("switch", { name: "Annuale in vendita" }).click();
  check("05 Regalo AI: dopo una modifica 'Salva' si accende", !(await page.getByRole("button", { name: /Salva le modifiche/ }).isDisabled()));
  await page.getByRole("button", { name: /Salva le modifiche/ }).click();
  await page.locator(".jm-adm-esito.ok").waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
  check("05 Regalo AI: 'Salvato' a schermo", (await page.locator(".jm-adm-esito.ok").count()) === 1);
  check("05 Regalo AI: il server ha giornate 7, tetto 250, annuale acceso", sb.regalo.giornate_per_ospite === 7 && Number(sb.regalo.tetto_mensile_eur) === 250 && sb.regalo.annuale_attivo === true, JSON.stringify(sb.regalo));
  await page.getByRole("switch", { name: "Il regalo" }).click();
  await page.getByRole("button", { name: /Salva le modifiche/ }).click();
  await page.waitForTimeout(1500);
  check("05 Regalo AI: l'interruttore del regalo si spegne sul server", sb.regalo.attivo === false, JSON.stringify(sb.regalo));
  const stato = await aspettaRegalo((s) => s.attivo === false && s.max === 7 && s.annualeAttivo === true);
  check("05 /api/ospite/stato vede subito i valori nuovi (cache dimenticata dopo il PUT)", stato.attivo === false && stato.max === 7);
  check("05 zero errori pagina", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
  sb.regalo.attivo = true;
  sb.regalo.giornate_per_ospite = 10;
  sb.regalo.tetto_mensile_eur = 100;
  sb.regalo.annuale_attivo = false;
}

/* ================= 06: la schermata dell'email (D1) e le giornate che salgono (C1) ================= */
{
  // Desktop: l'editor e gia nella colonna e "salva e basta" e Ctrl+S.
  const { ctx, page, errors } = await dispositivo({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  // Una giornata scritta sul dispositivo, che poi deve salire.
  await scriviEChiudi(page, "Giornata scritta da ospite, prima dell'email.", { conAI: false });

  // La schermata dell'email, dal pallino della rail: "Ho gia un account".
  await page.locator(".jm-acct-btn").click();
  await page.getByRole("menuitem", { name: /Ho gia un account/ }).click();
  await page.waitForURL("**/login**", { timeout: 15_000 });
  await page.waitForTimeout(800);
  const login = await page.locator("main").innerText();
  check("06 la schermata dell'email dice il perche: 'Le tue giornate, anche altrove.' e 'chiuse a chiave'", /Le tue giornate, anche altrove\./.test(login) && /chiuso a chiave/.test(login), login.replace(/\s+/g, " ").slice(0, 120));
  check("06 niente bivio: via 'Tienilo solo su questo dispositivo' e 'oppure', c'e 'Non ora'", !/Tienilo solo su questo dispositivo/.test(login) && !/\boppure\b/.test(login) && /Non ora/.test(login));
  check("06 niente 'La versione gratis non ha bisogno di email' (confondeva chi veniva a comprare)", !/versione gratis/.test(login));
  await page.getByRole("button", { name: "Non ora" }).click();
  await page.waitForTimeout(800);
  check("06 'Non ora' torna sul diario, non su un bivio", !page.url().includes("/login"), page.url());

  // Il login vero e proprio non si puo fare qui (il codice arriva per
  // email): si simula cio che il login lascia (la sessione, il promemoria
  // della migrazione, la modalita cloud) e si guarda il cancello fare il
  // resto: cassaforte nuova, giornate che salgono, braccialetto adottato.
  const finto = new SupabaseFinto();
  finto.tabelle.profiles = [{ user_id: UTENTE_ID, plan: "free" }];
  await montaSupabaseFinto(ctx, finto);
  const exp = Math.floor(Date.now() / 1000) + 6 * 3600;
  const TOKEN = jwtFinto(exp, UTENTE_ID);
  sb.utenti.set(TOKEN, { id: UTENTE_ID, email: "ospite-diventato-account@dayalogue.test" });
  await page.evaluate((token) => {
    const s = JSON.parse(window.localStorage.getItem("sb-sbfinto-auth-token") || "{}");
    s.access_token = token;
    window.localStorage.setItem("sb-sbfinto-auth-token", JSON.stringify(s));
    window.localStorage.removeItem("jm.mode");
    window.localStorage.setItem("jm.migrazione.locale", "1");
    window.localStorage.setItem("jm.saluto.silenzio", "sid:banco#v1");
  }, TOKEN);
  const api = [];
  page.on("request", (r) => { const u = r.url(); if (u.startsWith(BASE) && new URL(u).pathname.startsWith("/api/")) api.push({ path: new URL(u).pathname, auth: r.headers()["authorization"] ?? null, braccialetto: r.headers()["x-jm-braccialetto"] ?? null }); });
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  const parole = page.locator(".jm-login-cassa-check input");
  await parole.waitFor({ state: "visible", timeout: 30_000 });
  await parole.check();
  await page.locator("button.btn-primary").click();
  // La migrazione parte con la cassaforte aperta: si aspetta la riga sul server finto del browser.
  const inizio = Date.now();
  while (finto.tab("cassettine").length === 0 && Date.now() - inizio < 30_000) await page.waitForTimeout(500);
  check("06 con la cassaforte aperta la giornata del telefono SALE, chiusa a chiave (una cassettina sul server)", finto.tab("cassettine").length === 1 && !JSON.stringify(finto.tab("cassettine")).includes("prima dell'email"), String(finto.tab("cassettine").length));
  const adotta = api.filter((a) => a.path === "/api/ospite/adotta");
  check("06 il braccialetto viene adottato: /api/ospite/adotta con gettone E braccialetto", adotta.length >= 1 && adotta[0].auth !== null && typeof adotta[0].braccialetto === "string", JSON.stringify(adotta[0] ?? null));
  const brA = sb.tab("braccialetti").find((b) => b.user_id === UTENTE_ID);
  check("06 sul server il braccialetto e legato all'account", !!brA);
  await page.waitForTimeout(500);
  check("06 il promemoria della migrazione cade solo a fine riuscita", (await page.evaluate(() => localStorage.getItem("jm.migrazione.locale"))) === null);
  await page.locator(".jm-fv-h, .jm-ed-ta").first().waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
  const dopo = await page.locator("main").innerText().catch(() => "");
  check("06 la giornata scritta da ospite si vede anche da account", /Giornata scritta da ospite/.test(dopo), dopo.replace(/\s+/g, " ").slice(0, 100));
  check("06 zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

await browser.close();
await sb.ferma();
await oa.ferma();
const ok = results.filter((r) => r.ok).length;
console.log(`\n${ok}/${results.length} PASS`);
process.exit(ok === results.length ? 0 : 1);
