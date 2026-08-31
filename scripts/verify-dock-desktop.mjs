// Il banco del MENU DEL DESKTOP (mockup design/mockups/dock-desktop.html,
// strada 2 "la stessa forma", scelta da Manuel il 30 agosto 2026).
//
// Due cose da tenere ferme, e sono di natura diversa.
//
// 1. DA LG IL DOCK NON ESISTE. Non e una rifinitura: con la rail sinistra
//    gia presente, il dock sul desktop e un secondo menu con le stesse
//    cinque destinazioni. La regola per spegnerlo (`lg:hidden`) tab-bar.tsx
//    la scriveva gia e PERDEVA, perche le utility Tailwind stanno in
//    @layer e il display di una classe nostra vince. Il banco guarda il
//    risultato calcolato, non la presenza della classe: e l'unico modo di
//    accorgersi della prossima volta che una regola c'e ma non vince.
//    Si controlla anche .jm-dock-spazio, il vuoto di 94px che il dock si
//    porta dietro: nasconderne uno solo lascia un buco in fondo alla
//    pagina, cioe uno scorrimento su una schermata che non ha niente da
//    scorrere.
//
// 2. LA RAIL PARLA LA LINGUA DEL DOCK. Non si misura "e bello": si
//    misurano le tre cose che il mockup ha deciso e che, cambiate,
//    riportano il desktop a essere un'altra app rispetto al telefono —
//    il raggio a pillola, la LENTE sul posto acceso (lo stesso pezzo che
//    nel dock e .jm-dock-bolla, inchiostro translucido e non una tinta di
//    accento) e il tasto PIENO per l'azione, fuori dal vassoio.
//
// I colori non si confrontano con valori scritti a mano: si costruisce una
// sonda con `background: var(--color-glass-lens)`, si legge il suo colore
// calcolato e si confronta. Cosi il banco vale in tutti e sei i temi, in
// chiaro e in scuro, e continua a valere per un tema importato domani.
//
// Gira in modalita locale: niente rete, niente database, niente AI.
//
// PROVATO A MORDERE il 30 agosto 2026: tolto il `display: none` del blocco
// lg, i tre controlli sul dock sono usciti rossi e il resto verde;
// rimesso l'accento al posto della lente su .jm-rail-i.on, e uscito rosso
// il controllo della lente. Ripristinato, tutto verde.

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

async function apri(width, height, { tema, aspetto } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    locale: "it-IT",
  });
  await ctx.addInitScript(
    ([t, a]) => {
      try {
        window.localStorage.setItem("jm.mode", "local");
        // niente velo del saluto sui banchi
        window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
        window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
        if (t) window.localStorage.setItem("jm:theme", t);
        if (a) window.localStorage.setItem("jm:appearance", a);
      } catch {}
    },
    [tema ?? null, aspetto ?? null],
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  return { ctx, page, errors };
}

/** Il colore calcolato di un token, misurato invece che scritto a mano. */
const COLORE_DEL_TOKEN = (token) => `(() => {
  const s = document.createElement("span");
  s.style.background = "var(${token})";
  s.style.position = "fixed";
  s.style.left = "-9999px";
  document.body.appendChild(s);
  const c = getComputedStyle(s).backgroundColor;
  s.remove();
  return c;
})()`;

/* ================= DESKTOP 1440 ================= */
{
  const { ctx, page, errors } = await apri(1440, 900);
  await page.goto(BASE + "/app", { waitUntil: "networkidle" });
  await page.waitForTimeout(2200);

  /* --- 1. il dock non esiste --- */
  const dock = await page.evaluate(() => {
    const w = document.querySelector(".jm-dock-wrap");
    const s = document.querySelector(".jm-dock-spazio");
    return {
      wrapNelDom: !!w,
      wrapDisplay: w ? getComputedStyle(w).display : "assente",
      spazioDisplay: s ? getComputedStyle(s).display : "assente",
      // Un elemento nascosto non ha area: se ce l'ha, sta ancora occupando
      // spazio o intercettando tocchi.
      wrapAltezza: w ? w.getBoundingClientRect().height : 0,
      spazioAltezza: s ? s.getBoundingClientRect().height : 0,
    };
  });
  check(
    "desktop: la pillola del dock non si disegna",
    dock.wrapDisplay === "none" || dock.wrapDisplay === "assente",
    dock.wrapDisplay,
  );
  check(
    "desktop: nemmeno il vuoto da 94px che si porta dietro",
    dock.spazioDisplay === "none" || dock.spazioDisplay === "assente",
    dock.spazioDisplay,
  );
  check(
    "desktop: il dock non occupa nessuna altezza",
    dock.wrapAltezza === 0 && dock.spazioAltezza === 0,
    `pillola ${dock.wrapAltezza}px, vuoto ${dock.spazioAltezza}px`,
  );

  // La controprova che conta per chi usa l'app: in fondo alla colonna non
  // c'e nessun tasto del dock a rubare il clic.
  const inFondo = await page.evaluate(() => {
    const el = document.elementFromPoint(
      window.innerWidth / 2,
      window.innerHeight - 30,
    );
    return el ? el.className?.toString?.() ?? "" : "niente";
  });
  check(
    "desktop: in fondo alla pagina non c'e un tasto del dock",
    !inFondo.includes("jm-dock"),
    inFondo.slice(0, 60),
  );

  /* --- 2. la rail parla la lingua del dock --- */
  const rail = await page.evaluate(
    ([lensJs, accentJs, onAccentJs]) => {
      const nav = document.querySelector(".jm-rail-nav");
      const on = document.querySelector(".jm-rail-i.on");
      const rec = document.querySelector(".jm-rail-i.rec");
      const acct = document.querySelector(".jm-acct-btn");
      const voci = [...document.querySelectorAll(".jm-rail-i")];
      const cs = (e) => (e ? getComputedStyle(e) : null);
      const raggio = (e) => parseFloat(cs(e).borderTopLeftRadius);
      return {
        lens: eval(lensJs),
        accent: eval(accentJs),
        onAccent: eval(onAccentJs),
        navRaggio: raggio(nav),
        navBordo: cs(nav).borderTopWidth,
        recDentroIlVassoio: !!nav && nav.contains(rec),
        onSfondo: cs(on).backgroundColor,
        onTesto: cs(on).color,
        recSfondo: cs(rec).backgroundColor,
        recTesto: cs(rec).color,
        raggi: voci.map(raggio),
        altezze: voci.map((e) => Math.round(e.getBoundingClientRect().height)),
        recAltezza: Math.round(rec.getBoundingClientRect().height),
        navSinistra: Math.round(nav.getBoundingClientRect().left),
        recSinistra: Math.round(rec.getBoundingClientRect().left),
        acctRaggio: raggio(acct),
        acctSinistra: Math.round(acct.getBoundingClientRect().left),
      };
    },
    [
      COLORE_DEL_TOKEN("--color-glass-lens"),
      COLORE_DEL_TOKEN("--color-accent"),
      COLORE_DEL_TOKEN("--color-on-accent"),
    ],
  );

  check(
    "rail: le voci sono pillole, non riquadri",
    rail.raggi.every((r) => r >= 99),
    JSON.stringify(rail.raggi),
  );
  check(
    "rail: il vassoio ha il suo raggio e il bordo capello",
    rail.navRaggio >= 12 && parseFloat(rail.navBordo) >= 1,
    `raggio ${rail.navRaggio}, bordo ${rail.navBordo}`,
  );
  check(
    "rail: il posto acceso e LA LENTE del dock, non una tinta di accento",
    rail.onSfondo === rail.lens,
    `${rail.onSfondo} contro lente ${rail.lens}`,
  );
  check(
    "rail: il tasto Racconta e PIENO di accento, come il microfono del dock",
    rail.recSfondo === rail.accent && rail.recTesto === rail.onAccent,
    `${rail.recSfondo} su ${rail.recTesto}`,
  );
  check(
    "rail: Racconta sta FUORI dal vassoio delle destinazioni",
    rail.recDentroIlVassoio === false,
  );
  check(
    "rail: ogni voce e alta almeno 44 (brandbook cap. 05)",
    rail.altezze.every((h) => h >= 44),
    JSON.stringify(rail.altezze),
  );
  check(
    "rail: Racconta e alta come le altre, cioe una riga sola",
    Math.abs(rail.recAltezza - rail.altezze[0]) <= 2,
    `${rail.recAltezza} contro ${rail.altezze[0]}`,
  );
  check(
    "rail: vassoio, tasto e pallino allineati sulla stessa colonna",
    rail.navSinistra === rail.recSinistra &&
      rail.navSinistra === rail.acctSinistra,
    `vassoio ${rail.navSinistra}, tasto ${rail.recSinistra}, pallino ${rail.acctSinistra}`,
  );
  check(
    "rail: il pallino dell'account e una pillola come il resto",
    rail.acctRaggio >= 99,
    String(rail.acctRaggio),
  );
  check("desktop: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* --- 3. su Impostazioni il pallino usa la stessa lente --- */
{
  const { ctx, page, errors } = await apri(1440, 900);
  await page.goto(BASE + "/app/settings", { waitUntil: "networkidle" });
  await page.waitForTimeout(2200);
  const r = await page.evaluate(
    ([lensJs]) => {
      const b = document.querySelector(".jm-acct-btn");
      return {
        acceso: b.classList.contains("on"),
        sfondo: getComputedStyle(b).backgroundColor,
        lens: eval(lensJs),
      };
    },
    [COLORE_DEL_TOKEN("--color-glass-lens")],
  );
  check("impostazioni: il pallino risulta acceso", r.acceso);
  check(
    "impostazioni: acceso con la lente, non con l'accento",
    r.sfondo === r.lens,
    `${r.sfondo} contro lente ${r.lens}`,
  );
  check("impostazioni: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* --- 4. tutti i temi, chiaro e scuro: il dock resta assente e la lente
        e sempre una lente (non diventa un colore di marca) --- */
for (const tema of ["minimal", "wine", "carta", "malva", "macchina"]) {
  for (const aspetto of ["light", "dark"]) {
    const { ctx, page } = await apri(1440, 900, { tema, aspetto });
    await page.goto(BASE + "/app", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(
      ([lensJs]) => {
        const w = document.querySelector(".jm-dock-wrap");
        const on = document.querySelector(".jm-rail-i.on");
        return {
          dock: w ? getComputedStyle(w).display : "assente",
          onSfondo: on ? getComputedStyle(on).backgroundColor : "?",
          lens: eval(lensJs),
        };
      },
      [COLORE_DEL_TOKEN("--color-glass-lens")],
    );
    check(
      `tema ${tema}/${aspetto}: niente dock e la lente e la lente`,
      (r.dock === "none" || r.dock === "assente") && r.onSfondo === r.lens,
      `dock ${r.dock}, acceso ${r.onSfondo} contro ${r.lens}`,
    );
    await ctx.close();
  }
}

/* ================= TELEFONO 430 ================= */
{
  const { ctx, page, errors } = await apri(430, 860);
  await page.goto(BASE + "/app", { waitUntil: "networkidle" });
  await page.waitForTimeout(2200);
  const tel = await page.evaluate(() => {
    const w = document.querySelector(".jm-dock-wrap");
    const d = document.querySelector(".jm-dock");
    const s = document.querySelector(".jm-dock-spazio");
    const rail = document.querySelector(".jm-rail-l");
    const b = d ? d.getBoundingClientRect() : null;
    return {
      dockDisplay: w ? getComputedStyle(w).display : "assente",
      // sospeso: staccato dal fondo e dai lati (e il dock, non una barra)
      daFondo: b ? Math.round(window.innerHeight - b.bottom) : -1,
      daSinistra: b ? Math.round(b.left) : -1,
      spazio: s ? Math.round(s.getBoundingClientRect().height) : 0,
      railDisplay: rail ? getComputedStyle(rail).display : "assente",
    };
  });
  check("telefono: il dock c'e", tel.dockDisplay === "flex", tel.dockDisplay);
  check(
    "telefono: ed e sospeso, staccato dal fondo e dai lati",
    tel.daFondo >= 8 && tel.daSinistra >= 16,
    `${tel.daFondo}px dal fondo, ${tel.daSinistra}px dal bordo`,
  );
  check(
    "telefono: lo spazio sotto il contenuto c'e ancora",
    tel.spazio >= 80,
    `${tel.spazio}px`,
  );
  check(
    "telefono: la rail del desktop non esiste",
    tel.railDisplay === "none" || tel.railDisplay === "assente",
    tel.railDisplay,
  );
  check("telefono: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

await browser.close();

const ko = results.filter((r) => !r.ok);
console.log(`\n${results.length - ko.length}/${results.length} PASS`);
if (ko.length) {
  console.log("FALLITI:\n" + ko.map((r) => "  - " + r.name).join("\n"));
  process.exit(1);
}
