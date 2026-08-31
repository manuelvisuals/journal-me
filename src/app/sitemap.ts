import type { MetadataRoute } from "next";
import { SITO, indirizzo } from "@/modules/sito/metadata";
import { leggiSeo } from "@/modules/sito/server/seo";
import { PAGINE } from "@/modules/sito/seo";

/**
 * La mappa del sito: solo le pagine pubbliche, ognuna nelle due lingue.
 *
 * Una pagina con l'interruttore "fatti trovare" spento (pannello /admin)
 * NON entra qui: dichiararla nella mappa e poi dirle di non indicizzarsi
 * sono due ordini opposti dati allo stesso robot.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const voci: MetadataRoute.Sitemap = [];
  for (const pagina of PAGINE) {
    const riga = await leggiSeo(pagina);
    if (!riga.indicizzabile) continue;
    for (const lingua of ["it", "en"] as const) {
      voci.push({
        url: `${SITO}${indirizzo(pagina, lingua)}`,
        changeFrequency: "monthly",
        priority: pagina === "home" ? 1 : 0.5,
        alternates: {
          languages: {
            it: `${SITO}${indirizzo(pagina, "it")}`,
            en: `${SITO}${indirizzo(pagina, "en")}`,
          },
        },
      });
    }
  }
  return voci;
}
