// Banco della linguetta Feedback sull'account di revisione (decisione di
// Manuel del 9 settembre 2026, per gli screenshot dell'App Store).
//
// Cosa deve essere vero, coi finti (dev server su :3100):
//  1. con la sessione di appreview@... la linguetta NON c'e;
//  2. con la sessione di un'altra persona c'e, come sempre;
//  3. da ospite (modalita locale) c'e, e non parte nessuna richiesta;
//  4. la sorgente: la regola e "appreview@" all'inizio dell'email.
import { readFileSync } from "node:fs";
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
const TOKEN = jwtFinto(Math.floor(Date.now() / 1000) + 3600, UTENTE_ID);

async function cloud(email) {
  const finto = new SupabaseFinto();
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: "it-IT" });
  await montaSupabaseFinto(ctx, finto);
  await ctx.addInitScript(({ token, email }) => {
    try {
      window.localStorage.setItem("jm.plan", "free");
      const s = JSON.parse(window.localStorage.getItem("sb-sbfinto-auth-token") || "{}");
      s.access_token = token;
      s.user = { ...(s.user ?? {}), email };
      window.localStorage.setItem("sb-sbfinto-auth-token", JSON.stringify(s));
    } catch {}
  }, { token: TOKEN, email });
  const page = await ctx.newPage();
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  const parole = page.locator(".jm-login-cassa-check input");
  if (await parole.waitFor({ state: "visible", timeout: 15_000 }).then(() => true, () => false)) {
    await parole.check();
    await page.locator("button.btn-primary").click();
  }
  // Il dock: si e dentro l'app.
  await page.locator(".jm-tabbar, nav").first().waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(2000);
  return { ctx, page };
}

const ling = (page) => page.locator(".jm-benv-ling");

/* ============ 1. il revisore ============ */
{
  const { ctx, page } = await cloud("appreview@dayalogue.com");
  check("1 appreview@: la linguetta Feedback NON c'e", (await ling(page).count()) === 0);
  check("1 appreview@: si e davvero dentro l'app (URL /app, non /login)", /\/app(?!\/benvenuto)/.test(page.url()) && !/\/login/.test(page.url()), page.url());
  await ctx.close();
}

/* ============ 2. una persona qualunque ============ */
{
  const { ctx, page } = await cloud("giulia@example.com");
  check("2 un'altra persona: la linguetta c'e", (await ling(page).count()) === 1);
  await ctx.close();
}

/* ============ 3. l'ospite ============ */
{
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: "it-IT" });
  const richieste = [];
  await ctx.route("**/sbfinto.supabase.co/**", (route) => {
    richieste.push(route.request().url());
    return route.fulfill({ status: 500, body: "{}" });
  });
  await ctx.addInitScript(() => {
    try {
      window.localStorage.setItem("jm.mode", "local");
      window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
      window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
      window.localStorage.setItem("jm.welcomeSeen", "1");
    } catch {}
  });
  const page = await ctx.newPage();
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  check("3 ospite: la linguetta c'e", (await ling(page).count()) === 1);
  check("3 ospite: nessuna richiesta verso Supabase", richieste.length === 0, richieste.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ 4. la sorgente ============ */
const src = readFileSync("src/modules/accesso/revisore.ts", "utf8");
check("4 sorgente: la regola e l'email che inizia per appreview@", /\/\^appreview@\/i\.test/.test(src));

await browser.close();
const ko = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - ko}/${results.length} verdi`);
process.exit(ko ? 1 : 0);
