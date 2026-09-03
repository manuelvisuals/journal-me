// Verifica del messaggio di benvenuto (31 agosto 2026). Locale, porta 3200.
//
// Mockup approvato: design/mockups/messaggio-benvenuto.html (strada 1).
//
// Le promesse da difendere, in ordine di importanza:
//   1. il velo copre TUTTO e blocca i tocchi finche non si preme il tasto
//      (e la cosa che Manuel ha chiesto per iscritto);
//   2. in modalita locale la promessa sulla rete del par. 5 della SPEC
//      ospite-e-cassaforte regge (scripts/lib/promessa-ospite.mjs: nessuna
//      richiesta esterna, verso /api solo le route AI dell'elenco chiuso e
//      solo con il braccialetto, niente tabelle delle giornate) e il testo
//      arriva da quello cotto nel pacchetto. Fino al 3 settembre 2026 la
//      frase era "NEMMENO UNA richiesta di rete": l'ospite la rompe per
//      forza, e la promessa e stata riscritta, non cancellata;
//   3. la lettera si legge tutta e il tasto resta in vista anche col testo
//      ingrandito al massimo;
//   4. la casella "non mostrare piu" compare dalla terza apertura, e il
//      silenzio che scrive vale finche non cambia la versione del messaggio;
//   5. il grassetto *fra asterischi* diventa grassetto, e gli asterischi
//      spariscono;
//   6. il messaggio dice "scrivimi" e l'animazione di chiusura vola dentro
//      la linguetta Feedback: quindi la linguetta DEVE portare da qualche
//      parte. L'indirizzo lo decide il pannello admin; di fabbrica e la
//      pagina dei contatti del sito (/support). Vuoto, la linguetta torna
//      un bottone muto invece di aprire una scheda vuota.
import { chromium } from "playwright-core";
import { osservaPromessa, verificaPromessa } from "./lib/promessa-ospite.mjs";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3200";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

/**
 * Un contesto nuovo = un dispositivo nuovo. Il saluto NON viene silenziato
 * (al contrario di tutti gli altri banchi): qui e il soggetto.
 */
async function nuovoContesto({
  width = 390,
  height = 844,
  theme = "minimal",
  appearance = "light",
  scale = 1,
  lang = null,
} = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    locale: lang === "en" ? "en-US" : "it-IT",
  });
  await ctx.addInitScript(([t, a, z, l]) => {
    try {
      window.localStorage.setItem("jm.mode", "local");
      window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
      window.localStorage.setItem("jm:theme", t);
      window.localStorage.setItem("jm:appearance", a);
      window.localStorage.setItem("jm:scale", String(z));
      if (l) window.localStorage.setItem("jm:lang", l);
    } catch {}
  }, [theme, appearance, scale, lang]);
  return ctx;
}

/**
 * `external` e il registro della promessa sulla rete: lo riempie
 * osservaPromessa e lo giudica verificaPromessa (par. 5 della SPEC).
 * La proprieta `esterne` tiene il vecchio nome per i controlli che la
 * stampano.
 */
function osserva(page, errors, external) {
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  const reg = osservaPromessa(page, BASE);
  external.reg = reg;
}
function promessaRegge(external) {
  return verificaPromessa(external.reg ?? { esterne: [], api: [], tabelle: [] });
}

async function apri(ctx, url = "/app") {
  const errors = [];
  const external = [];
  const page = await ctx.newPage();
  osserva(page, errors, external);
  await page.goto(BASE + url, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  return { page, errors, external };
}

/* ============================================================
   1. IL VELO: copre tutto e blocca i tocchi
   ============================================================ */
{
  const ctx = await nuovoContesto();
  const { page, errors, external } = await apri(ctx);

  const velo = page.locator(".jm-benv-sal");
  check("il messaggio si apre al primo avvio", (await velo.count()) === 1);

  const stile = await velo.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      position: s.position,
      z: s.zIndex,
      blur: (s.backdropFilter || s.webkitBackdropFilter || "").toString(),
      r: el.getBoundingClientRect(),
    };
  });
  check("il velo e fisso e a tutto schermo", stile.position === "fixed", stile.position);
  check(
    "il velo copre tutta la finestra",
    Math.round(stile.r.width) >= 390 && Math.round(stile.r.height) >= 844,
    `${Math.round(stile.r.width)}x${Math.round(stile.r.height)}`,
  );
  check("il velo sfoca cio che c'e sotto", /blur\(\s*[1-9]/.test(stile.blur), stile.blur || "(vuoto)");
  check("il velo sta sopra tutto (z-index 2000)", Number(stile.z) >= 2000, stile.z);

  // Il velo e sopra a OGNI altro strato dell'app, misurato e non dedotto:
  // si guarda chi risponde al tocco nei punti dove stanno dock, barra e
  // linguetta. Se rispondesse uno di loro, il velo non coprirebbe davvero.
  const chiRisponde = await page.evaluate(() => {
    const punti = {
      "centro dello schermo": [195, 420],
      "il dock in fondo": [195, 800],
      "la barra in alto": [195, 26],
      "il bordo destro (linguetta)": [386, 422],
    };
    const out = {};
    for (const [nome, [x, y]] of Object.entries(punti)) {
      const el = document.elementFromPoint(x, y);
      out[nome] = el ? !!el.closest(".jm-benv-sal") : false;
    }
    return out;
  });
  for (const [dove, coperto] of Object.entries(chiRisponde)) {
    check(`sotto il velo non si tocca niente: ${dove}`, coperto === true);
  }

  /* L'ALTEZZA (1 settembre 2026, Manuel con gli screenshot): il riquadro
     non riempie lo schermo bordo a bordo come faceva sull'iPhone — sta
     dentro ~il 74 per cento dell'altezza, come il saluto di stoqfolio,
     e quando la lettera non ci sta e il CORPO a scorrere, col tasto per
     chiudere sempre in vista. */
  const misura = await page.evaluate(() => {
    const box = document.querySelector(".jm-benv-sal-box");
    const corpo = document.querySelector(".jm-benv-sal-corpo");
    const piede = document.querySelector(".jm-benv-sal-piede");
    const rb = box.getBoundingClientRect();
    const rp = piede.getBoundingClientRect();
    return {
      quota: rb.height / window.innerHeight,
      scorre: corpo.scrollHeight > corpo.clientHeight + 1,
      piedeInVista: rp.bottom <= window.innerHeight + 1,
    };
  });
  check(
    "il riquadro non riempie lo schermo (come stoqfolio, ~74%)",
    misura.quota <= 0.76,
    `${Math.round(misura.quota * 100)}% dello schermo`,
  );
  check("la lettera lunga scorre nel corpo", misura.scorre === true);
  check("il tasto per chiudere resta in vista", misura.piedeInVista === true);

  /* Il contenuto, dal testo di fabbrica. */
  const box = page.locator(".jm-benv-sal-box");
  check("c'e la foto", (await box.locator(".jm-benv-sal-foto").count()) === 1);
  check("c'e il marchio", (await box.locator(".jm-benv-sal-marchio").count()) === 1);
  check("c'e la promessa", (await box.locator(".jm-benv-sal-promessa").count()) === 1);
  check("c'e la riga in evidenza", (await box.locator(".jm-benv-sal-evidenza").count()) === 1);
  const par = await box.locator(".jm-benv-sal-p").count();
  check("i tre paragrafi della lettera ci sono", par === 3, `${par} trovati`);
  check("c'e la firma", (await box.locator(".jm-benv-sal-firma").innerText()) === "Manuel");
  check("il tasto dice Inizia", (await box.locator(".jm-benv-sal-b").innerText()) === "Inizia");

  /* Il grassetto: *fra asterischi* diventa <b>, e gli asterischi spariscono. */
  const testoTutto = await box.innerText();
  check("nessun asterisco rimasto a schermo", !testoTutto.includes("*"));
  const forte = await box.locator(".jm-benv-sal-p b").allInnerTexts();
  check(
    "la frase che conta e in grassetto",
    forte.some((f) => f.includes("scrivimi prima di lasciar perdere")),
    forte.join(" | ") || "(nessun grassetto)",
  );

  /* La lettera si legge tutta senza tagli, e il tasto e in vista. */
  const bottone = await box.locator(".jm-benv-sal-b").boundingBox();
  check(
    "il tasto e dentro lo schermo",
    bottone !== null && bottone.y + bottone.height <= 844,
    bottone ? `fondo a ${Math.round(bottone.y + bottone.height)}px` : "assente",
  );

  /* Le prime due volte non c'e la casella. */
  check(
    "prima apertura: nessuna casella",
    (await box.locator(".jm-benv-sal-c").count()) === 0,
  );

  { const v = promessaRegge(external); check("in modalita locale la promessa sulla rete (par. 5) regge", v.ok, v.dettagli); }
  check("zero errori in console", errors.length === 0, errors.join(" | "));
  await page.close();
  await ctx.close();
}

/* ============================================================
   2. LA CASELLA dalla terza apertura, e il silenzio
   ============================================================ */
{
  const ctx = await nuovoContesto();

  // Prima e seconda apertura: nessuna casella.
  for (const n of [1, 2]) {
    const { page } = await apri(ctx);
    const c = await page.locator(".jm-benv-sal-c").count();
    check(`apertura ${n}: nessuna casella`, c === 0, `${c} trovate`);
    await page.close();
  }

  // Terza: la casella c'e.
  const { page } = await apri(ctx);
  const casella = page.locator(".jm-benv-sal-c input");
  check("terza apertura: la casella compare", (await casella.count()) === 1);
  check(
    "la riga della casella e alta almeno 44px",
    await page.locator(".jm-benv-sal-c").evaluate((el) => el.getBoundingClientRect().height >= 44),
  );

  // Spuntata + Inizia: il messaggio se ne va e non torna.
  await casella.check();
  await page.locator(".jm-benv-sal-b").click();
  await page.waitForTimeout(1200);
  check("premendo Inizia il messaggio sparisce", (await page.locator(".jm-benv-sal").count()) === 0);
  const scritto = await page.evaluate(() => window.localStorage.getItem("jm.saluto.silenzio"));
  check("il silenzio porta dentro la versione", scritto === "dev:banco#v1", String(scritto));
  await page.close();

  const dopo = await apri(ctx);
  check(
    "dopo la spunta il messaggio non torna",
    (await dopo.page.locator(".jm-benv-sal").count()) === 0,
  );
  await dopo.page.close();

  // "Mostralo di nuovo" dal pannello = versione piu uno: il silenzio cade.
  // Qui si simula scrivendo un silenzio di una versione vecchia, che e
  // esattamente cio che si trova in tasca un utente dopo quel tasto.
  const ctx2 = await nuovoContesto();
  await ctx2.addInitScript(() => {
    try {
      window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v0");
    } catch {}
  });
  const rivisto = await apri(ctx2);
  check(
    "un silenzio di una versione vecchia non vale piu",
    (await rivisto.page.locator(".jm-benv-sal").count()) === 1,
  );
  const rimasto = await rivisto.page.evaluate(() =>
    window.localStorage.getItem("jm.saluto.silenzio"),
  );
  check("il silenzio scaduto viene buttato", rimasto === null, String(rimasto));
  await rivisto.page.close();
  await ctx2.close();
  await ctx.close();
}

/* ============================================================
   2-bis. ALLA MISURA DI PARTENZA (1,15): il taglio si deve vedere
   ============================================================ */
{
  // Nessun jm:scale piantato: e la misura con cui l'app si apre davvero.
  // Qui la lettera resta fuori di poco — la firma e la riga in fondo — e
  // il taglio cade su uno spazio bianco, dove la sola sfumatura non si
  // vede. Senza un secondo segnale la lettera sembra finita.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "it-IT" });
  await ctx.addInitScript(() => {
    try {
      window.localStorage.setItem("jm.mode", "local");
      window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
    } catch {}
  });
  const { page, errors } = await apri(ctx);
  const corpo = page.locator(".jm-benv-sal-corpo");
  const scorre = await corpo.evaluate((el) => el.scrollHeight > el.clientHeight + 1);
  if (scorre) {
    check("alla misura di partenza il taglio e segnalato", await corpo.evaluate((el) => el.hasAttribute("data-altro")));
    check(
      "e la riga sopra il tasto si vede",
      await page.locator(".jm-benv-sal-piede").evaluate((el) => {
        const b = getComputedStyle(el).borderTopWidth;
        return parseFloat(b) > 0;
      }),
    );
  } else {
    check("alla misura di partenza la lettera ci sta tutta", true);
    check(
      "e allora niente riga sopra il tasto",
      await page.locator(".jm-benv-sal-piede").evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth) === 0),
    );
  }
  const b = await page.locator(".jm-benv-sal-b").boundingBox();
  check(
    "alla misura di partenza il tasto e in vista",
    b !== null && b.y + b.height <= 844,
    b ? `fondo a ${Math.round(b.y + b.height)}px` : "assente",
  );
  check("alla misura di partenza zero errori in console", errors.length === 0, errors.join(" | "));
  await page.close();
  await ctx.close();
}

/* ============================================================
   3. TESTO INGRANDITO: la lettera scorre, il tasto resta in vista
   ============================================================ */
{
  const ctx = await nuovoContesto({ scale: 1.5 });
  const { page, errors } = await apri(ctx);
  const box = page.locator(".jm-benv-sal-box");
  check("a testo 1,5 il messaggio c'e ancora", (await box.count()) === 1);

  const b = await page.locator(".jm-benv-sal-b").boundingBox();
  check(
    "a testo 1,5 il tasto resta dentro lo schermo",
    b !== null && b.y + b.height <= 844 && b.y >= 0,
    b ? `da ${Math.round(b.y)} a ${Math.round(b.y + b.height)}` : "assente",
  );

  const corpo = await page.locator(".jm-benv-sal-corpo").evaluate((el) => ({
    scorre: el.scrollHeight > el.clientHeight + 1,
    overflow: getComputedStyle(el).overflowY,
  }));
  check("a testo 1,5 la lettera scorre invece di essere tagliata", corpo.overflow === "auto");
  check("a testo 1,5 la lettera e davvero piu alta del riquadro", corpo.scorre);
  // La sfumatura in fondo dice "sotto c'e altro". Deve accendersi quando
  // si scorre e SPEGNERSI arrivati in fondo, o sbiadirebbe la firma per
  // sempre. Si guarda l'attributo vero, non il CSS.
  check(
    "a testo 1,5 la sfumatura 'sotto c'e altro' e accesa",
    await page.locator(".jm-benv-sal-corpo").evaluate((el) => el.hasAttribute("data-altro")),
  );
  await page.locator(".jm-benv-sal-corpo").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(250);
  check(
    "arrivati in fondo la sfumatura si spegne",
    await page.locator(".jm-benv-sal-corpo").evaluate((el) => !el.hasAttribute("data-altro")),
  );
  check(
    "il messaggio non sborda dallo schermo",
    await box.evaluate((el) => el.getBoundingClientRect().bottom <= window.innerHeight + 1),
  );
  check("a testo 1,5 zero errori in console", errors.length === 0, errors.join(" | "));
  await page.close();
  await ctx.close();
}

/* ============================================================
   4. IN INGLESE, E IN UN TEMA SCURO
   ============================================================ */
{
  const ctx = await nuovoContesto({ lang: "en" });
  const { page } = await apri(ctx);
  const occhiello = await page.locator(".jm-benv-sal-occhiello").innerText();
  check("in inglese l'occhiello e tradotto", occhiello === "Welcome to", occhiello);
  const bott = await page.locator(".jm-benv-sal-b").innerText();
  check("in inglese il tasto dice Get started", bott === "Get started", bott);
  await page.close();
  await ctx.close();
}
{
  const ctx = await nuovoContesto({ theme: "wine", appearance: "dark" });
  const { page, errors } = await apri(ctx);
  check("nel tema scuro il messaggio c'e", (await page.locator(".jm-benv-sal").count()) === 1);
  // Il testo deve restare leggibile: si misura il contrasto vero fra il
  // colore del testo e il fondo della card, non si guarda il CSS.
  const contrasto = await page.locator(".jm-benv-sal-p").first().evaluate((el) => {
    const lum = (c) => {
      const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
      const f = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const testo = getComputedStyle(el).color;
    const card = getComputedStyle(el.closest(".jm-benv-sal-box")).backgroundColor;
    const a = lum(testo);
    const b = lum(card);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  check(
    "nel tema scuro la lettera resta leggibile (contrasto 4,5:1)",
    contrasto >= 4.5,
    `${contrasto.toFixed(2)}:1`,
  );
  check("nel tema scuro zero errori in console", errors.length === 0, errors.join(" | "));
  await page.close();
  await ctx.close();
}

/* ============================================================
   5. LA LINGUETTA: muta finche non ha un indirizzo
   ============================================================ */
{
  const ctx = await nuovoContesto();
  await ctx.addInitScript(() => {
    try {
      window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
    } catch {}
  });
  const { page } = await apri(ctx);
  const ling = page.locator(".jm-benv-ling");
  check("la linguetta Feedback c'e", (await ling.count()) === 1);
  const tag = await ling.evaluate((el) => el.tagName.toLowerCase());
  check("di fabbrica la linguetta porta ai contatti", tag === "a", tag);
  check(
    "e ci porta senza sbattere fuori dall'app",
    (await ling.getAttribute("href")) === "/support" &&
      (await ling.getAttribute("target")) === null,
    `${await ling.getAttribute("href")} target=${await ling.getAttribute("target")}`,
  );
  await page.close();

  // Svuotato dal pannello, torna il bottone muto di prima: mai una scheda
  // vuota in faccia a chi ha appena letto "scrivimi".
  const ctx0 = await nuovoContesto();
  await ctx0.addInitScript(() => {
    try {
      window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
      window.localStorage.setItem(
        "jm.benvenuto",
        JSON.stringify({ versione: 1, attivo: true, contatto_url: "" }),
      );
    } catch {}
  });
  const vuoto = await apri(ctx0);
  const tag0 = await vuoto.page.locator(".jm-benv-ling").evaluate((el) => el.tagName.toLowerCase());
  check("senza indirizzo la linguetta torna un bottone muto", tag0 === "button", tag0);
  await vuoto.page.close();
  await ctx0.close();

  // Con un indirizzo in cache (cioe scritto dal pannello admin) diventa un
  // link vero. La cache e la stessa che legge il saluto: nessuna rete.
  const ctx2 = await nuovoContesto();
  await ctx2.addInitScript(() => {
    try {
      window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
      window.localStorage.setItem(
        "jm.benvenuto",
        JSON.stringify({ versione: 1, attivo: true, contatto_url: "https://esempio.test/contatti" }),
      );
    } catch {}
  });
  const b = await apri(ctx2);
  const ling2 = b.page.locator(".jm-benv-ling");
  const tag2 = await ling2.evaluate((el) => el.tagName.toLowerCase());
  check("con un indirizzo la linguetta diventa un link", tag2 === "a", tag2);
  const href = await ling2.getAttribute("href");
  check("il link punta all'indirizzo del pannello", href === "https://esempio.test/contatti", String(href));
  check(
    "un indirizzo di fuori si apre in una scheda nuova",
    (await ling2.getAttribute("target")) === "_blank",
  );
  { const v = promessaRegge(b.external); check("la promessa sulla rete regge anche cosi", v.ok, v.dettagli); }
  await b.page.close();
  await ctx2.close();
  await ctx.close();
}

/* ============================================================
   6. SPENTO DAL PANNELLO: non si apre proprio
   ============================================================ */
{
  const ctx = await nuovoContesto();
  await ctx.addInitScript(() => {
    try {
      window.localStorage.setItem(
        "jm.benvenuto",
        JSON.stringify({ versione: 1, attivo: false, testo: "non si deve vedere" }),
      );
    } catch {}
  });
  const { page } = await apri(ctx);
  check("spento dal pannello, il messaggio non compare", (await page.locator(".jm-benv-sal").count()) === 0);
  await page.close();
  await ctx.close();
}

/* ============================================================
   7. IL TESTO ARRIVA DAL PANNELLO, non dal codice
   ============================================================ */
{
  const ctx = await nuovoContesto();
  await ctx.addInitScript(() => {
    try {
      window.localStorage.setItem(
        "jm.benvenuto",
        JSON.stringify({
          versione: 1,
          attivo: true,
          occhiello: "Ciao da",
          promessa: "Una promessa scritta dal pannello.",
          evidenza: "Una riga in evidenza dal pannello.",
          testo: "Primo paragrafo dal pannello.\n\nSecondo con *una parte forte* dentro.",
          firma: "Chi scrive",
          bottone: "Vai",
        }),
      );
    } catch {}
  });
  const { page } = await apri(ctx);
  const box = page.locator(".jm-benv-sal-box");
  check(
    "l'occhiello arriva dal pannello",
    (await box.locator(".jm-benv-sal-occhiello").innerText()) === "Ciao da",
  );
  check(
    "la promessa arriva dal pannello",
    (await box.locator(".jm-benv-sal-promessa").innerText()) === "Una promessa scritta dal pannello.",
  );
  const n = await box.locator(".jm-benv-sal-p").count();
  check("i paragrafi sono quelli del pannello", n === 2, `${n} trovati`);
  check(
    "il grassetto del pannello diventa grassetto",
    (await box.locator(".jm-benv-sal-p b").innerText()) === "una parte forte",
  );
  check(
    "il tasto porta il testo del pannello",
    (await box.locator(".jm-benv-sal-b").innerText()) === "Vai",
  );
  check(
    "la riga in fondo non compare senza indirizzo",
    (await box.locator(".jm-benv-sal-sotto").count()) === 0,
  );
  check(
    "la riga in fondo non compare senza indirizzo (link)",
    (await box.locator(".jm-benv-sal-sotto a").count()) === 0,
  );
  await page.close();
  await ctx.close();
}

/* ============================================================
   8. IL PANNELLO ADMIN non si apre a chi non e admin
   ============================================================ */
{
  const ctx = await nuovoContesto({ width: 1440, height: 900 });
  const { page, external } = await apri(ctx, "/admin");
  const n = await page.locator(".jm-adm").count();
  check("in modalita locale il pannello admin non disegna niente", n === 0, `${n} trovati`);
  { const v = promessaRegge(external); check("e la promessa sulla rete regge (niente verso /api ne fuori)", v.ok, v.dettagli); }
  await page.close();
  await ctx.close();
}

await browser.close();
const ok = results.filter((r) => r.ok).length;
console.log(`\n${ok}/${results.length} PASS`);
process.exit(ok === results.length ? 0 : 1);
