// English snapshot of the approved editorial homepage.
// It is intentionally excluded from indexing and the sitemap.
import type { Metadata } from "next";
import { HomeSitoV4 } from "@/modules/sito/components/home-v4";
import { metadataSito, viewportSito } from "@/modules/sito/metadata";

export const dynamic = "force-dynamic";
export const viewport = viewportSito;

export async function generateMetadata(): Promise<Metadata> {
  const m = await metadataSito("home", "en");
  return { ...m, robots: { index: false, follow: false }, alternates: undefined };
}

export default function Pagina() {
  return <HomeSitoV4 lingua="en" altraLingua="/v4" />;
}
