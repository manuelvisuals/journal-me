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
        // Le home congelate per confronto non sono pagine da trovare. /v4,
        // /v5 e /v6 restano fuori da qui solo perche hanno gia `robots:
        // index false` nel loro generateMetadata, che e il modo piu forte:
        // /v7 ce l'ha e in piu sta qui, perche e quella che restera piu a
        // lungo (e il metro del desktop approvato).
        disallow: ["/app", "/app/", "/login", "/auth", "/admin", "/api", "/v1", "/en/v1", "/v2", "/en/v2", "/v3", "/en/v3", "/v7", "/en/v7"],
      },
    ],
    sitemap: `${SITO}/sitemap.xml`,
    host: SITO,
  };
}
