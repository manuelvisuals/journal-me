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
 * CORPO HA LA SUA ICONA DALL'8 SETTEMBRE 2026 (disegno di Manuel), come
 * Persone e Luoghi sotto la giornata. Un'area nuova senza disegno resta
 * valida: la riga si disegna senza, meglio un posto vuoto che un simbolo
 * preso in prestito da un'altra area.
 */

import type { ReactElement } from "react";

/**
 * La mappa e a chiave sul campo `icona` dell'area (tabella `aree`), non sul
 * nome: il nome si puo rinominare dal pannello admin, il disegno resta
 * agganciato. Un'area senza `icona` (Corpo, o una nuova senza disegno) non
 * disegna niente, ed e un caso valido.
 */
const ICONS: Record<string, ReactElement> = {
  lavoro: (
    <svg className="jm-area-ic" viewBox="0 0 256 256">  <defs><filter id="f-lavoro" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency=".018 .055" numOctaves="2" seed="11" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.7"/></filter></defs> <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" filter="url(#f-lavoro)">  <path d="M45 90 Q45 78 58 78 H198 Q211 78 211 91 L205 184 Q204 196 191 196 H63 Q50 196 49 184 Z" strokeWidth="13"/>  <path d="M94 76 V62 Q94 53 104 53 H152 Q162 53 162 62 V76" strokeWidth="11"/>  <path d="M49 117 Q91 145 128 145 Q166 145 207 117" strokeWidth="9"/> </g> <path d="M128 127 C131 137 134 140 144 143 C134 146 131 149 128 159 C125 149 122 146 112 143 C122 140 125 137 128 127Z" fill="var(--jm-area-dot)"/></svg>
  ),
  relazioni: (
    <svg className="jm-area-ic" viewBox="0 0 256 256">  <defs><filter id="f-relazioni" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency=".016 .05" numOctaves="2" seed="23" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.8"/></filter></defs> <g fill="none" stroke="currentColor" strokeWidth="17" strokeLinecap="round" filter="url(#f-relazioni)">  <path d="M111 66 C77 40 39 67 42 107 C45 151 87 178 124 205"/>  <path d="M145 66 C179 40 217 67 214 107 C211 151 169 178 132 205"/>  <path d="M77 112 C95 128 108 135 126 146" strokeWidth="9"/>  <path d="M179 112 C161 128 148 135 130 146" strokeWidth="9"/> </g> <circle cx="128" cy="145" r="10" fill="var(--jm-area-dot)"/></svg>
  ),
  cibo: (
    <svg className="jm-area-ic" viewBox="0 0 256 256">  <defs><filter id="f-cibo" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency=".017 .052" numOctaves="2" seed="31" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.7"/></filter></defs> <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" filter="url(#f-cibo)">  <path d="M43 112 Q128 101 213 112 C203 163 172 192 128 192 C84 192 53 163 43 112Z" strokeWidth="14"/>  <path d="M66 202 Q128 211 190 202" strokeWidth="10"/>  <path d="M128 110 C126 82 136 62 158 48" strokeWidth="10"/>  <path d="M157 49 C177 42 188 48 191 64 C172 72 159 66 157 49Z" strokeWidth="8"/>  <path d="M129 88 C112 72 96 71 83 82 C95 99 110 102 129 88Z" strokeWidth="8"/> </g> <circle cx="128" cy="130" r="7" fill="var(--jm-area-dot)"/></svg>
  ),
  movimento: (
    <svg className="jm-area-ic" viewBox="0 0 256 256">  <defs><filter id="f-movimento" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency=".019 .058" numOctaves="2" seed="47" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.9"/></filter></defs> <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" filter="url(#f-movimento)">  <path d="M126 82 C108 104 103 126 115 145 C128 164 150 175 172 198" strokeWidth="16"/>  <path d="M113 113 C88 119 70 132 54 153" strokeWidth="12"/>  <path d="M121 113 C149 117 171 108 192 92" strokeWidth="12"/>  <path d="M117 146 C96 165 80 181 64 203" strokeWidth="15"/>  <path d="M49 215 C94 222 139 220 207 207" strokeWidth="7" opacity=".65"/> </g> <circle cx="137" cy="54" r="17" fill="var(--jm-area-dot)" filter="url(#f-movimento)"/></svg>
  ),
  emozioni: (
    <svg className="jm-area-ic" viewBox="0 0 256 256">  <defs><filter id="f-emozioni" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency=".015 .047" numOctaves="2" seed="59" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.8"/></filter></defs> <g fill="none" stroke="currentColor" strokeLinecap="round" filter="url(#f-emozioni)">  <path d="M128 41 C178 40 214 78 214 126 C214 178 178 214 128 215 C80 216 42 181 42 132 C42 93 63 66 91 53" strokeWidth="13"/>  <path d="M128 72 C163 70 184 95 183 127 C182 159 161 184 128 184 C95 184 72 162 73 130 C74 105 88 87 108 78" strokeWidth="11"/>  <path d="M129 102 C147 101 157 113 157 129 C157 146 145 156 129 156 C112 156 101 145 101 130 C101 118 108 108 117 104" strokeWidth="9"/> </g> <circle cx="129" cy="129" r="9" fill="var(--jm-area-dot)"/></svg>
  ),
};

/**
 * Le tre icone arrivate da Manuel l'8 settembre 2026 (journalmemissingiconssvg):
 * Corpo (l'area che non ne aveva), Persone e Luoghi (le due righe sotto la
 * giornata che non ne avevano). Sono disegni 24x24 a tratto 1.7: alla
 * misura delle altre (1.82em) il tratto pesa come i loro 13-17/256. Il
 * punto terracotta e sulla testa e sul segnaposto, per restare in famiglia.
 */
ICONS.corpo = (
  <svg className="jm-area-ic" viewBox="0 0 24 24" fill="none">
    <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="4.15" r="1.85" fill="var(--jm-area-dot)" stroke="none" />
      <path d="M9.25 8.1c.86.7 1.78 1.05 2.75 1.05s1.89-.35 2.75-1.05" />
      <path d="M9.35 8.45c-.72 2.2-.64 4.22.25 5.85.66 1.2.78 3.04.42 5.35" />
      <path d="M14.65 8.45c.72 2.2.64 4.22-.25 5.85-.66 1.2-.78 3.04-.42 5.35" />
      <path d="M9.65 14.15c1.4.7 3.3.7 4.7 0" />
    </g>
  </svg>
);
ICONS.persone = (
  <svg className="jm-area-ic" viewBox="0 0 24 24" fill="none">
    <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8.2" cy="8" r="2.35" />
      <circle cx="15.8" cy="8" r="2.35" />
      <path d="M3.75 18.3c.28-3.08 1.92-4.72 4.45-4.72 1.54 0 2.74.61 3.48 1.79" />
      <path d="M20.25 18.3c-.28-3.08-1.92-4.72-4.45-4.72-1.54 0-2.74.61-3.48 1.79" />
      <path d="M9.6 18.3c.36-1.36 1.16-2.06 2.4-2.06s2.04.7 2.4 2.06" />
    </g>
    <circle cx="12" cy="13.2" r="1.15" fill="var(--jm-area-dot)" />
  </svg>
);
ICONS.luoghi = (
  <svg className="jm-area-ic" viewBox="0 0 24 24" fill="none">
    <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.6 9.15c0 4.02-5.6 9.3-5.6 9.3s-5.6-5.28-5.6-9.3a5.6 5.6 0 0 1 11.2 0Z" />
      <path d="M8.65 18.15c-2.34.27-3.65.86-3.65 1.55 0 .96 3.13 1.74 7 1.74s7-.78 7-1.74c0-.69-1.31-1.28-3.65-1.55" />
    </g>
    <circle cx="12" cy="9.15" r="1.75" fill="var(--jm-area-dot)" />
  </svg>
);

/** Crescita (disegno di Manuel, 8 settembre 2026): il germoglio, stessa famiglia delle cinque. */
ICONS.crescita = (
  <svg className="jm-area-ic" viewBox="0 0 256 256">
    <defs>
      <filter id="f-crescita" x="-8%" y="-8%" width="116%" height="116%">
        <feTurbulence type="fractalNoise" baseFrequency=".017 .052" numOctaves="2" seed="83" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="1.8" />
      </filter>
    </defs>
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" filter="url(#f-crescita)">
      <path d="M128 207 C126 176 128 143 130 103" strokeWidth="13" />
      <path d="M129 145 C103 145 83 132 72 106 C99 102 120 116 129 145Z" strokeWidth="11" />
      <path d="M130 109 C136 79 156 61 187 56 C182 87 160 106 130 109Z" strokeWidth="11" />
      <path d="M65 209 C84 194 105 188 128 188 C151 188 172 194 191 209" strokeWidth="10" />
    </g>
    <circle cx="129" cy="145" r="9" fill="var(--jm-area-dot)" />
  </svg>
);

export function AreaIcon({ icona }: { icona: string | null }) {
  const icon = icona ? ICONS[icona] : undefined;
  if (!icon) return null;
  return (
    <span className="jm-area-icw" aria-hidden="true">
      {icon}
    </span>
  );
}
