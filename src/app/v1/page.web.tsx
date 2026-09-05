// Guscio TEMPORANEO: la home precedente, congelata su /v1 mentre la 2.0
// prende forma. Non indicizzabile, non nella mappa. Vedi home-v1.tsx.
import type { Metadata } from "next";
import { HomeSitoV1 } from "@/modules/sito/components/home-v1";
import { metadataSito, viewportSito } from "@/modules/sito/metadata";

export const dynamic = "force-dynamic";

export const viewport = viewportSito;

export async function generateMetadata(): Promise<Metadata> {
  const m = await metadataSito("home", "it");
  return { ...m, robots: { index: false, follow: false }, alternates: undefined };
}

export default function Pagina() {
  return <HomeSitoV1 lingua="it" altraLingua="/en/v1" />;
}
