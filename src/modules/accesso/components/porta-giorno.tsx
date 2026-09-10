"use client";

/**
 * LA PORTA DEL GIORNO: una schermata sola all'ingresso, una volta al giorno.
 *
 * Decisione di Manuel del 10 settembre 2026 (audit del modello premium, B1 +
 * 5A + C4 + B5, mockup MOCKUP-primo-avvio-senza-bivio.html). Ha preso il posto
 * del saluto all'avvio (saluto-avvio.tsx, 31 agosto) e del foglio "l'AI ha
 * chiuso questa giornata per te" (4 settembre): erano due tende, e con la
 * schermata quotidiana del regalo sarebbero state tre. La logica di QUALE
 * contenuto mostrare e in porta-stato.ts (pura, provata in Node); qui ci
 * sono le memorie, la rete e il disegno.
 *
 * Cosa mostra, per variante (porta-stato.ts):
 *  - lettera:  il primo avvio. Nel guscio iOS il regalo in testa ("N
 *              giornate, con l'AI accesa", "Comincia a scrivere") e sotto la
 *              lettera di Manuel (dal pannello admin, src/lib/benvenuto.ts);
 *              sul web solo la lettera, perche li il regalo non c'e. In
 *              locale c'e "Ho gia un account" (B5): chi cambia telefono e
 *              il revisore Apple devono vedere la porta del ritorno subito.
 *  - cambiata: "Ti restano N giornate", i pallini, "Passa a premium".
 *  - uguale:   il giorno, non il numero: chi scrive a mano per un mese non
 *              legge trenta volte la stessa frase (5A). Premium resta a un
 *              tocco, in piccolo.
 *  - finite:   "resta tutto, si scrive a mano", "Passa a premium".
 *  - pausa:    il tetto del mese: le giornate restano, l'AI torna domani.
 *  - proposta: l'account gratis senza regalo qui (il web).
 *
 * Il disegno e quello del saluto (classi jm-benv-sal-*, mockup
 * messaggio-benvenuto.html strada 1): foto tonda, marchio, corpo che scorre,
 * piede fermo. Il dock si ritira finche la porta e aperta.
 *
 * I banchi la zittiscono come zittivano il saluto: jm.saluto.silenzio scritto
 * per l'identita del dispositivo e la versione della lettera. Non e un caso
 * d'uso di prodotto (la casella "non mostrare piu" non esiste piu: la
 * lettera si vede una volta per dispositivo), e solo il gancio dei banchi.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Marchio } from "@/components/brand/marchio";
import { benvenutoInLingua, FOTO_DI_FABBRICA, paragrafi, pezzi } from "@/lib/benvenuto";
import { useBenvenuto } from "@/lib/benvenuto-client";
import { useStorageMode } from "@/lib/data/store";
import { useT, useLang } from "@/lib/i18n";
import { useRitiraDock } from "@/components/ui/dock-sipario";
import { usePianoNoto } from "@/lib/plan";
import { ospiteAttivo } from "@/lib/ospite/flag";
import { useStatoOspite } from "@/lib/ospite/stato";
import { isNative } from "@/lib/native/platform";
import { formatDate, formatNumber } from "@/lib/format";
import { REGALO_DI_FABBRICA } from "@/lib/regalo";
import { openPremiumWall } from "@/modules/abbonamento";
import {
  azzeraApertura,
  dopoUscita,
  giaMostratoInQuestaApertura,
  identita,
  segnaMostrato,
  segnaUscita,
  silenzioScritto,
  silenzioVale,
} from "@/modules/accesso/saluto-stato";
import { giornoLocale, variantePorta, type VariantePorta } from "@/modules/accesso/porta-stato";

const K_LETTERA = "jm.porta.lettera";
const K_GIORNO = "jm.porta.giorno";
const K_RIMASTE = "jm.porta.rimaste";

function leggi(k: string): string | null {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
}

function scrivi(k: string, v: string): void {
  try {
    window.localStorage.setItem(k, v);
  } catch {
    // senza memoria la porta torna alla prossima apertura: fastidioso, non rotto
  }
}

function paginaPubblica(pathname: string): boolean {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/app/benvenuto") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/termini")
  );
}

// La vedetta del logout: "Esci" non ricarica il documento, e l'ospite che
// resta sul dispositivo non e un primo avvio (bug dell'8 settembre 2026).
let vedettaAccesa = false;
function accendiVedetta(): void {
  if (vedettaAccesa) return;
  vedettaAccesa = true;
  void import("@/lib/supabase/client").then(({ createClient }) => {
    createClient().auth.onAuthStateChange((evento, sessione) => {
      if (evento === "SIGNED_OUT") segnaUscita();
      if (!sessione) azzeraApertura();
    });
  });
}

type Aperta = { variante: Exclude<VariantePorta, "niente">; rimaste: number; max: number };

export function PortaGiorno() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const mode = useStorageMode();
  const benvenuto = useBenvenuto();
  const testi = benvenutoInLingua(benvenuto, lang);
  const pathname = usePathname();
  const pubblica = paginaPubblica(pathname) || !benvenuto.attivo;
  const piano = usePianoNoto();
  const nativo = isNative();

  const [aperta, setAperta] = useState<Aperta | null>(null);
  useRitiraDock(aperta !== null && !pubblica);

  // Il conto del regalo serve solo se la porta di oggi non e gia passata e
  // non e il primo avvio: cosi il primo avvio non aspetta il server.
  const oggi = giornoLocale();
  const letteraVista = leggi(K_LETTERA) === String(benvenuto.versione);
  const giornoPassato = leggi(K_GIORNO) === oggi;
  const serveConto = !pubblica && mode !== "resolving" && letteraVista && !giornoPassato && ospiteAttivo();
  const regalo = useStatoOspite(serveConto);

  useEffect(() => {
    if (pubblica || mode === "resolving" || mode === "none" || aperta) return;
    if (mode === "cloud") accendiVedetta();
    if (giaMostratoInQuestaApertura()) return;
    let vivo = true;
    void (async () => {
      // Chi e dentro: in cloud, nessuna sessione = nessuno (come il saluto:
      // la porta non si apre a una sessione che il server ha rifiutato).
      // La stessa identita e il gancio dei banchi: un silenzio scritto per
      // lei (jm.saluto.silenzio) tiene la porta muta.
      if (mode === "cloud" || silenzioScritto()) {
        const id = await identita(mode);
        if (!vivo) return;
        if (!id) return;
        if (silenzioScritto() && silenzioVale(id, benvenuto.versione)) return;
      }
      if (mode === "cloud" && piano === null) return; // il piano si sta leggendo: si riprova
      const modalita: "local" | "cloud" = mode;
      const stato = {
        oggi,
        versioneLettera: benvenuto.versione,
        memoria: {
          lettera: leggi(K_LETTERA) === null ? null : Number(leggi(K_LETTERA)),
          giorno: leggi(K_GIORNO),
          rimaste: leggi(K_RIMASTE) === null ? null : Number(leggi(K_RIMASTE)),
        },
        dopoUscita: modalita === "local" && dopoUscita(),
        modalita,
        premium: piano === "premium",
        regalo: ospiteAttivo() && regalo ? { attivo: regalo.attivo, sopraIlTetto: regalo.sopraIlTetto, rimaste: regalo.rimaste, max: regalo.max, registrato: regalo.registrato } : null,
      };
      const variante = variantePorta(stato);
      if (variante === "niente") return;
      // Con l'ospite spento (i banchi del locale "puro") la sola porta e la lettera.
      if (variante !== "lettera" && !ospiteAttivo()) return;
      segnaMostrato();
      setAperta({ variante, rimaste: regalo?.rimaste ?? 0, max: regalo?.max ?? REGALO_DI_FABBRICA.giornatePerOspite });
    })();
    return () => {
      vivo = false;
    };
  }, [pubblica, mode, piano, regalo, benvenuto.versione, oggi, aperta]);

  /**
   * "Sotto c'e altro": la sfumatura in fondo al corpo che scorre. Col testo
   * ingrandito la lettera non ci sta e l'ultima riga visibile e tagliata a
   * meta parola: senza un segnale sembra un difetto. Si accende solo quando
   * c'e davvero da scorrere e si spegne arrivati in fondo (ereditata dal
   * saluto, misurata dal vivo perche dipende da testo, lingua e misura).
   */
  const corpoRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = corpoRef.current;
    if (!el || !aperta) return;
    const guarda = () => {
      const altro = el.scrollHeight - el.clientHeight - el.scrollTop > 4;
      el.toggleAttribute("data-altro", altro);
    };
    guarda();
    el.addEventListener("scroll", guarda, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(guarda) : null;
    ro?.observe(el);
    window.addEventListener("resize", guarda);
    return () => {
      el.removeEventListener("scroll", guarda);
      ro?.disconnect();
      window.removeEventListener("resize", guarda);
    };
  }, [aperta, testi.testo]);

  const chiudi = useCallback(() => {
    if (!aperta) return;
    if (aperta.variante === "lettera") scrivi(K_LETTERA, String(benvenuto.versione));
    scrivi(K_GIORNO, oggi);
    if (aperta.variante !== "lettera" && aperta.variante !== "proposta") scrivi(K_RIMASTE, String(aperta.rimaste));
    setAperta(null);
  }, [aperta, benvenuto.versione, oggi]);

  const premium = useCallback(() => {
    chiudi();
    openPremiumWall("aiSummary");
  }, [chiudi]);

  const account = useCallback(() => {
    chiudi();
    router.push("/login");
  }, [chiudi, router]);

  if (!aperta || pubblica) return null;

  const { variante, rimaste, max } = aperta;
  const spese = Math.max(0, max - rimaste);
  const pallini = (
    <div className="jm-benv-sal-pallini" aria-hidden="true">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < spese ? "jm-benv-sal-pallino spesa" : "jm-benv-sal-pallino"} />
      ))}
    </div>
  );
  const contatto =
    testi.contattoRiga.trim() !== "" && testi.contattoUrl.trim() !== ""
      ? { riga: testi.contattoRiga, url: testi.contattoUrl }
      : null;

  // Il titolo grande, il corpo e i tasti, per variante.
  type Tasto = { testo: string; azione: () => void };
  const contenuto = ((): { hero: string; corpo: string; primario: Tasto; secondario?: Tasto; quieto?: Tasto } => {
    switch (variante) {
      case "lettera":
        return {
          hero: nativo ? t("{n} giornate,\ncon l'AI accesa", { n: formatNumber(max) }) : "",
          corpo: nativo
            ? t("Racconti a voce e lei trascrive, scrive il titolo e la sintesi della giornata. Sono in regalo: non serve nessuna email.")
            : "",
          primario: { testo: t("Comincia a scrivere"), azione: chiudi },
          quieto: mode === "local" ? { testo: t("Ho gia un account"), azione: account } : undefined,
        };
      case "cambiata":
        return {
          hero: rimaste === 1 ? t("Ti resta\n1 giornata") : t("Ti restano\n{n} giornate", { n: formatNumber(rimaste) }),
          corpo: t("Poi il diario resta e si scrive a mano. Con premium l'AI non finisce mai, e le giornate vanno nel cloud."),
          primario: { testo: t("Passa a premium"), azione: premium },
          secondario: { testo: t("Continua cosi"), azione: chiudi },
        };
      case "uguale":
        return {
          hero: formatDate(new Date(), { weekday: "long", day: "numeric", month: "long" }),
          corpo:
            rimaste === 1
              ? t("Hai ancora 1 giornata con l'AI in regalo. Quando la vuoi, e accesa.")
              : t("Hai ancora {n} giornate con l'AI in regalo. Quando la vuoi, e accesa.", { n: formatNumber(rimaste) }),
          primario: { testo: t("Continua"), azione: chiudi },
          quieto: { testo: t("Passa a premium"), azione: premium },
        };
      case "finite":
        return {
          hero: t("Le {n} giornate\nsono finite", { n: formatNumber(max) }),
          corpo: t("Il diario resta tutto. Da qui in avanti scrivi a mano, oppure passi a premium e l'AI torna."),
          primario: { testo: t("Passa a premium"), azione: premium },
          secondario: { testo: t("Continua senza AI"), azione: chiudi },
        };
      case "pausa":
        return {
          hero: t("Oggi l'AI in regalo\ne in pausa"),
          corpo: t("Il regalo del mese e stato usato tutto, per tutti. Le tue {n} giornate restano: torna domani, o passa a premium.", { n: formatNumber(rimaste) }),
          primario: { testo: t("Passa a premium"), azione: premium },
          secondario: { testo: t("Continua"), azione: chiudi },
        };
      case "proposta":
        return {
          hero: t("Con premium\nl'AI scrive per te"),
          corpo: t("Voce, titolo, sintesi, recap, e il diario su tutti i tuoi dispositivi. Si attiva dall'app per iPhone."),
          primario: { testo: t("Scopri premium"), azione: premium },
          secondario: { testo: t("Continua"), azione: chiudi },
        };
    }
  })();
  const { hero, corpo, primario, secondario, quieto } = contenuto;

  const lettera = variante === "lettera";
  const mostraPallini = variante === "cambiata" || variante === "uguale" || variante === "finite" || variante === "pausa";

  return (
    <div className="jm-benv-sal" role="dialog" aria-modal="true" data-variante={variante}>
      <div className="jm-benv-sal-box">
        <div className="jm-benv-sal-testa">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="jm-benv-sal-foto"
            src={benvenuto.fotoData ?? FOTO_DI_FABBRICA}
            alt=""
            aria-hidden="true"
            draggable={false}
          />
          {lettera && testi.occhiello.trim() !== "" && <div className="jm-benv-sal-occhiello">{testi.occhiello}</div>}
          <div className="jm-benv-sal-marchio">
            <Marchio />
          </div>
        </div>

        <div className="jm-benv-sal-corpo" ref={corpoRef}>
          {hero !== "" && <p className="jm-benv-sal-hero">{hero}</p>}
          {corpo !== "" && <p className="jm-benv-sal-promessa">{corpo}</p>}
          {lettera && nativo && (
            <p className="jm-benv-sal-oltre">{t("Una giornata si conta quando l'AI lavora. Tutto il resto di quel giorno e compreso.")}</p>
          )}
          {mostraPallini && pallini}

          {lettera && (
            <>
              {!nativo && testi.promessa.trim() !== "" && <p className="jm-benv-sal-promessa">{testi.promessa}</p>}
              {testi.evidenza.trim() !== "" && (
                <p className="jm-benv-sal-evidenza">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 8.4l3.2 3.2L13 4.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {testi.evidenza}
                </p>
              )}
              {paragrafi(testi.testo).map((par, i) => (
                <p className="jm-benv-sal-p" key={i}>
                  {pezzi(par).map((pz, j) => (pz.forte ? <b key={j}>{pz.testo}</b> : <span key={j}>{pz.testo}</span>))}
                </p>
              ))}
              {testi.firma.trim() !== "" && <p className="jm-benv-sal-firma">{testi.firma}</p>}
            </>
          )}
        </div>

        <div className="jm-benv-sal-piede">
          <button type="button" className="jm-benv-sal-b" onClick={primario.azione}>
            {primario.testo}
          </button>
          {secondario && (
            <button type="button" className="jm-benv-sal-ghost" onClick={secondario.azione}>
              {secondario.testo}
            </button>
          )}
          {quieto && (
            <button type="button" className="jm-benv-sal-quieto" onClick={quieto.azione}>
              {quieto.testo}
            </button>
          )}
          {lettera && nativo && (
            <p className="jm-benv-sal-sotto">{t("Le tue giornate restano su questo dispositivo. Nel cloud salgono solo chiuse a chiave, quando lo vorrai tu.")}</p>
          )}
          {lettera && contatto && (
            <p className="jm-benv-sal-sotto">
              <a href={contatto.url} {...(/^https?:/i.test(contatto.url) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {contatto.riga}
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
