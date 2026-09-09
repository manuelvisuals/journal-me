// Banco VIVO della foto profilo (9 settembre 2026, richiesta di Manuel prima
// della sottomissione: "verifica che la foto profilo si possa caricare,
// cancellare, modificare").
//
// verify-foto-profilo prova l'aritmetica del ritaglio e i contratti senza
// browser. Questo apre il browser sul dev server coi finti e fa le tre cose
// come una persona, con l'account: da Impostazioni sceglie una foto dalla
// libreria, la conferma nel ritaglio, la vede nel pallino e nella riga; la
// cambia con un'altra e vede che e cambiata; la toglie e torna
// all'iniziale. Ogni passo si controlla anche sul SERVER finto (la riga
// profiles.avatar_data scritta dalla route /api/account/avatar) e dopo un
// ricaricamento della pagina (la foto viene da profiles, non dalla memoria).
//
// Serve il dev server su :3100 coi finti (SupabaseFintoServer su 3198).
import { chromium } from "playwright-core";
import { deflateSync } from "node:zlib";
import { SupabaseFintoServer, OpenAIFinto } from "./lib/finti-server.mjs";
import { SupabaseFinto, jwtFinto, montaSupabaseFinto, UTENTE_ID } from "./lib/supabase-finto.mjs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

// Due immagini diverse, generate qui: un quadrato rosso e uno blu (PNG
// minimi validi, 2x2), cosi il ritaglio ha qualcosa da tagliare.
function png(r, g, b) {
  // PNG 2x2 a tinta unita, scritto a mano: firma, IHDR, IDAT (zlib store), IEND.
  const crc = (buf) => {
    let c = ~0;
    for (const x of buf) {
      c ^= x;
      for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return (~c) >>> 0;
  };
  const chunk = (tipo, dati) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(dati.length);
    const td = Buffer.concat([Buffer.from(tipo), dati]);
    const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, cc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.from([0, r, g, b, r, g, b, 0, r, g, b, r, g, b]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const ROSSO = png(220, 40, 40);
const BLU = png(40, 60, 220);

const sb = new SupabaseFintoServer();
const oa = new OpenAIFinto();
await sb.avvia(3198);
await oa.avvia(3199);
const TOKEN = jwtFinto(Math.floor(Date.now() / 1000) + 6 * 3600, UTENTE_ID);
sb.utenti.set(TOKEN, { id: UTENTE_ID, email: "banco@dayalogue.test" });
sb.tab("profiles").push({ user_id: UTENTE_ID, plan: "free", plan_source: null, current_period_end: null, display_name: "Giulia", avatar_data: null });
const rigaServer = () => sb.tab("profiles").find((p) => p.user_id === UTENTE_ID);

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const finto = new SupabaseFinto();
// Il browser legge profiles dal finto in memoria: si specchia il server a
// ogni lettura, cosi dopo un ricaricamento la foto e quella salvata davvero.
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: "it-IT" });
await montaSupabaseFinto(ctx, finto);
await ctx.route(`**/sbfinto.supabase.co/rest/v1/profiles**`, (route) => {
  finto.tabelle.profiles = sb.tab("profiles").map((r) => ({ ...r }));
  return finto.gestisci(route);
});
await ctx.addInitScript((token) => {
  try {
    window.localStorage.setItem("jm.plan", "free");
    const s = JSON.parse(window.localStorage.getItem("sb-sbfinto-auth-token") || "{}");
    s.access_token = token;
    window.localStorage.setItem("sb-sbfinto-auth-token", JSON.stringify(s));
  } catch {}
}, TOKEN);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

async function apriImpostazioni() {
  await page.goto(BASE + "/app/settings", { waitUntil: "domcontentloaded" });
  const parole = page.locator(".jm-login-cassa-check input");
  if (await parole.waitFor({ state: "visible", timeout: 12_000 }).then(() => true, () => false)) {
    await parole.check();
    await page.locator("button.btn-primary").click();
  }
  const velo = page.locator(".jm-benv-sal");
  if (await velo.waitFor({ state: "visible", timeout: 3000 }).then(() => true, () => false)) {
    const spunta = page.locator(".jm-benv-sal-c input");
    if (await spunta.count()) await spunta.check().catch(() => undefined);
    await page.locator(".jm-benv-sal-b").click();
    await velo.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => undefined);
  }
  await page.locator(".jm-foto-mini, .jm-foto-avbtn").first().waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(800);
}
const pallino = () => page.locator(".jm-hd-av, .jm-acct-btn").locator("visible=true").first();
const riga = () => page.locator(".jm-foto-mini, .jm-foto-avbtn").locator("visible=true").first();
const srcPallino = async () => (await pallino().locator("img").count()) ? pallino().locator("img").getAttribute("src") : null;

async function caricaFoto(buffer, nome) {
  await riga().click();
  await page.getByRole("button", { name: /Scegli dalla libreria|Choose from library/ }).waitFor({ state: "visible", timeout: 10_000 });
  const input = page.locator("input[type=file][accept*='image']:not([capture])").first();
  await input.setInputFiles({ name: nome, mimeType: "image/png", buffer });
  const usa = page.locator(".jm-foto-usa");
  await usa.waitFor({ state: "visible", timeout: 15_000 });
  await usa.click();
  await page.locator(".jm-foto-crop").waitFor({ state: "hidden", timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(1200);
}

/* ============ 0. si parte senza foto ============ */
await apriImpostazioni();
check("0 all'inizio il pallino mostra l'iniziale, non una foto", (await srcPallino()) === null);
check("0 il server non ha nessuna foto", rigaServer().avatar_data === null);

/* ============ 1. caricare ============ */
await caricaFoto(ROSSO, "rossa.png");
const src1 = await srcPallino();
check("1 caricare: il pallino in alto mostra la foto", typeof src1 === "string" && src1.startsWith("data:image/"), String(src1).slice(0, 30));
check("1 caricare: anche la riga di Impostazioni mostra la foto", (await riga().locator("img").count()) === 1);
check("1 caricare: il server ha salvato la foto (profiles.avatar_data)", typeof rigaServer().avatar_data === "string" && rigaServer().avatar_data.startsWith("data:image/"), String(rigaServer().avatar_data).slice(0, 30));
check("1 caricare: la foto salvata e quella del pallino", rigaServer().avatar_data === src1);
await apriImpostazioni();
check("1 caricare: dopo un ricaricamento la foto resta (viene dal server)", (await srcPallino()) === src1);

/* ============ 2. modificare ============ */
await caricaFoto(BLU, "blu.png");
const src2 = await srcPallino();
check("2 modificare: il pallino mostra la foto nuova, diversa dalla prima", typeof src2 === "string" && src2 !== src1);
check("2 modificare: il server ha la foto nuova", rigaServer().avatar_data === src2);
await apriImpostazioni();
check("2 modificare: dopo un ricaricamento c'e la nuova, non la vecchia", (await srcPallino()) === src2);

/* ============ 3. cancellare ============ */
await riga().click();
const togli = page.getByRole("button", { name: /Togli la foto|Remove the photo/ });
check("3 cancellare: nel foglio c'e la riga per togliere la foto", await togli.waitFor({ state: "visible", timeout: 10_000 }).then(() => true, () => false));
await togli.click();
await page.waitForTimeout(1200);
check("3 cancellare: il pallino torna all'iniziale", (await srcPallino()) === null);
check("3 cancellare: la riga di Impostazioni torna all'iniziale", (await riga().locator("img").count()) === 0);
check("3 cancellare: il server ha avatar_data = null", rigaServer().avatar_data === null);
await apriImpostazioni();
check("3 cancellare: dopo un ricaricamento resta l'iniziale", (await srcPallino()) === null);
await riga().click();
check("3 senza foto il foglio NON offre 'togli la foto'", (await page.getByRole("button", { name: /Togli la foto|Remove the photo/ }).count()) === 0);
check("nessun errore di pagina", errors.length === 0, errors.slice(0, 2).join(" | "));

await browser.close();
await sb.ferma();
await oa.ferma();
const ko = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - ko}/${results.length} verdi`);
process.exit(ko ? 1 : 0);
