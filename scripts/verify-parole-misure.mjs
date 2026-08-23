// Verifica delle parole dell'interfaccia (22 agosto 2026): la voce della
// rail su una riga sola, e le cinque misure del testo rinominate.
// Locale, porta 3200.
//
// La cosa che questa suite ha davvero trovato, e per cui esiste: il passo
// di partenza era scritto in DUE posti — DEFAULT_UI_SCALE per React e un
// "var z=1" dentro lo script di boot. Finche i due valori coincidevano
// nessuno poteva accorgersene; spostando il default a 1,15 l'app si
// disegnava a 1 mentre Impostazioni diceva "Normale".
import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3200";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const FAKE_SESSION = {
  access_token: "fake", token_type: "bearer", expires_in: 3600,
  expires_at: 4102444800, refresh_token: "fake",
  user: { id: "00000000-0000-4000-8000-000000000001", aud: "authenticated",
          role: "authenticated", email: "manuel@journal.me",
          app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00.000Z" },
};

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

async function open(url, { width = 1440, height = 950, mode = "local", scale = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: "it-IT" });
  await ctx.addInitScript(([m, s, sess]) => {
    try {
      if (m === "local") window.localStorage.setItem("jm.mode", "local");
      else {
        window.localStorage.removeItem("jm.mode");
        window.localStorage.setItem("sb-example-auth-token", sess);
      }
      if (s) window.localStorage.setItem("jm:scale", s);
      else window.localStorage.removeItem("jm:scale");
    } catch {}
  }, [mode, scale, JSON.stringify(FAKE_SESSION)]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.route("**example.supabase.co/**", (r) => {
    const u = r.request().url();
    if (u.includes("/auth/v1/user")) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FAKE_SESSION.user) });
    if (u.includes("/rest/v1/profiles")) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ plan: "premium", plan_source: "stripe", current_period_end: null }]) });
    return r.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/usage**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ monthStart: "2026-08-01T00:00:00.000Z", byRoute: {}, totalUsd: 0 }) }));
  await page.goto(BASE + url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  return { ctx, page, errors };
}

/* ---- la rail: una parola, e alta come le altre voci ---- */
for (const [mode, parola, vietata] of [["local", "Scrivi", "Scrivi la giornata"], ["cloud", "Racconta", "Racconta a voce"]]) {
  const { ctx, page, errors } = await open("/mese", { mode });
  const rec = page.locator(".jm-rail-i.rec");
  const txt = (await rec.innerText()).replace(/\s+/g, " ").trim();
  check(`rail ${mode}: dice "${parola}" e non la frase lunga`,
    txt.includes(parola) && !txt.includes(vietata), JSON.stringify(txt));
  // Una riga sola: alta quanto una voce di navigazione qualsiasi, non di piu.
  const hRec = (await rec.boundingBox()).height;
  const hNav = (await page.locator(".jm-rail-i:not(.rec)").first().boundingBox()).height;
  check(`rail ${mode}: alta come le altre voci, quindi una riga sola`,
    Math.abs(hRec - hNav) <= 2, `${Math.round(hRec)}px contro ${Math.round(hNav)}px`);
  check(`rail ${mode}: zero errori console`, errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ---- le cinque misure ---- */
{
  const { ctx, page, errors } = await open("/settings");
  await page.locator(".jm-st-row:visible").filter({ hasText: "Dimensione del testo" }).first().click();
  await page.waitForTimeout(700);

  const names = await page.locator(".jm-st-szname").allInnerTexts();
  check("misure: i cinque nomi nuovi, in ordine",
    JSON.stringify(names) === JSON.stringify(["Molto piccolo", "Piccolo", "Normale", "Grande", "Molto grande"]),
    JSON.stringify(names));

  check("misure: la riga accesa e Normale",
    (await page.locator(".jm-st-szrow.on .jm-st-szname").innerText()) === "Normale");

  const v = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--jm-ui-scale").trim());
  check("misure: e l'app si disegna DAVVERO a 1.15", v === "1.15", v);

  check("misure: senza una scelta non compare il ripristino",
    (await page.locator(".jm-st-out").count()) === 0);

  const overflow = await page.locator(".jm-st-szrow").evaluateAll((els) =>
    els.filter((e) => e.scrollWidth > e.clientWidth + 1).length);
  check("misure: nessun nome sfora la sua riga", overflow === 0, `${overflow} righe`);

  // Le righe crescono con la misura che rappresentano: e il senso della schermata.
  const hs = await page.locator(".jm-st-szrow").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  check("misure: ogni riga e disegnata alla sua taglia",
    hs.every((h, i) => i === 0 || h > hs[i - 1]), hs.join(" < "));

  check("misure: zero errori console", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

/* ---- chi aveva gia scelto non si muove ---- */
for (const [scale, nome] of [["0.9", "Molto piccolo"], ["1", "Piccolo"], ["1.5", "Molto grande"]]) {
  const { ctx, page } = await open("/settings", { scale });
  await page.locator(".jm-st-row:visible").filter({ hasText: "Dimensione del testo" }).first().click();
  await page.waitForTimeout(600);
  const on = await page.locator(".jm-st-szrow.on .jm-st-szname").innerText();
  const v = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--jm-ui-scale").trim());
  check(`chi aveva scelto ${scale} resta li, e ora si chiama "${nome}"`,
    on === nome && v === scale, `${on} / ${v}`);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length === 0 ? 0 : 1);
