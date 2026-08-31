// LA BARRA IN ALTO (mockup design/mockups/pallino-ovunque.html, strada B,
// scelta da Manuel il 28 agosto 2026) — porta 3100.
//
// La cosa che conta, e che nessun banco copriva: il pallino dell'account
// deve stare NELLO STESSO PUNTO su tutte le schermate del telefono. Prima
// stava dentro l'intestazione di Oggi e navigando spariva; la strada
// scartata (una riga in ogni modulo) lo avrebbe messo in cinque punti
// leggermente diversi. Qui non si misura "c'e il pallino": si misurano le
// sue COORDINATE su ogni schermata e si pretende che siano identiche.
//
// Cosa si prova:
//  - il pallino: stesse coordinate e stessa misura su Oggi, Mese, Ricorda,
//    Recap, Impostazioni, Giornata, Persona; uno solo per schermata;
//  - non e piu dentro il contenuto: dentro <main> non c'e nessun pallino,
//    ne sulla sorgente di today-client (il modo piu facile di
//    reintrodurre il difetto e rimetterlo li);
//  - il titolo giusto per ogni indirizzo;
//  - su DESKTOP la barra non si vede e il pallino sta nella rail (uno solo);
//  - le pagine pubbliche (login, benvenuto, privacy) non hanno la barra;
//  - Mese scorre SOTTO la barra: la barra resta a zero e l'intestazione
//    del mese si incolla esattamente sotto, non sopra;
//  - una schermata corta non guadagna una striscia di scorrimento;
//  - alla misura del testo piu grande il pallino resta 44 e il titolo non
//    sborda;
//  - zero errori console.
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

async function open({ width = 390, height = 844, mode = "local", scale = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: "it-IT" });
  await ctx.addInitScript(
    ({ mode, scale }) => {
      try {
        window.localStorage.setItem("jm.mode", mode);
        // Il saluto e un velo aria-modal: si pianta il suo silenzio.
        if (mode === "local") {
          window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
          window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
        }
        if (scale) window.localStorage.setItem("jm:scale", String(scale));
      } catch {}
    },
    { mode, scale },
  );
  const page = await ctx.newPage();
  const errori = [];
  page.on("console", (m) => {
    if (m.type() === "error") errori.push(m.text());
  });
  return { ctx, page, errori };
}

/** Le coordinate del pallino, misurate dal bordo dello schermo. */
async function pallino(page) {
  return page.evaluate(() => {
    const tutti = document.querySelectorAll(".jm-hd-av");
    const el = document.querySelector(".jm-appbar .jm-hd-av");
    if (!el) return { quanti: tutti.length, trovato: false };
    const r = el.getBoundingClientRect();
    return {
      quanti: tutti.length,
      trovato: true,
      top: Math.round(r.top),
      destra: Math.round(window.innerWidth - r.right),
      larghezza: Math.round(r.width),
      altezza: Math.round(r.height),
      titolo: document.querySelector(".jm-appbar-t")?.textContent ?? null,
      dentroMain: !!document.querySelector("main .jm-hd-av"),
      scroll: document.documentElement.scrollHeight - window.innerHeight,
    };
  });
}

const SCHERMATE = [
  ["/", "Oggi"],
  ["/mese", "Mese"],
  ["/remember", "Ricorda"],
  ["/recap", "Recap"],
  ["/settings", "Impostazioni"],
  ["/giorno?d=2026-08-29", "Giornata"],
  ["/persona?nome=Marco", "Persona"],
];

/* ---------- 1. telefono: lo stesso punto, ovunque ---------- */
{
  const { ctx, page, errori } = await open({});
  const misure = [];
  for (const [rotta, titolo] of SCHERMATE) {
    await page.goto(BASE + rotta, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".jm-appbar .jm-hd-av", { timeout: 25000 });
    await page.waitForTimeout(700);
    const m = await pallino(page);
    misure.push([rotta, titolo, m]);
    check(`${rotta}: la barra c'e e il titolo e "${titolo}"`, m.titolo === titolo, String(m.titolo));
    check(`${rotta}: un solo pallino in pagina`, m.quanti === 1, `trovati ${m.quanti}`);
    check(`${rotta}: il pallino NON e dentro il contenuto`, m.dentroMain === false);
  }

  const rif = misure[0][2];
  for (const [rotta, , m] of misure.slice(1)) {
    check(
      `${rotta}: il pallino e nello STESSO punto di Oggi`,
      m.top === rif.top && m.destra === rif.destra,
      `top ${m.top} (atteso ${rif.top}), destra ${m.destra} (atteso ${rif.destra})`,
    );
    check(
      `${rotta}: il pallino ha la STESSA misura`,
      m.larghezza === rif.larghezza && m.altezza === rif.altezza,
      `${m.larghezza}x${m.altezza}`,
    );
  }
  check("il pallino e 44x44 (la misura dei suoi vicini)",
    rif.larghezza === 44 && rif.altezza === 44, `${rif.larghezza}x${rif.altezza}`);

  // Una schermata corta non deve guadagnare una striscia di scorrimento:
  // e il modo in cui una barra messa nel flusso si tradisce.
  const corte = misure.filter(([r]) => r === "/" || r === "/remember" || r === "/recap");
  for (const [rotta, , m] of corte) {
    check(`${rotta}: nessuna striscia di scorrimento inventata`, m.scroll === 0, `scroll ${m.scroll}`);
  }

  // Cio che e salito nella barra non deve restare scritto anche sotto.
  await page.goto(BASE + "/remember", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".jm-appbar-t", { timeout: 25000 });
  await page.waitForTimeout(500);
  const doppioni = await page.evaluate(() => {
    const soli = [...document.querySelectorAll(".jm-solo-desktop")];
    return { quanti: soli.length, visibili: soli.filter((e) => e.getBoundingClientRect().height > 0).length };
  });
  check("telefono: quello che e salito nella barra e marcato", doppioni.quanti > 0, `${doppioni.quanti}`);
  check("telefono: e non si vede due volte", doppioni.visibili === 0, `visibili ${doppioni.visibili}`);

  check("telefono: zero errori console", errori.length === 0, errori.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ---------- 2. Mese: si scorre SOTTO la barra ---------- */
{
  const { ctx, page } = await open({});
  await page.goto(BASE + "/mese", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".jm-month-header", { timeout: 25000 });
  await page.waitForTimeout(900);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(600);
  const dopo = await page.evaluate(() => {
    const b = document.querySelector(".jm-appbar").getBoundingClientRect();
    const m = document.querySelector(".jm-month-header").getBoundingClientRect();
    return {
      scrollY: Math.round(window.scrollY),
      barraTop: Math.round(b.top),
      barraBottom: Math.round(b.bottom),
      meseTop: Math.round(m.top),
    };
  });
  check("Mese: la pagina si e mossa davvero", dopo.scrollY > 200, `scrollY ${dopo.scrollY}`);
  check("Mese: la barra resta incollata in cima", dopo.barraTop === 0, `top ${dopo.barraTop}`);
  check(
    "Mese: l'intestazione del mese si incolla SOTTO la barra, non sopra",
    dopo.meseTop === dopo.barraBottom,
    `mese ${dopo.meseTop}, barra fino a ${dopo.barraBottom}`,
  );
  await ctx.close();
}

/* ---------- 3. desktop: la barra non c'e, la rail si ---------- */
{
  const { ctx, page, errori } = await open({ width: 1440, height: 950 });
  for (const rotta of ["/", "/mese", "/remember", "/recap", "/settings"]) {
    await page.goto(BASE + rotta, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".jm-acct-btn", { timeout: 25000 });
    await page.waitForTimeout(500);
    const d = await page.evaluate(() => ({
      barraVisibile: [...document.querySelectorAll(".jm-appbar")].some(
        (e) => e.getBoundingClientRect().height > 0,
      ),
      pallinoTestata: [...document.querySelectorAll(".jm-hd-av")].some(
        (e) => e.getBoundingClientRect().height > 0,
      ),
      pallinoRail: document.querySelectorAll(".jm-acct-btn").length,
    }));
    check(`desktop ${rotta}: nessuna barra in alto`, d.barraVisibile === false);
    check(`desktop ${rotta}: nessun pallino di testata`, d.pallinoTestata === false);
    check(`desktop ${rotta}: il pallino della rail c'e, uno solo`, d.pallinoRail === 1, String(d.pallinoRail));
  }
  // Il rovescio della medaglia: su desktop quei titoli DEVONO tornare,
  // perche li la barra non c'e e su desktop non cambia niente.
  await page.goto(BASE + "/remember", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".jm-rem-h", { timeout: 25000 });
  await page.waitForTimeout(400);
  const tornati = await page.evaluate(() => {
    const soli = [...document.querySelectorAll(".jm-solo-desktop")];
    return {
      quanti: soli.length,
      nascosti: soli.filter((e) => e.getBoundingClientRect().height === 0).length,
      titolo: document.querySelector(".jm-rem-h")?.textContent ?? null,
    };
  });
  check("desktop: i titoli saliti nella barra tornano al loro posto",
    tornati.quanti > 0 && tornati.nascosti === 0, `${tornati.quanti} marcati, ${tornati.nascosti} nascosti`);
  check("desktop: Ricorda ha ancora il suo titolo di pagina", tornati.titolo === "Ricorda", String(tornati.titolo));

  check("desktop: zero errori console", errori.length === 0, errori.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ---------- 4. le pagine pubbliche restano nude ---------- */
{
  const { ctx, page } = await open({ mode: "none" });
  for (const rotta of ["/login", "/benvenuto", "/privacy"]) {
    await page.goto(BASE + rotta, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const n = await page.evaluate(() => document.querySelectorAll(".jm-appbar").length);
    check(`${rotta}: nessuna barra (non sei ancora dentro)`, n === 0, `trovate ${n}`);
  }
  await ctx.close();
}

/* ---------- 5. testo grande: la barra tiene ---------- */
{
  const { ctx, page } = await open({ scale: 1.5 });
  await page.goto(BASE + "/settings", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".jm-appbar .jm-hd-av", { timeout: 25000 });
  await page.waitForTimeout(700);
  const g = await page.evaluate(() => {
    const t = document.querySelector(".jm-appbar-t");
    const a = document.querySelector(".jm-appbar .jm-hd-av");
    const b = document.querySelector(".jm-appbar");
    const rt = t.getBoundingClientRect();
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    return {
      scala: getComputedStyle(document.documentElement).getPropertyValue("--jm-ui-scale").trim(),
      titoloFont: Math.round(parseFloat(getComputedStyle(t).fontSize)),
      pallino: Math.round(ra.width),
      titoloDentro: rt.top >= rb.top - 1 && rt.bottom <= rb.bottom + 1,
      titoloNonTocca: rt.right <= ra.left,
    };
  });
  check("testo grande: la scala e davvero applicata", g.scala === "1.5", g.scala);
  check("testo grande: il titolo cresce col testo", g.titoloFont > 17, `${g.titoloFont}px`);
  check("testo grande: il pallino resta 44 (e un bersaglio, non testo)", g.pallino === 44, String(g.pallino));
  check("testo grande: il titolo resta dentro la barra", g.titoloDentro === true);
  check("testo grande: il titolo non finisce sotto il pallino", g.titoloNonTocca === true);
  await ctx.close();
}

/* ---------- 6. la sorgente: il pallino non torna dentro Oggi ---------- */
{
  const today = readFileSync("src/modules/oggi/components/today-client.tsx", "utf8");
  check(
    "sorgente: today-client non monta piu AccountMenu",
    !/AccountMenu/.test(today),
  );
  const bar = readFileSync("src/components/ui/app-bar.tsx", "utf8");
  check(
    "sorgente: la barra e l'unico posto che monta il pallino di testata",
    /AccountMenu\s+variant="testata"/.test(bar),
  );
  const moduli = [
    "src/modules/mese/components/mese-client.tsx",
    "src/modules/ricorda/components/remember-client.tsx",
    "src/modules/recap/components/recap-client.tsx",
    "src/modules/impostazioni/components/settings-client.tsx",
    "src/modules/oggi/components/day-client.tsx",
    "src/modules/ricorda/components/persona-client.tsx",
  ];
  const colpevoli = moduli.filter((f) => /AccountMenu/.test(readFileSync(f, "utf8")));
  check(
    "sorgente: nessun modulo si monta il pallino da solo",
    colpevoli.length === 0,
    colpevoli.join(", "),
  );
}

await browser.close();

const ok = results.filter((r) => r.ok).length;
console.log(`\n${ok}/${results.length} PASS`);
if (ok !== results.length) process.exitCode = 1;
