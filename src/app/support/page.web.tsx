// Guscio: dayalogue.com/support. Vedi src/app/page.web.tsx.
import type { Metadata } from "next";
import { PaginaSupporto } from "@/modules/sito/components/pagina-supporto";
import { metadataSito, viewportSito } from "@/modules/sito/metadata";
import { precompilatoDaIndirizzo, type ParametriPagina } from "@/modules/sito/supporto-indirizzo";

export const dynamic = "force-dynamic";

export const viewport = viewportSito;

export async function generateMetadata(): Promise<Metadata> {
  return metadataSito("support", "it");
}

export default async function Pagina({ searchParams }: { searchParams: ParametriPagina }) {
  return (
    <PaginaSupporto
      lingua="it"
      altraLingua="/en/support"
      precompilato={precompilatoDaIndirizzo(await searchParams)}
    />
  );
}
