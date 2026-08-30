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
import { useSyncExternalStore } from "react";
import { AccountMenu } from "@/components/ui/account-menu";
import { useT } from "@/lib/i18n";

/**
 * Indirizzo -> nome della schermata. Un prefisso vale anche per i suoi
 * sotto-indirizzi (/persona/x), l'esatto "/" no: sarebbe tutto.
 * Le frasi sono gia nel catalogo comune tranne "Giornata": vedi
 * scripts/verify-i18n.mjs, elenco DINAMICHE (qui t() riceve una variabile).
 */
const TITOLI: ReadonlyArray<readonly [string, string]> = [
  ["/mese", "Mese"],
  ["/remember", "Ricorda"],
  ["/recap", "Recap"],
  ["/settings", "Impostazioni"],
  ["/giorno", "Giornata"],
  ["/persona", "Persona"],
  ["/palestra", "Palestra"],
];

/** Il nome della schermata, o null se li la barra non ci va. */
export function titoloSchermata(pathname: string): string | null {
  if (pathname === "/") return "Oggi";
  for (const [prefisso, titolo] of TITOLI) {
    if (pathname === prefisso || pathname.startsWith(`${prefisso}/`)) {
      return titolo;
    }
  }
  return null;
}

/**
 * IL POSTO PER UNA AZIONE DELLA SCHERMATA (30 agosto 2026, mockup
 * mese-testata.html, strada A scelta da Manuel).
 *
 * Nasce per il tasto che scambia scacchiera e lista nel Mese. Il ragionamento
 * non e "avanzava spazio": quel tasto non cambia COSA guardi ma COME lo
 * guardi, quindi non appartiene alla riga del mese (che e navigazione, usata
 * ogni volta) ma alla barra della schermata, usata una volta ogni tanto. E
 * dove Calendario di Apple mette lo stesso identico comando.
 *
 * UNA sola azione, e per iscritto. Se questo posto diventa generico, fra sei
 * mesi ci sono cinque icone di cinque moduli e la barra e una barretta di
 * strumenti: il contrario di cio per cui e nata (il pallino sempre nello
 * stesso pixel). Chi vuole aggiungerne una seconda non allarga questo slot:
 * porta il problema a Manuel, perche a quel punto la domanda non e piu dove
 * mettere un bottone ma se quella schermata ha bisogno di un menu.
 *
 * Il pallino resta l'ULTIMO elemento a destra, sempre: e cio che
 * verify-barra-alto misura su ogni schermata, ed e il motivo per cui
 * l'azione entra PRIMA di lui e non dopo.
 *
 * Meccanica: lo stesso portal di RailRight. La schermata rende
 * <AppBarAzione>...</AppBarAzione> e il contenuto finisce qui.
 */
const SLOT_AZIONE = "jm-appbar-azione";

function subscribeNoop(): () => void {
  return () => {};
}

export function AppBarAzione({ children }: { children: React.ReactNode }) {
  /* Mount flag senza setState-in-effect: stesso pattern di RailRight. */
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  const target = document.getElementById(SLOT_AZIONE);
  if (!target) return null;
  return createPortal(children, target);
}

export function AppBar() {
  const t = useT();
  const pathname = usePathname();
  const titolo = titoloSchermata(pathname);

  if (titolo === null) return null;

  return (
    <header className="jm-appbar">
      {/* La riga interna ha lo stesso max-width delle schermate (440px,
          centrato): senza, su uno schermo piu largo di 440 il pallino si
          staccherebbe dal bordo del contenuto e la barra mentirebbe
          proprio sulla cosa per cui esiste. */}
      <div className="jm-appbar-in">
        <span className="jm-appbar-t">{t(titolo)}</span>
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
