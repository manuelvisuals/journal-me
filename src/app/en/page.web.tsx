// Guscio: la home in inglese. Vedi src/app/page.web.tsx.
import type { Metadata } from "next";
import { HomeSito } from "@/modules/sito/components/home";
import { metadataSito, viewportSito } from "@/modules/sito/metadata";

export const dynamic = "force-dynamic";

export const viewport = viewportSito;

export async function generateMetadata(): Promise<Metadata> {
  return metadataSito("home", "en");
}

export default function Pagina() {
  return <HomeSito lingua="en" altraLingua="/" />;
}
