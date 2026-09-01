// La prova del VETRO NATIVO del dock — la meta web, in un browser vero.
//
// Dentro il guscio iOS 26 la pillola non si sfoca da sola: una lastra di
// vetro nativo si appoggia sopra la WebView (ios/App/App/DockVetro.swift)
// e il web le dice dove stare (src/components/ui/dock-vetro.ts). La lastra
// vera si giudica SOLO sul telefono; quello che si puo provare qui, e che
// se si rompe rompe il telefono di Manuel, e L'ACCORDO:
//
//   1. col guscio (finto) il web spegne la sua imitazione e manda alla
//      lastra le misure GIUSTE della pillola, col modo chiaro/scuro giusto;
//   2. quando qualcosa copre il dock la lastra viene spenta e l'imitazione
//      web torna (il vetro nativo vive SOPRA la pagina: senza questo, un
//      foglio aperto se lo troverebbe acceso in faccia);
//   3. quando lo schermo cambia misura, la lastra viene rimisurata;
//   4. SENZA guscio non cambia niente: nessuna chiamata, il dock del sito
//      resta esattamente quello di verify-dock.mjs.
//
// Il guscio finto e window.__jmVetroFinto (il seam dichiarato in
// dock-vetro.ts): registra le chiamate invece di posare lastre.

import { chromium } from "playwright-core";

const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

async function contesto({ finto = true, aspetto = "dark" } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "it-IT",
    colorScheme: aspetto,
  });
  await ctx.addInitScript(
    ([conFinto, a]) => {
      try {
        window.localStorage.setItem("jm.mode", "local");
        window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
        window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
        window.localStorage.setItem("jm:theme", "minimal");
        // "system" + colorScheme del contesto: cosi il banco prova che il
        // MODO RISOLTO arriva alla lastra, non la stringa salvata.
        window.localStorage.setItem("jm:appearance", "system");
      } catch {}
      if (conFinto) {
        window.__vetroChiamate = [];
        window.__jmVetroFinto = {
          disponibile: async () => ({ vetro: true }),
          sincronizza: async (o) => {
            window.__vetroChiamate.push({ tipo: "sincronizza", ...o });
          },
          nascondi: async () => {
            window.__vetroChiamate.push({ tipo: "nascondi" });
          },
        };
      }
    },
    [finto, aspetto],
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  return { ctx, page, errors };
}

const ultima = (page, tipo) =>
  page.evaluate(
    (t) => [...window.__vetroChiamate].reverse().find((c) => c.tipo === t) ?? null,
    tipo,
  );

/* ============ 1. col guscio: misure giuste, imitazione spenta ============ */
{
  const { ctx, page, errors } = await contesto({ aspetto: "dark" });
  await page.goto(BASE + "/app", { waitUntil: "networkidle" });
  await page.waitForSelector(".jm-dock-nativo", { timeout: 20000 });
  await page.waitForTimeout(300);

  const stato = await page.evaluate(() => {
    const dock = document.querySelector(".jm-dock");
    const r = dock.getBoundingClientRect();
    const s = getComputedStyle(dock);
    return {
      rect: { x: r.left, y: r.top, larghezza: r.width, altezza: r.height },
      filtro: s.backdropFilter || s.webkitBackdropFilter,
      fondo: s.backgroundColor,
      ultimaSinc:
        [...window.__vetroChiamate].reverse().find((c) => c.tipo === "sincronizza") ??
        null,
    };
  });
  const c = stato.ultimaSinc;
  const combacia =
    c &&
    Math.abs(c.x - stato.rect.x) <= 2 &&
    Math.abs(c.y - stato.rect.y) <= 2 &&
    Math.abs(c.larghezza - stato.rect.larghezza) <= 2 &&
    Math.abs(c.altezza - stato.rect.altezza) <= 2;
  check(
    "la lastra riceve le misure vere della pillola",
    Boolean(combacia),
    c ? `lastra ${Math.round(c.x)},${Math.round(c.y)} ${Math.round(c.larghezza)}x${Math.round(c.altezza)}` : "nessuna chiamata",
  );
  check("e il modo giusto (scuro)", c?.modo === "dark", String(c?.modo));
  check(
    "l'imitazione web e spenta (niente blur doppio)",
    stato.filtro === "none" &&
      (stato.fondo === "rgba(0, 0, 0, 0)" || stato.fondo === "transparent"),
    `${stato.filtro} / ${stato.fondo}`,
  );

  /* -------- giro 2: il contenuto viaggia in fotografia -------- */
  const giro2 = await page.evaluate(() => {
    const sinc = [...window.__vetroChiamate]
      .reverse()
      .find((ch) => ch.tipo === "sincronizza" && ch.immagine);
    const acceso = document.querySelector(".jm-dock-t.on");
    const ra = acceso ? acceso.getBoundingClientRect() : null;
    const op = (sel) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el).opacity : null;
    };
    return {
      foto: sinc ? sinc.immagine.length : 0,
      scala: sinc?.scala ?? 0,
      lente: sinc?.lente ?? null,
      tastoAcceso: ra ? { x: ra.left, larghezza: ra.width } : null,
      opTasto: op(".jm-dock-t"),
      opMic: op(".jm-dock-mic"),
      opBolla: op(".jm-dock-bolla"),
    };
  });
  check(
    "la fotografia del contenuto arriva alla lastra (png vero)",
    giro2.foto > 500 && giro2.scala > 0,
    `${giro2.foto} byte base64, scala ${giro2.scala}`,
  );
  const lenteGiusta =
    giro2.lente &&
    giro2.tastoAcceso &&
    Math.abs(giro2.lente.x - giro2.tastoAcceso.x) <= 2 &&
    Math.abs(giro2.lente.larghezza - giro2.tastoAcceso.larghezza) <= 2;
  check(
    "la lente e sul tasto acceso, misurata",
    Boolean(lenteGiusta),
    giro2.lente ? `lente x=${Math.round(giro2.lente.x)}` : "nessuna lente",
  );
  check(
    "icone, microfono e bolla web sono invisibili (li disegna il nativo)",
    giro2.opTasto === "0" && giro2.opMic === "0" && giro2.opBolla === "0",
    `${giro2.opTasto}/${giro2.opMic}/${giro2.opBolla}`,
  );

  /* -------- cambiando schermata, lente e foto seguono -------- */
  await page.evaluate(() => { window.__vetroChiamate.length = 0; });
  await page.click('.jm-dock-t[href="/app/mese"]');
  await page.waitForTimeout(1200);
  const dopoTab = await page.evaluate(() => {
    const sinc = [...window.__vetroChiamate]
      .reverse()
      .find((ch) => ch.tipo === "sincronizza" && ch.lente);
    const acceso = document.querySelector(".jm-dock-t.on");
    const ra = acceso ? acceso.getBoundingClientRect() : null;
    return {
      lente: sinc?.lente ?? null,
      tastoAcceso: ra ? { x: ra.left } : null,
      rifoto: [...window.__vetroChiamate].some(
        (ch) => ch.tipo === "sincronizza" && ch.immagine,
      ),
    };
  });
  check(
    "cambiando schermata la lente va sul tasto nuovo",
    Boolean(
      dopoTab.lente &&
        dopoTab.tastoAcceso &&
        Math.abs(dopoTab.lente.x - dopoTab.tastoAcceso.x) <= 2,
    ),
    dopoTab.lente ? `lente x=${Math.round(dopoTab.lente.x)}` : "nessuna lente",
  );
  check(
    "e la fotografia si rifa (il tasto acceso ha cambiato colore)",
    dopoTab.rifoto,
  );

  /* -------- 2. qualcosa copre il dock: la lastra si spegne -------- */
  /* Prima si azzera il registro: il dock muore e rinasce navigando
     (scheletro poi schermata vera) e un `nascondi` di quel giro morto
     farebbe passare il controllo anche a logica rotta. Morso provato. */
  await page.evaluate(() => {
    window.__vetroChiamate.length = 0;
  });
  await page.evaluate(() => {
    const velo = document.createElement("div");
    velo.id = "velo-di-prova";
    velo.style.cssText =
      "position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.5)";
    document.body.appendChild(velo);
  });
  await page.waitForTimeout(200);
  const spenta = await ultima(page, "nascondi");
  const classeVia = await page.evaluate(
    () => !document.querySelector(".jm-dock-nativo"),
  );
  const veloTornato = await page.evaluate(() => {
    const s = getComputedStyle(document.querySelector(".jm-dock"));
    return /blur/.test(s.backdropFilter || s.webkitBackdropFilter);
  });
  check("un velo sopra il dock spegne la lastra", spenta !== null);
  check("e l'imitazione web torna al suo posto", classeVia && veloTornato);

  await page.evaluate(() => {
    document.getElementById("velo-di-prova")?.remove();
    window.__vetroChiamate.length = 0;
  });
  await page.waitForTimeout(200);
  const riaccesa = await ultima(page, "sincronizza");
  check("via il velo, la lastra si riaccende", riaccesa !== null);

  /* -------- 3. schermo di misura diversa: si rimisura -------- */
  await page.evaluate(() => { window.__vetroChiamate.length = 0; });
  await page.setViewportSize({ width: 340, height: 700 });
  await page.waitForTimeout(300);
  const dopoResize = await ultima(page, "sincronizza");
  const rectDopo = await page.evaluate(() => {
    const r = document.querySelector(".jm-dock").getBoundingClientRect();
    return { larghezza: r.width, y: r.top };
  });
  check(
    "cambiando schermo la lastra viene rimisurata",
    dopoResize !== null &&
      Math.abs(dopoResize.larghezza - rectDopo.larghezza) <= 2 &&
      Math.abs(dopoResize.y - rectDopo.y) <= 2,
    dopoResize ? `${Math.round(dopoResize.larghezza)}px vs ${Math.round(rectDopo.larghezza)}px` : "nessuna chiamata",
  );

  check("nessun errore in console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ 4. modo chiaro: alla lastra arriva "light" ============ */
{
  const { ctx, page, errors } = await contesto({ aspetto: "light" });
  await page.goto(BASE + "/app", { waitUntil: "networkidle" });
  await page.waitForSelector(".jm-dock-nativo", { timeout: 20000 });
  await page.waitForTimeout(200);
  const c = await ultima(page, "sincronizza");
  check("col tema chiaro alla lastra arriva il vetro chiaro", c?.modo === "light", String(c?.modo));
  check("nessun errore in console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ============ 5. senza guscio: non e successo niente ============ */
{
  const { ctx, page, errors } = await contesto({ finto: false });
  await page.goto(BASE + "/app", { waitUntil: "networkidle" });
  await page.waitForSelector(".jm-dock", { timeout: 20000 });
  await page.waitForTimeout(400);
  const pulito = await page.evaluate(() => {
    const s = getComputedStyle(document.querySelector(".jm-dock"));
    const t = document.querySelector(".jm-dock-t");
    return {
      classe: Boolean(document.querySelector(".jm-dock-nativo")),
      blur: /blur/.test(s.backdropFilter || s.webkitBackdropFilter),
      opTasto: t ? getComputedStyle(t).opacity : null,
    };
  });
  check(
    "sul web il dock e quello di sempre (vetro web acceso, niente classe)",
    !pulito.classe && pulito.blur,
  );
  check(
    "e le icone si vedono, altro che fotografia",
    pulito.opTasto === "1",
    String(pulito.opTasto),
  );
  check("nessun errore in console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

await browser.close();

const falliti = results.filter((r) => !r.ok);
console.log(
  `\n${falliti.length === 0 ? "VERDE" : "ROSSO"}: ${results.length - falliti.length}/${results.length} controlli passati`,
);
process.exit(falliti.length === 0 ? 0 : 1);
