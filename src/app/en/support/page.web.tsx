// Guscio: la pagina di assistenza in inglese. Vedi src/app/page.web.tsx.
import type { Metadata } from "next";
import { PaginaSupporto } from "@/modules/sito/components/pagina-supporto";
import { metadataSito, viewportSito } from "@/modules/sito/metadata";

export const dynamic = "force-dynamic";

export const viewport = viewportSito;

export async function generateMetadata(): Promise<Metadata> {
  return metadataSito("support", "en");
}

export default function Pagina() {
  return <PaginaSupporto lingua="en" altraLingua="/support" />;
}
