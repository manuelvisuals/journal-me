// La linguetta Feedback porta all'assistenza (13 settembre 2026, scelta di
// Manuel sul mockup MOCKUP-supporto-e-feedback.html, opzione C).
//
// Cosa deve essere vero:
//  1. l'indirizzo, da solo: relativo sul web e intero dentro il guscio, la
//     lingua sceglie /support o /en/support, e cio che non c'e non finisce
//     nell'indirizzo (niente "email=" vuoto);
//  2. dal vivo coi finti (dev server su :3100): con la sessione la
//     linguetta e un link all'assistenza con l'email gia dentro; da ospite
//     e un link senza email e senza una richiesta di rete;
//  3. il pannello admin vince ancora, ma solo con un indirizzo DIVERSO
//     dalle nostre pagine: il suo valore di fabbrica e gia "/support", che
//     dentro il guscio iOS non esiste nemmeno.
//
// LIMITE DICHIARATO: il caso "sessione in tasca" non si prova qui dal
// vivo. Coi finti la linguetta non arriva a montarsi in modalita cloud, e
// non e colpa di questa modifica: succede identico su main (verify-
// linguetta-revisore, caso 2, rosso anche li). Quello che resta provato
// dal vivo e l'ospite; l'email nell'indirizzo e provata sull'indirizzo.
//
//   node --experimental-strip-types scripts/verify-linguetta-assistenza.mjs
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { indirizzoAssistenza, destinazioneLinguetta, SITO } from "../src/modules/accesso/assistenza-url.ts";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

/* ============ 1. l'indirizzo, da solo ============ */
const web = indirizzoAssistenza({ nativo: false, lingua: "it", email: "a@b.it", versione: "1.0 (10)", schermata: "/app/mese" });
check("1 sul web e relativo (si resta dove si e)", web.startsWith("/support?"), web);
check("1 sul web porta email, versione e schermata", /da=app/.test(web) && /email=a%40b\.it/.test(web) && /v=1\.0\+%2810%29/.test(web) && /s=%2Fapp%2Fmese/.test(web), web);
const nativo = indirizzoAssistenza({ nativo: true, lingua: "it", email: "a@b.it" });
check("1 nel guscio l'indirizzo e intero (li /support non esiste)", nativo.startsWith(`${SITO}/support?`), nativo);
const inglese = indirizzoAssistenza({ nativo: false, lingua: "en" });
check("1 in inglese si va su /en/support", inglese.startsWith("/en/support?"), inglese);
check("1 cio che non c'e non finisce nell'indirizzo", !/email=/.test(inglese) && !/v=/.test(inglese) && !/s=/.test(inglese), inglese);
check("1 da dove si arriva c'e sempre", /(\?|&)da=app/.test(inglese), inglese);
const vuoti = indirizzoAssistenza({ nativo: false, lingua: "it", email: "", versione: null, schermata: undefined });
check("1 i campi vuoti valgono come assenti", vuoti === "/support?da=app", vuoti);

/* ============ 2. dal vivo, coi finti ============ */
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

const ling = (page) => page.locator(".jm-benv-ling");

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
  const href = (await ling(page).count()) ? await ling(page).getAttribute("href") : null;
  check("2 ospite: la linguetta porta all'assistenza lo stesso", (href ?? "").startsWith("/support?"), String(href));
  check("2 ospite: nessuna email nell'indirizzo (non ne ha una)", !/email=/.test(href ?? ""), String(href));
  check("2 ospite: nessuna richiesta verso Supabase", richieste.length === 0, richieste.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ 3. il pannello vince, ma non su casa nostra ============ */
const o = { nativo: false, lingua: "it", email: "a@b.it" };
check("3 il valore di fabbrica (/support) viene rifatto", destinazioneLinguetta("/support", o) === "/support?da=app&email=a%40b.it", destinazioneLinguetta("/support", o));
check("3 anche /en/support viene rifatto", destinazioneLinguetta("/en/support", { ...o, lingua: "en" }).startsWith("/en/support?da=app"));
check("3 il pannello vuoto: lo rifacciamo noi", destinazioneLinguetta("", o).startsWith("/support?da=app"));
check("3 un indirizzo suo si rispetta e non si tocca", destinazioneLinguetta("https://esempio.it/aiuto", o) === "https://esempio.it/aiuto");
check("3 un indirizzo suo di app si rispetta", destinazioneLinguetta("/app/settings", o) === "/app/settings");
const src = readFileSync("src/modules/accesso/components/linguetta.tsx", "utf8");
check("3 la linguetta passa dal pannello", /destinazioneLinguetta\(contattoUrlNoto\(\)/.test(src));
check("3 un indirizzo di fuori si apre in una scheda nuova", /\^https\?:/.test(src) && /target: "_blank"/.test(src));
const hook = readFileSync("src/modules/accesso/assistenza.ts", "utf8");
check("3 da ospite non si monta nessun client (niente rete in locale)", /if \(mode !== "cloud"\) return;/.test(hook));

await browser.close();
const ko = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - ko}/${results.length} verdi`);
process.exit(ko ? 1 : 0);
