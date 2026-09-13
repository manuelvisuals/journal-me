// Verifica della voce "Iscritti" in /admin (13 settembre 2026; mockup
// design/mockups/admin-iscritti.html v2, scelte di Manuel A2 B2 C2):
//
//   1  la voce c'e nella rail, col numero degli account;
//   2  i quattro numeri in cima arrivano dal server (account, premium,
//      ospiti attivi, AI del mese in euro);
//   3  l'elenco: cinque colonne, di fabbrica gli ultimi iscritti in cima
//      (C2), un clic sull'intestazione ordina e il secondo rovescia;
//   4  la ricerca filtra per email e nome;
//   5  la scheda Ospiti: braccialetti con giornate usate e l'esito;
//   6  l'ispettore: cliccando una riga, i dati della persona; il piano si
//      cambia a mano (PUT) e il server scrive plan_source = manual; per chi
//      paga con Apple il segmented e spento e il server risponde 409;
//   7  chi non e admin riceve 404 dalla rotta;
//   8  zero errori pagina.
//
// Il server parla con un Supabase FINTO (finti-server.mjs, porta 3198), che
// dal 13 settembre serve anche /auth/v1/admin/users. Dev server come per
// verify-ospite-schermate.mjs:
//
//   JM_SUPABASE_URL_SERVER=http://127.0.0.1:3198 OPENAI_BASE_URL=http://127.0.0.1:3199 \
//   SUPABASE_SERVICE_ROLE_KEY=finto OPENAI_API_KEY=finto \
//   NEXT_PUBLIC_SUPABASE_URL=https://sbfinto.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=finto-anon-key \
//   ./node_modules/.bin/next dev -p 3100
//
// poi: node scripts/verify-iscritti.mjs
import { chromium } from "playwright-core";
import { SupabaseFintoServer, OpenAIFinto } from "./lib/finti-server.mjs";
import { SupabaseFinto, jwtFinto, montaSupabaseFinto, UTENTE_ID } from "./lib/supabase-finto.mjs";

const EXE = process.env.JM_CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const sb = new SupabaseFintoServer();
const oa = new OpenAIFinto();
await sb.avvia(3198);
await oa.avvia(3199);

/* ------------ i dati finti: sei account, tre ospiti ------------ */
const GIORNO = 86_400_000;
const ora = Date.now();
const iso = (msFa) => new Date(ora - msFa).toISOString();
const ID = (n) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;
const ADMIN = UTENTE_ID;

sb.accountAuth = [
  { id: ADMIN, email: "madh52@gmail.com", created_at: iso(32 * GIORNO), last_sign_in_at: iso(1000) },
  { id: ID(2), email: "giulia.r@esempio.it", created_at: iso(11 * GIORNO), last_sign_in_at: iso(3 * 3600_000) },
  { id: ID(3), email: "marco.t@esempio.it", created_at: iso(3 * GIORNO), last_sign_in_at: iso(GIORNO + 3600_000) },
  { id: ID(4), email: "sara.b@esempio.it", created_at: iso(16 * GIORNO), last_sign_in_at: iso(7 * GIORNO) },
  { id: ID(5), email: "luca.p@esempio.it", created_at: iso(GIORNO / 2), last_sign_in_at: null },
  { id: ID(6), email: "appreview@dayalogue.com", created_at: iso(2 * GIORNO), last_sign_in_at: iso(10 * 3600_000) },
];
sb.tab("profiles").push(
  { user_id: ADMIN, plan: "premium", plan_source: "manual", current_period_end: null, display_name: "Manuel" },
  { user_id: ID(2), plan: "premium", plan_source: "apple", current_period_end: iso(-19 * GIORNO), display_name: "Giulia R.", apple_environment: "Production", apple_product_id: "com.manuelvisuals.journalme.premium.mensile", apple_ultimo_avviso: "DID_RENEW" },
  { user_id: ID(3), plan: "premium", plan_source: "apple", current_period_end: iso(-11 * GIORNO), display_name: "Marco T.", apple_environment: "Production", apple_product_id: "com.manuelvisuals.journalme.premium.mensile", apple_ultimo_avviso: "SUBSCRIBED/INITIAL_BUY" },
  { user_id: ID(4), plan: "premium", plan_source: "apple", current_period_end: iso(7 * GIORNO), display_name: "Sara B.", apple_environment: "Production", apple_product_id: "com.manuelvisuals.journalme.premium.mensile", apple_ultimo_avviso: "EXPIRED" },
  { user_id: ID(6), plan: "free", plan_source: null, current_period_end: null, display_name: null },
);
for (let i = 0; i < 31; i++) sb.tab("entries").push({ user_id: ADMIN });
for (let i = 0; i < 11; i++) sb.tab("cassettine").push({ user_id: ID(2) });
for (let i = 0; i < 3; i++) sb.tab("cassettine").push({ user_id: ID(3) });
for (let i = 0; i < 9; i++) sb.tab("entries").push({ user_id: ID(4) });
sb.tab("entries").push({ user_id: ID(6) }, { user_id: ID(6) });
sb.tab("cassaforte_utente").push({ user_id: ADMIN }, { user_id: ID(2) }, { user_id: ID(3) }, { user_id: ID(4) });
sb.tab("ai_usage").push(
  { user_id: ADMIN, costo_usd: 2.0, created_at: iso(GIORNO) },
  { user_id: ID(2), costo_usd: 0.3, created_at: iso(2 * GIORNO) },
  { user_id: null, braccialetto_id: "b1", costo_usd: 0.1, regalo: true, created_at: iso(3 * GIORNO) },
);
sb.tab("braccialetti").push(
  { id: "b1", segreto_hash: "h1", user_id: null, creato_il: iso(2 * GIORNO), ultimo_uso: iso(3600_000), devicecheck: true },
  { id: "b2", segreto_hash: "h2", user_id: ID(2), creato_il: iso(14 * GIORNO), ultimo_uso: iso(11 * GIORNO), devicecheck: true },
  { id: "b3", segreto_hash: "h3", user_id: null, creato_il: iso(40 * GIORNO), ultimo_uso: iso(40 * GIORNO), devicecheck: false },
);
for (let i = 0; i < 6; i++) sb.tab("braccialetto_giornate").push({ braccialetto_id: "b1" });
for (let i = 0; i < 4; i++) sb.tab("braccialetto_giornate").push({ braccialetto_id: "b2" });
for (let i = 0; i < 10; i++) sb.tab("braccialetto_giornate").push({ braccialetto_id: "b3" });

const exp = Math.floor(Date.now() / 1000) + 6 * 3600;
const TOKEN = jwtFinto(exp, ADMIN);
sb.utenti.set(TOKEN, { id: ADMIN, email: "madh52@gmail.com" });
const TOKEN_ALTRO = jwtFinto(exp, ID(2));
sb.utenti.set(TOKEN_ALTRO, { id: ID(2), email: "giulia.r@esempio.it" });

/* ------------ 7: la rotta, senza browser ------------ */
{
  const r = await fetch(BASE + "/api/admin/iscritti", { headers: { authorization: "Bearer " + TOKEN_ALTRO } });
  check("7 chi non e admin riceve 404 dalla rotta", r.status === 404, String(r.status));
  const r2 = await fetch(BASE + "/api/admin/iscritti", { headers: { authorization: "Bearer " + TOKEN } });
  const body = await r2.json();
  check("2 la rotta risponde all'admin coi numeri", r2.status === 200 && body.numeri?.account === 6, JSON.stringify(body.numeri));
  check("2 premium: 3 (Manuel a mano, Giulia e Marco via Apple; Sara e scaduta)", body.numeri?.premium === 3 && body.numeri?.premiumApple === 2 && body.numeri?.premiumMano === 1, JSON.stringify(body.numeri));
  check("2 ospiti: 3 in tutto, 1 attivo negli ultimi 30 giorni", body.numeri?.ospiti === 3 && body.numeri?.ospitiAttivi === 1, JSON.stringify(body.numeri));
  check("2 AI del mese in euro: (2 + 0,3 + 0,1) USD x 0,92", Math.abs(body.numeri?.aiEurMese - 2.4 * 0.92) < 0.001, String(body.numeri?.aiEurMese));
  const giulia = body.account?.find((a) => a.email === "giulia.r@esempio.it");
  check("6 Giulia: 11 giornate (cassettine), cassaforte chiusa, ospite prima", giulia?.giornate === 11 && giulia?.cassaforte === true && !!giulia?.ospitePrima, JSON.stringify(giulia));
  const sara = body.account?.find((a) => a.email === "sara.b@esempio.it");
  check("6 Sara: premium Apple con scadenza passata = free, fonte apple", sara?.piano === "free" && sara?.fonte === "apple", JSON.stringify(sara));
  const b3 = body.ospiti?.find((o) => o.id === "b3");
  const b2 = body.ospiti?.find((o) => o.id === "b2");
  check("5 ospiti: b3 ha finito il regalo (10 di 10), b2 e diventato l'account di Giulia", b3?.esito?.tipo === "finito" && b3?.usate === 10 && b2?.esito?.tipo === "account" && b2?.esito?.email === "giulia.r@esempio.it", JSON.stringify([b2?.esito, b3?.esito]));

  // Il PUT: Apple si rifiuta, il gratis diventa premium a mano.
  const put = (userId, piano, token = TOKEN) => fetch(BASE + "/api/admin/iscritti", { method: "PUT", headers: { authorization: "Bearer " + token, "content-type": "application/json" }, body: JSON.stringify({ userId, piano }) });
  const rApple = await put(ID(2), "free");
  check("6 PUT su un premium Apple: 409, e il profilo non cambia", rApple.status === 409 && sb.tab("profiles").find((p) => p.user_id === ID(2)).plan === "premium", String(rApple.status));
  const rNo = await put(ID(6), "premium", TOKEN_ALTRO);
  check("7 PUT da chi non e admin: 404", rNo.status === 404, String(rNo.status));
  const rSara = await put(ID(4), "premium");
  const sBody = await rSara.json();
  const pSara = sb.tab("profiles").find((p) => p.user_id === ID(4));
  check("6 PUT su Sara (Apple scaduto): premium a mano, plan_source manual, senza scadenza", rSara.status === 200 && sBody.piano === "premium" && pSara.plan === "premium" && pSara.plan_source === "manual" && pSara.current_period_end === null, JSON.stringify(pSara));
  const rNuovo = await put(ID(5), "premium");
  check("6 PUT su chi non ha ancora un profilo: la riga nasce", rNuovo.status === 200 && sb.tab("profiles").some((p) => p.user_id === ID(5) && p.plan === "premium"), String(rNuovo.status));
  await put(ID(5), "free");
  await put(ID(4), "free");
  pSara.plan = "premium"; pSara.plan_source = "apple"; pSara.current_period_end = iso(7 * GIORNO);
}

/* ------------ la schermata ------------ */
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const finto = new SupabaseFinto();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "it-IT" });
await montaSupabaseFinto(ctx, finto);
await ctx.addInitScript(({ token }) => {
  try {
    const s = JSON.parse(window.localStorage.getItem("sb-sbfinto-auth-token") || "{}");
    s.access_token = token;
    window.localStorage.setItem("sb-sbfinto-auth-token", JSON.stringify(s));
    window.localStorage.setItem("jm.mode", "cloud");
  } catch {}
}, { token: TOKEN });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(BASE + "/admin", { waitUntil: "domcontentloaded" });
const parole = page.locator(".jm-login-cassa-check input");
try {
  await parole.waitFor({ state: "visible", timeout: 8_000 });
  await parole.check();
  await page.locator("button.btn-primary").click();
  await page.goto(BASE + "/admin", { waitUntil: "domcontentloaded" });
} catch {}
const nav = page.locator(".jm-adm-nav");
await nav.waitFor({ state: "visible", timeout: 30_000 });
await nav.getByRole("button", { name: /Iscritti/ }).click();
await page.locator(".jm-adm-isc-tbl .jm-adm-isc-tr:not(.head)").first().waitFor({ state: "visible", timeout: 20_000 });

const navTesto = (await nav.innerText()).replace(/\s+/g, " ");
check("1 la voce 'Iscritti' e nella rail col numero 6", /Iscritti\s*6/.test(navTesto), navTesto);

const numeri = await page.locator(".jm-adm-isc-box .n").allInnerTexts();
check("2 i quattro numeri a schermo: 6, 3, 1, 2,21 EUR", numeri.length === 4 && /^6/.test(numeri[0]) && /^3/.test(numeri[1]) && /^1/.test(numeri[2]) && /2,21/.test(numeri[3]), numeri.join(" | "));

const righe = () => page.locator(".jm-adm-isc-tbl .jm-adm-isc-tr:not(.head) .chi b").allInnerTexts();
let ordine = await righe();
check("3 di fabbrica gli ultimi iscritti in cima (C2): luca, appreview, Marco...", ordine[0] === "luca.p@esempio.it" && ordine[1] === "appreview@dayalogue.com" && ordine[2] === "Marco T.", ordine.join(" > "));
const testa = page.locator(".jm-adm-isc-tr.head button");
await testa.filter({ hasText: /Giornate/ }).click();
ordine = await righe();
check("3 un clic su Giornate: crescente (0 in cima)", ordine[0] === "luca.p@esempio.it" && ordine[ordine.length - 1] === "Manuel", ordine.join(" > "));
await testa.filter({ hasText: /Giornate/ }).click();
ordine = await righe();
check("3 il secondo clic rovescia: decrescente (Manuel, 31, in cima)", ordine[0] === "Manuel" && ordine[1] === "Giulia R.", ordine.join(" > "));
await testa.filter({ hasText: /^Account/ }).click();
ordine = await righe();
check("3 per nome, crescente: appreview, Giulia, luca...", ordine[0] === "appreview@dayalogue.com" && ordine[1] === "Giulia R.", ordine.join(" > "));
await testa.filter({ hasText: /Accesso/ }).click();
await testa.filter({ hasText: /Accesso/ }).click();
ordine = await righe();
check("3 per accesso decrescente: Manuel (adesso) in cima, luca (mai) in fondo", ordine[0] === "Manuel" && ordine[ordine.length - 1] === "luca.p@esempio.it", ordine.join(" > "));

await page.locator(".jm-adm-isc-cerca").fill("esempio");
ordine = await righe();
check("4 la ricerca 'esempio' lascia i quattro account @esempio.it", ordine.length === 4 && ordine.every((n) => /esempio|Giulia|Marco|Sara/.test(n)), ordine.join(" > "));
await page.locator(".jm-adm-isc-cerca").fill("giulia");
ordine = await righe();
check("4 la ricerca per nome trova Giulia", ordine.length === 1 && ordine[0] === "Giulia R.", ordine.join(" > "));
await page.locator(".jm-adm-isc-cerca").fill("");

// L'ispettore.
await page.locator(".jm-adm-isc-tr:not(.head)").filter({ hasText: "Giulia R." }).click();
const isp = page.locator(".jm-adm-isc-isp");
await isp.waitFor({ state: "visible", timeout: 5_000 });
const ispTesto = (await isp.innerText()).replace(/\s+/g, " ");
check("6 l'ispettore di Giulia: email, 11 giornate, cassaforte chiusa, da ospite, Apple", /giulia\.r@esempio\.it/.test(ispTesto) && /\b11\b/.test(ispTesto) && /chiusa/.test(ispTesto) && /si, dal/.test(ispTesto) && /Production/.test(ispTesto), ispTesto.slice(0, 200));
check("6 per chi paga con Apple il segmented e spento", await isp.locator(".jm-adm-isc-seg2 button").first().isDisabled() && /App Store/.test(ispTesto));

await page.locator(".jm-adm-isc-tr:not(.head)").filter({ hasText: "luca.p@esempio.it" }).click();
await isp.getByRole("radio", { name: "Premium" }).click();
await page.waitForTimeout(1200);
const pLuca = sb.tab("profiles").find((p) => p.user_id === ID(5));
check("6 dall'ispettore: luca diventa premium a mano sul server", pLuca?.plan === "premium" && pLuca?.plan_source === "manual", JSON.stringify(pLuca));
const rigaLuca = page.locator(".jm-adm-isc-tr:not(.head)").filter({ hasText: "luca.p@esempio.it" });
check("6 la riga mostra Premium, a mano, senza ricaricare", /Premium/.test(await rigaLuca.innerText()) && /a mano/.test(await rigaLuca.innerText()));
const numeriDopo = await page.locator(".jm-adm-isc-box .n").allInnerTexts();
check("6 il numero dei premium sale a 4", /^4/.test(numeriDopo[1]), numeriDopo[1]);
await isp.getByRole("radio", { name: "Gratis" }).click();
await page.waitForTimeout(1200);
check("6 e torna gratis", sb.tab("profiles").find((p) => p.user_id === ID(5))?.plan === "free");

// La scheda Ospiti.
await page.getByRole("tab", { name: /Ospiti/ }).click();
await page.locator(".jm-adm-isc-tr.osp:not(.head)").first().waitFor({ state: "visible", timeout: 5_000 });
const ospTesto = (await page.locator(".jm-adm-isc-tbl").innerText()).replace(/\s+/g, " ");
check("5 la scheda Ospiti: tre braccialetti, '6 di 10', 'finito, senza account', 'con account giulia'", /6 di 10/.test(ospTesto) && /finito, senza account/.test(ospTesto) && /con account giulia\.r@esempio\.it/.test(ospTesto) && /senza DeviceCheck/.test(ospTesto), ospTesto.slice(0, 260));
check("5 nella scheda Ospiti l'ispettore non c'e", (await page.locator(".jm-adm-isc-isp").count()) === 0);
const testaOsp = page.locator(".jm-adm-isc-tr.head button");
await testaOsp.filter({ hasText: /Regalo/ }).click();
const regali = await page.locator(".jm-adm-isc-tr.osp:not(.head) .num:nth-child(4)").allInnerTexts();
check("3 anche gli ospiti si ordinano (Regalo crescente: 4, 6, 10)", regali.join(",").replace(/ di 10/g, "") === "4,6,10", regali.join(" | "));

check("8 zero errori pagina", errors.length === 0, errors.slice(0, 2).join(" | "));

await ctx.close();
await browser.close();
await sb.ferma?.();
await oa.ferma?.();

const pass = results.filter((r) => r.ok).length;
console.log(`\n${pass}/${results.length} PASS`);
process.exit(pass === results.length ? 0 : 1);
