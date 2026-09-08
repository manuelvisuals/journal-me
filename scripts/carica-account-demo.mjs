// Carica l'account demo (PIANO-APPSTORE, chat "dayalogue sull'App Store",
// 8 settembre 2026): la donna che il revisore Apple trova dentro l'app.
//
// NON scrive nel database: guida l'app VERA, come farebbe una persona, dal
// login col codice fisso (review-login) alla cassaforte, alle giornate
// scritte a mano e chiuse dall'AI, ai memo, al recap. Tutto passa dallo
// stesso codice che usa chiunque: titoli, sintesi, aree e fatti li scrive
// l'AI di produzione, le giornate finiscono cifrate nelle cassettine.
//
// Due modi di girare:
//   - sul Mac di Manuel, con Chrome installato, via carica-account-demo.command
//     (la rete del sandbox non arriva a dayalogue.com);
//   - nel banco scripts/verify-account-demo.mjs, contro il dev server con i
//     finti (Supabase e OpenAI in memoria), che importa `caricaDemo` e gli
//     passa una pagina gia dentro.
//
// Due fasi, decise da sole. L'AI delle giornate vuole un account premium, e
// premium lo mette Claude con una SQL su profiles DOPO che l'account esiste
// (lo crea il primo login). Quindi: al primo giro lo script entra, prende le
// otto parole della cassaforte, mette nome e foto, e se il piano e ancora
// free si ferma e scrive nel referto l'id dell'utente. Al secondo giro trova
// premium e carica tutto il resto. Il profilo di Chrome e persistente
// (JM_DEMO_PROFILO): la chiave della cassaforte resta li fra un giro e l'altro.
//
// Variabili: JM_BASE (https://dayalogue.com), JM_DEMO_EMAIL, JM_DEMO_CODICE,
// JM_DEMO_DATI (json delle giornate), JM_DEMO_FOTO (jpg), JM_DEMO_REFERTO
// (html di uscita), JM_DEMO_PROFILO (cartella del profilo Chrome),
// JM_DEMO_PAROLE (le otto parole, se il profilo e nuovo ma la cassaforte no).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const QUI = dirname(fileURLToPath(import.meta.url));

/** I sei obiettivi di fabbrica (migration 010), in inglese: l'account e inglese. */
export const OBIETTIVI_EN = {
  corpo: "moved my body",
  aria: "been outdoors",
  sonno: "slept enough",
  gente: "seen someone",
  me: "time for myself",
  letto: "read something",
};
const KIND_INDICE = { nota: 0, persona: 1, todo: 2, luogo: 3, idea: 4 };

const attesa = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Il lavoro vero. `page` e gia aperta su un contesto con la lingua inglese
 * (localStorage jm:lang = en). Ritorna il referto come oggetto.
 */
export async function caricaDemo({
  page,
  base,
  dati,
  foto = null,
  parole = null,
  email = "",
  codice = "",
  saltaAccesso = false,
  log = console.log,
}) {
  const referto = {
    inizio: new Date().toISOString(),
    fase: null,
    userId: null,
    parole: parole ? [...parole] : null,
    piano: null,
    profilo: {},
    obiettivi: [],
    giornate: [],
    memo: [],
    recap: null,
    errori: [],
  };
  const err = (dove, e) => {
    const m = `${dove}: ${e instanceof Error ? e.message : String(e)}`;
    referto.errori.push(m);
    log("ERRORE " + m);
  };

  /* 1. Accesso col codice fisso (review-login.ts). */
  if (!saltaAccesso) {
    log("accesso: " + email);
    await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
    await page.locator("input[type=email]").fill(email);
    await page.locator("button[type=submit]").click();
    const codiceCampo = page.locator("input[inputmode=numeric]");
    await codiceCampo.waitFor({ state: "visible", timeout: 30_000 });
    await codiceCampo.fill(codice);
    await page.locator("button[type=submit]").click();
    try {
      await page.waitForFunction(
        () => document.querySelector(".jm-login-cassa-h1") || location.pathname.startsWith("/app"),
        null,
        { timeout: 60_000 },
      );
    } catch {
      // Non si e entrati: si dice COSA c'e sullo schermo, non solo "timeout".
      const testo = (await page.evaluate(() => document.body.innerText).catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 500);
      throw new Error("login non riuscito. Sullo schermo: " + page.url() + " -- " + testo);
    }
  } else {
    await page.goto(base + "/app", { waitUntil: "domcontentloaded" });
  }

  /* 2. La cassaforte: otto parole nuove, o le parole del profilo. */
  const cassa = page.locator(".jm-login-cassa-h1");
  try {
    await cassa.waitFor({ state: "visible", timeout: 15_000 });
  } catch {
    /* niente cancello: la chiave c'e gia in questo profilo */
  }
  if (await cassa.isVisible().catch(() => false)) {
    const h1 = await cassa.innerText();
    if (/Otto parole|Eight words/i.test(h1)) {
      await page.waitForFunction(
        () => {
          const l = [...document.querySelectorAll(".jm-login-cassa-parole li span")];
          return l.length === 8 && l.every((s) => !/•/.test(s.textContent));
        },
        null,
        { timeout: 30_000 },
      );
      referto.parole = await page.$$eval(".jm-login-cassa-parole li span", (l) =>
        l.map((s) => s.textContent.trim()),
      );
      log("cassaforte: otto parole nuove: " + referto.parole.join(" "));
      await page.locator(".jm-login-cassa-check input").check();
      await page.locator("button.btn-primary").click();
    } else {
      if (!parole || parole.length !== 8) {
        throw new Error(
          "la cassaforte esiste gia e questo profilo non ha la chiave: servono le otto parole (JM_DEMO_PAROLE)",
        );
      }
      log("cassaforte: apro con le otto parole del referto precedente");
      await page.locator("textarea.jm-login-cassa-campo").fill(parole.join(" "));
      await page.locator("button.btn-primary").click();
      await page.waitForFunction(
        () => !document.querySelector(".jm-login-cassa-h1") || document.querySelector(".jm-login-cassa-errore"),
        null,
        { timeout: 60_000 },
      );
      const e = page.locator(".jm-login-cassa-errore");
      if (await e.isVisible().catch(() => false)) throw new Error("cassaforte: " + (await e.innerText()));
    }
  }

  /* 3. Benvenuto e saluto: si passa oltre. */
  await attesa(1500);
  if (page.url().includes("/app/benvenuto")) {
    await page.goto(base + "/app", { waitUntil: "domcontentloaded" });
  }
  const saluto = page.locator(".jm-benv-sal-b");
  if (await saluto.waitFor({ state: "visible", timeout: 4000 }).then(() => true, () => false)) {
    await saluto.click();
    log("saluto: chiuso");
  }

  /* 4. Chi sono e che piano ho. */
  const sessione = await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (/^sb-.*-auth-token$/.test(k)) {
        try {
          const v = JSON.parse(localStorage.getItem(k));
          return { userId: v?.user?.id ?? null, email: v?.user?.email ?? null };
        } catch {
          return null;
        }
      }
    }
    return null;
  });
  referto.userId = sessione?.userId ?? null;
  log("utente: " + (referto.userId ?? "?") + " " + (sessione?.email ?? ""));

  await page.goto(base + "/app", { waitUntil: "domcontentloaded" });
  try {
    await page.waitForFunction(() => localStorage.getItem("jm.plan") !== null, null, { timeout: 25_000 });
  } catch {
    /* il piano non e arrivato: si legge quello che c'e */
  }
  referto.piano = await page.evaluate(() => localStorage.getItem("jm.plan"));
  log("piano: " + referto.piano);

  /* 5. Nome e foto (Impostazioni). */
  try {
    await page.goto(base + "/app/settings", { waitUntil: "domcontentloaded" });
    await page.locator(".jm-st-row").first().waitFor({ state: "visible", timeout: 30_000 });
    // Sul telefono il nome si cambia dalla pennina del menu dell'account
    // (account-menu.tsx), che apre la schermata del nome nelle Impostazioni.
    await page.locator(".jm-hd-av").first().click();
    const penna = page.locator(".jm-acct-penna");
    await penna.waitFor({ state: "visible", timeout: 10_000 });
    await penna.click();
    const campo = page.locator(".jm-nome-campo");
    await campo.waitFor({ state: "visible", timeout: 15_000 });
    await campo.fill(dati.persona.nome);
    await page.locator(".jm-nome-salva").click();
    await attesa(1500);
    referto.profilo.nome = dati.persona.nome;
    log("profilo: nome " + dati.persona.nome);
    if (foto) {
      await page.goto(base + "/app/settings", { waitUntil: "domcontentloaded" });
      const input = page.locator("input[type=file][accept='image/*']:not([capture])").first();
      await input.waitFor({ state: "attached", timeout: 30_000 });
      await input.setInputFiles(foto);
      const usa = page.locator(".jm-foto-usa");
      await usa.waitFor({ state: "visible", timeout: 15_000 });
      await usa.click();
      await attesa(2500);
      referto.profilo.foto = true;
      log("profilo: foto caricata");
    }
  } catch (e) {
    err("profilo", e);
  }

  if (referto.piano !== "premium") {
    referto.fase = "accesso";
    referto.fine = new Date().toISOString();
    log("il piano non e premium: mi fermo qui (fase accesso). Rilancia dopo la SQL.");
    return referto;
  }
  referto.fase = "completa";

  /* 6. Gli obiettivi in inglese (Impostazioni > Obiettivi): via quelli di fabbrica, dentro i sei nuovi. */
  try {
    await page.goto(base + "/app/settings", { waitUntil: "domcontentloaded" });
    const riga = page.locator(".jm-st-row", { has: page.locator(".jm-st-t", { hasText: /^(Obiettivi|Goals)$/ }) });
    await riga.first().waitFor({ state: "visible", timeout: 30_000 });
    await riga.first().click();
    await page.locator("form.jm-st-add input").waitFor({ state: "visible", timeout: 15_000 });
    const etichette = async () =>
      (await page.$$eval(".jm-st-row.static .jm-st-t", (l) => l.map((s) => s.textContent.trim()))).filter(
        (t) => !/^(Nessun obiettivo|No goals)/i.test(t),
      );
    const volute = Object.values(OBIETTIVI_EN);
    for (let giro = 0; giro < 12; giro++) {
      const presenti = await etichette();
      log("obiettivi presenti: " + presenti.join(" | "));
      const daTogliere = presenti.findIndex((p) => !volute.includes(p));
      if (daTogliere < 0) break;
      await page.locator(".jm-st-row.static").nth(daTogliere).locator(".jm-st-x").click();
      // Non si conta le righe: senza obiettivi compare la riga "Nessun
      // obiettivo", che e una riga anche lei. Si aspetta che sparisca l'etichetta.
      await page.waitForFunction(
        (l) => ![...document.querySelectorAll(".jm-st-row.static .jm-st-t")].some((s) => s.textContent.trim() === l),
        presenti[daTogliere],
        { timeout: 15_000 },
      );
    }
    for (const label of volute) {
      if ((await etichette()).includes(label)) continue;
      log("obiettivi: aggiungo " + label);
      await page.locator("form.jm-st-add input").fill(label);
      await page.locator("form.jm-st-add button[type=submit]").click();
      await page.waitForFunction(
        (l) => [...document.querySelectorAll(".jm-st-row.static .jm-st-t")].some((s) => s.textContent.trim() === l),
        label,
        { timeout: 15_000 },
      );
    }
    referto.obiettivi = await etichette();
    log("obiettivi: " + referto.obiettivi.join(", "));
  } catch (e) {
    err("obiettivi", e);
  }

  /* 7. Le giornate, una per una, dal flusso vero: /app/giorno -> Type it -> Continue. */
  for (const g of dati.giornate) {
    if (g.vuota) continue;
    const voce = { data: g.data, titolo: null, tuo: false, metriche: [], obiettivi: [], stato: "" };
    referto.giornate.push(voce);
    try {
      await page.goto(base + "/app/giorno?d=" + g.data, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(
        () => document.querySelector(".jm-fv-h") || document.querySelector(".btn-ghost"),
        null,
        { timeout: 60_000 },
      );
      if (await page.locator(".jm-fv-h").count()) {
        voce.stato = "gia piena";
        log(g.data + ": gia piena, non tocco il testo");
      } else {
        await page.locator(".btn-ghost").first().click();
        const ta = page.locator(".jm-editor-textarea");
        await ta.waitFor({ state: "visible", timeout: 15_000 });
        await ta.fill(g.testo);
        await page.locator(".jm-editor-btn.save").click();
        const t0 = Date.now();
        await page.waitForFunction(
          () => document.querySelector(".jm-fv-h") || document.querySelector(".jm-wall"),
          null,
          { timeout: 180_000 },
        );
        if (await page.locator(".jm-wall").count()) {
          await page.keyboard.press("Escape");
          throw new Error("si e aperto il muro premium: l'AI ha risposto 402");
        }
        voce.stato = "scritta in " + Math.round((Date.now() - t0) / 1000) + " s";
        await attesa(1500);
      }
      voce.titolo = (await page.locator(".jm-fv-h").first().innerText()).trim();

      // gli obiettivi del giorno
      for (const k of g.obiettivi ?? []) {
        const label = OBIETTIVI_EN[k];
        const riga = page.locator(".jm-goal-row", { has: page.locator(".jm-goal-lab", { hasText: label }) }).first();
        if (!(await riga.count())) {
          referto.errori.push(g.data + ": obiettivo non trovato: " + label);
          continue;
        }
        if ((await riga.getAttribute("aria-pressed")) !== "true") {
          await riga.click();
          await attesa(400);
        }
        voce.obiettivi.push(label);
      }

      // il titolo scritto da lei, col lucchetto
      if (g.titolo_suo) {
        const h = page.locator(".jm-fv-htap");
        if (await h.count()) {
          await h.click();
          const ed = page.locator(".jm-fv-hedit");
          await ed.waitFor({ state: "visible", timeout: 10_000 });
          await ed.fill(g.titolo_suo);
          await ed.press("Enter");
          await page.locator(".jm-fv-tuo").waitFor({ state: "visible", timeout: 15_000 });
          voce.titolo = g.titolo_suo;
          voce.tuo = true;
        } else if (await page.locator(".jm-fv-tuo").count()) {
          voce.tuo = true;
        }
      }

      // le misure, come le ha lette l'AI
      voce.metriche = await page.$$eval(".jm-metric", (l) =>
        l.map((m) => m.textContent.trim().replace(/\s+/g, " ")),
      );
      log(g.data + ": " + voce.stato + " | " + voce.titolo);
    } catch (e) {
      voce.stato = "errore";
      err(g.data, e);
    }
  }

  /* 8. I memo. */
  try {
    await page.goto(base + "/app/remember", { waitUntil: "domcontentloaded" });
    const campo = page.locator("form.jm-qc-card input[type=text]");
    await campo.waitFor({ state: "visible", timeout: 30_000 });
    for (const m of dati.memo ?? []) {
      await page.locator(".jm-qc-kind").click();
      await page.locator(".jm-qc-kind-pop .row").nth(KIND_INDICE[m.tipo] ?? 0).click();
      await campo.fill(m.testo);
      await page.locator(".jm-qc-add").click();
      await page.waitForFunction(() => document.querySelector("form.jm-qc-card input[type=text]").value === "", null, { timeout: 20_000 });
      await attesa(400);
      referto.memo.push(m.tipo + ": " + m.testo);
    }
    log("memo: " + referto.memo.length);
  } catch (e) {
    err("memo", e);
  }

  /* 9. Il recap del mese scorso, col bottone dell'app. */
  try {
    await page.goto(base + "/app/recap", { waitUntil: "domcontentloaded" });
    const gen = page.locator(".jm-gen-btn");
    if (await gen.waitFor({ state: "visible", timeout: 20_000 }).then(() => true, () => false)) {
      await gen.click();
      await page.waitForFunction(() => !document.querySelector(".jm-gen-btn") || document.querySelector(".jm-rec-suggest .err"), null, { timeout: 180_000 });
      const e = page.locator(".jm-rec-suggest .err");
      if (await e.isVisible().catch(() => false)) throw new Error(await e.innerText());
      referto.recap = "generato";
    } else {
      referto.recap = "il bottone non c'era (recap gia fatto, o non e il mese giusto)";
    }
    log("recap: " + referto.recap);
  } catch (e) {
    err("recap", e);
  }

  referto.fine = new Date().toISOString();
  return referto;
}

/* ---------------- il referto in HTML, per la cartella del Mac ---------------- */
export function refertoHtml(r, { email, base }) {
  const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  const righe = r.giornate
    .map(
      (g) =>
        `<tr><td>${g.data.slice(8)}</td><td>${esc(g.titolo)}${g.tuo ? ' <span class="tuo">titolo suo</span>' : ""}</td><td>${esc(g.obiettivi.join(", "))}</td><td>${esc(Object.values(g.metriche).join(" . "))}</td><td class="${g.stato === "errore" ? "no" : ""}">${esc(g.stato)}</td></tr>`,
    )
    .join("\n");
  const parole = r.parole ? r.parole.map((p, i) => `<li><i>${i + 1}</i>${esc(p)}</li>`).join("") : "";
  const prossimo =
    r.fase === "accesso"
      ? `<p>L'account esiste ma <b>non e premium</b>: le giornate con l'AI non si possono ancora scrivere. Adesso Claude rende premium l'account con una SQL su <code>profiles</code> (user_id <code>${esc(r.userId)}</code>), poi si rilancia lo stesso comando: trova premium e carica tutto il resto.</p>`
      : `<p>Caricamento completo. Sul telefono: apri dayalogue, metti <b>${esc(email)}</b> e il codice fisso, poi le otto parole qui sopra quando le chiede. In Impostazioni &gt; Lingua scegli English, perche l'account e in inglese.</p>`;
  return `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Referto . Account demo (${esc(r.fine?.slice(0, 10))})</title>
<style>
:root{--pg:#17171A;--pg-2:#202024;--line:rgba(255,255,255,.1);--ink:#EDEDF0;--mut:#A9A9B2;--faint:#77777F;--ok:#4ADE80;--no:#F87171;--hot:#FBBF24;--amb:#E3A15F}
*{box-sizing:border-box;margin:0;padding:0}body{background:var(--pg);color:var(--mut);font-family:-apple-system,system-ui,sans-serif;padding:48px 24px 120px;line-height:1.55}
.wrap{max-width:1000px;margin:0 auto}h1{font-family:"Iowan Old Style",Palatino,Georgia,serif;font-weight:400;font-size:36px;color:var(--ink);text-align:center;letter-spacing:-.02em}
.sub{text-align:center;color:var(--faint);margin-top:10px;font-size:14px}.label{font-size:11px;font-weight:650;letter-spacing:.22em;text-transform:uppercase;color:var(--faint);text-align:center;margin:48px 0 12px}
.parole{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;list-style:none;max-width:720px;margin:0 auto}.parole li{background:var(--pg-2);border:1px solid var(--line);border-radius:12px;padding:14px;font-family:ui-monospace,Menlo,monospace;font-size:18px;color:var(--ink);text-align:center}.parole li i{display:block;font-style:normal;font-size:10px;color:var(--faint);letter-spacing:.2em;margin-bottom:4px}
.box{background:var(--pg-2);border:1px solid var(--line);border-radius:14px;padding:16px 20px;max-width:820px;margin:0 auto;font-size:14.5px}.box b,.box code{color:var(--ink)}.box.hot{border-color:rgba(251,191,36,.4)}
table{border-collapse:collapse;width:100%;font-size:13px;margin-top:8px}th,td{border-top:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}th{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint)}td:first-child{color:var(--ink);font-weight:600}
.tuo{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--amb);border:1px solid rgba(227,161,95,.5);border-radius:999px;padding:1px 7px;margin-left:6px}.no{color:var(--no)}.ok{color:var(--ok)}
ul.piatto{list-style:none;max-width:820px;margin:0 auto;font-size:14px}ul.piatto li{padding:6px 0;border-top:1px solid var(--line)}
</style></head><body><div class="wrap">
<h1>Account demo: ${r.fase === "accesso" ? "primo giro" : "caricato"}</h1>
<p class="sub">${esc(email)} su ${esc(base)} . fase <b>${esc(r.fase)}</b> . piano <b>${esc(r.piano)}</b> . utente <code>${esc(r.userId)}</code></p>
${parole ? `<p class="label">Le otto parole della cassaforte</p><ol class="parole">${parole}</ol><p class="sub">Servono sul telefono, una volta. Se si perdono, il diario demo si rifa da zero: non e un dramma, ma tienile.</p>` : ""}
<p class="label">Cosa succede adesso</p><div class="box hot">${prossimo}</div>
${r.errori.length ? `<p class="label">Errori</p><ul class="piatto">${r.errori.map((e) => `<li class="no">${esc(e)}</li>`).join("")}</ul>` : `<p class="label">Errori</p><p class="sub ok">nessuno</p>`}
${r.giornate.length ? `<p class="label">Le giornate</p><table><tr><th>giorno</th><th>titolo (dell'AI, salvo lucchetto)</th><th>obiettivi</th><th>misure lette</th><th>esito</th></tr>${righe}</table>` : ""}
${r.memo.length ? `<p class="label">Memo</p><ul class="piatto">${r.memo.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : ""}
${r.recap ? `<p class="label">Recap</p><p class="sub">${esc(r.recap)}</p>` : ""}
<p class="label">Profilo</p><p class="sub">nome: ${esc(r.profilo.nome ?? "-")} . foto: ${r.profilo.foto ? "caricata" : "-"} . obiettivi: ${esc(r.obiettivi.join(", ") || "-")}</p>
<p class="sub" style="margin-top:40px">inizio ${esc(r.inizio)} . fine ${esc(r.fine)}</p>
</div></body></html>`;
}

/* ---------------- da riga di comando: il Chrome del Mac ---------------- */
const eMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (eMain) {
  const { chromium } = await import("playwright-core");
  const base = process.env.JM_BASE ?? "https://dayalogue.com";
  const email = process.env.JM_DEMO_EMAIL ?? "appreview@dayalogue.com";
  const codice = process.env.JM_DEMO_CODICE ?? "";
  const datiPath = process.env.JM_DEMO_DATI ?? join(QUI, "..", "demo", "giulia-en.json");
  const foto = process.env.JM_DEMO_FOTO ?? join(QUI, "..", "demo", "giulia-profilo.jpg");
  const refertoPath = process.env.JM_DEMO_REFERTO ?? join(process.cwd(), "referto-account-demo.html");
  const profilo = process.env.JM_DEMO_PROFILO ?? join(process.env.HOME ?? ".", ".dayalogue-demo-chrome");
  if (!codice) {
    console.error("manca JM_DEMO_CODICE (il codice fisso di JM_REVIEW_CODE)");
    process.exit(2);
  }
  const dati = JSON.parse(readFileSync(datiPath, "utf8"));
  mkdirSync(profilo, { recursive: true });
  const paroleFile = join(profilo, "parole.txt");
  let parole = (process.env.JM_DEMO_PAROLE ?? "").trim().split(/\s+/).filter(Boolean);
  if (parole.length !== 8 && existsSync(paroleFile)) {
    parole = readFileSync(paroleFile, "utf8").trim().split(/\s+/).filter(Boolean);
  }
  if (parole.length !== 8) parole = null;

  const ctx = await chromium.launchPersistentContext(profilo, {
    channel: "chrome",
    headless: false,
    viewport: { width: 430, height: 932 },
    locale: "en-GB",
    args: ["--window-size=470,1000"],
  });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("jm:lang", "en");
    } catch {}
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  let referto;
  try {
    referto = await caricaDemo({
      page,
      base,
      dati,
      foto: existsSync(foto) ? foto : null,
      parole,
      email,
      codice,
    });
  } catch (e) {
    referto = {
      inizio: new Date().toISOString(),
      fine: new Date().toISOString(),
      fase: "interrotta",
      userId: null,
      parole,
      piano: null,
      profilo: {},
      obiettivi: [],
      giornate: [],
      memo: [],
      recap: null,
      errori: [e instanceof Error ? e.message : String(e)],
    };
    console.error("INTERROTTO: " + referto.errori[0]);
    await page.screenshot({ path: refertoPath.replace(/\.html$/, "-schermata.png"), fullPage: true }).catch(() => undefined);
  }
  if (referto.parole?.length === 8) writeFileSync(paroleFile, referto.parole.join(" ") + "\n");
  writeFileSync(refertoPath, refertoHtml(referto, { email, base }));
  writeFileSync(refertoPath.replace(/\.html$/, ".json"), JSON.stringify(referto, null, 2));
  console.log("referto: " + refertoPath);
  await ctx.close();
  process.exit(referto.fase === "interrotta" ? 1 : 0);
}
