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
 *  - lettera:  il primo avvio. Nel guscio iOS il regalo in testa ("N giorni
 *              di funzioni premium in regalo") e sotto la lettera di Manuel
 *              (dal pannello admin, src/lib/benvenuto.ts), coi tasti alla
 *              fine dello scroll invece che in un piede fermo (15 settembre
 *              2026: si legge prima di scegliere); sul web solo la lettera,
 *              perche li il regalo non c'e. In locale c'e "Ho gia un
 *              account" (B5): chi cambia telefono e il revisore Apple
 *              devono vedere la porta del ritorno subito.
 *  - cambiata: "N giornate Ai ancora in regalo.", i pallini, "Passa a premium".
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
import { SELETTORE_LINGUETTA } from "@/modules/accesso/components/linguetta";
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

  /* La chiusura si risucchia nella linguetta Feedback (eredita da
     saluto-avvio.tsx, commit 841bec6): due tocchi rapidi non devono
     accavallare due animazioni, e la scheda che va in secondo piano non
     deve lasciare la porta aperta per sempre. `chiudendo` e lo STATO che fa
     scattare la misura e l'animazione dentro un effetto, e fa ANCHE da
     guardia contro il doppio tocco: un ref (inChiusura, tentato prima)
     letto dentro il tasto stesso viola react-hooks/refs, anche se non e
     mai attaccato a un elemento — la regola vale per QUALSIASI ref, non
     solo per quelli del DOM (misurato qui il 15 settembre 2026: un ref
     boolean nudo dentro l'onClick bastava a far scattare l'errore, lo
     stesso identico ref letto dentro un useEffect no). Da qui la regola
     per questo file: boxRef/veloRef si LEGGONO solo nell'effetto qui
     sotto, mai nei tasti — coerente con dock-vetro.ts e foto-row.tsx. */
  const [chiudendo, setChiudendo] = useState<boolean>(false);
  const veloRef = useRef<HTMLDivElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const reteDiSicurezza = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (reteDiSicurezza.current !== null) window.clearTimeout(reteDiSicurezza.current);
    };
  }, []);

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
      setChiudendo(false);
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

  // Le tre scritture in localStorage, in un posto solo: le usano sia la
  // chiusura animata (i tasti diretti) sia quella secca (premium/account,
  // che aprono un'altra superficie a schermo pieno subito dopo — vedi
  // sotto — e per cui il risucchio si accavallerebbe con quella).
  const scriviMemoria = useCallback((a: Aperta) => {
    if (a.variante === "lettera") scrivi(K_LETTERA, String(benvenuto.versione));
    scrivi(K_GIORNO, oggi);
    if (a.variante !== "lettera" && a.variante !== "proposta") scrivi(K_RIMASTE, String(a.rimaste));
  }, [benvenuto.versione, oggi]);

  const chiudiSecco = useCallback(() => {
    if (!aperta) return;
    scriviMemoria(aperta);
    setAperta(null);
  }, [aperta, scriviMemoria]);

  /**
   * La chiusura diretta: scrive la memoria e chiede l'animazione — la
   * misura e il risucchio vero stanno nell'effetto sotto, MAI qui. La
   * guardia contro il doppio tocco e lo stesso stato `chiudendo`, non un
   * ref: un ref letto qui (fosse anche un semplice booleano, mai attaccato
   * a un elemento) violerebbe react-hooks/refs allo stesso modo di
   * boxRef/veloRef.
   */
  const chiudi = useCallback(() => {
    if (!aperta || chiudendo) return;
    scriviMemoria(aperta);
    setChiudendo(true);
  }, [aperta, chiudendo, scriviMemoria]);

  /**
   * Il risucchio vero: la porta si anima dentro la linguetta Feedback.
   *
   * Stessa coreografia del vecchio saluto-avvio.tsx (commit 841bec6, "La
   * chiusura del saluto: il messaggio si risucchia nella linguetta"), che
   * qui non era piu partita — la porta del giorno (10 settembre) aveva
   * preso il suo posto senza portarsi dietro l'animazione, e "Comincia a
   * scrivere" chiudeva a secco. Si misurano dal vivo i due rettangoli, si
   * anima il messaggio verso la linguetta con la Web Animations API (una
   * transizione CSS con lo stesso giro di JS del nuovo transform parte "a
   * volte") e si lascia il velo con solo fondo/sfocatura animati — mai la
   * sua opacita, che si porterebbe via anche il figlio. Vive in un effetto
   * innescato da `chiudendo`, non nel tasto: e proprio quel confine a
   * rendere legale leggere boxRef/veloRef.
   */
  useEffect(() => {
    if (!chiudendo) return;
    const box = boxRef.current;
    const velo = veloRef.current;
    const ling = document.querySelector<HTMLElement>(SELETTORE_LINGUETTA);
    // Ripieghi obbligatori: senza linguetta, o senza animate(), chiusura
    // secca. Mai un crash, mai una porta che resta aperta.
    if (!box || !ling || typeof box.animate !== "function") {
      setAperta(null);
      return;
    }

    const b = box.getBoundingClientRect();
    const l = ling.getBoundingClientRect();
    const dx = l.left + l.width / 2 - (b.left + b.width / 2);
    const dy = l.top + l.height / 2 - (b.top + b.height / 2);
    // Pavimento sulla scala: senza, un riquadro molto piu grande della
    // linguetta collassa a zero e sparisce prima di arrivare.
    const fine = Math.max(Math.min(l.width / b.width, l.height / b.height), 0.04);
    const versoFine = (q: number) => 1 + (fine - 1) * q;
    // Lo sbilanciamento fra X e Y durante il viaggio e cio che da la
    // sensazione del risucchio: una scala uniforme sembra solo un
    // rimpicciolimento.
    const s55 = versoFine(0.55);
    const s82 = versoFine(0.82);

    box.animate(
      [
        { transform: "translate(0px, 0px) scale(1, 1)", borderRadius: "30px", opacity: 1 },
        {
          transform: `translate(${dx * 0.55}px, ${dy * 0.55}px) scale(${s55 * 1.12}, ${s55 * 0.84})`,
          borderRadius: "40px",
          opacity: 1,
        },
        {
          transform: `translate(${dx * 0.82}px, ${dy * 0.82}px) scale(${s82 * 0.74}, ${s82 * 1.24})`,
          borderRadius: "50px",
          opacity: 0.98,
        },
        { transform: `translate(${dx}px, ${dy}px) scale(${fine}, ${fine})`, borderRadius: "60px", opacity: 0.25 },
      ],
      { duration: 480, easing: "cubic-bezier(.55,0,.72,.3)", fill: "forwards" },
    );

    if (velo && typeof velo.animate === "function") {
      const fondo = getComputedStyle(velo).backgroundColor;
      velo.animate(
        [
          { backgroundColor: fondo, WebkitBackdropFilter: "blur(14px)", backdropFilter: "blur(14px)" },
          { backgroundColor: "rgba(0, 0, 0, 0)", WebkitBackdropFilter: "blur(0px)", backdropFilter: "blur(0px)" },
        ],
        { duration: 440, easing: "ease-out", fill: "forwards" },
      );
    }

    // Il ricevimento: la linguetta batte quando il messaggio arriva. Il
    // translateY(-50%) va ripetuto in OGNI fotogramma, o al primo salta di
    // posto (styles.css, .jm-benv-ling).
    if (typeof ling.animate === "function") {
      ling.animate(
        [
          { transform: "translateY(-50%) scale(1)" },
          { transform: "translateY(-50%) scale(1.22)" },
          { transform: "translateY(-50%) scale(1)" },
        ],
        { duration: 300, delay: 400, easing: "ease-out" },
      );
    }

    // Cintura: onfinish non arriva se la scheda finisce in secondo piano.
    reteDiSicurezza.current = window.setTimeout(() => setAperta(null), 900);
  }, [chiudendo]);

  // Secca, non animata: qui sotto si apre un'ALTRA superficie a schermo
  // pieno nello stesso istante (il muro premium, il login), e il risucchio
  // ci arriverebbe sotto senza che nessuno lo veda.
  const premium = useCallback(() => {
    chiudiSecco();
    openPremiumWall("aiSummary");
  }, [chiudiSecco]);

  const account = useCallback(() => {
    chiudiSecco();
    router.push("/login");
  }, [chiudiSecco, router]);

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
        // Hero + lettera (Manuel, 15 settembre 2026): non piu "N giornate,
        // con l'AI accesa" + una promessa breve. Il regalo si dice in una
        // riga sola ("N giorni di funzioni premium in regalo") e sotto
        // scorre la lettera vera (pannello admin, src/lib/benvenuto.ts). I
        // tasti stanno alla fine della lettera, non in un piede fermo: si
        // legge prima, si sceglie dopo (vedi il rendering piu sotto).
        return {
          hero: nativo ? t("{n} giorni di funzioni premium in regalo", { n: formatNumber(max) }) : "",
          corpo: "",
          primario: { testo: t("Comincia a scrivere"), azione: chiudi },
          quieto: mode === "local" ? { testo: t("Ho gia un account"), azione: account } : undefined,
        };
      case "cambiata": {
        // PAROLE DI MANUEL, ALLA LETTERA (12 settembre 2026, dal telefono).
        // "Ti restano 4 giornate. Poi il diario resta e si scrive a mano"
        // metteva ansia: deve capirsi che e un regalo dello sviluppatore.
        // Il numero va in lettere come nel suo testo ("ne restano ancora
        // quattro"), da uno a dieci; oltre, in cifre.
        const parole = t("uno,due,tre,quattro,cinque,sei,sette,otto,nove,dieci").split(",");
        const inLettere = (k: number) => (k >= 1 && k <= parole.length ? parole[k - 1] : formatNumber(k));
        return {
          hero:
            rimaste === 1
              ? t("1 giornata Ai ancora in regalo.")
              : t("{n} giornate Ai ancora in regalo.", { n: formatNumber(rimaste) }),
          corpo:
            rimaste === 1
              ? t(
                  "La funzionalità di recap AI è un regalo dello sviluppatore, {max} giornate senza scadenza: ne resta ancora una, usala quando vuoi. Allo scadere, il diario resterà tuo comunque. Se desideri, considera il passaggio a premium per avere recap illimitati, il resoconto mensile, e le giornate vanno nel cloud.",
                  { max: inLettere(max) },
                )
              : t(
                  "La funzionalità di recap AI è un regalo dello sviluppatore, {max} giornate senza scadenza: ne restano ancora {n}, usale quando vuoi. Allo scadere, il diario resterà tuo comunque. Se desideri, considera il passaggio a premium per avere recap illimitati, il resoconto mensile, e le giornate vanno nel cloud.",
                  { max: inLettere(max), n: inLettere(rimaste) },
                ),
          primario: { testo: t("Passa a premium"), azione: premium },
          secondario: { testo: t("Continua gratis"), azione: chiudi },
        };
      }
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
    <div className="jm-benv-sal" role="dialog" aria-modal="true" data-variante={variante} ref={veloRef}>
      <div className="jm-benv-sal-box" ref={boxRef}>
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

              {/* I tasti chiudono la lettera invece di stare in un piede
                  fermo (Manuel, 15 settembre 2026): cosi si legge prima di
                  scegliere. La sfumatura "c'e altro sotto" (data-altro, qui
                  sopra su jm-benv-sal-corpo) resta il segnale che si deve
                  scorrere fino in fondo per trovarli. */}
              <button type="button" className="jm-benv-sal-b" onClick={primario.azione}>
                {primario.testo}
              </button>
              {quieto && (
                <button type="button" className="jm-benv-sal-quieto" onClick={quieto.azione}>
                  {quieto.testo}
                </button>
              )}
              {contatto && (
                <p className="jm-benv-sal-sotto">
                  <a href={contatto.url} {...(/^https?:/i.test(contatto.url) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                    {contatto.riga}
                  </a>
                </p>
              )}
            </>
          )}
        </div>

        {!lettera && (
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
          </div>
        )}
      </div>
    </div>
  );
}
