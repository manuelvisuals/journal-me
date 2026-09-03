// Banco R11 (SPEC-ospite-e-cassaforte.md): senza rete la trascrizione NON
// resta appesa. Registra con un microfono finto, tiene la rete in un buco
// nero (le richieste partono e non ricevono MAI risposta: e cio che fa un
// telefono senza segnale, che e diverso da un errore immediato), preme Fine
// e pretende che entro TETTO_MESSAGGIO_MS compaia un messaggio che dice cosa
// e successo e cosa fare.
//
// Il difetto del 3 settembre 2026 (referto in src/modules/oggi/
// PROVA-trascrizione.md): la lettura del glossario da Supabase, davanti alla
// chiamata di trascrizione, non aveva nessun tetto. Con quel codice questo
// banco resta rosso per sempre: e stato provato a mordere rimettendo il
// difetto (vedi la nota in fondo al referto).
//
// Come si fa a essere in modalita cloud e premium senza un Supabase vero:
// il dev server ha NEXT_PUBLIC_SUPABASE_URL=https://sbfinto.supabase.co
// (vedi .env.local nel sandbox), una sessione finta e non scaduta sta nel
// localStorage sotto la chiave che supabase-js si aspetta, il piano e in
// cache come premium. Le letture che disegnano la schermata rispondono
// vuote; la lettura del glossario (e ogni altra richiesta a Supabase) viene
// trattenuta da Playwright senza risposta. La trascrizione (/api/
// transcribe-fallback) viene interrotta come farebbe la rete assente.
//
// Provato a mordere il 3 settembre 2026: rimesso il glossario senza tetto,
// 4 controlli rossi (il messaggio non compare in 15 s e il POST della
// trascrizione non parte mai), esattamente il sintomo del telefono.
//
// Serve un dev server su :3100 con quelle env. Lancio:
//   node scripts/verify-rete-spenta.mjs
import { chromium } from "playwright-core";
import { SupabaseFinto, sessioneFinta } from "./lib/supabase-finto.mjs";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const SB_HOST = "sbfinto.supabase.co";
/** Entro quanto la persona deve vedere il messaggio, da quando preme Fine. */
const TETTO_MESSAGGIO_MS = 15_000;
/** Quanto si tiene premuto il microfono finto. */
const PARLA_MS = 2_500;

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({
  executablePath: EXE,
  args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
});

async function pagina() {
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 932 },
    locale: "it-IT",
    permissions: ["microphone"],
  });
  const sessione = sessioneFinta();
  // Un Supabase finto risponde a tutto il resto (cassaforte compresa: dal 3
  // settembre 2026 in cloud si passa dal cancello delle otto parole).
  const finto = new SupabaseFinto();
  // Il microfono: nel sandbox non c'e nessun dispositivo audio (nemmeno
  // quello finto di Chromium), quindi getUserMedia restituisce un flusso
  // sintetico di Web Audio (un oscillatore). MediaRecorder lo registra come
  // registrerebbe una voce: la pipeline dell'app resta quella vera.
  await ctx.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const ac = new AudioContext();
      const osc = ac.createOscillator();
      osc.frequency.value = 220;
      const dest = ac.createMediaStreamDestination();
      osc.connect(dest);
      osc.start();
      await ac.resume();
      return dest.stream;
    };
  });
  await ctx.addInitScript((s) => {
    try {
      window.localStorage.setItem("sb-sbfinto-auth-token", JSON.stringify(s));
      window.localStorage.setItem("jm.plan", "premium");
      // niente saluto di benvenuto sopra il banco: il silenzio e legato
      // alla session_id del gettone finto (saluto-stato.ts)
      window.localStorage.setItem("jm.saluto.silenzio", "sid:banco#v1");
      window.localStorage.setItem("journalme-rec-primer", "1");
    } catch {}
  }, sessione);

  // Il buco nero, mirato: la lettura del glossario (remembers) parte e non
  // torna MAI; tutto il resto risponde (finto). E la forma esatta del
  // difetto del 3 settembre: la schermata c'era, la trascrizione no.
  const trattenute = [];
  await ctx.route(`**/${SB_HOST}/**`, (route) => {
    const u = route.request().url();
    if (u.includes("/rest/v1/remembers")) {
      trattenute.push(u);
      return; // nessun fulfill, nessun abort: la richiesta resta appesa
    }
    return finto.gestisci(route);
  });
  // La trascrizione: la rete assente la fa cadere (e la sua chiamata ha
  // gia un tetto suo: qui si prova cio che le sta DAVANTI).
  const trascrizioni = [];
  await ctx.route("**/api/transcribe-fallback", (route) => {
    trascrizioni.push(route.request().method());
    return route.abort("internetdisconnected");
  });

  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return { ctx, page, errors, trattenute, trascrizioni };
}

/* ============ 1. Senza rete, Fine mostra un messaggio entro il tetto ============ */
{
  const { ctx, page, errors, trattenute, trascrizioni } = await pagina();
  await page.goto(BASE + "/app?record=1", { waitUntil: "domcontentloaded" });
  // Il cancello della cassaforte (le otto parole, una volta): si passa.
  await page.locator(".jm-login-cassa-check input").check({ timeout: 30_000 });
  await page.locator("button.btn-primary").click();
  const ptt = page.locator(".rec-ptt");
  await ptt.waitFor({ state: "visible", timeout: 20_000 });
  check("registrazione: l'ascolto si apre in modalita cloud finta", true);
  // il microfono finto deve essere armato prima di premere
  await page.waitForFunction(
    () => {
      const b = document.querySelector(".rec-ptt");
      return b && !b.disabled;
    },
    null,
    { timeout: 15_000 },
  );

  const box = await ptt.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(PARLA_MS);
  await page.mouse.up();
  await page.waitForTimeout(400);

  const fine = page.getByRole("button", { name: /Fine e salva/ });
  const t0 = Date.now();
  await fine.click();

  let msg = "";
  let comparso = false;
  try {
    await page.waitForFunction(
      () => document.body.innerText.includes("non sono riuscito a trascriverla"),
      null,
      { timeout: TETTO_MESSAGGIO_MS },
    );
    comparso = true;
    msg = await page.evaluate(() => document.body.innerText);
  } catch {
    comparso = false;
  }
  const passati = Date.now() - t0;
  check(
    `rete spenta: un messaggio compare entro ${TETTO_MESSAGGIO_MS / 1000}s da Fine`,
    comparso,
    `${passati}ms`,
  );
  check(
    "rete spenta: il messaggio dice cosa fare (il racconto e ancora qui, premi di nuovo Fine)",
    /Il racconto e ancora qui/.test(msg),
  );
  check(
    "rete spenta: la rotella 'Trascrivo' non e piu a schermo",
    comparso && !/Trascrivo quello che hai detto/.test(msg),
  );
  check(
    "rete spenta: la chiamata di trascrizione e partita lo stesso, senza glossario",
    trascrizioni.includes("POST"),
    trascrizioni.join(","),
  );
  check(
    "rete spenta: la lettura del glossario e rimasta appesa (il buco nero e vero)",
    trattenute.some((u) => u.includes("/rest/v1/remembers")),
    `${trattenute.length} trattenute`,
  );

  // Premere di nuovo Fine riprova col clip conservato, invece di dire
  //    "non e arrivato audio".
  const primaPost = trascrizioni.filter((m) => m === "POST").length;
  await fine.click();
  await page.waitForTimeout(6_000);
  const dopo = await page.evaluate(() => document.body.innerText);
  check(
    "riprova: Fine dopo l'errore rimanda lo stesso clip",
    trascrizioni.filter((m) => m === "POST").length > primaPost,
  );
  check(
    "riprova: nessun 'non e arrivato audio' (il racconto non e andato perso)",
    !/non e arrivato audio/.test(dopo),
  );
  check("zero errori di pagina", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ 2. Le primitive di src/lib/tetto.ts fanno cio che promettono ============ */
{
  // Il file e TypeScript: lo si traspila al volo e lo si importa qui, cosi il
  // banco prova IL codice in uso e non una copia.
  const ts = (await import("typescript")).default;
  const src = readFileSync("src/lib/tetto.ts", "utf8");
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const tmp = join(tmpdir(), `jm-tetto-${Date.now()}.mjs`);
  writeFileSync(tmp, js);
  const { conTetto, conSegnale, fetchConTetto, eTettoScaduto } = await import(
    pathToFileURL(tmp).href
  );
  const mai = new Promise(() => {});

  let t0 = Date.now();
  let esito = "";
  try {
    await conTetto(mai, 300, "prova");
  } catch (e) {
    esito = e && e.name;
  }
  check(
    "conTetto: una promessa che non finisce mai scade con AbortError",
    esito === "AbortError" && Date.now() - t0 < 1500,
    `${esito} in ${Date.now() - t0}ms`,
  );
  check(
    "conTetto: una promessa che finisce in tempo passa il suo valore",
    (await conTetto(Promise.resolve(42), 300)) === 42,
  );

  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), 200);
  t0 = Date.now();
  esito = "";
  try {
    await conSegnale(mai, ctrl.signal, "prova");
  } catch (e) {
    esito = e && e.name;
  }
  check(
    "conSegnale: il segnale che scatta interrompe l'attesa",
    esito === "AbortError" && Date.now() - t0 < 1500,
    `${esito} in ${Date.now() - t0}ms`,
  );

  // fetchConTetto: una fetch che non risponde mai deve essere interrotta.
  const fetchVera = globalThis.fetch;
  globalThis.fetch = (input, init) =>
    new Promise((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal.reason));
    });
  t0 = Date.now();
  esito = "";
  try {
    await fetchConTetto(300)("https://sbfinto.supabase.co/x");
  } catch (e) {
    esito = e && e.name;
  }
  globalThis.fetch = fetchVera;
  check(
    "fetchConTetto: una richiesta senza risposta viene interrotta entro il tetto",
    esito === "AbortError" && Date.now() - t0 < 1500,
    `${esito} in ${Date.now() - t0}ms`,
  );
  check("eTettoScaduto riconosce l'AbortError", eTettoScaduto({ name: "AbortError" }) && !eTettoScaduto(new Error("x")));
  rmSync(tmp, { force: true });
}

await browser.close();
const ok = results.filter((r) => r.ok).length;
console.log(`\n${ok}/${results.length} PASS`);
process.exit(ok === results.length ? 0 : 1);
