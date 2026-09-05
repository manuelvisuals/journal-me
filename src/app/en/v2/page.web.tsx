// Guscio TEMPORANEO: la home precedente, congelata su /v2 mentre la 2.0
// prende forma. Non indicizzabile, non nella mappa. Vedi home-v2.tsx.
import type { Metadata } from "next";
import { HomeSitoV2 } from "@/modules/sito/components/home-v2";
import { metadataSito, viewportSito } from "@/modules/sito/metadata";

export const dynamic = "force-dynamic";

export const viewport = viewportSito;

export async function generateMetadata(): Promise<Metadata> {
  const m = await metadataSito("home", "en");
  return { ...m, robots: { index: false, follow: false }, alternates: undefined };
}

export default function Pagina() {
  return <HomeSitoV2 lingua="en" altraLingua="/v2" />;
}
