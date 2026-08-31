"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PersonaClient } from "@/modules/ricorda/components/persona-client";
import { loadPersonCard, type PersonCard } from "@/lib/data/people";
import { signalReady } from "@/lib/app-ready";

/**
 * /persona?nome=Christian — la scheda di una persona (mockup
 * design/mockups/idee-feature.html §1, approvato il 21 agosto 2026).
 *
 * Il nome viaggia in `?nome=` e non come pezzo di indirizzo, per la stessa
 * ragione di /giorno?d=: il bundle si esporta statico e un segmento dinamico
 * andrebbe elencato in anticipo, cosa impossibile con i nomi delle persone.
 * In piu un nome puo contenere spazi e accenti, che in una query sono
 * normali e in un percorso sono una fonte di errori.
 */
export default function PersonaPage() {
  const router = useRouter();
  const [stato, setStato] = useState<
    { fase: "carico" } | { fase: "pronto"; card: PersonCard | null; nome: string }
  >({ fase: "carico" });

  useEffect(() => {
    const nome = new URLSearchParams(window.location.search).get("nome") ?? "";
    if (!nome.trim()) {
      router.replace("/app");
      return;
    }
    let vivo = true;
    (async () => {
      const card = await loadPersonCard("auth", nome);
      if (!vivo) return;
      setStato({ fase: "pronto", card, nome });
      signalReady();
    })();
    return () => {
      vivo = false;
    };
  }, [router]);

  if (stato.fase === "carico") return null;
  return <PersonaClient card={stato.card} nome={stato.nome} />;
}
