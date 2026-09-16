// La registrazione a blocchi DAL VIVO, nel browser: l'anello e il numero
// del blocco seguono il tasto premuto (si fermano quando lo lasci), il
// ritmo reale in byte al secondo si misura dai pezzi del MediaRecorder, e
// con JM_LUNGO=1 si tiene premuto oltre i 3 minuti per vedere il blocco
// chiudersi da solo, il secondo aprirsi sulla stessa traccia, e i due
// testi cucirsi in ordine con il contesto passato al secondo.
//
// L'anello (15 settembre 2026, PROMPT-REGISTRAZIONE-ANELLO.md) ha
// sostituito la barra del blocco e i due orologi: qui si legge la sua
// frazione (aria-valuenow) e il numero del conto alla rovescia, non piu
// una barra e una riga di testo con "Blocco N".
//
// La matematica pura sta in verify-registrazione-blocchi.mjs: qui si prova
// che l'overlay la usi davvero, con un microfono sintetico (oscillatore) e
// un /api/transcribe-fallback finto che risponde un testo diverso a ogni
// chiamata e annota se ha ricevuto il campo `contesto`.
//
// Serve un dev server su :3100 con NEXT_PUBLIC_SUPABASE_URL=https://sbfinto.supabase.co.
//   node scripts/verify-registrazione-blocchi-vivo.mjs
//   JM_LUNGO=1 node scripts/verify-registrazione-blocchi-vivo.mjs   (~4 minuti)
import { chromium } from "playwright-core";
import { SupabaseFinto, sessioneFinta } from "./lib/supabase-finto.mjs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const SB_HOST = "sbfinto.supabase.co";
const LUNGO = process.env.JM_LUNGO === "1";

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
  const finto = new SupabaseFinto();
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
      window.localStorage.setItem("jm.saluto.silenzio", "sid:banco#v1");
      window.localStorage.setItem("journalme-rec-primer", "1");
    } catch {}
  }, sessione);
  await ctx.route(`**/${SB_HOST}/**`, (route) => finto.gestisci(route));

  // La trascrizione finta: ogni POST risponde "blocco N" e annota il
  // contesto ricevuto (il campo multipart `contesto`).
  const chiamate = [];
  await ctx.route("**/api/transcribe-fallback", (route) => {
    const req = route.request();
    if (req.method() !== "POST") {
      return route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
    }
    const corpo = req.postDataBuffer()?.toString("latin1") ?? "";
    const m = corpo.match(/name="contesto"\r\n\r\n([\s\S]*?)\r\n--/);
    const peso = corpo.length;
    chiamate.push({ contesto: m ? m[1] : null, peso, quando: Date.now() });
    const n = chiamate.length;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ text: `Testo del blocco ${n} con il nome Karya.` }),
    });
  });

  const page = await ctx.newPage();
  const errors = [];
  const log = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    const t = m.text();
    if (t.startsWith("[rec]")) log.push(t);
  });
  return { ctx, page, errors, log, chiamate };
}

async function apriAscolto(page) {
  await page.goto(BASE + "/app?record=1", { waitUntil: "domcontentloaded" });
  await page.locator(".jm-login-cassa-check input").check({ timeout: 30_000 });
  await page.locator("button.btn-primary").click();
  const ptt = page.locator(".rec-ptt");
  await ptt.waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForFunction(
    () => {
      const b = document.querySelector(".rec-ptt");
      return b && !b.disabled;
    },
    null,
    { timeout: 15_000 },
  );
  return ptt;
}

const leggiBlocco = (page) =>
  page.evaluate(() => {
    const anello = document.querySelector(".jm-rec-anello");
    const resta = document.querySelector(".jm-rec-resta");
    const pezzi = document.querySelectorAll(".jm-rec-pezzi span");
    return {
      pct: anello ? Number(anello.getAttribute("aria-valuenow")) : -1,
      resta: resta ? resta.textContent : "",
      avviso: resta ? resta.classList.contains("jm-rec-resta-avviso") : false,
      pezzi: pezzi.length,
    };
  });

// "2:37" -> 157 secondi. Confronta il conto alla rovescia con una
// tolleranza di un paio di secondi, senza pretendere il millisecondo
// esatto del browser (lo stesso spirito delle vecchie regex "00:04").
function restaSecondi(testo) {
  const m = /^(\d+):(\d\d)$/.exec(testo ?? "");
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/* ============ 1. l'anello e il numero seguono il tasto ============ */
{
  const { ctx, page, errors, log, chiamate } = await pagina();
  const ptt = await apriAscolto(page);
  const prima = await leggiBlocco(page);
  check("l'anello e il numero sono visibili PRIMA di cominciare, a 3:00", prima.resta === "3:00", prima.resta);
  check("...vuoto (0%)", prima.pct === 0, String(prima.pct));
  check("...zero pezzi chiusi", prima.pezzi === 0, String(prima.pezzi));

  const box = await ptt.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(4_200);
  const durante = await leggiBlocco(page);
  await page.mouse.up();
  await page.waitForTimeout(300);
  const lasciato = await leggiBlocco(page);
  await page.waitForTimeout(2_500);
  const dopo = await leggiBlocco(page);

  const restaDurante = restaSecondi(durante.resta);
  check("mentre e premuto il numero scende (circa 176 s restanti su 180)", restaDurante !== null && restaDurante <= 178 && restaDurante >= 174, durante.resta);
  check("mentre e premuto l'anello avanza", durante.pct >= 2, String(durante.pct));
  check("lasciato il tasto l'anello e il numero si FERMANO", dopo.pct === lasciato.pct && dopo.resta === lasciato.resta, `${lasciato.pct}/${lasciato.resta} -> ${dopo.pct}/${dopo.resta}`);
  const bodyDopo = await page.evaluate(() => document.body.innerText);
  check("il totale non appare mentre si registra (decisione 5A)", !/hai raccontato/i.test(bodyDopo));

  // Secondo tratto: il tempo riparte da dove era.
  await page.mouse.down();
  await page.waitForTimeout(2_200);
  await page.mouse.up();
  await page.waitForTimeout(300);
  const secondo = await leggiBlocco(page);
  const restaSecondo = restaSecondi(secondo.resta);
  check("ripremuto, il numero riparte da dove era (circa 174 s restanti)", restaSecondo !== null && restaSecondo <= 176 && restaSecondo >= 172, secondo.resta);

  await page.getByRole("button", { name: /Fine e salva/ }).click();
  // La rilettura mette il testo in una textarea: innerText non lo vede.
  await page.waitForFunction(() => /Karya/.test(document.querySelector("textarea")?.value ?? ""), null, { timeout: 20_000 }).catch(() => {});
  const testo = await page.evaluate(() => document.querySelector("textarea")?.value ?? "");
  check("un blocco solo: una chiamata, senza contesto", chiamate.length === 1 && chiamate[0].contesto === null, JSON.stringify(chiamate));
  check("il testo arriva alla rilettura", /Testo del blocco 1/.test(testo));
  const armato = log.find((l) => /armed mime=.* bps=/.test(l)) ?? "";
  check("il registratore e stato armato con la qualita chiesta", /bps=(32000|64000)/.test(armato), armato);
  const fine = log.find((l) => /^\[rec\] fine: /.test(l)) ?? "";
  const byte = Number(fine.match(/, (\d+) byte/)?.[1] ?? 0);
  // ~6 s incisi: il ritmo reale, misurato. A Opus 32 kbit/s = ~4.000 B/s.
  const bps = byte / 6;
  check("ritmo reale misurato: sotto i 10 KB/s (era 29,7 KB/s di fabbrica)", byte > 0 && bps < 10_000, `${byte} byte in ~6 s = ${Math.round(bps)} B/s`);
  console.log(`  ritmo reale misurato in Chromium: ${Math.round(bps)} byte/s (${Math.round((bps * 8) / 1000)} kbit/s); multipart ${chiamate[0]?.peso} byte`);
  check("zero errori di pagina", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ 2. (JM_LUNGO) il blocco si chiude da solo a 3 minuti ============ */
if (LUNGO) {
  const { ctx, page, errors, log, chiamate } = await pagina();
  const ptt = await apriAscolto(page);
  const box = await ptt.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  // 3 minuti e 8 secondi premuti senza mai lasciare.
  const t0 = Date.now();
  let chiusoA = null;
  while (Date.now() - t0 < 188_000) {
    await page.waitForTimeout(1_000);
    if (chiusoA === null && log.some((l) => /blocco 1 chiuso \(tempo\)/.test(l))) chiusoA = Date.now() - t0;
  }
  const durante = await leggiBlocco(page);
  await page.mouse.up();
  await page.waitForTimeout(500);
  const chiusura = log.find((l) => /blocco 1 chiuso/.test(l)) ?? "";
  check("a 3 minuti il blocco 1 si chiude DA SOLO, per tempo", /chiuso \(tempo\)/.test(chiusura), chiusura);
  check("...intorno ai 180 s premuti", chiusoA !== null && chiusoA >= 179_000 && chiusoA <= 184_000, `${chiusoA} ms`);
  const restaDurante2 = restaSecondi(durante.resta);
  check("il blocco 2 e aperto e il numero e ripartito da quasi 3:00", restaDurante2 !== null && restaDurante2 >= 170, durante.resta);
  check("un trattino segna il blocco 1 chiuso", durante.pezzi === 1, String(durante.pezzi));
  check("il blocco 2 e stato armato ATTIVO (tasto ancora premuto)", log.some((l) => /armed .*state=recording blocco=2/.test(l)), log.filter((l) => /armed/.test(l)).join(" | "));
  const byte1 = Number(chiusura.match(/byte=(\d+)/)?.[1] ?? 0);
  console.log(`  blocco pieno (180 s a Opus 32): ${byte1} byte = ${(byte1 / 1_000_000).toFixed(2)} MB, ${Math.round(byte1 / 180)} B/s`);
  check("un blocco pieno pesa molto meno del tetto di 3,5 MB", byte1 > 0 && byte1 < 1_500_000, `${byte1} byte`);

  // La catena: il blocco 1 deve essere gia stato mandato PRIMA di Fine.
  check("il blocco 1 e stato trascritto MENTRE si registrava il 2 (prima di Fine)", chiamate.length === 1, `${chiamate.length} chiamate prima di Fine`);
  const tFine = Date.now();
  await page.getByRole("button", { name: /Fine e salva/ }).click();
  await page.waitForFunction(() => /blocco 2/.test(document.querySelector("textarea")?.value ?? ""), null, { timeout: 60_000 }).catch(() => {});
  check("a Fine parte solo l'ultimo blocco", chiamate.length === 2 && chiamate[1].quando >= tFine && chiamate[0].quando < tFine);
  const testo = await page.evaluate(() => document.querySelector("textarea")?.value ?? "");
  check("due blocchi: due chiamate", chiamate.length === 2, String(chiamate.length));
  check("la seconda chiamata porta la coda del primo testo come contesto", chiamate[1] && /Karya/.test(chiamate[1].contesto ?? ""), JSON.stringify(chiamate[1]));
  check("i due testi sono cuciti in ordine con uno spazio", /Testo del blocco 1 con il nome Karya\. Testo del blocco 2/.test(testo));
  check("zero errori di pagina", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
} else {
  console.log("  (JM_LUNGO=1 per la prova del blocco che si chiude a 3 minuti)");
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
if (failed.length) {
  console.log("FALLITI:\n" + failed.map((f) => "  - " + f.name).join("\n"));
  process.exit(1);
}
