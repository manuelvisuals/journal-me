// Prova VERA della foto profilo su dayalogue.com, dal Chrome del Mac, con
// l'account demo gia dentro (profilo ~/.dayalogue-demo-chrome).
//
// Fa le tre cose come una persona, contro il database vero (policy RLS,
// service role, colonne): carica una foto di prova, la vede nel pallino e
// dopo un ricaricamento; la cambia con una seconda; la toglie; e ALLA FINE
// rimette la foto vera di Giulia (demo/giulia-profilo.jpg), cosi l'account
// demo resta com'era. Scrive un referto html.
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const QUI = dirname(fileURLToPath(import.meta.url));
const base = process.env.JM_BASE ?? "https://dayalogue.com";
const profilo = process.env.JM_DEMO_PROFILO ?? join(process.env.HOME ?? ".", ".dayalogue-demo-chrome");
const fotoVera = process.env.JM_DEMO_FOTO ?? join(QUI, "..", "demo", "giulia-profilo.jpg");
const refertoPath = process.env.JM_DEMO_REFERTO ?? join(process.cwd(), "referto-foto-profilo.html");

function png(r, g, b) {
  const crc = (buf) => { let c = ~0; for (const x of buf) { c ^= x; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (~c) >>> 0; };
  const chunk = (tipo, dati) => { const len = Buffer.alloc(4); len.writeUInt32BE(dati.length); const td = Buffer.concat([Buffer.from(tipo), dati]); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.from([0, r, g, b, r, g, b, 0, r, g, b, r, g, b]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok, extra }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`); };

const ctx = await chromium.launchPersistentContext(profilo, { channel: "chrome", headless: false, viewport: { width: 430, height: 932 }, locale: "en-GB", args: ["--window-size=470,1000"] });
const page = ctx.pages()[0] ?? (await ctx.newPage());
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

async function apriImpostazioni() {
  await page.goto(base + "/app/settings", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  if (/\/login/.test(page.url())) throw new Error("il profilo di Chrome non ha piu la sessione: lancia prima carica-account-demo.command");
  const velo = page.locator(".jm-benv-sal");
  if (await velo.waitFor({ state: "visible", timeout: 3000 }).then(() => true, () => false)) {
    const spunta = page.locator(".jm-benv-sal-c input");
    if (await spunta.count()) await spunta.check().catch(() => undefined);
    await page.locator(".jm-benv-sal-b").click();
    await velo.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => undefined);
  }
  await page.locator(".jm-foto-mini, .jm-foto-avbtn").first().waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(1500);
}
const pallino = () => page.locator(".jm-hd-av, .jm-acct-btn").locator("visible=true").first();
const riga = () => page.locator(".jm-foto-mini, .jm-foto-avbtn").locator("visible=true").first();
const srcPallino = async () => (await pallino().locator("img").count()) ? pallino().locator("img").getAttribute("src") : null;
async function caricaFoto(buffer, nome, mime) {
  await riga().click();
  await page.getByRole("button", { name: /Scegli dalla libreria|Choose from library/ }).waitFor({ state: "visible", timeout: 10_000 });
  await page.locator("input[type=file][accept*='image']:not([capture])").first().setInputFiles({ name: nome, mimeType: mime, buffer });
  const usa = page.locator(".jm-foto-usa");
  await usa.waitFor({ state: "visible", timeout: 20_000 });
  await usa.click();
  await page.locator(".jm-foto-crop").waitFor({ state: "hidden", timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(2500);
}

let ripristinata = false;
try {
  await apriImpostazioni();
  const originale = await srcPallino();
  check("0 all'inizio c'e la foto di Giulia", typeof originale === "string");

  await caricaFoto(png(220, 40, 40), "rossa.png", "image/png");
  const src1 = await srcPallino();
  check("1 caricare: il pallino mostra la foto nuova", typeof src1 === "string" && src1 !== originale);
  await apriImpostazioni();
  check("1 caricare: dopo un ricaricamento resta (e sul server vero)", (await srcPallino()) === src1);

  await caricaFoto(png(40, 60, 220), "blu.png", "image/png");
  const src2 = await srcPallino();
  check("2 modificare: il pallino mostra la seconda foto, diversa", typeof src2 === "string" && src2 !== src1);
  await apriImpostazioni();
  check("2 modificare: dopo un ricaricamento c'e la seconda", (await srcPallino()) === src2);

  await riga().click();
  const togli = page.getByRole("button", { name: /Togli la foto|Remove the photo/ });
  check("3 cancellare: c'e la riga per togliere la foto", await togli.waitFor({ state: "visible", timeout: 10_000 }).then(() => true, () => false));
  await togli.click();
  await page.waitForTimeout(2500);
  check("3 cancellare: il pallino torna all'iniziale", (await srcPallino()) === null);
  await apriImpostazioni();
  check("3 cancellare: dopo un ricaricamento resta l'iniziale (server vero)", (await srcPallino()) === null);

  // Il ripristino: la foto vera di Giulia, dallo stesso flusso.
  await caricaFoto(readFileSync(fotoVera), "giulia-profilo.jpg", "image/jpeg");
  await apriImpostazioni();
  const fine = await srcPallino();
  ripristinata = typeof fine === "string";
  check("4 ripristino: la foto di Giulia e tornata (e resta dopo un ricaricamento)", ripristinata);
  check("nessun errore di pagina", errors.length === 0, errors.slice(0, 2).join(" | "));
} catch (e) {
  check("interrotto", false, e instanceof Error ? e.message : String(e));
  await page.screenshot({ path: refertoPath.replace(/\.html$/, "-schermata.png") }).catch(() => undefined);
}

const ko = results.filter((r) => !r.ok).length;
const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
writeFileSync(refertoPath, `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Referto . Foto profilo su dayalogue.com</title>
<style>body{background:#17171A;color:#A9A9B2;font-family:-apple-system,system-ui,sans-serif;padding:48px 24px;line-height:1.5}.wrap{max-width:820px;margin:0 auto}h1{font-family:"Iowan Old Style",Palatino,Georgia,serif;font-weight:400;color:#EDEDF0;font-size:34px;text-align:center}p{text-align:center;color:#77777F}table{border-collapse:collapse;width:100%;font-size:14px;margin-top:28px}td{border-top:1px solid rgba(255,255,255,.1);padding:9px 10px}td:first-child{width:60px;font-weight:700}.ok{color:#4ADE80}.no{color:#F87171}</style></head>
<body><div class="wrap"><h1>La foto profilo, su dayalogue.com</h1><p>${results.length - ko} su ${results.length} controlli verdi. ${ripristinata ? "La foto di Giulia e al suo posto." : "ATTENZIONE: la foto di Giulia NON e stata rimessa: rilancia carica-account-demo.command o rimettila a mano."}</p>
<table>${results.map((r) => `<tr><td class="${r.ok ? "ok" : "no"}">${r.ok ? "OK" : "NO"}</td><td>${esc(r.name)}${r.extra ? " <small>" + esc(r.extra) + "</small>" : ""}</td></tr>`).join("")}</table></div></body></html>`);
console.log(`\n${results.length - ko}/${results.length} verdi\nreferto: ${refertoPath}`);
await ctx.close();
process.exit(ko ? 1 : 0);
