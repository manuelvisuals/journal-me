// Il braccialetto nasce solo con DeviceCheck (audit del 10 settembre 2026,
// decisione 2A di Manuel).
//
// Cosa misura:
//   1. senza token il server rifiuta la nascita (403 solo_app): e il web e
//      il curl; il segreto resta sconosciuto e l'AI risponde 402 solo_app;
//   2. con un token che Apple non riconosce: 403 token_non_valido;
//   3. con un token buono e il bit spento: 200 nato, il bit 0 si accende
//      presso Apple, la riga porta devicecheck = true, l'AI lavora;
//   4. lo stesso dispositivo (stesso token, telefono cancellato e
//      reinstallato senza portachiavi) con un segreto NUOVO: 409
//      regalo_gia_dato, nessuna riga nuova;
//   5. lo stesso segreto ripresentato: 200 gia (niente doppioni);
//   6. dal browser (il guscio finto con window.__jmDeviceCheckFinto) l'app si
//      registra da sola all'avvio e l'AI lavora; dal browser SENZA guscio il
//      muro del regalo dice "si accende dall'app".
//
// Serve un dev server CON DeviceCheck acceso (l'Apple DeviceCheck finto e
// su :3196). Next non fa girare due dev server nella stessa cartella: e lo
// stesso :3100 degli altri banchi, RILANCIATO con la variabile in piu (gli
// altri banchi vanno rilanciati senza, perche qui il web non ha regalo):
//   APPLE_DEVICECHECK_BASE_URL=http://127.0.0.1:3196 \
//   JM_SUPABASE_URL_SERVER=http://127.0.0.1:3198 OPENAI_BASE_URL=http://127.0.0.1:3199 \
//   SUPABASE_SERVICE_ROLE_KEY=finto OPENAI_API_KEY=finto \
//   NEXT_PUBLIC_SUPABASE_URL=https://sbfinto.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=finto-anon-key \
//   ./node_modules/.bin/next dev -p 3100
// poi: node scripts/verify-devicecheck.mjs
import { chromium } from "playwright-core";
import { createHash } from "node:crypto";
import { DeviceCheckFinto, OpenAIFinto, SupabaseFintoServer } from "./lib/finti-server.mjs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const sb = new SupabaseFintoServer();
const oa = new OpenAIFinto();
const dc = new DeviceCheckFinto();
await sb.avvia(3198);
await oa.avvia(3199);
await dc.avvia(3196);

const segreto = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
const hash = (s) => createHash("sha256").update(s, "utf8").digest("hex");

async function registra(seg, token) {
  const r = await fetch(BASE + "/api/ospite/braccialetto", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-jm-braccialetto": seg },
    body: JSON.stringify({ token }),
  });
  let j = {};
  try { j = await r.json(); } catch {}
  return { status: r.status, j };
}

async function ai(seg) {
  const r = await fetch(BASE + "/api/remember/classify", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-jm-braccialetto": seg },
    body: JSON.stringify({ text: "ricordami il pane" }),
  });
  let j = {};
  try { j = await r.json(); } catch {}
  return { status: r.status, j };
}

/* 1. senza token: il web e il curl */
{
  const s = segreto();
  const r = await registra(s, null);
  check("1 senza token la nascita e rifiutata: 403 solo_app", r.status === 403 && r.j.error === "solo_app", JSON.stringify(r.j));
  check("1 nessuna riga e nata", sb.tab("braccialetti").length === 0);
  const a = await ai(s);
  check("1 l'AI per quel segreto risponde 402 regalo_finito motivo solo_app", a.status === 402 && a.j.motivo === "solo_app", JSON.stringify(a.j));
  check("1 OpenAI non e stato chiamato", oa.chiamate.length === 0);
}

/* 2. token che Apple non riconosce */
{
  const r = await registra(segreto(), "non-un-token-apple");
  check("2 token falso: 403 token_non_valido", r.status === 403 && r.j.error === "token_non_valido", JSON.stringify(r.j));
  check("2 il server ha chiesto ad Apple (query_two_bits) e non ha scritto bit", dc.registro.some((x) => x.path === "/v1/query_two_bits") && !dc.registro.some((x) => x.path === "/v1/update_two_bits"));
}

/* 2-bis. la CHIAVE del server sbagliata: e un guasto nostro, non del token */
{
  dc.chiaveRotta = true;
  const seg = segreto();
  const r = await registra(seg, "dc-dispositivo-vero");
  check("2-bis chiave del server sbagliata (401 da Apple): 503 devicecheck_non_disponibile, NON token_non_valido", r.status === 503 && r.j.error === "devicecheck_non_disponibile", JSON.stringify(r.j));
  check("2-bis nessuna riga nasce e nessun bit viene scritto", sb.tab("braccialetti").length === 0 && dc.bit.size === 0);
  // La differenza che conta: con la chiave buona lo STESSO token inventato
  // da 403. E cosi che si verifica dall'esterno se la chiave su Vercel vale.
  dc.chiaveRotta = false;
  const r2 = await registra(segreto(), "non-un-token-apple");
  check("2-bis con la chiave buona un token inventato da 403 token_non_valido (il probe della produzione)", r2.status === 403 && r2.j.error === "token_non_valido", JSON.stringify(r2.j));
}

/* 3. token buono, bit spento: nasce */
const tokenA = "dc-dispositivo-A";
const segA = segreto();
{
  const r = await registra(segA, tokenA);
  check("3 token buono e bit spento: 200 nato, devicecheck true", r.status === 200 && r.j.esito === "nato" && r.j.devicecheck === true, JSON.stringify(r.j));
  const riga = sb.tab("braccialetti").find((b) => b.segreto_hash === hash(segA));
  check("3 la riga porta devicecheck = true e l'hash, non il segreto", !!riga && riga.devicecheck === true && !JSON.stringify(sb.tabelle).includes(segA));
  check("3 presso Apple il bit 0 e acceso per quel dispositivo", dc.bit.get(tokenA)?.bit0 === true);
  const a = await ai(segA);
  check("3 l'AI lavora per il braccialetto nato (200) e spende una giornata", a.status === 200 && sb.tab("braccialetto_giornate").filter((g) => g.braccialetto_id === riga.id).length === 1, String(a.status));
}

/* 4. stesso dispositivo, segreto nuovo (telefono cancellato): niente secondo regalo */
{
  const r = await registra(segreto(), tokenA);
  check("4 stesso dispositivo con un segreto nuovo: 409 regalo_gia_dato", r.status === 409 && r.j.error === "regalo_gia_dato", JSON.stringify(r.j));
  check("4 nessuna riga nuova", sb.tab("braccialetti").length === 1, String(sb.tab("braccialetti").length));
}

/* 5. stesso segreto ripresentato (l'avvio di ogni giorno): gia */
{
  const r = await registra(segA, tokenA);
  check("5 lo stesso segreto ripresentato: 200 gia, nessun doppione", r.status === 200 && r.j.esito === "gia" && sb.tab("braccialetti").length === 1, JSON.stringify(r.j));
  // Anche senza token: chi e gia nato non ha bisogno di dimostrare niente
  // (un iPad che trova il braccialetto nel portachiavi).
  const r2 = await registra(segA, null);
  check("5 lo stesso segreto senza token (l'iPad dal portachiavi): 200 gia", r2.status === 200 && r2.j.esito === "gia", JSON.stringify(r2.j));
}

/* 6. dal browser: il guscio finto si registra da solo; il web no */
{
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
  const apri = async ({ guscio }) => {
    // Sul computer: sul telefono l'editor sta dietro "Scrivi a mano", qui si vuole la textarea.
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "it-IT" });
    await ctx.route("**/sbfinto.supabase.co/**", (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
    await ctx.addInitScript(({ guscio }) => {
      try {
        window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
        window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
      } catch {}
      if (guscio) {
        window.__jmDeviceCheckFinto = { token: async () => ({ token: "dc-browser-" + Math.random().toString(36).slice(2) }) };
      }
    }, { guscio });
    const page = await ctx.newPage();
    const risposte = [];
    page.on("response", (r) => { if (r.url().includes("/api/ospite/braccialetto")) risposte.push(r.status()); });
    await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
    // La prima apertura compila la pagina: il dev server puo volerci un minuto.
    await page.locator(".jm-ed-ta").waitFor({ state: "visible", timeout: 90_000 });
    await page.waitForTimeout(2000);
    return { ctx, page, risposte };
  };

  const righePrima = sb.tab("braccialetti").length;
  const g = await apri({ guscio: true });
  check("6 guscio: all'avvio l'app si registra da sola (200)", g.risposte.includes(200) && sb.tab("braccialetti").length === righePrima + 1, g.risposte.join(","));
  await g.page.locator(".jm-ed-ta").click();
  await g.page.keyboard.type("Prima giornata dal guscio finto, con DeviceCheck.");
  await g.page.keyboard.press("Control+Enter");
  await g.page.locator(".jm-fv-h").waitFor({ state: "visible", timeout: 30_000 });
  await g.page.waitForTimeout(800);
  const titolo = await g.page.locator(".jm-fv-h").innerText();
  check("6 guscio: l'AI lavora (titolo dell'OpenAI finto)", /giornata da ospite/i.test(titolo), titolo);
  await g.ctx.close();

  const w = await apri({ guscio: false });
  check("6 web: la registrazione all'avvio e rifiutata (403) e non nasce niente", w.risposte.includes(403) && sb.tab("braccialetti").length === righePrima + 1, w.risposte.join(","));
  await w.page.locator(".jm-ed-ta").click();
  await w.page.keyboard.type("Prima giornata dal web, senza guscio.");
  await w.page.keyboard.press("Control+Enter");
  await w.page.locator(".jm-wall").waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
  const muro = await w.page.locator(".jm-wall").innerText().catch(() => "");
  check("6 web: il muro del regalo dice che l'AI si accende dall'app", /si accende dall'app/.test(muro) && /nell'app per iPhone/.test(muro) && /Continua senza AI/.test(muro), muro.replace(/\s+/g, " ").slice(0, 120));
  await w.page.locator(".jm-wall .btn-ghost").click().catch(() => {});
  await w.page.waitForTimeout(800);
  check("6 web: la giornata si e salvata lo stesso, a mano", /Prima giornata dal web/.test(await w.page.locator("main").innerText()));
  await w.ctx.close();
  await browser.close();
}

await sb.ferma();
await oa.ferma();
await dc.ferma();

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} PASS`);
process.exit(passed === results.length ? 0 : 1);
