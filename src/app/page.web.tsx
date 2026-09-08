// Guscio: la home pubblica di dayalogue.com. La pagina vive nel modulo
// SITO. Il nome del file NON e un errore: `page.web.tsx` esiste solo per
// la build web (pageExtensions in next.config.ts) e la build del guscio
// iOS lo ignora, perche un sito di vendita dentro il pacchetto dell'app
// sarebbe la prima schermata che vede chi apre l'app sul telefono.
import type { Metadata } from "next";
import { HomeSito } from "@/modules/sito/components/home";
import { metadataSito, viewportSito } from "@/modules/sito/metadata";

// Ogni visita rilegge i testi dal pannello: cambi il titolo in /admin,
// ricarichi, ed e cambiato. Senza questo il titolo si congelerebbe al
// momento del deploy e il pannello sarebbe un giocattolo.
export const dynamic = "force-dynamic";

export const viewport = viewportSito;

export async function generateMetadata(): Promise<Metadata> {
  return metadataSito("home", "it");
}

export default function Pagina() {
  return <HomeSito lingua="it" altraLingua="/en" />;
}
