// Ritocca i titoli delle giornate dell'account demo (9 settembre 2026).
//
// Il caricatore (carica-account-demo.mjs) ha lasciato che l'AI scrivesse i
// titoli, e l'AI di allora li scriveva tutti minuscoli. Manuel ha scelto il
// Sentence case (PR #88 per le giornate nuove); per le 28 gia scritte
// questo script apre ogni giornata e mette il titolo di demo/giulia-titoli-en.json
// col lucchetto, come farebbe una persona: tocca il titolo, scrive, Invio.
// Non tocca testo, aree, misure, obiettivi, memo, recap.
//
// Da riga di comando gira nel Chrome del Mac col profilo dell'account demo
// (la sessione c'e gia). Esporta ritoccaTitoli() per il banco coi finti.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const QUI = dirname(fileURLToPath(import.meta.url));

export async function ritoccaTitoli({ page, base, titoli, log = () => {} }) {
  const referto = { inizio: new Date().toISOString(), fine: null, giornate: [], errori: [] };
  const attesa = (ms) => page.waitForTimeout(ms);
  // Il titolo e il primo nodo di testo dell'h1: dentro ci sono anche il
  // distintivo "tuo"/"yours" del lucchetto o la matita.
  const leggiTitolo = () =>
    page.locator(".jm-fv-h").first().evaluate((h) =>
      [...h.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join("").trim(),
    );
  const chiudiSaluto = async (attesaMs = 2000) => {
    const velo = page.locator(".jm-benv-sal");
    if (!(await velo.waitFor({ state: "visible", timeout: attesaMs }).then(() => true, () => false))) return;
    const spunta = page.locator(".jm-benv-sal-c input");
    if (await spunta.count()) await spunta.check().catch(() => undefined);
    await page.locator(".jm-benv-sal-b").click();
    await velo.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => undefined);
  };

  for (const [data, titolo] of Object.entries(titoli)) {
    const voce = { data, prima: null, dopo: null, stato: "" };
    referto.giornate.push(voce);
    try {
      await page.goto(base + "/app/giorno?d=" + data, { waitUntil: "domcontentloaded" });
      await chiudiSaluto();
      const h = page.locator(".jm-fv-h").first();
      if (!(await h.waitFor({ state: "visible", timeout: 60_000 }).then(() => true, () => false))) {
        voce.stato = "vuota: nessuna giornata da ritoccare";
        log(data + ": " + voce.stato);
        continue;
      }
      voce.prima = await leggiTitolo();
      if (voce.prima === titolo && (await page.locator(".jm-fv-tuo").count())) {
        voce.dopo = voce.prima;
        voce.stato = "gia cosi";
        log(data + ": gia cosi | " + titolo);
        continue;
      }
      await page.locator(".jm-fv-htap").click();
      const ed = page.locator(".jm-fv-hedit");
      await ed.waitFor({ state: "visible", timeout: 10_000 });
      await ed.fill(titolo);
      await ed.press("Enter");
      await page.locator(".jm-fv-tuo").waitFor({ state: "visible", timeout: 15_000 });
      await attesa(600);
      voce.dopo = await leggiTitolo();
      voce.stato = voce.dopo === titolo ? "ritoccata" : "diverso da quello chiesto";
      if (voce.stato !== "ritoccata") referto.errori.push(data + ": letto '" + voce.dopo + "' invece di '" + titolo + "'");
      log(data + ": " + voce.stato + " | " + voce.prima + " -> " + voce.dopo);
    } catch (e) {
      voce.stato = "errore";
      referto.errori.push(data + ": " + (e instanceof Error ? e.message : String(e)));
      log(data + ": ERRORE " + referto.errori.at(-1));
    }
  }
  referto.fine = new Date().toISOString();
  return referto;
}

export function refertoHtml(r) {
  const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  const righe = r.giornate
    .map((g) => `<tr><td>${g.data}</td><td>${esc(g.prima)}</td><td><b>${esc(g.dopo)}</b></td><td class="${g.stato === "errore" ? "no" : "ok"}">${esc(g.stato)}</td></tr>`)
    .join("\n");
  const ok = r.giornate.filter((g) => g.stato === "ritoccata" || g.stato === "gia cosi").length;
  return `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Referto . Titoli dell'account demo</title>
<style>body{background:#17171A;color:#A9A9B2;font-family:-apple-system,system-ui,sans-serif;padding:48px 24px;line-height:1.5}
.wrap{max-width:900px;margin:0 auto}h1{font-family:"Iowan Old Style",Palatino,Georgia,serif;font-weight:400;color:#EDEDF0;font-size:34px;text-align:center}
p{text-align:center;color:#77777F}table{border-collapse:collapse;width:100%;font-size:13.5px;margin-top:28px}
th,td{border-top:1px solid rgba(255,255,255,.1);padding:8px 10px;text-align:left;vertical-align:top}th{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#77777F}
td:first-child{color:#EDEDF0;white-space:nowrap}b{color:#EDEDF0}.ok{color:#4ADE80}.no{color:#F87171}.err{background:#202024;border:1px solid rgba(248,113,113,.4);border-radius:12px;padding:14px 18px;margin-top:24px;color:#F87171}</style></head>
<body><div class="wrap"><h1>I titoli dell'account demo</h1>
<p>${ok} su ${r.giornate.length} giornate col titolo nuovo, col lucchetto. ${r.errori.length ? r.errori.length + " problemi, sotto." : "Nessun problema."}</p>
${r.errori.length ? `<div class="err">${r.errori.map(esc).join("<br>")}</div>` : ""}
<table><tr><th>giorno</th><th>prima</th><th>dopo</th><th>esito</th></tr>${righe}</table></div></body></html>`;
}

/* ---------------- da riga di comando: il Chrome del Mac ---------------- */
const eMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (eMain) {
  const { chromium } = await import("playwright-core");
  const base = process.env.JM_BASE ?? "https://dayalogue.com";
  const titoliPath = process.env.JM_DEMO_TITOLI ?? join(QUI, "..", "demo", "giulia-titoli-en.json");
  const refertoPath = process.env.JM_DEMO_REFERTO ?? join(process.cwd(), "referto-titoli-demo.html");
  const profilo = process.env.JM_DEMO_PROFILO ?? join(process.env.HOME ?? ".", ".dayalogue-demo-chrome");
  const { titoli } = JSON.parse(readFileSync(titoliPath, "utf8"));
  const ctx = await chromium.launchPersistentContext(profilo, {
    channel: "chrome",
    headless: false,
    viewport: { width: 430, height: 932 },
    locale: "en-GB",
    args: ["--window-size=470,1000"],
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  // Se il profilo non ha piu la sessione, si finisce su /login: qui non si
  // fa il login (lo fa carica-account-demo.command), ci si ferma e si dice.
  await page.goto(base + "/app", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  let referto;
  if (/\/login/.test(page.url())) {
    referto = { inizio: new Date().toISOString(), fine: new Date().toISOString(), giornate: [], errori: ["il profilo di Chrome non ha piu la sessione: lancia prima carica-account-demo.command"] };
  } else {
    referto = await ritoccaTitoli({ page, base, titoli, log: (m) => console.log("  . " + m) });
  }
  writeFileSync(refertoPath, refertoHtml(referto));
  writeFileSync(refertoPath.replace(/\.html$/, ".json"), JSON.stringify(referto, null, 2));
  console.log("referto: " + refertoPath);
  await ctx.close();
  process.exit(referto.errori.length ? 1 : 0);
}
