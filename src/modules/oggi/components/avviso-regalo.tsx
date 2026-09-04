"use client";

/**
 * L'avviso discreto dell'ospite (SPEC R3; mockup ospite-primo-avvio.html,
 * schermata 02, approvato da Manuel il 4 settembre 2026, decisione D:
 * quando restano 3 giornate o meno).
 *
 * Una riga in una card SOTTO la giornata appena chiusa dall'AI: non un
 * popup, non all'avvio, non nel Mese. Dice la verita e cosa succede dopo
 * (l'app resta, finisce solo l'AI). Si chiude con la X e per quella
 * giornata non torna (localStorage). "Prova premium" apre il muro a
 * schede con l'acquisto Apple (sul web: il rimando all'App Store).
 *
 * Quando l'ultima giornata e appena stata spesa (rimaste 0) lo dice con
 * un'altra frase: e l'unico momento in cui "ti restano 0" sarebbe stato
 * ridicolo.
 */
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { useStatoOspite } from "@/lib/ospite/stato";
import { openPremiumWall } from "@/modules/abbonamento";

export const SOGLIA_AVVISO = 3;

function chiaveChiuso(date: string): string {
  return `jm.ospite.avviso.${date}`;
}

export function AvvisoRegalo({ date, vivo }: { date: string; vivo: boolean }) {
  const t = useT();
  const stato = useStatoOspite(vivo);
  const [chiuso, setChiuso] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(chiaveChiuso(date)) === "1";
    } catch {
      return false;
    }
  });

  if (!vivo || chiuso || !stato) return null;
  if (!stato.attivo || stato.sopraIlTetto) return null;
  if (stato.rimaste > SOGLIA_AVVISO) return null;

  const chiudi = () => {
    setChiuso(true);
    try {
      window.localStorage.setItem(chiaveChiuso(date), "1");
    } catch {
      // niente memoria: la X vale per questa visita
    }
  };

  const testo =
    stato.rimaste <= 0
      ? t("Questa era l'ultima giornata con l'AI in regalo. Da domani scrivi e rileggi come sempre: manca solo il titolo fatto dall'AI.")
      : stato.rimaste === 1
        ? t("Ti resta 1 giornata con l'AI in regalo. Dopo, scrivi e rileggi come sempre: manca solo il titolo fatto dall'AI.")
        : t("Ti restano {n} giornate con l'AI in regalo. Dopo, scrivi e rileggi come sempre: manca solo il titolo fatto dall'AI.", {
            n: String(stato.rimaste),
          });

  return (
    <div className="jm-avviso-regalo" role="status" data-rimaste={stato.rimaste}>
      <i aria-hidden="true" />
      <div className="t">
        {testo}{" "}
        <button type="button" className="l" onClick={() => openPremiumWall("aiSummary")}>
          {t("Prova premium")}
        </button>
      </div>
      <button type="button" className="x" aria-label={t("Chiudi l'avviso")} onClick={chiudi}>
        &#x2715;
      </button>
    </div>
  );
}
