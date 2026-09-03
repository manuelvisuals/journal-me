// Banco della cassaforte (SPEC-ospite-e-cassaforte.md, R6 R7 R8).
//
// Gira contro un Supabase FINTO in memoria (scripts/lib/supabase-finto.mjs)
// montato dentro Playwright: cosi il banco vede OGNI byte che lascia il
// dispositivo, che e esattamente cio che arriva sul server. La prova di
// accettazione di R6 e questa: si scrive una giornata con parole rare e
// inconfondibili, poi si cerca ognuna di quelle parole in tutto cio che e
// uscito verso Supabase. Una sola parola trovata = rosso.
//
// R7: si simula un altro dispositivo che ha gia scritto (la versione sul
// server sale) e si pretende che la scrittura successiva venga rifiutata e
// che compaia l'avviso con le due versioni, senza perdere niente.
//
// R8: un dispositivo nuovo (contesto senza IndexedDB) trova le giornate
// chiuse, le apre con le otto parole, e segnala QUALE parola e sbagliata.
//
// Serve il dev server su :3100 con NEXT_PUBLIC_SUPABASE_URL=https://sbfinto.supabase.co.
import { chromium } from "playwright-core";
import { SupabaseFinto, montaSupabaseFinto } from "./lib/supabase-finto.mjs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

// Parole rare, che non compaiono da nessun'altra parte (ne nell'app ne nel
// codice): se una sola esce dal dispositivo, la promessa e rotta.
const TESTO_TITOLO = "Quarzite ambrata sul molo di Zafferana";
const TESTO_CORPO =
  "Stamattina ho incontrato Brunilde Vespucci al bar del porto e mi ha raccontato del cugino Ottaviano che restaura clavicembali a Ortigia.";
const TESTO_MEMO = "Chiamare la Sfinge per il preventivo";
const PAROLE_SPIA = ["Quarzite", "Zafferana", "Brunilde", "Vespucci", "Ottaviano", "clavicembali", "Ortigia"];

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

async function nuovaPagina(finto, opzioni = {}) {
  const ctx = await browser.newContext({
    viewport: opzioni.viewport ?? { width: 1440, height: 900 },
    locale: "it-IT",
    permissions: ["clipboard-read", "clipboard-write"],
  });
  await montaSupabaseFinto(ctx, finto, { seme: opzioni.seme ?? null });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return { ctx, page, errors };
}

const finto = new SupabaseFinto();
let paroleDiRecupero = [];

/* ============ 1. Primo accesso: le otto parole, una volta ============ */
{
  const { ctx, page, errors } = await nuovaPagina(finto);
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  const h1 = page.locator(".jm-login-cassa-h1");
  await h1.waitFor({ state: "visible", timeout: 30_000 });
  check("primo accesso: compare la schermata delle parole", /Otto parole/.test(await h1.innerText()));
  await page.waitForFunction(
    () => [...document.querySelectorAll(".jm-login-cassa-parole li span")].every((s) => !/•/.test(s.textContent)),
    null,
    { timeout: 20_000 },
  );
  paroleDiRecupero = await page.$$eval(".jm-login-cassa-parole li span", (l) => l.map((s) => s.textContent.trim()));
  check("parole: sono otto, tutte dalla lista (minuscole, solo lettere)", paroleDiRecupero.length === 8 && paroleDiRecupero.every((p) => /^[a-z]+$/.test(p)), paroleDiRecupero.join(" "));
  check("parole: il tasto e spento finche non si spunta", await page.locator("button.btn-primary").isDisabled());
  check(
    "server: c'e la prova, e NON contiene le parole ne il seme",
    finto.tab("cassaforte_utente").length === 1 &&
      !paroleDiRecupero.some((p) => finto.tab("cassaforte_utente")[0].prova.includes(p)),
  );
  await page.locator(".jm-login-cassa-check input").check();
  check("parole: spuntato, il tasto si accende", await page.locator("button.btn-primary").isEnabled());
  await page.locator("button.btn-primary").click();
  await page.locator(".jm-ed-ta").waitFor({ state: "visible", timeout: 30_000 });
  check("dopo le parole: si entra nel diario", true);

  /* ============ 2. Una giornata scritta: sul server non resta niente di leggibile (R6) ============ */
  await page.locator(".jm-ed-ta").click();
  await page.keyboard.type(`${TESTO_TITOLO}\n\n${TESTO_CORPO}`);
  await page.keyboard.press("Control+s");
  await page.waitForFunction(() => document.body.innerText.includes("Quarzite ambrata"), null, { timeout: 30_000 });
  await page.waitForTimeout(1500);
  const cass = finto.tab("cassettine");
  check("R6: la giornata e una cassettina (una riga, v=1)", cass.length === 1 && cass[0].v === 1, JSON.stringify(cass.map((c) => ({ giorno: c.giorno, v: c.v, bytes: c.bytes }))));
  check("R6: la tabella entries e VUOTA", finto.tab("entries").length === 0, `${finto.tab("entries").length} righe`);
  check("R6: la tabella facts e VUOTA", finto.tab("facts").length === 0);
  const uscito = finto.tuttoCioCheEUscito();
  const trovate = PAROLE_SPIA.filter((p) => uscito.includes(p));
  check("R6: NESSUNA parola del testo e uscita dal dispositivo verso Supabase", trovate.length === 0, trovate.join(","));
  const busta = JSON.parse(cass[0].busta);
  check("R6: la busta e AES-GCM v1 con iv e ct in base64", busta.alg === "A256GCM" && busta.v === 1 && /^[A-Za-z0-9+/=]+$/.test(busta.iv) && /^[A-Za-z0-9+/=]+$/.test(busta.ct));
  check("R6: in chiaro restano solo giorno, v, bytes, date", Object.keys(cass[0]).sort().join(",") === "busta,bytes,created_at,giorno,updated_at,user_id,v");

  /* ============ 2-bis. Un memo: anche le altre tabelle sono buste (migration 022) ============ */
  await page.goto(BASE + "/app/remember", { waitUntil: "domcontentloaded" });
  const qc = page.locator(".jm-qc-card input, .jm-qc-card textarea").first();
  await qc.waitFor({ state: "visible", timeout: 30_000 });
  await qc.fill(TESTO_MEMO);
  await page.locator(".jm-qc-add").click();
  await page.waitForFunction((t) => document.body.innerText.includes(t), TESTO_MEMO, { timeout: 30_000 });
  const memo = finto.tab("remembers");
  check("R6 memo: la riga esiste, il testo in chiaro e VUOTO e c'e la busta", memo.length === 1 && memo[0].text === "" && typeof memo[0].busta === "string" && memo[0].busta.length > 20, JSON.stringify(memo.map((m) => ({ text: m.text, kind: m.kind })))) ;
  check("R6 memo: la parola del memo non e uscita dal dispositivo", !finto.tuttoCioCheEUscito().includes("Sfinge"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction((t) => document.body.innerText.includes(t), TESTO_MEMO, { timeout: 30_000 });
  check("R6 memo: dopo un reload il memo si rilegge dalla busta", true);
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });

  // Ricaricando, la giornata si rilegge (la chiave e sul dispositivo)
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.body.innerText.includes("Quarzite ambrata"), null, { timeout: 30_000 });
  check("rilettura: dopo un reload la giornata si apre con la chiave del dispositivo", true);
  check("zero errori di pagina", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ 3. Dispositivo nuovo senza chiave (R8) ============ */
{
  const { ctx, page, errors } = await nuovaPagina(finto);
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  const h1 = page.locator(".jm-login-cassa-h1");
  await h1.waitFor({ state: "visible", timeout: 30_000 });
  check("dispositivo nuovo: chiede le parole (non le mostra)", /non ha la chiave/.test(await h1.innerText()), await h1.innerText());
  check("dispositivo nuovo: il testo del diario NON e a schermo", !(await page.evaluate(() => document.body.innerText.includes("Quarzite"))));
  const campo = page.locator(".jm-login-cassa-campo");
  const sbagliate = [...paroleDiRecupero];
  sbagliate[6] = sbagliate[6] + "rr";
  await campo.fill(sbagliate.join(" "));
  await page.waitForTimeout(200);
  const err = await page.locator(".jm-login-cassa-errore").innerText().catch(() => "");
  check("parola sbagliata: l'errore dice QUALE (la numero 7) e la ripete", /numero 7/.test(err) && err.includes(sbagliate[6]), err);
  check("parola sbagliata: il tasto resta spento", await page.locator("button.btn-primary").isDisabled());
  // Parole giuste ma in ordine sbagliato: il controllo le rifiuta
  const scambiate = [...paroleDiRecupero];
  [scambiate[0], scambiate[1]] = [scambiate[1], scambiate[0]];
  await campo.fill(scambiate.join(" "));
  await page.locator("button.btn-primary").click();
  await page.locator(".jm-login-cassa-errore").waitFor({ state: "visible", timeout: 15_000 });
  const err2 = await page.locator(".jm-login-cassa-errore").innerText();
  check("ordine sbagliato: rifiutato con una spiegazione", /ordine/.test(err2), err2);
  // Le parole giuste, incollate con maiuscole e numeri davanti
  await campo.fill(paroleDiRecupero.map((p, i) => `${i + 1}. ${p.toUpperCase()}`).join("\n"));
  await page.locator("button.btn-primary").click();
  await page.waitForFunction(() => document.body.innerText.includes("Quarzite ambrata"), null, { timeout: 40_000 });
  check("parole giuste: il diario si apre e la giornata si legge", true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.body.innerText.includes("Quarzite ambrata"), null, { timeout: 30_000 });
  check("parole giuste: la chiave resta sul dispositivo (non le chiede di nuovo)", true);
  check("zero errori di pagina (dispositivo nuovo)", errors.length === 0, errors.slice(0, 2).join(" | "));

  /* ============ 4. Il conflitto di versione (R7) ============ */
  // Un altro dispositivo scrive FRA la lettura e la scrittura di questo: e
  // la corsa vera, e il server la vede come "versione attesa 1, corrente 2".
  const scrittureDopoReload = finto.registro.filter((v) => v.url.includes("salva_cassettina")).length;
  const modifica = page.locator("button:visible", { hasText: /^modifica/ }).first();
  const c = await modifica.count();
  check("R7: c'e un modo di modificare la giornata dalla schermata", c > 0);
  if (c > 0) {
    await modifica.click();
    const ta = page.locator(".jm-editor-textarea");
    try {
      await ta.waitFor({ state: "visible", timeout: 10_000 });
    } catch (e) {
      await page.screenshot({ path: "/tmp/verify-cassaforte-r7.png" });
      throw e;
    }
    await ta.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(" Aggiunta da questo dispositivo.");
    const scrittureOra = finto.registro.filter((v) => v.url.includes("salva_cassettina")).length;
    check("R7: aprire e leggere una giornata non scrive niente sul server", scrittureOra === scrittureDopoReload, `${scrittureOra - scrittureDopoReload} scritture spontanee`);
    const vPrima = finto.tab("cassettine")[0].v;
    finto.primaDellaProssimaScrittura = (righe) => {
      righe[0].v = righe[0].v + 1;
      righe[0].updated_at = new Date().toISOString();
    };
    // Il click via DOM: il foglio del conflitto compare sopra il tasto un
    // istante dopo, e Playwright, che ricontrolla il bersaglio, si confonde.
    await page.evaluate(() => document.querySelector(".jm-editor-btn.save").click());
    const avviso = page.locator(".jm-conflitto");
    let comparso = true;
    try {
      await avviso.waitFor({ state: "visible", timeout: 20_000 });
    } catch {
      comparso = false;
    }
    check("R7: il server rifiuta e compare l'avviso 'modificata altrove'", comparso);
    check("R7: la versione sul server non e stata sovrascritta", finto.tab("cassettine")[0].v === vPrima + 1, `v=${finto.tab("cassettine")[0].v}`);
    if (comparso) {
      check("R7: l'avviso mostra tutte e due le versioni", (await avviso.locator(".jm-conflitto-ver").count()) === 2);
      check("R7: la frase nuova e evidenziata nella versione di qui", (await avviso.locator(".jm-conflitto-mia mark").count()) >= 1);
      await avviso.locator(".jm-conflitto-tutte").click();
      await avviso.waitFor({ state: "hidden", timeout: 20_000 });
      check("R7: 'tienile tutte e due' scrive sopra la versione corrente", finto.tab("cassettine")[0].v === vPrima + 2, `v=${finto.tab("cassettine")[0].v}`);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator("button:visible", { hasText: /^modifica/ }).first().click({ timeout: 30_000 });
      await page.locator(".jm-editor-textarea").waitFor({ state: "visible", timeout: 15_000 });
      const testo = await page.locator(".jm-editor-textarea").inputValue();
      await page.locator(".jm-editor-btn.cancel").click().catch(() => undefined);
      check("R7: dopo il reload ci sono TUTTE E DUE le versioni, niente perso", testo.includes("Brunilde") && testo.includes("Aggiunta da questo dispositivo") && testo.includes("dall'altra versione"));
      const uscito2 = finto.tuttoCioCheEUscito();
      check("R6 (dopo il conflitto): ancora nessuna parola del testo uscita", !PAROLE_SPIA.some((p) => uscito2.includes(p)) && !uscito2.includes("Aggiunta da questo"));
    }
  }
  check("zero errori di pagina (conflitto)", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

await browser.close();
const ok = results.filter((r) => r.ok).length;
console.log(`\n${ok}/${results.length} PASS`);
process.exit(ok === results.length ? 0 : 1);
