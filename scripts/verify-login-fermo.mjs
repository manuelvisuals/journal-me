// La colonna del login sta ferma fra un passo e l'altro (Manuel, 13
// settembre 2026, su desktop: "logo e box per la mail sono in una posizione,
// ma poi logo e box per il codice sono posizionati in modo diverso").
//
// Prima la colonna era centrata in verticale (`justify-center`) e i due
// passi non erano alti uguali (email 530px, codice 460px): il marchio
// saltava di 35px a ogni cambio di passo, su desktop come sul telefono.
//
// Cosa deve essere vero, misurato a 1440x900, 1280x720 e 390x844:
//  1. marchio, titolo e casella hanno lo STESSO top nel passo email e nel
//     passo del codice (tolleranza 1px);
//  2. il passo email sta dov'era prima del fix (il top della colonna e
//     (altezza - 530) / 2, cioe il centro della vecchia colonna): chi
//     conosceva la schermata non deve accorgersi di niente;
//  3. sotto i 610px di altezza la colonna non va sopra il padding del main
//     (margine zero, si scorre).
//
// Serve il dev server su :3100 (qualunque Supabase: il finto risponde 200 a
// /auth/v1/otp, quindi il passo del codice si raggiunge senza email vera).
//   node scripts/verify-login-fermo.mjs
import { chromium } from "playwright-core";
import { SupabaseFinto, montaSupabaseFinto } from "./lib/supabase-finto.mjs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({ executablePath: EXE });

async function misura(page) {
  return page.evaluate(() => {
    const r = (s) => {
      const e = document.querySelector(s);
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return { top: Math.round(b.top), h: Math.round(b.height) };
    };
    return { marchio: r(".jm-marchio"), h1: r("h1"), input: r("input"), colonna: r(".jm-login-colonna") };
  });
}

async function apri(vp) {
  const ctx = await browser.newContext({ viewport: vp, locale: "it-IT" });
  await montaSupabaseFinto(ctx, new SupabaseFinto({ tabelle: {} }));
  // Senza sessione: /login deve restare /login.
  await ctx.addInitScript(() => {
    try {
      window.localStorage.removeItem("sb-sbfinto-auth-token");
      window.localStorage.setItem("jm.mode", "local");
    } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.waitForSelector("input[type=email]", { timeout: 20_000 });
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}

for (const vp of [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
]) {
  const nome = `${vp.width}x${vp.height}`;
  const { ctx, page, errors } = await apri(vp);
  const email = await misura(page);
  await page.fill("input[type=email]", "banco@dayalogue.test");
  await page.click("button[type=submit]");
  await page.waitForSelector("input[inputmode=numeric]", { timeout: 10_000 });
  await page.waitForTimeout(300);
  const codice = await misura(page);
  const uguale = (a, b) => a && b && Math.abs(a.top - b.top) <= 1;
  check(`1 ${nome} il marchio non si muove fra email e codice`, uguale(email.marchio, codice.marchio), `${email.marchio?.top} -> ${codice.marchio?.top}`);
  check(`1 ${nome} il titolo non si muove`, uguale(email.h1, codice.h1), `${email.h1?.top} -> ${codice.h1?.top}`);
  check(`1 ${nome} la casella non si muove`, uguale(email.input, codice.input), `${email.input?.top} -> ${codice.input?.top}`);
  const atteso = Math.round((vp.height - 530) / 2);
  check(`2 ${nome} il passo email sta dov'era (colonna a ${atteso}px)`, email.colonna && Math.abs(email.colonna.top - atteso) <= 2, `${email.colonna?.top}`);
  check(`1 ${nome} zero errori pagina`, errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

// 3. finestra bassa: margine zero, la colonna parte dal padding del main (40px)
{
  const { ctx, page } = await apri({ width: 1024, height: 560 });
  const m = await misura(page);
  check("3 1024x560 la colonna parte dal padding del main, non sopra", m.colonna && m.colonna.top >= 39 && m.colonna.top <= 41, `${m.colonna?.top}`);
  await ctx.close();
}

await browser.close();
const ko = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - ko}/${results.length} verdi`);
process.exit(ko ? 1 : 0);
