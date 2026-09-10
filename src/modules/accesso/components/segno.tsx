"use client";

/**
 * Il segno di dayalogue dentro l'app: la `d` del wordmark (Newsreader 600,
 * il GLIFO vero, gia ridotto a contorno) piu i tre punti delle aree.
 *
 * E' lo stesso disegno dell'icona sul telefono (design/immagini/icona-app.svg,
 * approvata da Manuel il 9 settembre 2026), stesse proporzioni: `d` al 41 per
 * cento del lato, punto al 6,8, passo 11,3, stacco 4,6. Qui e un contorno e
 * non una PNG per due motivi: si ridisegna nitido a ogni densita di schermo,
 * e prende i colori del tema invece di portarsi dietro il suo fondo chiaro.
 *
 * Il tracciato NON si tocca a mano: viene dal font. Per rifarlo, la ricetta e
 * in reference_wordmark (istanza wght 600, glifo "d", SVGPathPen).
 */
export function SegnoDayalogue({ size = 30 }: { size?: number }) {
  return (
    <svg
      className="jm-segno"
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="1024" height="1024" rx="225" className="jm-segno-fondo" />
      <g transform="translate(338.65 656.68) scale(0.28796 -0.28796)">
        <path className="jm-segno-d" d="M752 611Q752 697 705.5 750.0Q659 803 564 803Q490 803 437.5 765.0Q385 727 357.0 650.0Q329 573 329 458Q329 347 359.0 273.5Q389 200 443.5 164.0Q498 128 573 128Q632 128 691.0 145.5Q750 163 806 200V122Q735 77 684.5 48.0Q634 19 596.0 3.5Q558 -12 525.5 -18.0Q493 -24 461 -24Q333 -24 245.5 29.5Q158 83 114.0 179.0Q70 275 70 401Q70 524 111.0 619.5Q152 715 223.5 780.5Q295 846 386.5 880.0Q478 914 578 914Q633 914 683.5 905.5Q734 897 786.5 879.5Q839 862 900 832L752 799V1203Q738 1219 715.0 1234.0Q692 1249 664.0 1263.5Q636 1278 603 1293V1338L977 1434H1012L997 1230V178Q1007 167 1023.0 156.0Q1039 145 1058.0 133.5Q1077 122 1096.5 113.5Q1116 105 1134 99V59L817 -23H785L752 147Z" />
      </g>
      <g className="jm-segno-punti">
        <circle cx="396.3" cy="745.5" r="34.8" />
        <circle cx="512" cy="745.5" r="34.8" />
        <circle cx="627.7" cy="745.5" r="34.8" />
      </g>
    </svg>
  );
}
