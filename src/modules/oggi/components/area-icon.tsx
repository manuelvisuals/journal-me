"use client";

/**
 * Le icone delle sei macro-aree, dentro le schede della giornata piena.
 * Mockup `design/mockups/icone-aree.html` §01, approvato il 22 agosto 2026:
 * 20px accanto all'etichetta, dentro la riga che c'e gia.
 *
 * PERCHE STANNO NEL CODICE E NON IN `public`. Sono disegni a due colori che
 * devono vivere su dieci fondi diversi (cinque temi, chiaro e scuro). Il
 * tratto arriva marrone scuro dal file originale: su Wine, o su qualunque
 * tema scuro, sparirebbe. Inline, il tratto prende `currentColor` e segue
 * il testo; un `<img>` non puo ereditare un colore.
 *
 * IL PUNTO CALDO RESTA SUO. Ogni disegno ha un punto terracotta — la ciotola
 * ne ha uno dentro, il corridore ne ha uno per testa. Non prende l'accento
 * del tema: su Minimal l'accento e quasi nero, e il punto sparirebbe dentro
 * il tratto proprio dove serve a dare calore. Il colore sta in features.css
 * (`--jm-area-dot`), cosi cambiarlo non passa da qui.
 *
 * IL FILTRO A PENNELLO. Ogni disegno porta un `feTurbulence` con un `id`
 * suo (`f-lavoro`, `f-cibo`...). Se restassero tutti `id="s"` come nei file
 * originali, cinque icone nella stessa pagina si riferirebbero tutte al
 * primo filtro: gli id di un SVG inline sono globali al documento.
 *
 * CORPO NON HA ICONA. Le aree sono sei e i disegni cinque. La riga si
 * disegna senza, e la scheda resta valida: meglio un posto vuoto che un
 * simbolo preso in prestito da un'altra area.
 */

import type { ReactElement } from "react";

/**
 * Le etichette sono un elenco chiuso salvato a database e restano in
 * italiano anche quando l'app parla inglese (vedi il prompt di
 * process-entry): la mappa si fa su quelle, non sulla traduzione.
 */
const ICONS: Record<string, ReactElement> = {
  Lavoro: (
    <svg className="jm-area-ic" viewBox="0 0 256 256">  <defs><filter id="f-lavoro" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency=".018 .055" numOctaves="2" seed="11" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.7"/></filter></defs> <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" filter="url(#f-lavoro)">  <path d="M45 90 Q45 78 58 78 H198 Q211 78 211 91 L205 184 Q204 196 191 196 H63 Q50 196 49 184 Z" strokeWidth="13"/>  <path d="M94 76 V62 Q94 53 104 53 H152 Q162 53 162 62 V76" strokeWidth="11"/>  <path d="M49 117 Q91 145 128 145 Q166 145 207 117" strokeWidth="9"/> </g> <path d="M128 127 C131 137 134 140 144 143 C134 146 131 149 128 159 C125 149 122 146 112 143 C122 140 125 137 128 127Z" fill="var(--jm-area-dot)"/></svg>
  ),
  Relazioni: (
    <svg className="jm-area-ic" viewBox="0 0 256 256">  <defs><filter id="f-relazioni" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency=".016 .05" numOctaves="2" seed="23" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.8"/></filter></defs> <g fill="none" stroke="currentColor" strokeWidth="17" strokeLinecap="round" filter="url(#f-relazioni)">  <path d="M111 66 C77 40 39 67 42 107 C45 151 87 178 124 205"/>  <path d="M145 66 C179 40 217 67 214 107 C211 151 169 178 132 205"/>  <path d="M77 112 C95 128 108 135 126 146" strokeWidth="9"/>  <path d="M179 112 C161 128 148 135 130 146" strokeWidth="9"/> </g> <circle cx="128" cy="145" r="10" fill="var(--jm-area-dot)"/></svg>
  ),
  Cibo: (
    <svg className="jm-area-ic" viewBox="0 0 256 256">  <defs><filter id="f-cibo" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency=".017 .052" numOctaves="2" seed="31" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.7"/></filter></defs> <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" filter="url(#f-cibo)">  <path d="M43 112 Q128 101 213 112 C203 163 172 192 128 192 C84 192 53 163 43 112Z" strokeWidth="14"/>  <path d="M66 202 Q128 211 190 202" strokeWidth="10"/>  <path d="M128 110 C126 82 136 62 158 48" strokeWidth="10"/>  <path d="M157 49 C177 42 188 48 191 64 C172 72 159 66 157 49Z" strokeWidth="8"/>  <path d="M129 88 C112 72 96 71 83 82 C95 99 110 102 129 88Z" strokeWidth="8"/> </g> <circle cx="128" cy="130" r="7" fill="var(--jm-area-dot)"/></svg>
  ),
  Movimento: (
    <svg className="jm-area-ic" viewBox="0 0 256 256">  <defs><filter id="f-movimento" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency=".019 .058" numOctaves="2" seed="47" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.9"/></filter></defs> <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" filter="url(#f-movimento)">  <path d="M126 82 C108 104 103 126 115 145 C128 164 150 175 172 198" strokeWidth="16"/>  <path d="M113 113 C88 119 70 132 54 153" strokeWidth="12"/>  <path d="M121 113 C149 117 171 108 192 92" strokeWidth="12"/>  <path d="M117 146 C96 165 80 181 64 203" strokeWidth="15"/>  <path d="M49 215 C94 222 139 220 207 207" strokeWidth="7" opacity=".65"/> </g> <circle cx="137" cy="54" r="17" fill="var(--jm-area-dot)" filter="url(#f-movimento)"/></svg>
  ),
  Emozioni: (
    <svg className="jm-area-ic" viewBox="0 0 256 256">  <defs><filter id="f-emozioni" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency=".015 .047" numOctaves="2" seed="59" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.8"/></filter></defs> <g fill="none" stroke="currentColor" strokeLinecap="round" filter="url(#f-emozioni)">  <path d="M128 41 C178 40 214 78 214 126 C214 178 178 214 128 215 C80 216 42 181 42 132 C42 93 63 66 91 53" strokeWidth="13"/>  <path d="M128 72 C163 70 184 95 183 127 C182 159 161 184 128 184 C95 184 72 162 73 130 C74 105 88 87 108 78" strokeWidth="11"/>  <path d="M129 102 C147 101 157 113 157 129 C157 146 145 156 129 156 C112 156 101 145 101 130 C101 118 108 108 117 104" strokeWidth="9"/> </g> <circle cx="129" cy="129" r="9" fill="var(--jm-area-dot)"/></svg>
  ),
};

export function AreaIcon({ label }: { label: string }) {
  const icon = ICONS[label];
  if (!icon) return null;
  return (
    <span className="jm-area-icw" aria-hidden="true">
      {icon}
    </span>
  );
}
