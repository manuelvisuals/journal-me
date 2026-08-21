import {
  APPEARANCE_STORAGE_KEY,
  cssVarsFor,
  DEFAULT_THEME_ID,
  THEME_STORAGE_KEY,
} from "./contract";
import { THEMES } from "./index";
import { UI_SCALE_STORAGE_KEY, UI_SCALES } from "@/lib/ui-scale-contract";

/**
 * Lo script inline di boot (SPEC-temi §5, "Applicazione, senza flash").
 *
 * Va eseguito PRIMA del primo paint: legge tema e appearance da
 * localStorage, risolve `system` con matchMedia e scrive data-theme,
 * data-mode e le custom property su <html>. Se si aspetta React, ogni
 * avvio lampeggia — e in un'app che si apre al buio a colazione,
 * lampeggiare bianco e la cosa peggiore che si possa fare.
 *
 * I valori dei temi inclusi arrivano da QUESTO modulo TypeScript,
 * serializzati dentro lo script dal layout (server component): una sola
 * fonte di verita, nessun blocco CSS duplicato da tenere in sync.
 *
 * Da qui passa anche la DIMENSIONE dell'interfaccia (src/lib/ui-scale.ts),
 * per lo stesso motivo del tema: applicarla da React vuol dire vedere
 * l'app piccola per un istante e poi vederla saltare. Con lo zoom scritto
 * qui, il primo disegno e gia della misura giusta.
 */
export function themeBootScript(): string {
  const themes: Record<string, { light: Record<string, string>; dark: Record<string, string> }> = {};
  for (const t of THEMES) {
    themes[t.id] = {
      light: cssVarsFor(t, "light"),
      dark: cssVarsFor(t, "dark"),
    };
  }
  const payload = JSON.stringify({
    themes,
    def: DEFAULT_THEME_ID,
    scales: UI_SCALES,
  });
  return `(function(){try{
var D=${payload};
var t=null,a=null;
try{t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});a=localStorage.getItem(${JSON.stringify(APPEARANCE_STORAGE_KEY)});}catch(e){}
if(!t||!D.themes[t])t=D.def;
if(a!=="light"&&a!=="dark")a="system";
var m=a==="system"?(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):a;
var e=document.documentElement;
e.setAttribute("data-theme",t);
e.setAttribute("data-mode",m);
var v=D.themes[t][m];
for(var k in v)e.style.setProperty(k,v[k]);
e.style.colorScheme=m;
var mc=document.querySelector('meta[name="theme-color"]');
if(mc)mc.setAttribute("content",v["--jm-bg-app"]);
var z=1;
try{var zr=Number(localStorage.getItem(${JSON.stringify(UI_SCALE_STORAGE_KEY)}));if(D.scales.indexOf(zr)>=0)z=zr;}catch(e){}
e.style.setProperty("--jm-ui-scale",String(z));
if(z!==1)e.style.zoom=String(z);
}catch(err){}})();`;
}
