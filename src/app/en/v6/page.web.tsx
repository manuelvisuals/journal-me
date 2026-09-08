// La home dell'8 settembre 2026, congelata prima delle animazioni di scorrimento.
// Non indicizzabile e non inclusa nella sitemap.
import type { Metadata } from "next";
import { HomeSitoV6 } from "@/modules/sito/components/home-v6";
import { metadataSito, viewportSitoHome } from "@/modules/sito/metadata";

export const dynamic = "force-dynamic";
export const viewport = viewportSitoHome;

export async function generateMetadata(): Promise<Metadata> {
  const m = await metadataSito("home", "en");
  return { ...m, robots: { index: false, follow: false }, alternates: undefined };
}

export default function Pagina() {
  return <HomeSitoV6 lingua="en" altraLingua="/v6" />;
}
