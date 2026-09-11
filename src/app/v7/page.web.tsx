// La home dell'11 settembre 2026, congelata quando il desktop e stato
// approvato: da qui in avanti si lavora solo sulla versione telefono.
// Non indicizzabile e non inclusa nella sitemap.
import type { Metadata } from "next";
import { HomeSitoV7 } from "@/modules/sito/components/home-v7";
import { metadataSito, viewportSitoHome } from "@/modules/sito/metadata";

export const dynamic = "force-dynamic";
export const viewport = viewportSitoHome;

export async function generateMetadata(): Promise<Metadata> {
  const m = await metadataSito("home", "it");
  return { ...m, robots: { index: false, follow: false }, alternates: undefined };
}

export default function Pagina() {
  return <HomeSitoV7 lingua="it" altraLingua="/en/v7" />;
}
