import type { Metadata } from "next";
import { HomeSito } from "@/modules/sito/components/home";
import { metadataSito, viewportSito } from "@/modules/sito/metadata";

export const dynamic = "force-dynamic";
export const viewport = viewportSito;

export async function generateMetadata(): Promise<Metadata> {
  const m = await metadataSito("home", "it");
  return { ...m, robots: { index: false, follow: false }, alternates: undefined };
}

export default function Pagina() {
  return <HomeSito lingua="it" altraLingua="/en/v5" archivioV5 />;
}
