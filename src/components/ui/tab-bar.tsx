"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useT } from "@/lib/i18n";
import { MODULE_ICONS } from "@/components/ui/module-icons";
import { useActiveModules } from "@/lib/modules";

/**
 * "Sono DENTRO l'app?" — il segnale, per chi deve saperlo da fuori.
 *
 * Dentro = una schermata col dock (questa TabBar) o col guscio desktop e
 * montata. Login, /benvenuto, privacy e checkout non lo montano, e infatti
 * li dentro non sei ancora.
 *
 * Nato il 27 agosto 2026 per la linguetta Feedback (modulo accesso):
 * Manuel la vuole solo dopo l'ingresso, "quando vedi il dock". La linguetta
 * pero DEVE stare montata a livello di body (vincolo di transform, vedi
 * linguetta.tsx), quindi non puo semplicemente vivere accanto al dock: le
 * serve questo segnale. Conteggio e non booleano: durante una navigazione
 * la schermata nuova puo montare prima che la vecchia smonti.
 */
let schermateDentro = 0;
const dentroListeners = new Set<() => void>();
function dentroEmit(): void {
  for (const l of dentroListeners) l();
}

/** Da chiamare in useEffect: registra "questa schermata e dentro l'app". */
export function segnalaDentroApp(): () => void {
  schermateDentro++;
  dentroEmit();
  return () => {
    schermateDentro--;
    dentroEmit();
  };
}

/** True quando almeno una schermata col dock (o il guscio desktop) e viva. */
export function useDentroApp(): boolean {
  return useSyncExternalStore(
    (l) => {
      dentroListeners.add(l);
      return () => dentroListeners.delete(l);
    },
    () => schermateDentro > 0,
    // SSR: fuori. La linguetta compare all'idratazione, mai prima.
    () => false,
  );
}

/**
 * Dove stava la bolla l'ultima volta.
 *
 * Ogni schermata monta la SUA TabBar: cambiando pagina questo componente
 * non si sposta, muore e rinasce. Senza memoria, la bolla comparirebbe
 * gia arrivata e il viaggio — cioe la cosa per cui esiste — non si
 * vedrebbe mai. Vive fuori da React per lo stesso motivo del contatore
 * qui sopra: e uno stato del DOCK, non di una schermata.
 */
let ultimoAttivo: TabKey | null = null;

export type TabKey =
  | "today"
  | "month"
  | "mic"
  | "remember"
  | "module"
  | "settings";

type Props = {
  active: TabKey;
};

type Tab = {
  key: TabKey;
  label: string;
  href: string;
  icon: React.ReactNode;
};

const SIDE_TABS_LEFT: Tab[] = [
  {
    key: "today",
    label: "Oggi",
    href: "/",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
  {
    key: "month",
    label: "Mese",
    href: "/mese",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
];

// Lo slot "Impostazioni" NON esiste piu (28 agosto 2026, mockup
// porta-account): li si arriva dal pallino dell'account in testata.
// Ricorda torna FISSO — era lui a farsi sfrattare dal modulo acceso —
// e il quinto posto, quando c'e, e del modulo.
const SIDE_TABS_RIGHT: Tab[] = [
  {
    key: "remember",
    label: "Ricorda",
    href: "/remember",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

/**
 * IL DOCK DI VETRO (mockup design/mockups/dock-liquid-glass.html,
 * variante A + bolla "lente", scelte da Manuel il 29 agosto 2026).
 *
 * La barra non e piu un bordo incollato al fondo: e una pillola sospesa,
 * staccata dal bordo, e la giornata le passa SOTTO sfocata. Sul tasto
 * acceso si posa una bolla di vetro che scivola da un tasto all'altro e
 * si allunga mentre viaggia.
 *
 * Due dettagli che sembrano capricci e non lo sono:
 *   - la bolla si MISURA sul tasto (non si calcola a percentuali): con
 *     quattro voci invece di cinque la pillola cambia larghezza, e una
 *     percentuale mentirebbe;
 *   - il microfono al centro non e una destinazione ma un'azione: la
 *     bolla non ci va mai sopra, e resta pieno anche a dock spento.
 *
 * Lo spazio sotto: la pillola e fissa, quindi il contenuto ci finisce
 * dietro. Invece di chiedere a ogni schermata di aggiungersi un margine
 * (dodici file, e la tredicesima se ne dimentica), il dock si porta
 * dietro il PROPRIO spazio: un elemento vuoto che resta nel flusso.
 */
export function TabBar({ active }: Props) {
  const t = useT();
  // La barra c'e = sei dentro (vedi segnalaDentroApp qui sopra).
  useEffect(segnalaDentroApp, []);
  // Il modulo acceso prende il QUINTO posto (28 agosto 2026, mockup
  // porta-account): con lo slot Impostazioni sparito, il compromesso che
  // sfrattava Ricorda non serve piu. Il microfono al centro non si tocca,
  // mai. Senza moduli la griglia e a quattro colonne: non si inventa una
  // quinta destinazione per riempire il buco.
  const moduli = useActiveModules();
  const primo = moduli[0];
  const tabsRight: Tab[] = primo
    ? [
        ...SIDE_TABS_RIGHT,
        {
          key: "module",
          label: primo.label,
          href: primo.href,
          icon: MODULE_ICONS[primo.id],
        },
      ]
    : SIDE_TABS_RIGHT;

  /* La bolla parte da dove era, non da dove deve arrivare. */
  const [mostrato, setMostrato] = useState<TabKey>(
    ultimoAttivo && ultimoAttivo !== active ? ultimoAttivo : active,
  );
  const bolla = useRef<HTMLSpanElement | null>(null);
  const pillola = useRef<HTMLDivElement | null>(null);
  const tasti = useRef<Map<TabKey, HTMLAnchorElement>>(new Map());
  const primoGiro = useRef(true);

  const registra = useCallback((key: TabKey, el: HTMLAnchorElement | null) => {
    if (el) tasti.current.set(key, el);
    else tasti.current.delete(key);
  }, []);

  /* Arrivati: da qui in poi la bolla insegue la schermata vera. */
  useEffect(() => {
    ultimoAttivo = active;
    if (mostrato === active) return;
    const id = requestAnimationFrame(() => setMostrato(active));
    return () => cancelAnimationFrame(id);
  }, [active, mostrato]);

  /* La misura. Il primo disegno e senza viaggio: la bolla e gia dov'e. */
  useLayoutEffect(() => {
    const b = bolla.current;
    const p = pillola.current;
    const acceso = tasti.current.get(mostrato);
    if (!b || !p) return;
    if (!acceso) {
      // Nessun tasto corrisponde (Impostazioni, Recap): niente bolla.
      b.style.opacity = "0";
      return;
    }
    const a = acceso.getBoundingClientRect();
    const q = p.getBoundingClientRect();
    const primo = primoGiro.current;
    if (primo) b.style.transition = "none";
    b.style.opacity = "1";
    b.style.left = `${a.left - q.left}px`;
    b.style.width = `${a.width}px`;
    if (primo) {
      primoGiro.current = false;
      requestAnimationFrame(() => {
        b.style.transition = "";
      });
      return;
    }
    /* Lo stiramento dura quanto il viaggio, non un millisecondo di piu:
       e questo, e non la sfocatura, a far dire "liquido". */
    b.classList.add("viaggio");
    const id = window.setTimeout(() => b.classList.remove("viaggio"), 240);
    return () => window.clearTimeout(id);
  }, [mostrato, tabsRight.length]);

  /* Se lo schermo cambia misura (rotazione, tastiera che si apre) la
     bolla si rimisura senza viaggiare: non e successo niente. */
  useEffect(() => {
    const rimisura = () => {
      const b = bolla.current;
      const p = pillola.current;
      const acceso = tasti.current.get(mostrato);
      if (!b || !p || !acceso) return;
      const a = acceso.getBoundingClientRect();
      const q = p.getBoundingClientRect();
      b.style.transition = "none";
      b.style.left = `${a.left - q.left}px`;
      b.style.width = `${a.width}px`;
      requestAnimationFrame(() => {
        b.style.transition = "";
      });
    };
    window.addEventListener("resize", rimisura);
    window.addEventListener("orientationchange", rimisura);
    return () => {
      window.removeEventListener("resize", rimisura);
      window.removeEventListener("orientationchange", rimisura);
    };
  }, [mostrato]);

  return (
    <>
      {/* Lo spazio che la pillola occuperebbe se non fosse sospesa. Sta
          nel flusso, cosi l'ultima riga di ogni schermata non finisce
          dietro il vetro. */}
      <div className="jm-dock-spazio lg:hidden" aria-hidden="true" />

      <nav className="jm-dock-wrap lg:hidden">
        <div className="jm-dock" ref={pillola}>
          <span className="jm-dock-bolla" ref={bolla} aria-hidden="true" />

          {SIDE_TABS_LEFT.map((tab) => (
            <SideTab
              key={tab.key}
              tab={tab}
              active={mostrato === tab.key}
              onMount={registra}
              onScelto={() => setMostrato(tab.key)}
            />
          ))}

          {/* Mic centrale — premium iOS-like, sempre disponibile */}
          <Link
            href="/?record=1"
            aria-label={t("Registra")}
            className="jm-dock-mic"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="23"
              height="23"
              aria-hidden="true"
            >
              <rect x="9" y="3" width="6" height="12" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0" />
              <path d="M12 18v3" />
            </svg>
          </Link>

          {tabsRight.map((tab) => (
            <SideTab
              key={tab.key}
              tab={tab}
              active={mostrato === tab.key}
              onMount={registra}
              onScelto={() => setMostrato(tab.key)}
            />
          ))}
        </div>
      </nav>
    </>
  );
}

function SideTab({
  tab,
  active,
  onMount,
  onScelto,
}: {
  tab: Tab;
  active: boolean;
  onMount: (key: TabKey, el: HTMLAnchorElement | null) => void;
  onScelto: () => void;
}) {
  const t = useT();
  return (
    <Link
      href={tab.href}
      ref={(el) => onMount(tab.key, el)}
      className={`jm-dock-t${active ? " on" : ""}`}
      aria-current={active ? "page" : undefined}
      /* La bolla parte col dito, non quando la pagina nuova e pronta:
         fra il tocco e il disegno passano decine di millisecondi, e in
         quelli il dock sembrerebbe non aver sentito. */
      onPointerDown={onScelto}
    >
      <span className="jm-dock-i">{tab.icon}</span>
      <span className="jm-dock-l">{t(tab.label)}</span>
    </Link>
  );
}
