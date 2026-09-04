// I bugfix del 1 settembre 2026 (screenshot di Manuel dal telefono),
// misurati dove vivono davvero: sull'EXPORT STATICO iOS, non sul dev
// server. Il motivo e il bug stesso: l'export ha trailingSlash:true e il
// pathname arriva "/app/" — il dev server invece normalizza a "/app", e
// li il difetto non si vede.
//
// Cosa si prova:
//  1. la barra in alto ESISTE su Oggi anche col pathname "/app/"
//     (titoloSchermata normalizza la barra finale); con lei la safe-area;
//  2. il tema scelto si RIAFFERMA se qualcuno spoglia <html> (il fallback
//     di idratazione di React porta via data-theme, style e la dimensione
//     del testo: la guardia in theme-watcher li rimette);
//  3. il foglio dell'account COPRE il dock (portal su body): il velo sta
//     sopra la pillola, quindi anche la lastra nativa si spegnerebbe
//     (dockCoperto guarda elementFromPoint); e le righe del foglio non
//     hanno piu il filo doppio;
//  4. i chiarimenti hanno la safe-area (env nel CSS);
//  5. Face ID e opt-in: il lucchetto legge la scelta, il login propone
//     dopo il codice, le Impostazioni hanno l'interruttore (sorgente).
//
// Prima: JM_MOBILE=1 npx next build (il banco serve .next-mobile da se).
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, normalize, extname } from "node:path";
import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const DIR = ".next-mobile";
const PORT = Number(process.env.JM_PORT_STATICO ?? 3210);

let pass = 0;
let fail = 0;
function check(nome, ok, extra = "") {
  if (ok) {
    pass += 1;
    console.log(`PASS  ${nome}${extra ? `  -- ${extra}` : ""}`);
  } else {
    fail += 1;
    console.log(`FAIL  ${nome}${extra ? `  -- ${extra}` : ""}`);
  }
}

if (!existsSync(DIR)) {
  console.error(`Manca ${DIR}: esegui prima JM_MOBILE=1 npx next build.`);
  process.exit(1);
}

/* ---------- il file server dell'export, come lo vede WKWebView ---------- */
const TIPI = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

const server = createServer((req, res) => {
  const grezzo = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const dentro = normalize(join(DIR, grezzo));
  if (!dentro.startsWith(DIR)) {
    res.writeHead(403).end();
    return;
  }
  let file = null;
  if (existsSync(dentro) && statSync(dentro).isFile()) file = dentro;
  else if (existsSync(join(dentro, "index.html"))) file = join(dentro, "index.html");
  else if (existsSync(`${dentro.replace(/\/$/, "")}.html`)) file = `${dentro.replace(/\/$/, "")}.html`;
  if (!file) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "content-type": TIPI[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(PORT, r));
const BASE = `http://localhost:${PORT}`;

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

async function apri(url) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    try {
      window.localStorage.setItem("jm.mode", "local"); window.localStorage.setItem("jm.ospite", "0");
      window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
      window.localStorage.setItem("jm.saluto.silenzio", "dev:banco#v1");
      window.localStorage.setItem("jm:theme", "wine");
    } catch {}
  });
  const page = await ctx.newPage();
  const errori = [];
  page.on("console", (m) => {
    if (m.type() === "error") errori.push(m.text());
  });
  page.on("pageerror", (e) => errori.push(String(e)));
  await page.goto(BASE + url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  return { ctx, page, errori };
}

/* ---------- 1. la barra in alto col pathname del guscio ---------- */
{
  const { ctx, page } = await apri("/app/");
  const pathname = await page.evaluate(() => location.pathname);
  check("il banco prova la cosa vera: pathname con la barra finale", pathname === "/app/", pathname);
  check("la barra in alto c'e su Oggi", (await page.locator(".jm-appbar").count()) === 1);
  const conbarra = await page.locator(".jm-conbarra").count();
  check("il guscio sa di avere la barra (jm-conbarra)", conbarra === 1, String(conbarra));
  const titolo = (await page.locator(".jm-appbar-t").innerText()).trim();
  check("la barra dice il nome della schermata", titolo.length > 0, titolo);
  const pallino = await page.locator(".jm-appbar .jm-hd-av").count();
  check("il pallino dell'account e nella barra", pallino === 1, String(pallino));

  /* ---------- 2. la guardia del tema ---------- */
  const temaPrima = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  check("il tema scelto e applicato al boot", temaPrima === "wine", String(temaPrima));
  await page.evaluate(() => {
    const el = document.documentElement;
    // Il colpo di spugna del fallback di idratazione: via gli attributi
    // che il boot script aveva scritto, dimensione del testo compresa.
    el.removeAttribute("data-theme");
    el.removeAttribute("data-mode");
    el.removeAttribute("style");
  });
  await page.waitForTimeout(500);
  const dopo = await page.evaluate(() => ({
    tema: document.documentElement.getAttribute("data-theme"),
    modo: document.documentElement.getAttribute("data-mode"),
    bg: document.documentElement.style.getPropertyValue("--jm-bg-app"),
    scala: document.documentElement.style.getPropertyValue("--jm-ui-scale"),
  }));
  check("spogliato <html>, il tema torna da solo", dopo.tema === "wine", String(dopo.tema));
  check("torna anche il modo", dopo.modo === "light" || dopo.modo === "dark", String(dopo.modo));
  check("tornano le custom property", dopo.bg !== "", dopo.bg);
  check("torna la dimensione del testo", dopo.scala !== "", dopo.scala);

  /* ---------- 3. il foglio dell'account e il sipario del dock ----------
     Dal secondo giro (1 settembre, sera): con una superficie a schermo
     pieno aperta il dock NON ESISTE (dock-sipario.ts) — non "e coperto".
     Nel guscio la lastra nativa sta sopra la WebView, quindi coprirla dal
     web non basta mai: la pillola si smonta e lo smontaggio spegne la
     lastra per la via del cambio pagina. */
  const dockPrima = await page.locator(".jm-dock-wrap").count();
  check("prima del foglio il dock esiste", dockPrima === 1, String(dockPrima));
  await page.locator(".jm-appbar .jm-hd-av").click();
  await page.waitForSelector(".jm-sheet-scrim", { timeout: 8000 });
  const suBody = await page.evaluate(
    () => document.querySelector(".jm-sheet-scrim")?.parentElement === document.body,
  );
  check("il foglio nasce in un portal su body", suBody === true);
  const dockDurante = await page.locator(".jm-dock-wrap").count();
  check("col foglio aperto il dock non esiste (sipario)", dockDurante === 0, String(dockDurante));
  const filoRighe = await page.evaluate(() => {
    const righe = [...document.querySelectorAll(".jm-sheet .jm-acct-row")];
    if (righe.length === 0) return "nessuna riga";
    return righe.every((r) => getComputedStyle(r).borderBottomWidth === "0px")
      ? "pulite"
      : "col filo";
  });
  check("le righe del foglio non hanno piu il filo doppio", filoRighe === "pulite", filoRighe);
  const separatori = await page.locator(".jm-sheet .jm-acct-sheet-sep").count();
  check("resta il separatore prima dell'azione che scotta", separatori >= 1, String(separatori));
  /* Chiuso il foglio, il dock torna: il sipario e un conteggio, non un
     interruttore che resta giu. */
  await page.locator(".jm-sheet-scrim").click({ position: { x: 10, y: 10 } });
  await page.waitForTimeout(400);
  const dockDopo = await page.locator(".jm-dock-wrap").count();
  check("chiuso il foglio il dock torna", dockDopo === 1, String(dockDopo));
  await ctx.close();
}

/* ---------- 3-bis. il sipario e cablato in tutte le superfici ---------- */
{
  const superfici = [
    "src/modules/oggi/components/chiarimenti-screen.tsx",
    "src/modules/oggi/components/people-review.tsx",
    "src/modules/oggi/components/recording-overlay.tsx",
    "src/modules/oggi/components/review-screen.tsx",
    "src/modules/oggi/components/manual-write.tsx",
    "src/modules/oggi/components/foto-giorno.tsx",
    "src/modules/accesso/components/saluto-avvio.tsx",
    "src/components/ui/sheet.tsx",
  ];
  for (const f of superfici) {
    check(
      `sipario cablato: ${f.split("/").pop()}`,
      readFileSync(f, "utf8").includes("useRitiraDock"),
    );
  }
  const barra = readFileSync("src/components/ui/tab-bar.tsx", "utf8");
  check("la tab bar legge il sipario", barra.includes("useDockRitirato"));
  const posSegnale = barra.indexOf("useEffect(segnalaDentroApp");
  const posRitiro = barra.indexOf("if (ritirato) return null");
  check(
    "il segnale dentro-app sopravvive al sipario",
    posSegnale > -1 && posRitiro > -1 && posSegnale < posRitiro,
  );
}

/* ---------- 4+5. le sorgenti: safe-area chiarimenti e Face ID ---------- */
{
  const features = readFileSync("src/app/features.css", "utf8");
  const blocco = features.split(".jm-ch-col")[1]?.split("}")[0] ?? "";
  check(
    "chiarimenti: la colonna ha la safe-area in alto",
    blocco.includes("env(safe-area-inset-top"),
  );
  check(
    "chiarimenti: e anche in basso",
    blocco.includes("env(safe-area-inset-bottom"),
  );

  const lock = readFileSync("src/components/biometric-lock.tsx", "utf8");
  check("il lucchetto e opt-in: legge la scelta Face ID", lock.includes("faceIdAttivo()"));
  check(
    "il lucchetto non si arma piu da solo sul nativo nudo",
    !lock.includes("useState<LockState>(native ?"),
  );

  const login = readFileSync("src/app/(app)/login/page.tsx", "utf8");
  check("il login propone Face ID solo DOPO il codice", login.includes("deveProporreFaceId"));
  const chiamate = login.split("dopoCodice()").length - 1;
  check(
    "tutti e due i percorsi del codice passano dalla proposta",
    chiamate >= 2,
    String(chiamate),
  );
  check("al terzo no c'e il congedo con le Impostazioni", login.includes('"basta"'));

  const settings = readFileSync(
    "src/modules/impostazioni/components/settings-client.tsx",
    "utf8",
  );
  check("le Impostazioni hanno l'interruttore Face ID", settings.includes("useFaceIdAttivo"));
  check(
    "l'interruttore attiva solo a prova riuscita",
    settings.includes("provaEAttivaFaceId"),
  );

  const sheet = readFileSync("src/components/ui/sheet.tsx", "utf8");
  check(
    "la primitiva Sheet e un portal su body per tutti i clienti",
    sheet.includes("createPortal") && sheet.includes("document.body"),
  );
}

await browser.close();
server.close();

console.log(`\n${pass}/${pass + fail} PASS${fail ? ` . ${fail} FAIL` : ""}`);
process.exit(fail === 0 ? 0 : 1);
