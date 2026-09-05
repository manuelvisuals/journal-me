// Guscio TEMPORANEO: la home del 5 settembre 2026 sera, congelata su /v2 mentre
// si rimette mano al sito. Non indicizzabile, non nella mappa.
import type { Metadata } from "next";
import { HomeSitoV2 } from "@/modules/sito/components/home-v2";
import { metadataSito, viewportSito } from "@/modules/sito/metadata";

export const dynamic = "force-dynamic";

export const viewport = viewportSito;

export async function generateMetadata(): Promise<Metadata> {
  const m = await metadataSito("home", "it");
  return { ...m, robots: { index: false, follow: false }, alternates: undefined };
}

export default function Pagina() {
  return <HomeSitoV2 lingua="it" altraLingua="/en/v2" />;
}
