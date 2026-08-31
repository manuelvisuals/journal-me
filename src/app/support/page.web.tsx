// Guscio: dayalogue.com/support. Vedi src/app/page.web.tsx.
import type { Metadata } from "next";
import { PaginaSupporto } from "@/modules/sito/components/pagina-supporto";
import { metadataSito, viewportSito } from "@/modules/sito/metadata";

export const dynamic = "force-dynamic";

export const viewport = viewportSito;

export async function generateMetadata(): Promise<Metadata> {
  return metadataSito("support", "it");
}

export default function Pagina() {
  return <PaginaSupporto lingua="it" altraLingua="/en/support" />;
}
