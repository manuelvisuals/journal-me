"use client";

/**
 * Il pannello "AI in regalo" di Impostazioni (SPEC R3; mockup
 * ospite-primo-avvio.html, schermata 04, approvato il 4 settembre 2026).
 *
 * E L'UNICO POSTO dove il contatore del regalo si vede sempre: nel diario
 * compare solo l'avviso discreto quando resta poco (R3). Tre frasi vere e
 * due numeri. Il tasto per comprare NON sta qui: sta nella riga "Passa a
 * Premium" della schermata prima, come nel mockup.
 *
 * I numeri li dice il server (src/lib/ospite/stato.ts): il dispositivo non
 * conta niente e non promette niente che il server non confermi.
 */

import { useT } from "@/lib/i18n";

type T = ReturnType<typeof useT>;
import { formatNumber } from "@/lib/format";
import { useStatoOspite } from "@/lib/ospite/stato";
import { SetGroup, SetRow } from "@/modules/impostazioni/components/rows";

/** Il valore corto per la riga "AI in regalo" della schermata principale. */
export function valoreRegalo(
  t: T,
  s: { attivo: boolean; sopraIlTetto: boolean; rimaste: number; max: number } | null,
): string | undefined {
  if (!s) return undefined;
  if (!s.attivo || s.sopraIlTetto) return t("in pausa");
  if (s.rimaste <= 0) return t("finito");
  return t("{n} giornate su {max}", { n: formatNumber(s.rimaste), max: formatNumber(s.max) });
}

export function RegaloPanel() {
  const t = useT();
  const stato = useStatoOspite(true);

  const lede = !stato
    ? t("Un attimo: chiedo al server quante giornate restano.")
    : !stato.attivo || stato.sopraIlTetto
      ? t("Il regalo e in pausa: per ora l'AI non lavora per chi non ha un abbonamento.")
      : stato.rimaste <= 0
        ? t("Le {max} giornate con l'AI in regalo sono finite.", { max: formatNumber(stato.max) })
        : t("{n} giornate su {max}, ancora con l'AI.", {
            n: formatNumber(stato.rimaste),
            max: formatNumber(stato.max),
          });

  return (
    <>
      <p className="jm-st-lede">{lede}</p>
      <SetGroup label={t("Come funziona")}>
        <SetRow
          title={t("Le prime giornate le paga chi ha fatto questa app")}
          desc={t(
            "Racconto a voce, titolo, sintesi e aree. Una giornata conta una volta, anche se la riapri e la completi.",
          )}
          chevron={false}
        />
        <SetRow
          title={t("Quando finiscono, l'app continua")}
          desc={t("Scrivi, salvi, rileggi. Manca solo la parte fatta dall'AI.")}
          chevron={false}
        />
        <SetRow
          title={t("Il conto e legato a questo dispositivo, non all'app")}
          desc={t(
            "Cancellare e reinstallare non lo azzera. Se metti una email, il conto ti segue e non ricomincia.",
          )}
          chevron={false}
        />
      </SetGroup>
      {stato && (
        <SetGroup label={t("Il conto")}>
          <SetRow title={t("Usate")} value={formatNumber(stato.usate)} chevron={false} />
          <SetRow title={t("Rimaste")} value={formatNumber(stato.rimaste)} chevron={false} />
        </SetGroup>
      )}
    </>
  );
}
