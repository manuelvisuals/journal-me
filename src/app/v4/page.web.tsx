// La home editoriale approvata, congelata prima del nuovo aggiornamento.
// Non indicizzabile e non inclusa nella sitemap.
import type { Metadata } from "next";
import { HomeSitoV4 } from "@/modules/sito/components/home-v4";
import { metadataSito, viewportSito } from "@/modules/sito/metadata";

export const dynamic = "force-dynamic";
export const viewport = viewportSito;

export async function generateMetadata(): Promise<Metadata> {
  const m = await metadataSito("home", "it");
  return { ...m, robots: { index: false, follow: false }, alternates: undefined };
}

export default function Pagina() {
  return <HomeSitoV4 lingua="it" altraLingua="/en/v4" />;
}
