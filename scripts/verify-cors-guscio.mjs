// Banco del preflight del guscio iOS (12 settembre 2026).
//
// IL BUG CHE LO HA FATTO NASCERE. Dentro il guscio l'app vive su
// capacitor://localhost e le route /api stanno su Vercel: origini diverse,
// quindi ogni POST con un header custom fa partire un preflight OPTIONS, e
// il browser lascia passare la chiamata SOLO se ogni header che manda sta
// in Access-Control-Allow-Headers (next.config.ts). Un header non elencato
// non produce un 4xx: la fetch muore PRIMA di partire, e WebKit dice solo
// "Load failed". Il 10 settembre apiFetch ha iniziato a mandare x-jm-giorno
// (decisione 4A, il giorno del diario che il regalo conta) e nessuno lo ha
// aggiunto alla lista: sul telefono di Manuel process-entry ed extract-facts
// morivano cosi, in silenzio, mentre la trascrizione (che quell'header non
// lo manda) funzionava. Il 4 settembre era successo lo stesso con
// x-jm-braccialetto, e il banco dell'ospite controllava SOLO quello, per
// nome: il terzo header e passato sotto.
//
// Cosa pretende questo banco, in due parti:
//   1. STATICA (sempre): ogni header che il client mette su una chiamata
//      /api - quelli di apiFetch (src/lib/api.ts) e ogni stringa "x-jm-*"
//      nel codice client - deve stare nella lista di next.config.ts. Non
//      per nome: TUTTI. Il prossimo header non passa sotto.
//   2. VIVA (se un dev server risponde su JM_BASE): un Chromium apre una
//      pagina su un'ALTRA origine e fa la stessa fetch che fa il telefono,
//      con tutti gli header. Se il preflight e bocciato la fetch lancia
//      TypeError, esattamente come sul telefono; se passa, arriva una
//      risposta HTTP (qualunque status: e il preflight che si prova qui,
//      non la guardia).
//
// Uso:  node scripts/verify-cors-guscio.mjs
//       (con il dev server su :3100 - vedi la testa di verify-ospite.mjs -
//       gira anche la parte viva; senza, gira solo la statica)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "node:http";

// 127.0.0.1 e non localhost: la fetch di Node prova prima ::1, dove il dev server non ascolta.
const BASE = process.env.JM_BASE ?? "http://127.0.0.1:3100";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

/* ---------------------------- 1. la parte statica ---------------------------- */

/** La lista ammessa in next.config.ts, in minuscolo (i nomi degli header non hanno maiuscole). */
function headerAmmessi() {
  const cfg = readFileSync("next.config.ts", "utf8");
  const m = cfg.match(/key:\s*"Access-Control-Allow-Headers",[\s\S]*?value:\s*"([^"]+)"/);
  if (!m) return null;
  return m[1].split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/** Le costanti HEADER_* = "..." di src/lib/regalo.ts (e di chiunque altro le definisca in src/lib). */
function costantiHeader() {
  const out = new Map();
  for (const f of fileSorgente("src/lib")) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/export const (HEADER_[A-Z_]+)\s*=\s*"([^"]+)"/g)) out.set(m[1], m[2]);
  }
  return out;
}

function* fileSorgente(dir) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) yield* fileSorgente(p);
    else if (/\.(ts|tsx)$/.test(nome)) yield p;
  }
}

/** Gli header che apiFetch mette su ogni chiamata: merged.set("...") e merged.set(HEADER_X). */
function headerDiApiFetch() {
  const src = readFileSync("src/lib/api.ts", "utf8");
  const costanti = costantiHeader();
  const nomi = new Set();
  for (const m of src.matchAll(/merged\.set\(\s*"([^"]+)"/g)) nomi.add(m[1].toLowerCase());
  for (const m of src.matchAll(/merged\.set\(\s*(HEADER_[A-Z_]+)/g)) {
    const v = costanti.get(m[1]);
    nomi.add(v ? v.toLowerCase() : `?${m[1]}`);
  }
  return nomi;
}

/** Ogni stringa "x-jm-*" nel codice sorgente: la rete sotto la rete. */
function tuttiGliXjm() {
  const nomi = new Set();
  for (const f of fileSorgente("src")) {
    for (const m of readFileSync(f, "utf8").matchAll(/"(x-jm-[a-z0-9-]+)"/gi)) nomi.add(m[1].toLowerCase());
  }
  return nomi;
}

const ammessi = headerAmmessi();
check("next.config.ts ha una lista Access-Control-Allow-Headers leggibile", Array.isArray(ammessi), ammessi ? ammessi.join(", ") : "non trovata");

const daApiFetch = headerDiApiFetch();
check("apiFetch mette almeno un header custom (il banco legge il file giusto)", daApiFetch.size >= 2, [...daApiFetch].join(", "));
for (const h of daApiFetch) {
  check(`preflight: "${h}" (messo da apiFetch) e fra gli header ammessi`, ammessi?.includes(h) ?? false);
}
for (const h of tuttiGliXjm()) {
  if (daApiFetch.has(h)) continue;
  check(`preflight: "${h}" (stringa x-jm-* nel codice) e fra gli header ammessi`, ammessi?.includes(h) ?? false);
}
// Content-Type lo mettono i chiamanti (JSON); senza, ogni POST JSON muore.
check(`preflight: "content-type" e fra gli header ammessi`, ammessi?.includes("content-type") ?? false);

/* ----------------------------- 2. la parte viva ----------------------------- */

async function devServerRisponde() {
  try {
    const r = await fetch(BASE + "/api/ospite/stato", { signal: AbortSignal.timeout(30_000) });
    return r.status > 0;
  } catch {
    return false;
  }
}

async function parteViva() {
  if (!(await devServerRisponde())) {
    console.log(`SKIP  parte viva: nessun dev server su ${BASE} (solo la statica)`);
    return;
  }
  let chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch {
    console.log("SKIP  parte viva: playwright-core non installato (npm install --no-save playwright-core)");
    return;
  }
  // Un'altra origine, come capacitor://localhost lo e per Vercel.
  const altra = createServer((_, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end("<!doctype html><title>altra origine</title>ok");
  });
  await new Promise((ok) => altra.listen(0, "127.0.0.1", ok));
  const porta = altra.address().port;
  const browser = await chromium.launch({ executablePath: EXE });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${porta}/`);
    const headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer gettone-finto",
    };
    for (const h of daApiFetch) if (h !== "authorization") headers[h] = h === "x-jm-giorno" ? "2026-09-12" : "finto";
    // Il controllo: la stessa fetch SENZA gli header custom passa sempre.
    // E il motivo per cui sul telefono la trascrizione (che manda solo il
    // gettone e la lingua) funzionava mentre l'analisi moriva: se anche
    // questa muore, il guasto non e la lista degli header ma il server.
    const controllo = await page.evaluate(
      async ({ url }) => {
        try {
          const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
          return { ok: true, status: r.status };
        } catch (e) {
          return { ok: false, errore: String(e && e.message ? e.message : e) };
        }
      },
      { url: BASE + "/api/process-entry" },
    );
    check("controllo: la stessa fetch senza header custom passa (il server c'e, il preflight e l'unica variabile)", controllo.ok, controllo.ok ? `HTTP ${controllo.status}` : controllo.errore);
    for (const route of ["/api/process-entry", "/api/extract-facts", "/api/transcribe-fallback"]) {
      const esito = await page.evaluate(
        async ({ url, headers }) => {
          try {
            const r = await fetch(url, { method: "POST", headers, body: "{}" });
            return { ok: true, status: r.status };
          } catch (e) {
            return { ok: false, errore: String(e && e.message ? e.message : e) };
          }
        },
        { url: BASE + route, headers },
      );
      check(
        `preflight vivo: POST ${route} da un'altra origine con tutti gli header di apiFetch NON muore prima di partire`,
        esito.ok,
        esito.ok ? `HTTP ${esito.status}` : esito.errore,
      );
    }
  } finally {
    await browser.close();
    altra.close();
  }
}

await parteViva();

const falliti = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - falliti}/${results.length} verdi${falliti ? `, ${falliti} ROSSI` : ""}`);
process.exit(falliti ? 1 : 0);
