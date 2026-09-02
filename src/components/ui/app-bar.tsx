"use client";

/**
 * LA BARRA IN ALTO (mockup design/mockups/pallino-ovunque.html, "strada B",
 * scelta da Manuel il 28 agosto 2026).
 *
 * Il pallino dell'account viveva dentro l'intestazione di UNA schermata
 * (Oggi): navigando spariva, e l'app sembrava di due persone diverse. La
 * strada scartata — "una riga di <AccountMenu variant='testata' /> in ogni
 * modulo" — avrebbe messo lo stesso pallino dentro cinque intestazioni con
 * contenuti diversi, cioe in cinque allineamenti leggermente diversi, senza
 * nessuna guardia contro il sesto modulo. Lo stesso difetto, piu grande.
 *
 * Qui invece la barra e UNA, montata una volta sola dal guscio
 * (desktop-shell.tsx), e nessun modulo puo metterla altrove: il pallino sta
 * nello stesso pixel per costruzione. Solo sotto lg — da lg in su il
 * pallino sta in fondo alla rail sinistra, che e gia presente ovunque, e la
 * barra si spegne (regola esplicita in base.css: le utility Tailwind stanno
 * in @layer e perderebbero contro il display:flex di .jm-appbar).
 *
 * IL TITOLO: una mappa indirizzo -> nome, qui dentro. E il canale piu
 * semplice fra quelli possibili, e soprattutto non tocca i moduli: una
 * schermata nuova si aggiunge scrivendo una riga QUI, non montando un
 * componente in un altro file. La mappa e anche l'interruttore: un
 * indirizzo che non c'e (login, /benvenuto, /auth, /privacy, il checkout,
 * l'admin) non ha titolo e quindi non ha barra, e le pagine pubbliche
 * restano nude senza una seconda lista da tenere allineata.
 */

import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AccountMenu } from "@/components/ui/account-menu";
import { useT } from "@/lib/i18n";

/**
 * "C'e contenuto sotto la barra?" — il segnale che accende il vetro
 * (mockup restyling §03: da ferma la barra e aria, scorrendo e vetro).
 *
 * Si ascolta lo scroll IN CATTURA: gli eventi di scroll non risalgono,
 * ma la cattura li vede anche quando a scorrere e un contenitore interno
 * (la lista di Memo) e non la finestra. I mini-scroller (un popover, una
 * riga orizzontale del mese) non contano: solo la finestra o un
 * contenitore alto quanto una schermata puo mandare contenuto sotto la
 * barra.
 */
function useContenutoSottoLaBarra(): boolean {
  const [sotto, setSotto] = useState(false);
  useEffect(() => {
    const misura = (e?: Event) => {
      let s = window.scrollY > 4;
      if (!s && e && e.target instanceof Element) {
        const el = e.target;
        s =
          el.scrollTop > 4 &&
          el.clientHeight > window.innerHeight * 0.5 &&
          el.scrollHeight > el.clientHeight;
      }
      setSotto((prima) => (prima === s ? prima : s));
    };
    misura();
    window.addEventListener("scroll", misura, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", misura, { capture: true });
  }, []);
  return sotto;
}

/**
 * Indirizzo -> nome della schermata. Un prefisso vale anche per i suoi
 * sotto-indirizzi (/app/persona/x), l'esatto "/app" no: sarebbe tutto.
 * Le frasi sono gia nel catalogo comune tranne "Giornata": vedi
 * scripts/verify-i18n.mjs, elenco DINAMICHE (qui t() riceve una variabile).
 */
const TITOLI: ReadonlyArray<readonly [string, string]> = [
  ["/app/mese", "Mese"],
  ["/app/remember", "Memo"],
  ["/app/recap", "Recap"],
  ["/app/settings", "Impostazioni"],
  /* UNA GIORNATA SOLA (mockup una-giornata-sola.html, approvato il 2
     settembre 2026): /app e /app/giorno sono la stessa schermata — la
     pagina di un giorno — e la barra dice il POSTO, "Diario", per
     tutte e due. Il QUANDO (Oggi, Ieri, giovedi 27) lo dice il nav
     sotto. "Oggi" e "Giornata" come titoli non esistono piu. */
  ["/app/giorno", "Diario"],
  ["/app/persona", "Persona"],
  ["/app/palestra", "Palestra"],
];

/** Il nome della schermata, o null se li la barra non ci va. */
export function titoloSchermata(pathname: string): string | null {
  /* Nel guscio iOS l'export statico ha trailingSlash:true e il pathname
     arriva con la barra in fondo ("/app/", "/app/mese/"). Il confronto
     esatto qui sotto non la riconosceva, la barra in alto spariva su Oggi
     e con lei la safe-area: il contenuto finiva sotto l'orologio
     (screenshot di Manuel, 1 settembre 2026). Si normalizza PRIMA di
     confrontare, in questo unico punto: da qui passano sia AppBar sia il
     guscio (jm-conbarra), quindi barra e safe-area restano d'accordo. */
  const puro = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (puro === "/app") return "Diario";
  pathname = puro;
  for (const [prefisso, titolo] of TITOLI) {
    if (pathname === prefisso || pathname.startsWith(`${prefisso}/`)) {
      return titolo;
    }
  }
  return null;
}

/**
 * I POSTI PER LE AZIONI DELLA SCHERMATA (30 agosto 2026, mockup
 * mese-testata.html; ALLARGATO il 1 settembre 2026 sera, mockup
 * testate-oggi-giornata.html approvato da Manuel).
 *
 * Nato per UN tasto (lo scambio scacchiera/lista del Mese), il posto a
 * destra e diventato per scelta esplicita di Manuel LA casa dei comandi
 * della schermata: su Oggi matita, scrittura e microfono; sulla Giornata
 * matita e cestino. La regola nuova non e "quanti bottoni vuoi": e che i
 * comandi di una schermata stanno TUTTI qui, come cerchi da 38 col filo
 * (.jm-cmd, la stessa famiglia delle frecce del Mese) — mai sparsi in
 * intestazioni sotto la barra. Sotto la barra resta solo la navigazione
 * del tempo.
 *
 * Il pallino resta l'ULTIMO elemento a destra, sempre: e cio che
 * verify-barra-alto misura su ogni schermata, ed e il motivo per cui
 * le azioni entrano PRIMA di lui e non dopo.
 *
 * A sinistra c'e il posto gemello (AppBarPrima), per l'unico comando che
 * appartiene a quel lato: l'indietro della Giornata, prima del nome.
 *
 * Meccanica: lo stesso portal di RailRight. La schermata rende
 * <AppBarAzione>...</AppBarAzione> (o <AppBarPrima>) e il contenuto
 * finisce qui.
 */
const SLOT_AZIONE = "jm-appbar-azione";
const SLOT_PRIMA = "jm-appbar-prima";

function subscribeNoop(): () => void {
  return () => {};
}

/**
 * IL NOME FORZATO (1 settembre 2026, notte, richiesta di Manuel). La
 * pagina Record — il microfono del dock — vive su /app ma non e "Oggi":
 * e il momento in cui racconti, e la barra deve dirlo. Una schermata puo
 * forzare il nome finche il suo stato e vivo; alla chiusura torna quello
 * della mappa. Il nome e una frase italiana e passa da t(), come tutto.
 */
let titoloForzato: string | null = null;
const titoloListeners = new Set<() => void>();

function titoloEmit(): void {
  for (const l of titoloListeners) l();
}

function titoloSubscribe(l: () => void): () => void {
  titoloListeners.add(l);
  return () => {
    titoloListeners.delete(l);
  };
}

export function useTitoloBarra(titolo: string, attivo: boolean): void {
  useEffect(() => {
    if (!attivo) return;
    titoloForzato = titolo;
    titoloEmit();
    return () => {
      if (titoloForzato === titolo) {
        titoloForzato = null;
        titoloEmit();
      }
    };
  }, [titolo, attivo]);
}

function SlotPortal({
  slot,
  children,
}: {
  slot: string;
  children: React.ReactNode;
}) {
  /* Mount flag senza setState-in-effect: stesso pattern di RailRight. */
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  const target = document.getElementById(slot);
  if (!target) return null;
  return createPortal(children, target);
}

export function AppBarAzione({ children }: { children: React.ReactNode }) {
  return <SlotPortal slot={SLOT_AZIONE}>{children}</SlotPortal>;
}

/** Il posto a sinistra del nome: l'indietro della Giornata. */
export function AppBarPrima({ children }: { children: React.ReactNode }) {
  return <SlotPortal slot={SLOT_PRIMA}>{children}</SlotPortal>;
}

export function AppBar() {
  const t = useT();
  const pathname = usePathname();
  const vetro = useContenutoSottoLaBarra();
  const titolo = titoloSchermata(pathname);
  const forzato = useSyncExternalStore(
    titoloSubscribe,
    () => titoloForzato,
    () => null,
  );

  /* La barra ESISTE dove la mappa dice che esiste; il nome forzato cambia
     solo cosa dice, mai dove sta. */
  if (titolo === null) return null;
  const mostrato = forzato ?? titolo;

  return (
    <header className={`jm-appbar${vetro ? " jm-appbar-vetro" : ""}`}>
      {/* La riga interna ha lo stesso max-width delle schermate (440px,
          centrato): senza, su uno schermo piu largo di 440 il pallino si
          staccherebbe dal bordo del contenuto e la barra mentirebbe
          proprio sulla cosa per cui esiste. */}
      <div className="jm-appbar-in">
        <span className="jm-appbar-l">
          {/* L'indietro della Giornata, quando c'e: prima del nome, come
              su ogni schermata di dettaglio di iOS. Vuoto sparisce. */}
          <span id={SLOT_PRIMA} className="jm-appbar-px" />
          <span className="jm-appbar-t">{t(mostrato)}</span>
        </span>
        <span className="jm-appbar-r">
          {/* Vuoto su quasi tutte le schermate: la regola :empty lo fa
              sparire, cosi il pallino non guadagna un margine dal nulla. */}
          <span id={SLOT_AZIONE} className="jm-appbar-az" />
          <AccountMenu variant="testata" />
        </span>
      </div>
    </header>
  );
}
