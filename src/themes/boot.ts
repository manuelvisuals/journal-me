import {
  APPEARANCE_STORAGE_KEY,
  cssVarsFor,
  DEFAULT_THEME_ID,
  THEME_STORAGE_KEY,
} from "./contract";
import { THEMES } from "./index";
import {
  DEFAULT_UI_SCALE,
  UI_SCALE_STORAGE_KEY,
  UI_SCALES,
} from "@/lib/ui-scale-contract";

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
    // Il passo di partenza viaggia con il resto invece di essere scritto a
    // mano qui sotto: era 1 in questo script e DEFAULT_UI_SCALE in React,
    // e finche i due valori coincidevano nessuno se n'e accorto. Spostare
    // il default a 1,15 li ha separati, e l'app si disegnava a 1 mentre
    // Impostazioni diceva "Normale". Una fonte sola, non due.
    zdef: DEFAULT_UI_SCALE,
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
var z=D.zdef;
try{var zr=Number(localStorage.getItem(${JSON.stringify(UI_SCALE_STORAGE_KEY)}));if(D.scales.indexOf(zr)>=0)z=zr;}catch(e){}
e.style.setProperty("--jm-ui-scale",String(z));
}catch(err){}})();`;
}


/**
 * La CINTURA DI SICUREZZA dei token (24 agosto 2026, guscio iOS).
 *
 * Lo script di boot scrive i token via JavaScript: se per qualunque motivo
 * non arriva a fondo (successo davvero dentro il WKWebView: app "nuda",
 * testo a serif, niente spaziature), l'app resta senza un solo token e il
 * CSS che dice var(--jm-*) muore in silenzio. Questo blocco emette il tema
 * di DEFAULT come CSS vero, nel <style> del layout: il primo paint e gia
 * vestito, e lo script di boot — quando gira — sovrascrive con il tema
 * scelto dall'utente. STESSA fonte di verita (cssVarsFor sul contratto):
 * non e un secondo elenco da tenere in sync, e la stessa funzione resa in
 * due forme.
 */
/**
 * IL SITO TIENE SEMPRE I SUOI COLORI (14 settembre 2026, Manuel: "perche
 * fa schifo con questi colori strani se imposto il telefono in modalita
 * scura?").
 *
 * IL DIFETTO. Il sito e l'app condividono la tavolozza. L'app ha la
 * modalita scura, e in scuro due token si SCAMBIANO: `--jm-bg` passa da
 * crema a quasi nero e `--jm-ink` da cioccolato a crema. Per l'app e
 * giusto — fondo e testo si invertono e il diario si legge al buio.
 *
 * Per il sito e un disastro, perche il sito non li usa come "fondo e
 * testo" ma come MATERIALI. Il velo sotto la fotografia dell'eroe e
 * cioccolato trasparente: scambiato, diventa crema trasparente, e la
 * fotografia si sbianca con sopra parole color crema. Il badge Apple, che
 * e una lastra scura con la scritta chiara, diventa scritta scura su
 * lastra scura: illeggibile. Il sito non ha mai avuto una modalita scura,
 * indossava quella dell'app.
 *
 * LA CURA. Sulle pagine del sito la tavolozza e quella del tema di
 * default in CHIARO, sempre, qualunque cosa dica il telefono. Dentro
 * l'app non cambia niente: la modalita scura resta.
 *
 * PERCHE' `html:has(.jm-sito)` E PERCHE' `!important`, che non sono
 * eleganti e vanno spiegati. Lo script di boot scrive i token come STILE
 * IN LINEA su <html>, e lo stile in linea batte qualunque selettore: una
 * regola normale non lo tocca. `!important` lo batte, ed e l'unico modo
 * senza riscrivere il boot. Va su <html> e non su .jm-sito perche il
 * fondo della pagina — quello che si vede facendo rimbalzare lo scorrimento
 * su iPhone, e quello che Safari campiona per colorare la fascia dell'ora
 * — lo dipinge <html>, non il sito. Il selettore `html:has(...)` e gia lo
 * strumento di casa: styles.css del sito lo usa dal 5 settembre per la
 * stessa ragione.
 *
 * SI PAGA UNA COSA, ed e voluta: chi dentro l'app ha scelto un tema
 * diverso, sul sito vede comunque i colori di casa. Una vetrina che cambia
 * colore a seconda di chi guarda non e piu una vetrina.
 */
export function sitoLuceCss(): string {
  const theme = THEMES.find((t) => t.id === DEFAULT_THEME_ID) ?? THEMES[0];
  const luce = cssVarsFor(theme, "light");
  const corpo = Object.entries(luce)
    .map(([k, v]) => `${k}:${v} !important`)
    .join(";");
  // `color-scheme` lo scrive anche lui il boot, in linea: senza !important
  // resterebbe "dark" e Safari disegnerebbe scuri i controlli di modulo
  // della pagina di assistenza e la barra di scorrimento.
  return `html:has(.jm-sito){${corpo};color-scheme:light !important}`;
}

export function defaultThemeCss(): string {
  const theme = THEMES.find((t) => t.id === DEFAULT_THEME_ID) ?? THEMES[0];
  const render = (vars: Record<string, string>) =>
    Object.entries(vars)
      .map(([k, v]) => `${k}:${v}`)
      .join(";");
  const light = render(cssVarsFor(theme, "light"));
  const dark = render(cssVarsFor(theme, "dark"));
  return (
    `:root{${light};--jm-ui-scale:${DEFAULT_UI_SCALE}}` +
    `@media (prefers-color-scheme: dark){:root{${dark}}}`
  );
}
