import type { Metadata, Viewport } from "next";
import { leggiSeo } from "@/modules/sito/server/seo";
import {
  descrizioneDi,
  ogTitoloDi,
  titoloDi,
  type LinguaSito,
  type PaginaSito,
} from "@/modules/sito/seo";

/**
 * I metadata delle pagine pubbliche, costruiti a ogni visita dai testi che
 * stanno nel pannello /admin.
 *
 * PERCHE UN FILE SOLO PER QUATTRO PAGINE. Perche le cose che vanno tenute
 * d'accordo sono tre e sono noiose: il canonical (l'indirizzo "ufficiale"
 * della pagina), gli hreflang (che dicono a Google che `/` e `/en` sono la
 * stessa pagina in due lingue, non due pagine che si copiano) e il
 * robots. Sbagliarne uno non da nessun errore: da meno visite, sei mesi
 * dopo, senza dire perche.
 */

export const SITO = "https://www.dayalogue.com";

/** L'indirizzo di una pagina, nella lingua data. */
export function indirizzo(pagina: PaginaSito, lingua: LinguaSito): string {
  const l = lingua === "en" ? "/en" : "";
  return pagina === "support" ? `${l}/support` : `${l}/`;
}

/**
 * Il viewport delle pagine pubbliche.
 *
 * L'app blocca lo zoom (`userScalable: false`) perche e una applicazione e
 * il doppio tap deve fare altro. Una pagina di testo no: impedire di
 * ingrandire un paragrafo a chi non vede bene e una barriera, e per Google
 * e un difetto di accessibilita misurato. Quindi qui si sovrascrive.
 */
export const viewportSito: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Solo per la home viva (/ e /en), dove la barra e trasparente sull'eroe.
 * Senza questo meta Safari su iPhone colora la fascia dell'ora campionando
 * il fondo di <html> (--jm-bg), piu scuro dell'eroe (--jm-bg-app): si
 * vedeva una banda beige sopra la pagina (8 settembre 2026). Il valore e
 * il bgApp del tema di fabbrica; lo script di boot dei temi lo riscrive
 * col --jm-bg-app del tema e della modalita reali. Le pagine archiviate
 * (/v1../v5) e /support tengono la barra piena color --jm-bg, quindi per
 * loro il campionamento di Safari e gia giusto.
 */
/**
 * La home viva apre con l'eroe SCURO (10 settembre 2026): la barra di
 * sistema deve accordarsi con quello, non col fondo chiaro della pagina.
 * Il valore e --jm-ink del tema wine chiaro; chi legge theme-color lo usa,
 * e Safari 26, che invece campiona il primo elemento fisso, trova lo stesso
 * colore su body::before (vedi styles.css, blocco jm-sito10).
 */
export const viewportSitoHome: Viewport = {
  ...viewportSito,
  themeColor: "#2B1A17",
};

export async function metadataSito(
  pagina: PaginaSito,
  lingua: LinguaSito,
): Promise<Metadata> {
  const riga = await leggiSeo(pagina);
  const titolo = titoloDi(riga, lingua);
  const descrizione = descrizioneDi(riga, lingua);
  const qui = indirizzo(pagina, lingua);

  return {
    title: titolo,
    description: descrizione,
    metadataBase: new URL(SITO),
    alternates: {
      canonical: qui,
      languages: {
        it: indirizzo(pagina, "it"),
        en: indirizzo(pagina, "en"),
        "x-default": indirizzo(pagina, "it"),
      },
    },
    robots: riga.indicizzabile
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: {
      type: "website",
      siteName: "dayalogue",
      locale: lingua === "it" ? "it_IT" : "en_US",
      url: `${SITO}${qui}`,
      title: ogTitoloDi(riga, lingua),
      description: descrizione,
      images: riga.og_immagine ? [{ url: riga.og_immagine }] : undefined,
    },
    twitter: {
      card: riga.og_immagine ? "summary_large_image" : "summary",
      title: ogTitoloDi(riga, lingua),
      description: descrizione,
      images: riga.og_immagine ? [riga.og_immagine] : undefined,
    },
  };
}
