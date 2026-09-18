// Le altezze fisse della giornata (17 settembre 2026). Locale, porta 3100.
// Mockup design/mockups/giornata-altezze-fisse.html, opzione 1.
//
// Perche esiste. Manuel, sfogliando i giorni sul telefono: "photos of the
// day e su due posizioni diverse verticalmente, e scrollando tra i giorni
// si nota". La causa e che titolo e sintesi sono lunghi quanto capita.
// Qui non si guarda il CSS: si MISURA, su tre giornate di lunghezza molto
// diversa, dove comincia la striscia delle foto. Se le tre misure non
// coincidono, il lavoro non e fatto - e se un giorno qualcuno toglie il
// tetto, questo banco lo vede.
import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE || "http://localhost:3100";
const FIXTURE = new URL("./fixtures-altezze-fisse.json", import.meta.url).pathname;
// 10 marzo: titolo di una riga, sintesi corta.  11: titolo di due righe,
// sintesi media.  12: titolo di due righe, sintesi lunga.
const GIORNI = ["2026-03-10", "2026-03-11", "2026-03-12"];
// La giornata che sfonda il tetto a QUALSIASI larghezza: su desktop la
// colonna e piu larga e la stessa sintesi ci sta dentro, quindi la prova
// del velo vuole un testo che sfondi anche li.
const SFONDA = "2026-03-13";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

// Il saluto del primo avvio copre tutto: va chiuso o ogni click finisce
// sul velo (stessa strada di prova-foto-profilo.mjs).
async function chiudiSaluto(page) {
  const velo = page.locator(".jm-benv-sal");
  const c = await velo
    .waitFor({ state: "visible", timeout: 3000 })
    .then(() => true, () => false);
  if (!c) return;
  const spunta = page.locator(".jm-benv-sal-c input");
  if (await spunta.count()) await spunta.check().catch(() => undefined);
  await page.locator(".jm-benv-sal-b").click();
  await velo.waitFor({ state: "hidden", timeout: 10000 }).catch(() => undefined);
  await page.waitForTimeout(600);
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

for (const larghezza of [390, 1440]) {
  const nome = larghezza === 390 ? "telefono" : "desktop";
  const ctx = await browser.newContext({
    viewport: { width: larghezza, height: 900 },
    locale: "it-IT",
  });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("jm.mode", "local");
      localStorage.setItem("jm.ospite", "0");
    } catch {}
  });
  const page = await ctx.newPage();
  const erroriConsole = [];
  page.on("console", (m) => {
    if (m.type() === "error") erroriConsole.push(m.text());
  });

  await page.goto(BASE + "/app/settings", { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  await chiudiSaluto(page);
  await page.locator('input[type="file"][accept*="json"]').setInputFiles(FIXTURE);
  await page.waitForTimeout(2600);

  const misure = [];
  for (const g of GIORNI) {
    await page.goto(BASE + "/app/giorno?d=" + g, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => {
      const wrap = document.querySelector(".jm-fv-wrap");
      const add = document.querySelector(".jm-day-add");
      const clip = document.querySelector(".jm-fv-clip");
      const h = document.querySelector(".jm-fv-h");
      if (!wrap || !add) return null;
      const base = wrap.getBoundingClientRect().top;
      return {
        // Quanto sotto l'inizio della giornata comincia il tasto
        // "aggiungi": e' l'ancora, le foto vengono subito dopo.
        add: Math.round(add.getBoundingClientRect().top - base),
        titolo: h ? Math.round(h.getBoundingClientRect().height) : null,
        clip: clip ? Math.round(clip.getBoundingClientRect().height) : null,
        troppo: clip ? clip.hasAttribute("data-troppo") : null,
        // Il vero sfondamento, misurato: il contenuto contro il tetto.
        sfonda: clip
          ? clip.firstElementChild.offsetHeight - clip.clientHeight > 4
          : null,
      };
    });
    if (!m) {
      check(`${nome} ${g}: la giornata si apre`, false, "manca .jm-day-add");
      continue;
    }
    misure.push({ g, ...m });
  }

  if (misure.length === GIORNI.length) {
    const adds = misure.map((m) => m.add);
    const scarto = Math.max(...adds) - Math.min(...adds);
    check(
      `${nome}: il tasto "aggiungi" parte alla stessa altezza in tutti e tre i giorni`,
      scarto <= 1,
      adds.join(" / ") + ` (scarto ${scarto}px)`,
    );

    const titoli = misure.map((m) => m.titolo);
    const scartoT = Math.max(...titoli) - Math.min(...titoli);
    check(
      `${nome}: il titolo occupa la stessa altezza con una riga e con due`,
      scartoT <= 1,
      titoli.join(" / "),
    );

    const clips = misure.map((m) => m.clip);
    const scartoC = Math.max(...clips) - Math.min(...clips);
    check(
      `${nome}: la sintesi tiene il suo spazio anche quando e corta`,
      scartoC <= 1,
      clips.join(" / "),
    );

    // La sfumatura non e decorazione: deve accendersi SOLO dove il testo
    // sfonda davvero, o su una sintesi corta prometterebbe altro testo
    // che non c'e.
    // Non un elenco di giorni scritto a mano (a larghezze diverse sfonda
    // chi capita): la sfumatura c'e ESATTAMENTE quando il testo sfonda.
    check(
      `${nome}: la sfumatura c'e quando e solo quando il testo sfonda`,
      misure.every((m) => m.troppo === m.sfonda),
      misure.map((m) => `${m.g}: velo ${m.troppo} / sfonda ${m.sfonda}`).join("  "),
    );
  }

  // Il tocco apre, e aprendo la giornata si allunga (le foto scendono: e
  // voluto, succede solo quando lo chiedi tu).
  await page.goto(BASE + "/app/giorno?d=" + SFONDA, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const prima = await page.evaluate(() => {
    const wrap = document.querySelector(".jm-fv-wrap");
    const add = document.querySelector(".jm-day-add");
    return Math.round(add.getBoundingClientRect().top - wrap.getBoundingClientRect().top);
  });
  const velo = page.locator(".jm-fv-apri");
  check(`${nome}: sulla sintesi lunga c'e il velo "leggi tutto"`, await velo.isVisible());
  await velo.click();
  await page.waitForTimeout(600);
  const dopo = await page.evaluate(() => {
    const wrap = document.querySelector(".jm-fv-wrap");
    const add = document.querySelector(".jm-day-add");
    const clip = document.querySelector(".jm-fv-clip");
    return {
      add: Math.round(add.getBoundingClientRect().top - wrap.getBoundingClientRect().top),
      mascherata: clip ? clip.hasAttribute("data-troppo") : null,
      veloRimasto: !!document.querySelector(".jm-fv-apri"),
    };
  });
  check(`${nome}: aperta, la sintesi spinge giu il resto`, dopo.add > prima + 20, `${prima} -> ${dopo.add}`);
  check(`${nome}: aperta, il velo se ne va`, dopo.veloRimasto === false);
  check(`${nome}: aperta, la sfumatura sparisce`, dopo.mascherata === false);

  // Da aperta la sintesi torna quella di sempre: un tocco la riscrive.
  await page.locator(".jm-fv-sntap").click();
  await page.waitForTimeout(500);
  check(
    `${nome}: da aperta, toccando la sintesi si riscrive`,
    await page.locator(".jm-fv-snedit").isVisible(),
  );
  const altoEditor = await page.evaluate(() => {
    const ta = document.querySelector(".jm-fv-snedit");
    const clip = document.querySelector(".jm-fv-clip");
    if (!ta || !clip) return null;
    // Il campo non deve finire tagliato dal riquadro.
    return Math.round(clip.getBoundingClientRect().bottom - ta.getBoundingClientRect().bottom);
  });
  check(
    `${nome}: il campo di scrittura non resta tagliato dal tetto`,
    altoEditor !== null && altoEditor >= -1,
    `${altoEditor}px`,
  );

  // LA MATITA DEL TITOLO. E uscita dal titolo (headline-editable.tsx)
  // proprio perche il taglio a due righe se la mangiava: qui si controlla
  // sul caso peggiore, cioe il titolo che le due righe le riempie tutte.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.goto(BASE + "/app/giorno?d=2026-03-11", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const matita = page.locator(".jm-fv-hazione .jm-fv-hpen");
  check(`${nome}: su un titolo di due righe piene la matita si vede ancora`, await matita.isVisible());
  const dentroIlTitolo = await page.evaluate(() => {
    const h = document.querySelector(".jm-fv-h");
    const m = document.querySelector(".jm-fv-hazione .jm-fv-hpen");
    if (!h || !m) return null;
    const a = h.getBoundingClientRect();
    const b = m.getBoundingClientRect();
    // Deve stare SOTTO il titolo, non sovrapposta all'ultima riga.
    return b.top >= a.bottom - 1;
  });
  check(`${nome}: la matita non finisce sopra il testo del titolo`, dentroIlTitolo === true);
  await matita.click();
  await page.waitForTimeout(500);
  check(
    `${nome}: toccando la matita si riscrive il titolo`,
    await page.locator(".jm-fv-hedit").isVisible(),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // Sfogliando, ogni giornata riparte piegata.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.goto(BASE + "/app/giorno?d=2026-03-11", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.goto(BASE + "/app/giorno?d=" + SFONDA, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  check(
    `${nome}: cambiando giorno la sintesi torna piegata`,
    await page.locator(".jm-fv-apri").isVisible(),
  );

  const veri = erroriConsole.filter((e) => !/Supabase non configurato|favicon/i.test(e));
  check(`${nome}: zero errori in console`, veri.length === 0, veri.slice(0, 2).join(" | "));

  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length === 0 ? 0 : 1);
