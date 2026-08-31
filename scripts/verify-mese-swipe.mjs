// Il banco del MESE CHE SI SFOGLIA COL DITO (30 agosto 2026).
//
// Richiesta di Manuel: nella griglia a scacchiera del telefono, cambiare
// mese col dito, "usa la stessa funzionalita che abbiamo per fare swipe
// left and right sul giorno" e "non deve scrollare verso l'alto, solo a
// sinistra e destra".
//
// Da qui i controlli. Non si misura "il gesto e piacevole": si misurano le
// cose che, rotte, rendono il gesto sbagliato o pericoloso.
//
//  1. IL VERSO. Trascini verso destra e arriva il mese PRIMA, che entra da
//     sinistra, dov'e la freccia "<". Le due strade, frecce e dito, non si
//     devono mai contraddire: e l'unica cosa che rende il gesto prevedibile.
//  2. SOLO DI LATO. Durante il trascinamento il piano si sposta in
//     orizzontale e basta: la componente verticale della trasformazione
//     deve essere ZERO, e la pagina non si deve muovere. Questo controllo
//     esiste perche il difetto e gia stato pagato una volta sulla giornata
//     ("la pagina si muove anche in alto o basso seguendo il dito ed e
//     fastidioso"), e in griglia non c'e nemmeno niente da scorrere.
//  3. IL MURO. Sul mese corrente il dito verso sinistra non porta nel
//     futuro: resiste e torna indietro. Un mese vuoto in avanti sarebbe
//     una bugia disegnata bene.
//  4. IL GESTO VERTICALE NON SI RUBA. Un dito che va su e giu non deve
//     cambiare mese: se lo facesse, ogni tentativo di scorrere sfoglierebbe.
//  5. IL TOCCO RESTA UN TOCCO. Il quadratino di un giorno si seleziona
//     ancora: un gesto che mangia i tap rompe la schermata che protegge.
//  6. DOVE NON DEVE ESSERCI. Nella vista a LISTA il riquadro che sfoglia
//     non esiste (li il dito verticale e lo scorrimento del feed, e i due
//     litigherebbero), e da lg non esiste per niente: sul computer si
//     cambia mese con le frecce.
//
// Gira in modalita locale: niente rete, niente database, niente AI.
//
// PROVATO A MORDERE il 30 agosto 2026, quattro volte, e il primo morso ha
// insegnato qualcosa:
//   1. invertito onPrima con onDopo -> UN rosso solo. Troppo poco: il dito
//      portava a settembre, cioe nel futuro, e nessun controllo se ne
//      accorgeva, perche il muro guarda solo la direzione "dopo". Da li e
//      nato il controllo "in nessun momento la griglia ha mostrato un mese
//      futuro", che tiene il registro di tutto cio che e passato a schermo.
//      Rifatto lo stesso morso: 2 rossi.
//   2. tolto muroDopo -> rossi il muro e il registro dei mesi futuri.
//   3. tolto il DaySwipe -> rossi i quattro della griglia, verdi lista e
//      desktop (cioe il banco sa distinguere dove il gesto deve mancare).
//   4. tolto il display:none da lg di .jm-mese-solo -> rossi i tre del
//      doppione sul desktop, col numero vero (849px, 838 di pagina in piu).
// Ripristinato ogni volta: 21/21.

import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({
  executablePath: EXE,
  args: ["--no-sandbox"],
});

async function apri({ vista = "griglia", width = 430, height = 860 } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    locale: "it-IT",
    hasTouch: true,
    isMobile: width < 1024,
  });
  await ctx.addInitScript(
    (v) => {
      try {
        window.localStorage.setItem("jm.mode", "local");
        window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
        window.localStorage.setItem("jm.saluto.silenzio", "dev:banco");
        if (v) window.localStorage.setItem("jm.mese.vista", v);
        else window.localStorage.removeItem("jm.mese.vista");
      } catch {}
    },
    vista,
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + "/app/mese", { waitUntil: "networkidle" });
  await page.waitForTimeout(2200);
  return { ctx, page, errors };
}

/** Il mese che la griglia sta mostrando, letto dal DOM e non dal titolo. */
const visti = [];
const meseMostrato = async (page) => {
  const m = await page.evaluate(
    () =>
      document.querySelector(".jm-mese-mini")?.getAttribute("data-jm-month") ??
      null,
  );
  if (m) visti.push(m);
  return m;
};

/**
 * Il mese di oggi, come lo calcola l'app (Europe/Rome, mai il fuso della
 * macchina che fa girare il banco).
 */
const meseDiOggi = (page) =>
  page.evaluate(() => {
    const p = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "2-digit",
    }).format(new Date());
    return p.slice(0, 7);
  });

/**
 * Un trascinamento vero, a passi, come un dito: un salto solo non fa
 * scattare la decisione orizzontale del gesto (servono almeno 6px prima
 * che decida) e misurerebbe una cosa che gli utenti non fanno mai.
 * Ritorna anche la trasformazione letta A META gesto: e li che si vede se
 * il piano si sta muovendo anche in verticale.
 */
async function trascina(page, { da, a, dy = 0, y }) {
  const passi = 10;
  await page.mouse.move(da, y);
  await page.mouse.down();
  let aMeta = null;
  for (let i = 1; i <= passi; i++) {
    const k = i / passi;
    await page.mouse.move(da + (a - da) * k, y + dy * k);
    await page.waitForTimeout(16);
    if (i === Math.round(passi / 2)) {
      aMeta = await page.evaluate(() => {
        const el = document.querySelector(".jm-mese-solo .jm-day-sw-piano");
        if (!el) return null;
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        return { x: Math.round(m.m41), y: Math.round(m.m42), scrollY: window.scrollY };
      });
    }
  }
  await page.mouse.up();
  await page.waitForTimeout(900);
  return aMeta;
}

/* ============ TELEFONO, VISTA A GRIGLIA ============ */
{
  const { ctx, page, errors } = await apri();

  check(
    "griglia: il riquadro che si sfoglia c'e",
    (await page.locator(".jm-mese-solo .jm-day-sw").count()) === 1,
  );

  // Manuel: "non deve scrollare verso l'alto". In griglia la schermata
  // sta dentro lo schermo: non c'e proprio niente da scorrere.
  const scorrevole = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );
  check(
    "griglia: la schermata non scorre in verticale, per niente",
    scorrevole <= 1,
    `${scorrevole}px di troppo`,
  );

  const partenza = await meseMostrato(page);
  const box = await page.locator(".jm-mese-mini-grid").boundingBox();
  const y = Math.round(box.y + box.height / 2);

  /* --- 1. verso destra = il mese PRIMA --- */
  const meta = await trascina(page, { da: 60, a: 360, dy: 6, y });
  const indietro = await meseMostrato(page);
  check(
    "il dito verso destra porta al mese PRIMA",
    indietro !== null && indietro < partenza,
    `da ${partenza} a ${indietro}`,
  );

  /* --- 2. e mentre lo fa, si muove SOLO di lato --- */
  check(
    "mentre il dito va di lato il piano non si muove in verticale",
    meta !== null && meta.y === 0 && meta.x > 0,
    meta ? `spostamento x ${meta.x}, y ${meta.y}` : "piano non trovato",
  );
  check(
    "e la pagina sotto resta ferma",
    meta !== null && meta.scrollY === 0,
    meta ? `scrollY ${meta.scrollY}` : "?",
  );

  /* --- 3. verso sinistra = il mese DOPO --- */
  await trascina(page, { da: 360, a: 60, dy: -6, y });
  const avanti = await meseMostrato(page);
  check(
    "il dito verso sinistra riporta al mese DOPO",
    avanti === partenza,
    `${indietro} -> ${avanti}, atteso ${partenza}`,
  );

  /* --- 4. il muro del futuro --- */
  await trascina(page, { da: 360, a: 60, y });
  const dopoIlMuro = await meseMostrato(page);
  check(
    "sul mese corrente il dito in avanti non porta nel futuro",
    dopoIlMuro === partenza,
    `${dopoIlMuro}`,
  );
  const tornato = await page.evaluate(() => {
    const el = document.querySelector(".jm-mese-solo .jm-day-sw-piano");
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return Math.round(m.m41);
  });
  check("e la griglia torna al suo posto", tornato === 0, `${tornato}px`);

  /* --- 5. un gesto verticale non sfoglia --- */
  const primaDelVerticale = await meseMostrato(page);
  await page.mouse.move(215, y - 90);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(215 + i, y - 90 + i * 18);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(700);
  check(
    "un dito che va su e giu NON cambia mese",
    (await meseMostrato(page)) === primaDelVerticale,
    `${primaDelVerticale} -> ${await meseMostrato(page)}`,
  );

  /* --- 6. il tocco resta un tocco --- */
  const cella = page.locator(".jm-mese-mini-c:not(.out)").nth(9);
  await cella.click();
  await page.waitForTimeout(500);
  check(
    "il quadratino di un giorno si seleziona ancora",
    (await page.locator(".jm-mese-mini-c.sel").count()) === 1,
  );

  /* --- 7. l'intestazione sta FUORI dal piano che scorre --- */
  /* IL CONTROLLO CHE MANCAVA (scoperto provando a mordere il 30 agosto
     2026: col verso invertito il dito portava a SETTEMBRE e il banco non
     se ne accorgeva, perche il muro guarda solo la direzione "dopo").
     Un mese futuro e uno schermo di quadratini vuoti che dice "non hai
     raccontato niente" di giorni che non sono ancora arrivati: la stessa
     bugia del muro, disegnata bene. Qui si guarda TUTTO quello che la
     griglia ha mostrato dall'inizio della prova, non l'ultimo stato. */
  const oggiMese = await meseDiOggi(page);
  const futuri = visti.filter((m) => m > oggiMese);
  check(
    "in nessun momento la griglia ha mostrato un mese futuro",
    futuri.length === 0,
    `oggi ${oggiMese}, visti ${[...new Set(visti)].join(" ")}`,
  );

  check(
    "il titolo del mese non e dentro il piano che si sposta",
    await page.evaluate(() => {
      const piano = document.querySelector(".jm-mese-solo .jm-day-sw-piano");
      const titolo = document.querySelector(".jm-month-title");
      return !!piano && !!titolo && !piano.contains(titolo);
    }),
  );

  check("griglia: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ TELEFONO, VISTA A LISTA ============ */
{
  const { ctx, page, errors } = await apri({ vista: null });
  check(
    "lista: il riquadro che sfoglia NON c'e",
    (await page.locator(".jm-mese-solo").count()) === 0,
  );
  check(
    "lista: e il feed puo ancora scorrere in verticale",
    (await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    )) > 100,
  );
  check("lista: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ DESKTOP ============ */
{
  const { ctx, page, errors } = await apri({ vista: "griglia", width: 1440, height: 900 });
  /* Il difetto trovato da questo banco il 30 agosto 2026: .jm-mese-solo
     aveva gia il suo `lg:hidden` e perdeva contro il display: flex scritto
     in mese/styles.css, quindi su desktop, per chi aveva scelto la griglia
     sul telefono, sotto la griglia grande ne stava una seconda, identica,
     alta 849px. Non si vedeva senza scorrere: per questo si misura anche
     l'altezza e lo scorrimento, non solo il display. */
  const doppione = await page.evaluate(() => {
    const el = document.querySelector(".jm-mese-solo");
    if (!el) return { display: "assente", altezza: 0 };
    return {
      display: getComputedStyle(el).display,
      altezza: Math.round(el.getBoundingClientRect().height),
    };
  });
  check(
    "desktop: la griglia compatta del telefono non si disegna",
    doppione.display === "none" || doppione.display === "assente",
    doppione.display,
  );
  check(
    "desktop: e non occupa nemmeno un pixel di pagina",
    doppione.altezza === 0,
    `${doppione.altezza}px`,
  );
  const inPiu = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );
  check(
    "desktop: niente pagina in piu da scorrere sotto la griglia grande",
    inPiu < 200,
    `${inPiu}px`,
  );
  const titoloDesk = () =>
    page.evaluate(
      () =>
        document
          .querySelector(".jm-mese-t")
          ?.innerText?.trim() ?? null,
    );
  const prima = await titoloDesk();
  await page.locator(".jm-mese-navpair .jm-mese-nav").first().click();
  await page.waitForTimeout(900);
  const dopo = await titoloDesk();
  check(
    "desktop: le frecce cambiano mese come prima",
    prima !== null && dopo !== null && prima !== dopo,
    `${prima} -> ${dopo}`,
  );
  check("desktop: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

await browser.close();

const ko = results.filter((r) => !r.ok);
console.log(`\n${results.length - ko.length}/${results.length} PASS`);
if (ko.length) {
  console.log("FALLITI:\n" + ko.map((r) => "  - " + r.name).join("\n"));
  process.exit(1);
}
