"use client";

/**
 * La scheda di una persona.
 *
 * A cosa serve, con le parole di Manuel: "tener traccia delle persone che
 * incontro cosi da ricordarmi guarda che Christian l'hai visto poco
 * ultimamente". Quindi la domanda a cui questa schermata deve rispondere in
 * un secondo, senza far contare niente a nessuno, e UNA: da quanto non lo
 * vedi. Sta in cima, in lettere grandi.
 *
 * Le altre due cifre stanno accanto perche da sole non dicono molto: sette
 * incontri e' tanto o poco a seconda che siano di quest'anno o di tre anni
 * fa, e "in calo" ha senso solo confrontando due periodi.
 *
 * NESSUN GIUDIZIO. La riga dell'andamento dice "3 negli ultimi due mesi,
 * prima 6": un fatto, con i suoi numeri accanto. Non "stai trascurando
 * Christian" — il diario non da pagelle (SPEC-v2: tracker neutri, niente
 * voti), e chi legge sa benissimo cosa farsene di quel confronto.
 */

import { useRouter } from "next/navigation";
import { TabBar } from "@/components/ui/tab-bar";
import { compactDayDate, formatNumber, parseISODate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { PersonCard } from "@/lib/data/people";

type Props = {
  card: PersonCard | null;
  nome: string;
};

export function PersonaClient({ card, nome }: Props) {
  const t = useT();
  const router = useRouter();

  return (
    <>
      <main className="jm-screen mx-auto flex w-full max-w-[440px] lg:max-w-none flex-1 flex-col">
        <header className="jm-day-head">
          <button
            type="button"
            className="jm-day-back"
            onClick={() => router.back()}
            aria-label={t("Indietro")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          {/* Sul telefono il nome della schermata sta nella barra in alto
              (30 agosto 2026, strada B): qui sarebbe scritto due volte. */}
          <span className="jm-day-head-label jm-solo-desktop">
            {t("Persona")}
          </span>
        </header>

        {!card ? (
          <div className="jm-pers-empty">
            <div className="jm-pers-empty-h">{nome}</div>
            <p className="jm-pers-empty-p">
              {t(
                "Questo nome non compare in nessuna giornata. Comparira da solo la prossima volta che lo nomini raccontando.",
              )}
            </p>
          </div>
        ) : (
          <div className="jm-pers-scroll">
            <div className="jm-pers-top">
              <div className="jm-pers-av" aria-hidden="true">
                {card.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="jm-pers-id">
                <h1 className="jm-pers-name">{card.name}</h1>
                <div className="jm-pers-last">{lastSeenLabel(card, t)}</div>
              </div>
            </div>

            <div className="jm-pers-stats">
              <div className="jm-pers-stat">
                <div className="n">{formatNumber(card.meetings)}</div>
                <div className="k">
                  {card.meetings === 1 ? t("giornata") : t("giornate")}
                </div>
              </div>
              <div className="jm-pers-stat">
                <div className="n">
                  {card.daysAgo === null ? "-" : formatNumber(card.daysAgo)}
                </div>
                <div className="k">{t("giorni fa")}</div>
              </div>
              <div className="jm-pers-stat">
                <div className="n">{formatNumber(card.recent)}</div>
                <div className="k">{t("in 2 mesi")}</div>
              </div>
            </div>

            <div className="jm-pers-trend">{trendLabel(card, t)}</div>

            <div className="jm-pers-l">{t("Le giornate")}</div>
            <div className="jm-pers-days">
              {card.days.map((d) => (
                <button
                  key={d.date}
                  type="button"
                  className="jm-pers-day"
                  onClick={() => router.push(`/giorno?d=${d.date}`)}
                >
                  <span className="d">
                    {compactDayDate(parseISODate(d.date))}
                  </span>
                  <span className="x">
                    {d.headline?.trim() || d.snippet?.trim() || t("giornata raccontata")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
      <TabBar active="today" />
    </>
  );
}

/** "vista oggi" / "vista 2 giorni fa" / "vista il 3 marzo". */
function lastSeenLabel(card: PersonCard, t: (s: string, v?: Record<string, string | number>) => string): string {
  if (card.lastSeen === null || card.daysAgo === null) return "";
  if (card.daysAgo <= 0) return t("l'ultima volta oggi");
  if (card.daysAgo === 1) return t("l'ultima volta ieri");
  if (card.daysAgo < 30)
    return t("l'ultima volta {giorni} giorni fa", {
      giorni: formatNumber(card.daysAgo),
    });
  return t("l'ultima volta il {giorno}", {
    giorno: compactDayDate(parseISODate(card.lastSeen)),
  });
}

/**
 * Il confronto fra due mesi e i due precedenti, detto come un fatto. Se non
 * c'e abbastanza storia alle spalle non si dice niente: due mesi di dati non
 * bastano per parlare di andamento, e inventarlo sarebbe peggio che tacere.
 */
function trendLabel(
  card: PersonCard,
  t: (s: string, v?: Record<string, string | number>) => string,
): string {
  if (card.recent === 0 && card.previous === 0) return "";
  if (card.previous === 0)
    return t("{recenti} negli ultimi due mesi", {
      recenti: formatNumber(card.recent),
    });
  return t("{recenti} negli ultimi due mesi, prima erano {prima}", {
    recenti: formatNumber(card.recent),
    prima: formatNumber(card.previous),
  });
}
