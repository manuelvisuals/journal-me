// Guscio TEMPORANEO: la home del 7 settembre 2026, congelata su /v3 mentre
// si rimette mano al sito. Non indicizzabile, non nella mappa.
import type { Metadata } from "next";
import { HomeSitoV3 } from "@/modules/sito/components/home-v3";
import { metadataSito, viewportSito } from "@/modules/sito/metadata";

export const dynamic = "force-dynamic";

export const viewport = viewportSito;

export async function generateMetadata(): Promise<Metadata> {
  const m = await metadataSito("home", "it");
  return { ...m, robots: { index: false, follow: false }, alternates: undefined };
}

export default function Pagina() {
  return <HomeSitoV3 lingua="it" altraLingua="/en/v3" />;
}
