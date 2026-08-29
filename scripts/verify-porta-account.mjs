// La porta dell'account (mockup design/mockups/porta-account.html §03) —
// porta 3100. Questo comportamento prima non lo copriva nessun banco.
//
// Cosa si prova, dal contratto:
//  - il menu si apre col click e si chiude con Esc (fuoco sul bottone),
//    col click fuori e scegliendo una voce; aria-expanded segue lo stato;
//  - le voci giuste per modalita e piano: cloud gratis vede Impostazioni /
//    Passa a Premium / Esci; il guscio iOS legge "Scopri Premium" senza
//    nessun prezzo; il locale vede "Accedi al tuo account" e NIENTE
//    Premium ne Esci;
//  - la barra del telefono non ha piu lo slot Impostazioni, mostra Ricorda
//    ANCHE con un modulo acceso (quinto posto), e senza moduli e a quattro;
//  - il pallino vive nell'intestazione di Oggi sul telefono e apre il
//    foglio dal basso (la primitiva promossa da add-to-day);
//  - il logout e UNO: la sorgente lo prova (eseguiLogout nei due punti,
//    i cinque passi solo in src/lib/auth/logout.ts).
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3100";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

async function open({
  width = 1440,
  height = 950,
  mode = "cloud",
  native = false,
  plan = "free",
  moduli = null,
} = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: "it-IT" });
  await ctx.addInitScript(
    ({ mode, native, plan, moduli }) => {
      try {
        window.localStorage.setItem("jm.mode", mode);
        // Il saluto e un velo aria-modal: si pianta il suo silenzio.
        if (mode === "local") {
          window.localStorage.setItem("jm.saluto.dispositivo", "dev:banco");
          window.localStorage.setItem("jm.saluto.silenzio", "dev:banco");
        } else {
          window.localStorage.setItem(
            "jm.saluto.silenzio",
            "usr:00000000-0000-4000-8000-000000000001",
          );
        }
        // Il piano NON ottimista: la cache scritta qui e cio che usePlan
        // legge subito, e decide se la voce Premium compare.
        if (mode === "cloud") window.localStorage.setItem("jm.plan", plan);
        if (moduli) window.localStorage.setItem("jm:moduli", JSON.stringify(moduli));
        if (mode === "cloud") {
          const fra = Math.floor(Date.now() / 1000) + 3600;
          window.localStorage.setItem(
            "sb-example-auth-token",
            JSON.stringify({
              access_token: "dummy.dummy.dummy",
              token_type: "bearer",
              expires_in: 3600,
              expires_at: fra,
              refresh_token: "dummy",
              user: {
                id: "00000000-0000-4000-8000-000000000001",
                aud: "authenticated",
                role: "authenticated",
                email: "prova@example.com",
                app_metadata: { provider: "email" },
                user_metadata: {},
                created_at: "2026-01-01T00:00:00Z",
              },
            }),
          );
        }
      } catch {}
      if (native) window.CapacitorCustomPlatform = { name: "iosprova" };
    },
    { mode, native, plan, moduli },
  );
  const page = await ctx.newPage();
  return { ctx, page };
}

/* ---------- 1. desktop cloud gratis: apertura, voci, chiusure ---------- */
{
  const { ctx, page } = await open({ mode: "cloud", plan: "free" });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".jm-acct-btn", { timeout: 25000 });
  await page.waitForTimeout(600);

  const btn = page.locator(".jm-acct-btn");
  check("desktop: il pallino e un bottone", (await btn.count()) === 1);
  check(
    "desktop: chiuso, aria-expanded=false",
    (await btn.getAttribute("aria-expanded")) === "false",
  );
  check(
    "desktop: la voce Impostazioni NON e piu in navigazione",
    !(await page.locator(".jm-rail-nav").innerText()).includes("Impostazioni"),
  );

  await btn.click();
  await page.waitForSelector(".jm-acct-menu", { timeout: 5000 });
  check(
    "desktop: click apre il menu e aria-expanded=true",
    (await btn.getAttribute("aria-expanded")) === "true",
  );
  const menu = await page.locator(".jm-acct-menu").innerText();
  check("desktop cloud: la voce Impostazioni c'e", menu.includes("Impostazioni"));
  check("desktop cloud gratis: Passa a Premium c'e", menu.includes("Passa a Premium"));
  check("desktop cloud: Esci dall'account c'e", menu.includes("Esci dall'account"));
  check("desktop: nel menu non si stampa nessun prezzo", !menu.includes("4,99"));

  // Esc chiude e il fuoco TORNA sul bottone. Il fuoco prima si sposta
  // dentro il menu: senza questo passo il controllo era decorativo — il
  // click aveva gia lasciato il fuoco sul bottone e il ritorno non
  // provava niente (visto al morso).
  await page.locator(".jm-acct-i").first().evaluate((el) => el.focus());
  check(
    "desktop: il fuoco e entrato nel menu",
    await page.evaluate(() => document.activeElement?.classList.contains("jm-acct-i") ?? false),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  check(
    "desktop: Esc chiude",
    (await page.locator(".jm-acct-menu").count()) === 0,
  );
  check(
    "desktop: dopo Esc il fuoco e sul bottone",
    await btn.evaluate((el) => document.activeElement === el),
  );

  // Click fuori chiude.
  await btn.click();
  await page.waitForSelector(".jm-acct-menu", { timeout: 5000 });
  await page.mouse.click(700, 300);
  await page.waitForTimeout(200);
  check(
    "desktop: click fuori chiude",
    (await page.locator(".jm-acct-menu").count()) === 0,
  );

  // La scelta di una voce chiude e porta a /settings; li il bottone e acceso.
  await btn.click();
  await page.locator(".jm-acct-i", { hasText: "Impostazioni" }).click();
  await page.waitForURL("**/settings", { timeout: 10000 });
  await page.waitForTimeout(600);
  check(
    "desktop: su /settings il bottone resta acceso",
    (await page.locator(".jm-acct-btn.on").count()) === 1,
  );
  await ctx.close();
}

/* ---------- 2. desktop cloud PREMIUM: la voce Premium sparisce ---------- */
{
  const { ctx, page } = await open({ mode: "cloud", plan: "premium" });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".jm-acct-btn", { timeout: 25000 });
  await page.waitForTimeout(400);
  await page.locator(".jm-acct-btn").click();
  await page.waitForSelector(".jm-acct-menu", { timeout: 5000 });
  const menu = await page.locator(".jm-acct-menu").innerText();
  check("desktop premium: nessuna voce Premium", !menu.includes("Premium"));
  check("desktop premium: Esci c'e", menu.includes("Esci dall'account"));
  await ctx.close();
}

/* ---------- 3. guscio iOS cloud gratis: Scopri Premium, mai prezzi ---------- */
{
  const { ctx, page } = await open({
    width: 390,
    height: 844,
    mode: "cloud",
    plan: "free",
    native: true,
  });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".jm-hd-av", { timeout: 25000 });
  await page.waitForTimeout(600);
  await page.locator(".jm-hd-av").click();
  await page.waitForSelector(".jm-sheet", { timeout: 5000 });
  const sheet = await page.locator(".jm-sheet").innerText();
  check("guscio iOS: l'etichetta e Scopri Premium", sheet.includes("Scopri Premium"));
  check(
    "guscio iOS: mai 'Passa a Premium'",
    !sheet.includes("Passa a Premium"),
  );
  check("guscio iOS: nessun prezzo nel foglio", !sheet.includes("4,99"));
  await ctx.close();
}

/* ---------- 4. telefono locale: la via del ritorno, niente Esci ---------- */
{
  const { ctx, page } = await open({ width: 390, height: 844, mode: "local" });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".jm-hd-av", { timeout: 25000 });
  await page.waitForTimeout(600);

  check(
    "telefono: il pallino vive nell'intestazione di Oggi",
    (await page.locator(".jm-hd-av").count()) === 1,
  );
  await page.locator(".jm-hd-av").click();
  await page.waitForSelector(".jm-sheet", { timeout: 5000 });
  const sheet = await page.locator(".jm-sheet").innerText();
  check("locale: la testata dice Questo dispositivo", sheet.includes("Questo dispositivo"));
  check("locale: Accedi al tuo account c'e", sheet.includes("Accedi al tuo account"));
  check("locale: NIENTE Premium", !sheet.includes("Premium"));
  check("locale: NIENTE Esci", !sheet.includes("Esci dall'account"));

  // Il velo chiude.
  await page.locator(".jm-sheet-scrim").click({ position: { x: 10, y: 10 } });
  await page.waitForTimeout(250);
  check(
    "telefono: il tocco sul velo chiude il foglio",
    (await page.locator(".jm-sheet").count()) === 0,
  );

  /* ---- la barra: quattro posti senza moduli, niente Impost. ---- */
  const tabs = await page.locator("nav.jm-dock-wrap").innerText();
  check("barra: lo slot Impostazioni non esiste piu", !tabs.includes("IMPOST"));
  check("barra: Ricorda c'e", tabs.toUpperCase().includes("RICORDA"));
  const colonne = await page
    .locator("nav.jm-dock-wrap")
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  check("barra senza moduli: quattro colonne", colonne === 4, String(colonne));
  await ctx.close();
}

/* ---------- 5. telefono con Palestra accesa: Ricorda RESTA ---------- */
{
  const { ctx, page } = await open({
    width: 390,
    height: 844,
    mode: "local",
    moduli: ["palestra"],
  });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("nav.jm-dock-wrap", { timeout: 25000 });
  await page.waitForTimeout(600);
  const tabs = (await page.locator("nav.jm-dock-wrap").innerText()).toUpperCase();
  check("barra con modulo: Ricorda c'e ancora", tabs.includes("RICORDA"));
  check("barra con modulo: il modulo ha il quinto posto", tabs.includes("PALESTRA"));
  check("barra con modulo: niente Impost.", !tabs.includes("IMPOST"));
  const colonne = await page
    .locator("nav.jm-dock-wrap")
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  check("barra con modulo: cinque colonne", colonne === 5, String(colonne));
  await ctx.close();
}

/* ---------- 6. il logout e UNO: lo dice la sorgente ---------- */
{
  const logout = readFileSync("src/lib/auth/logout.ts", "utf8");
  const settings = readFileSync(
    "src/modules/impostazioni/components/settings-client.tsx",
    "utf8",
  );
  const menu = readFileSync("src/components/ui/account-menu.tsx", "utf8");
  // Le CHIAMATE, non i nomi: al primo morso il controllo cercava
  // "clearPlanCache" e l'import bastava a tenerlo verde. Guardia
  // decorativa, riscritta per cercare l'invocazione.
  check(
    "logout: i passi con le cicatrici stanno in lib/auth/logout.ts",
    logout.includes("clearPlanCache()") &&
      logout.includes("dimenticaScansione()") &&
      logout.includes("journalme-demo"),
  );
  check("logout: le Impostazioni chiamano eseguiLogout", settings.includes("eseguiLogout("));
  check("logout: il menu chiama eseguiLogout", menu.includes("eseguiLogout("));
  check(
    "logout: nessuno dei due rifa i passi in proprio",
    !settings.includes("clearPlanCache()") && !menu.includes("clearPlanCache()"),
  );
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS${failed.length ? ` . ${failed.length} FAIL` : ""}`);
process.exit(failed.length ? 1 : 0);
