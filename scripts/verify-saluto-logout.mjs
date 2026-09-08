// Banco del saluto dopo il logout (bug segnalato da Manuel l'8 settembre 2026).
//
// Il difetto: premendo "Esci dall'account" il saluto di benvenuto si apriva
// SUBITO, prima della schermata di login. Succedeva perche chi esce torna
// ospite in modalita locale (AuthGate -> chooseLocalMode), e per il saluto
// un ospite e un primo avvio. In piu il logout naviga a /login senza
// ricaricare, e un saluto gia aperto restava li sopra.
//
// Cosa deve essere vero:
//  1. da dentro, il saluto compare (era cosi e resta cosi);
//  2. dopo "Esci" NON compare: ne prima di /login, ne su /login, ne
//     ricaricando come ospite;
//  3. un dispositivo davvero nuovo (contesto vergine) lo vede: il ripiego
//     non deve spegnere il saluto del primo avvio.
//
// Serve il dev server su :3100 con NEXT_PUBLIC_SUPABASE_URL=https://sbfinto.supabase.co.
import { chromium } from "playwright-core";
import { SupabaseFinto, jwtFinto, montaSupabaseFinto, UTENTE_ID } from "./lib/supabase-finto.mjs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const exp = Math.floor(Date.now() / 1000) + 6 * 3600;
const TOKEN = jwtFinto(exp, UTENTE_ID);

async function dispositivo({ dentro }) {
  const finto = new SupabaseFinto();
  finto.tab("profiles").push({ user_id: UTENTE_ID, plan: "free", plan_source: null, current_period_end: null });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: "it-IT" });
  await montaSupabaseFinto(ctx, finto);
  await ctx.addInitScript(
    ({ token, dentro }) => {
      try {
        // Il finto risemina sessione e silenzio a OGNI caricamento: qui la
        // sessione si pianta una volta sola (al secondo caricamento si e
        // ospiti, come dopo un logout vero) e il silenzio non si vuole.
        window.localStorage.removeItem("jm.saluto.silenzio");
        if (!dentro || window.localStorage.getItem("jm.banco.seminato")) {
          window.localStorage.removeItem("sb-sbfinto-auth-token");
          return;
        }
        window.localStorage.setItem("jm.banco.seminato", "1");
        window.localStorage.setItem("jm.mode", "cloud");
        window.localStorage.setItem("jm.plan", "free");
        const s = JSON.parse(window.localStorage.getItem("sb-sbfinto-auth-token") || "{}");
        s.access_token = token;
        window.localStorage.setItem("sb-sbfinto-auth-token", JSON.stringify(s));
      } catch {}
    },
    { token: TOKEN, dentro },
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return { ctx, page, errors };
}

const velo = (page) => page.locator(".jm-benv-sal");
async function compare(page, ms) {
  return velo(page).waitFor({ state: "visible", timeout: ms }).then(() => true, () => false);
}

/* ============ 1. dentro: il saluto c'e, e si chiude ============ */
const { ctx, page, errors } = await dispositivo({ dentro: true });
await page.goto(BASE + "/app/settings", { waitUntil: "domcontentloaded" });
// Contesto vergine: prima del diario c'e il cancello della cassaforte con
// le otto parole. Si passa, come farebbe una persona.
const cassa = page.locator(".jm-login-cassa-h1");
if (await cassa.waitFor({ state: "visible", timeout: 15_000 }).then(() => true, () => false)) {
  await page.waitForFunction(() => [...document.querySelectorAll(".jm-login-cassa-parole li span")].every((s) => !/•/.test(s.textContent)), null, { timeout: 20_000 });
  await page.locator(".jm-login-cassa-check input").check();
  await page.locator("button.btn-primary").click();
}
check("1 dentro: il saluto compare", await compare(page, 30_000));
await page.locator(".jm-benv-sal-b").click();
await velo(page).waitFor({ state: "hidden", timeout: 10_000 });
check("1 dentro: si chiude col tasto", (await velo(page).count()) === 0);

/* ============ 2. Esci: niente saluto, ne prima ne dopo ============ */
const esci = page.locator("button", { hasText: /^(Esci dall'account|Esco\.\.\.)$/ }).first();
await esci.waitFor({ state: "visible", timeout: 15_000 });
await esci.click();
// Il logout naviga a /login senza ricaricare: si guarda per due secondi
// che il velo non spunti nel mezzo, poi che su /login non ci sia.
let spuntato = false;
const t0 = Date.now();
while (Date.now() - t0 < 2500) {
  if ((await velo(page).count()) > 0 && (await velo(page).isVisible().catch(() => false))) {
    spuntato = true;
    break;
  }
  await page.waitForTimeout(100);
}
check("2 esci: il saluto NON spunta durante il logout", !spuntato);
await page.waitForURL(/\/login/, { timeout: 15_000 }).catch(() => undefined);
check("2 esci: si arriva su /login", /\/login/.test(page.url()), page.url());
check("2 esci: su /login niente saluto", !(await compare(page, 3000)));
check("2 esci: la memoria del logout e scritta", (await page.evaluate(() => localStorage.getItem("jm.saluto.uscito"))) === "1");

/* ============ 3. ricaricando come ospite: ancora niente ============ */
await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
check("3 ospite dopo il logout: niente saluto neanche ricaricando", !(await compare(page, 3000)), page.url());
check("nessun errore di pagina", errors.length === 0, errors.slice(0, 2).join(" | "));
await ctx.close();

/* ============ 4. un dispositivo nuovo lo vede ancora ============ */
{
  const { ctx: c2, page: p2 } = await dispositivo({ dentro: false });
  await p2.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  check("4 dispositivo vergine (ospite): il saluto del primo avvio c'e ancora", await compare(p2, 30_000));
  await c2.close();
}

/* ============ 5. la sorgente: la memoria si dimentica al login vero ============ */
{
  const { readFileSync } = await import("node:fs");
  const stato = readFileSync("src/modules/accesso/saluto-stato.ts", "utf8");
  check("5 sorgente: identita() in cloud con sessione dimentica l'uscita", /if \(!sessione\) return null;\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*dimenticaUscita\(\);/.test(stato));
}

await browser.close();
const ko = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - ko}/${results.length} verdi`);
process.exit(ko ? 1 : 0);
