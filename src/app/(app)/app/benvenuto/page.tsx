"use client";

/**
 * /app/benvenuto non esiste piu come schermata (10 settembre 2026, punto 7
 * del modello premium: "Come vuoi iniziare? FREE o PREMIUM" sparisce, una
 * porta sola per tutti). L'indirizzo resta per i vecchi segnalibri e per
 * chi lo ha in cronologia: porta dentro. La proposta di premium vive nella
 * porta del giorno (modulo accesso, porta-giorno.tsx) e nel muro.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BenvenutoPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app");
  }, [router]);
  return null;
}
