// La registrazione a blocchi DAL VIVO, nel browser: la barra e l'orologio
// del blocco seguono il tasto premuto (si fermano quando lo lasci), il
// ritmo reale in byte al secondo si misura dai pezzi del MediaRecorder, e
// con JM_LUNGO=1 si tiene premuto oltre i 3 minuti per vedere il blocco
// chiudersi da solo, il secondo aprirsi sulla stessa traccia, e i due
// testi cucirsi in ordine con il contesto passato al secondo.
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
    chiamate.push({ contesto: m ? m[1] : null, peso });
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
    const barra = document.querySelector(".jm-rec-blocco-barra");
    const riga = document.querySelector(".jm-rec-blocco-riga");
    const wrap = document.querySelector(".jm-rec-blocco");
    return {
      pct: barra ? Number(barra.getAttribute("aria-valuenow")) : -1,
      riga: riga ? riga.textContent : "",
      visibile: wrap ? !wrap.classList.contains("jm-rec-blocco-nascosta") : false,
      orologio: document.body.innerText.match(/\b(\d\d:\d\d)\b/)?.[1] ?? "",
    };
  });

/* ============ 1. barra e orologio seguono il tasto ============ */
{
  const { ctx, page, errors, log, chiamate } = await pagina();
  const ptt = await apriAscolto(page);
  const prima = await leggiBlocco(page);
  check("la barra del blocco e visibile PRIMA di cominciare", prima.visibile);
  check("...e dice blocco 1, 00:00 su 03:00", /Blocco 1/i.test(prima.riga) && /00:00/.test(prima.riga) && /03:00/.test(prima.riga), prima.riga);
  check("...vuota", prima.pct === 0, String(prima.pct));

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

  check("mentre e premuto l'orologio del blocco scorre (00:04)", /00:04/.test(durante.riga), durante.riga);
  check("mentre e premuto la barra avanza", durante.pct >= 2, String(durante.pct));
  check("lasciato il tasto la barra si FERMA", dopo.pct === lasciato.pct && dopo.riga === lasciato.riga, `${lasciato.pct} -> ${dopo.pct}`);
  check("l'orologio grande segna il totale inciso, non quello a muro", /00:04/.test(dopo.orologio), dopo.orologio);

  // Secondo tratto: il tempo riparte da dove era.
  await page.mouse.down();
  await page.waitForTimeout(2_200);
  await page.mouse.up();
  await page.waitForTimeout(300);
  const secondo = await leggiBlocco(page);
  check("ripremuto, riparte da dove era (00:06)", /00:06/.test(secondo.riga), secondo.riga);

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
  check("il blocco 2 e aperto e l'orologio del blocco e ripartito", /Blocco 2/i.test(durante.riga) && /00:0\d/.test(durante.riga), durante.riga);
  check("il blocco 2 e stato armato ATTIVO (tasto ancora premuto)", log.some((l) => /armed .*state=recording blocco=2/.test(l)), log.filter((l) => /armed/.test(l)).join(" | "));
  const byte1 = Number(chiusura.match(/byte=(\d+)/)?.[1] ?? 0);
  console.log(`  blocco pieno (180 s a Opus 32): ${byte1} byte = ${(byte1 / 1_000_000).toFixed(2)} MB, ${Math.round(byte1 / 180)} B/s`);
  check("un blocco pieno pesa molto meno del tetto di 3,5 MB", byte1 > 0 && byte1 < 1_500_000, `${byte1} byte`);

  await page.getByRole("button", { name: /Fine e salva/ }).click();
  await page.waitForFunction(() => /blocco 2/.test(document.querySelector("textarea")?.value ?? ""), null, { timeout: 60_000 }).catch(() => {});
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
