// Guscio: la home in inglese. Vedi src/app/page.web.tsx.
import type { Metadata } from "next";
import { HomeSito } from "@/modules/sito/components/home";
import { metadataSito, viewportSito } from "@/modules/sito/metadata";

export const dynamic = "force-dynamic";

export const viewport = viewportSito;

export async function generateMetadata(): Promise<Metadata> {
  return metadataSito("home", "en");
}

export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametri = await searchParams;
  return <HomeSito lingua="en" altraLingua="/" debugHero={parametri.debugHero === "1"} />;
}
