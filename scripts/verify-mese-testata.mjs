// Il banco della TESTATA DEL MESE e del TASTO DELLA VISTA (30 agosto 2026,
// mockup design/mockups/mese-testata.html, strada A scelta da Manuel).
//
// Due richieste, e sono di natura diversa.
//
//  1. LE FRECCE NON SI MUOVONO. "Posizione fissa alle due estremita", con
//     il mese al centro. Non e una preferenza estetica: e la promessa che
//     il pollice torni sempre nello stesso punto. Con flex e
//     space-between il centro non e il centro, e "cio che avanza", e balla
//     col titolo. Qui si misura la cosa vera — la stessa freccia su mesi di
//     lunghezza diversa deve stare allo stesso pixel — e non la regola CSS
//     che dovrebbe produrla.
//
//  2. IL TASTO DELLA VISTA NON STA PIU LI. Non cambia COSA guardi ma COME
//     lo guardi: e salito nella barra in alto, dove Calendario di Apple
//     mette lo stesso comando. Il banco controlla che sia sparito dalla
//     riga del mese, che sia comparso nella barra, e soprattutto che il
//     PALLINO resti l'ultimo elemento a destra: e l'invariante su cui e
//     costruita tutta la barra (verify-barra-alto misura che stia nello
//     stesso pixel su ogni schermata), e uno slot nuovo accanto a lui e
//     esattamente il modo in cui si rompe senza accorgersene.
//
//     Lo slot e per UNA azione sola. Il banco lo fa rispettare: se un
//     giorno ce ne fossero due, esce rosso e chi legge trova qui scritto
//     perche.
//
//  3. LA MISURA DEI BERSAGLI. Il tasto nuovo e 44 come il pallino che gli
//     sta accanto (brandbook cap. 05). Due tasti vicini di misura diversa
//     si vedono, anche senza saper dire perche.
//
//  4. L'ICONA NON E UN HAMBURGER. Tre righe uguali in iOS vogliono dire
//     "menu", cioe "apro un cassetto di comandi": il tasto prometteva una
//     cosa e ne dava un'altra. Una lista si disegna con righe corte
//     precedute da un puntino, e i puntini sono cerchi: il banco li conta.
//
// Gira in modalita locale: niente rete, niente database, niente AI.
//
// PROVATO A MORDERE il 30 agosto 2026, cinque volte, e uno dei morsi ha
// cambiato l'idea che avevo del banco:
//   1. rimesso `display: flex; justify-content: space-between` al posto
//      delle tre colonne -> VERDE. Non e un buco: con tre figli e il
//      titolo che puo restringersi (min-width 0 piu il trattino), flex e
//      griglia danno lo STESSO risultato su ogni cosa che conta. Il banco
//      guarda il risultato, non l'attrezzo, ed e giusto cosi. Prima di
//      accorgermene il controllo del nome lunghissimo non c'era: e nato da
//      questo morso, ed e la cosa che davvero non si puo dare per scontata.
//      La griglia resta la scrittura scelta perche dice a chi legge cosa
//      e fisso e cosa e elastico; se un giorno qualcuno la cambia in flex
//      con criterio, il banco non deve fermarlo.
//   2. tolto <AppBarAzione> (tasto di nuovo nella riga) -> 2 rossi.
//   3. messo lo slot DOPO il pallino -> rossi "il pallino resta l'ultimo"
//      e "resta attaccato al bordo" (318 invece di 366: il pallino si era
//      spostato di 48 punti, cioe esattamente il difetto che la barra e
//      nata per non avere).
//   4. rimessa l'icona a tre righe uguali -> rosso il conto dei puntini.
//   5. infilata una seconda azione nello slot -> rosso "una azione sola".
// Ripristinato ogni volta: 28/28.

import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const LARGO = 390;

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({
  executablePath: EXE,
  args: ["--no-sandbox"],
});

async function apri({ vista = "griglia", width = LARGO, height = 800 } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    locale: "it-IT",
    hasTouch: true,
    isMobile: width < 1024,
  });
  await ctx.addInitScript((v) => {
    try {
      window.localStorage.setItem("jm.mode", "local");
      window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
      window.localStorage.setItem("jm.saluto.silenzio", "dev:banco");
      if (v) window.localStorage.setItem("jm.mese.vista", v);
      else window.localStorage.removeItem("jm.mese.vista");
    } catch {}
  }, vista);
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + "/mese", { waitUntil: "networkidle" });
  await page.waitForTimeout(2200);
  return { ctx, page, errors };
}

/* ============ 1. LE FRECCE NON SI MUOVONO ============ */
{
  const { ctx, page, errors } = await apri();

  const riga = () =>
    page.evaluate(() => {
      const h = document.querySelector(".jm-month-header");
      const n = h.querySelectorAll(".jm-mese-nav");
      const t = h.querySelector(".jm-month-title");
      const b = (e) => e.getBoundingClientRect();
      return {
        mese:
          document.querySelector(".jm-mese-mini")?.getAttribute("data-jm-month") ??
          null,
        nome: t.innerText.replace(/\s+/g, " ").trim(),
        /* La larghezza DISEGNATA del nome, non il numero di lettere:
           "Giugno 2026" e "Luglio 2026" hanno le stesse lettere e
           larghezze diverse, ed e la larghezza a spingere le frecce. */
        largoNome: Math.round(b(t).width),
        quante: n.length,
        sinistra: Math.round(b(n[0]).left),
        destra: Math.round(b(n[1]).right),
        centroTitolo: Math.round(b(t).left + b(t).width / 2),
        centroSchermo: Math.round(window.innerWidth / 2),
        avantiSpenta: n[1].disabled,
        avantiVisibile: getComputedStyle(n[1]).display !== "none",
        ordine: [...h.children].map((e) =>
          e.className.toString().split(" ")[0],
        ),
      };
    });

  const prima = await riga();
  check(
    "griglia: la riga e freccia, nome, freccia — in quest'ordine",
    prima.quante === 2 &&
      prima.ordine.length === 3 &&
      prima.ordine[0] === "jm-mese-nav" &&
      prima.ordine[1] === "jm-month-title" &&
      prima.ordine[2] === "jm-mese-nav",
    JSON.stringify(prima.ordine),
  );

  // Sul mese corrente la freccia avanti e SPENTA ma c'e: farla sparire
  // rimetterebbe in movimento la riga che stiamo inchiodando.
  check(
    "sul mese corrente la freccia avanti e spenta ma resta al suo posto",
    prima.avantiSpenta === true && prima.avantiVisibile === true,
    `spenta ${prima.avantiSpenta}, visibile ${prima.avantiVisibile}`,
  );

  // Quattro mesi di lunghezza diversa, un solo asse.
  const misure = [prima];
  for (let i = 0; i < 3; i++) {
    await page.locator(".jm-month-header .jm-mese-nav").first().click();
    await page.waitForTimeout(800);
    misure.push(await riga());
  }
  const larghezze = misure.map((m) => m.largoNome);
  const spread = Math.max(...larghezze) - Math.min(...larghezze);
  check(
    "la prova ha senso: i quattro nomi sono davvero larghi diversi",
    new Set(misure.map((m) => m.nome)).size === 4 && spread >= 6,
    `${misure.map((m) => `${m.nome} ${m.largoNome}px`).join(" | ")} — scarto ${spread}px`,
  );
  check(
    "la freccia INDIETRO sta allo stesso pixel in tutti e quattro",
    new Set(misure.map((m) => m.sinistra)).size === 1,
    misure.map((m) => m.sinistra).join(" "),
  );
  check(
    "la freccia AVANTI sta allo stesso pixel in tutti e quattro",
    new Set(misure.map((m) => m.destra)).size === 1,
    misure.map((m) => m.destra).join(" "),
  );
  check(
    "e il nome del mese e centrato davvero, non 'quel che avanza'",
    misure.every((m) => Math.abs(m.centroTitolo - m.centroSchermo) <= 1),
    misure.map((m) => `${m.centroTitolo}/${m.centroSchermo}`).join(" "),
  );

  /* La prova che distingue davvero le tre colonne da uno space-between:
     un nome LUNGO. Con tre figli e space-between le frecce stanno ai bordi
     lo stesso, finche il centro ci sta; con un nome che non ci sta, in
     flex il titolo spinge e le frecce si spostano, in griglia le colonne
     sono fisse e a cedere e il nome (col trattino). Scoperto provando a
     mordere il banco il 30 agosto 2026: senza questo controllo, rimettere
     space-between usciva tutto verde. Le lingue esistono: "Settembre" in
     tedesco, o la misura del testo al massimo, arrivano li davvero. */
  const lungo = await page.evaluate(() => {
    const h = document.querySelector(".jm-month-header");
    const n = h.querySelectorAll(".jm-mese-nav");
    const nome = h.querySelector(".jm-month-nome");
    const prima = nome.textContent;
    nome.textContent = "Settembre Ottobre Novembre Dicembre 2026";
    const b = (e) => e.getBoundingClientRect();
    const r = {
      sinistra: Math.round(b(n[0]).left),
      destra: Math.round(b(n[1]).right),
      largoNome: Math.round(b(nome).width),
      // il nome deve cedere col trattino, non sfondare
      tagliato: nome.scrollWidth > nome.clientWidth + 1,
    };
    nome.textContent = prima;
    return r;
  });
  check(
    "con un nome LUNGHISSIMO le frecce non si spostano lo stesso",
    lungo.sinistra === prima.sinistra && lungo.destra === prima.destra,
    `sinistra ${lungo.sinistra} (era ${prima.sinistra}), destra ${lungo.destra} (era ${prima.destra})`,
  );
  check(
    "e a cedere e il nome, che si accorcia col trattino",
    lungo.tagliato === true,
    `largo ${lungo.largoNome}px, tagliato ${lungo.tagliato}`,
  );

  /* ---- 2. il tasto della vista non sta piu nella riga ---- */
  const barra = await page.evaluate(() => {
    const h = document.querySelector(".jm-month-header");
    const app = document.querySelector(".jm-appbar");
    const slot = document.querySelector("#jm-appbar-azione");
    const gruppo = document.querySelector(".jm-appbar-r");
    const dot = document.querySelector(".jm-hd-av");
    const vista = document.querySelector(".jm-mese-vista");
    const b = (e) => e.getBoundingClientRect();
    return {
      nellaRiga: !!h.querySelector(".jm-mese-vista"),
      nellaBarra: !!app?.querySelector(".jm-mese-vista"),
      azioniNelloSlot: slot ? slot.childElementCount : -1,
      pallinoUltimo: gruppo?.lastElementChild?.contains(dot) === true,
      pallinoDestra: Math.round(b(dot).right),
      /* Il bordo del CONTENUTO, non del riquadro: .jm-appbar-in ha 24
         punti di respiro laterale, ed e a quel bordo che il pallino deve
         restare attaccato. */
      barraDestra: (() => {
        const el = document.querySelector(".jm-appbar-in");
        const pad = parseFloat(getComputedStyle(el).paddingRight) || 0;
        return Math.round(b(el).right - pad);
      })(),
      vistaMis: [Math.round(b(vista).width), Math.round(b(vista).height)],
      dotMis: [Math.round(b(dot).width), Math.round(b(dot).height)],
      // I puntini della lista: cerchi nell'icona. Un hamburger non ne ha.
      puntini: vista.querySelectorAll("svg circle").length,
      premuto: vista.getAttribute("aria-pressed"),
    };
  });
  check("il tasto della vista NON e piu nella riga del mese", barra.nellaRiga === false);
  check("ed e nella barra in alto", barra.nellaBarra === true);
  check(
    "lo slot della barra porta UNA azione sola",
    barra.azioniNelloSlot === 1,
    String(barra.azioniNelloSlot),
  );
  check(
    "il pallino resta l'ULTIMO elemento a destra",
    barra.pallinoUltimo === true,
  );
  check(
    "e resta attaccato al bordo del contenuto, come prima",
    Math.abs(barra.pallinoDestra - barra.barraDestra) <= 1,
    `${barra.pallinoDestra} contro ${barra.barraDestra}`,
  );
  check(
    "il tasto nuovo e grande come il pallino (44, brandbook cap. 05)",
    barra.vistaMis[0] === 44 &&
      barra.vistaMis[1] === 44 &&
      barra.vistaMis[0] === barra.dotMis[0],
    `vista ${barra.vistaMis.join("x")}, pallino ${barra.dotMis.join("x")}`,
  );
  check(
    "in griglia l'icona e una LISTA coi puntini, non un hamburger",
    barra.puntini === 3 && barra.premuto === "true",
    `${barra.puntini} puntini, premuto ${barra.premuto}`,
  );

  /* ---- 3. e funziona: scambia le viste nei due sensi ---- */
  await page.locator(".jm-appbar .jm-mese-vista").click();
  await page.waitForTimeout(900);
  const inLista = await page.evaluate(() => ({
    griglia: !!document.querySelector(".jm-mese-mini"),
    lista: !!document.querySelector(".jm-day-list"),
    frecce: document.querySelectorAll(".jm-month-header .jm-mese-nav").length,
    contatore: !!document.querySelector(".jm-month-count"),
    quadrati: document.querySelectorAll(".jm-mese-vista svg rect").length,
  }));
  check(
    "il tasto porta davvero alla lista",
    inLista.lista === true && inLista.griglia === false,
  );
  check(
    "in lista la riga non ha frecce e il contatore torna al suo posto",
    inLista.frecce === 0 && inLista.contatore === true,
    `frecce ${inLista.frecce}, contatore ${inLista.contatore}`,
  );
  check(
    "e l'icona diventa la scacchiera (quattro quadrati)",
    inLista.quadrati === 4,
    String(inLista.quadrati),
  );

  await page.locator(".jm-appbar .jm-mese-vista").click();
  await page.waitForTimeout(900);
  check(
    "e riporta alla scacchiera",
    (await page.locator(".jm-mese-mini").count()) === 1,
  );

  check("zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ 4. LE ALTRE SCHERMATE NON GUADAGNANO NIENTE ============ */
{
  const { ctx, page, errors } = await apri({ vista: "griglia" });
  for (const rotta of ["/", "/remember", "/recap"]) {
    await page.goto(BASE + rotta, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => {
      const slot = document.querySelector("#jm-appbar-azione");
      const dot = document.querySelector(".jm-hd-av");
      return {
        slotVuoto: slot ? slot.childElementCount === 0 : null,
        slotLargo: slot ? Math.round(slot.getBoundingClientRect().width) : -1,
        pallinoDestra: dot ? Math.round(dot.getBoundingClientRect().right) : -1,
      };
    });
    check(
      `${rotta}: lo slot azione e vuoto e non occupa spazio`,
      m.slotVuoto === true && m.slotLargo === 0,
      `vuoto ${m.slotVuoto}, largo ${m.slotLargo}px`,
    );
  }
  check("altre schermate: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ 5. DESKTOP: NIENTE DI TUTTO QUESTO ============ */
{
  const { ctx, page, errors } = await apri({ vista: "griglia", width: 1440, height: 900 });
  const d = await page.evaluate(() => {
    const h = document.querySelector(".jm-month-header");
    const app = document.querySelector(".jm-appbar");
    const v = document.querySelector(".jm-mese-vista");
    const vis = (e) => (e ? getComputedStyle(e).display !== "none" : false);
    return {
      testataTelefono: vis(h),
      barra: vis(app),
      // il tasto sta dentro la barra: se la barra e spenta lo e anche lui
      vistaAltezza: v ? Math.round(v.getBoundingClientRect().height) : 0,
    };
  });
  check("desktop: la riga del mese del telefono non si disegna", d.testataTelefono === false);
  check("desktop: nemmeno la barra in alto", d.barra === false);
  check(
    "desktop: e il tasto della vista non occupa niente",
    d.vistaAltezza === 0,
    `${d.vistaAltezza}px`,
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
