import type { MetadataRoute } from "next";
import { SITO } from "@/modules/sito/metadata";

/**
 * Cosa possono guardare i motori di ricerca.
 *
 * Il sito si (`/`, `/en`, `/support`, `/privacy`). L'APP no: `/app` e
 * tutto quello che ci sta sotto e una schermata che senza sessione
 * rimbalza al login, quindi indicizzarla vorrebbe dire riempire Google di
 * pagine vuote a nome nostro. Stessa cosa per /login, /admin e le API.
 *
 * Questo file NON entra nel pacchetto iOS: la build mobile accetta solo
 * `.tsx` (pageExtensions), e un robots.txt dentro un'app non ha senso.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /v1 e la home precedente, congelata per confronto: non e una pagina
        // da trovare, e sparira con la 2.0 approvata.
        disallow: ["/app", "/app/", "/login", "/auth", "/admin", "/api", "/v1", "/en/v1"],
      },
    ],
    sitemap: `${SITO}/sitemap.xml`,
    host: SITO,
  };
}
