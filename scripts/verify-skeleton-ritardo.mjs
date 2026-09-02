// GLI SCHELETRI NON BALENANO (2 settembre 2026, richiesta di Manuel: "per
// un microsecondo appare uno scheletro che da fastidio agli occhi").
// Regola: uno scheletro resta invisibile per i primi 400 ms e poi entra in
// dissolvenza. Qui si MISURA l'opacita calcolata di un .jm-skel e di un
// contenitore .jm-skel-attesa appena montati (deve essere 0) e dopo 800 ms
// (deve essere 1), sull'app vera — porta 3100 (JM_BASE).
import { chromium } from "playwright-core";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.JM_BASE ?? "http://localhost:3100";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -- " + extra : ""}`);
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("jm.mode", "local");
  } catch {}
});
const page = await ctx.newPage();
await page.goto(BASE + "/app/mese", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const misura = await page.evaluate(async () => {
  const attendi = (ms) => new Promise((r) => setTimeout(r, ms));
  const skel = document.createElement("div");
  skel.className = "jm-skel";
  skel.style.cssText = "width:120px;height:20px";
  const cont = document.createElement("div");
  cont.className = "jm-skel-attesa";
  cont.style.cssText = "width:120px;height:20px;background:red";
  document.body.append(skel, cont);
  await attendi(30);
  const subito = [getComputedStyle(skel).opacity, getComputedStyle(cont).opacity];
  await attendi(200);
  const a200 = [getComputedStyle(skel).opacity, getComputedStyle(cont).opacity];
  await attendi(700);
  const dopo = [getComputedStyle(skel).opacity, getComputedStyle(cont).opacity];
  const shimmer = getComputedStyle(skel).animationName;
  skel.remove();
  cont.remove();
  return { subito, a200, dopo, shimmer };
});

check("uno scheletro appena montato e invisibile", misura.subito.every((o) => Number(o) === 0), misura.subito.join(","));
check("a 200 ms e ancora invisibile (sotto i 400 non si vede mai)", misura.a200.every((o) => Number(o) === 0), misura.a200.join(","));
check("dopo 900 ms e pienamente visibile", misura.dopo.every((o) => Number(o) === 1), misura.dopo.join(","));
check("il luccichio c'e ancora, insieme al ritardo", /shimmer/.test(misura.shimmer) && /appare/.test(misura.shimmer), misura.shimmer);

/* I contenitori degli scheletri di pagina portano la classe del ritardo. */
import { readFileSync } from "node:fs";
for (const [nome, file] of [
  ["lo scheletro di pagina", "src/components/ui/page-skeleton.tsx"],
  ["lo scheletro di Oggi", "src/app/(app)/app/page.tsx"],
]) {
  check(`${nome}: il contenitore aspetta (jm-skel-attesa)`, readFileSync(file, "utf8").includes("jm-skel-attesa"));
}

await browser.close();
const passati = results.filter((r) => r.ok).length;
console.log(`\n${passati}/${results.length} PASS`);
process.exit(passati === results.length ? 0 : 1);
