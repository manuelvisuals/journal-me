"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { useT } from "@/lib/i18n";
import { MODULE_ICONS } from "@/components/ui/module-icons";
import { useActiveModules } from "@/lib/modules";
import { useVetroNativo } from "@/components/ui/dock-vetro";

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
 * Dove stava la bolla, in pixel, l'ultima volta che un dock e morto.
 *
 * Cambiando schermata questo componente non si sposta: muore e rinasce
 * (anche DUE volte, perche prima monta lo scheletro di caricamento e poi
 * la schermata vera). Senza memoria la bolla comparirebbe gia arrivata e
 * il viaggio — cioe la cosa per cui esiste — non si vedrebbe mai.
 *
 * Si ricorda la POSIZIONE e non il tasto, e si legge dal vivo al momento
 * di morire: cosi un dock che nasce mentre il viaggio e a meta riparte
 * esattamente da li invece di ricominciare da capo o saltare alla fine.
 * Vive fuori da React per lo stesso motivo del contatore qui sopra: e uno
 * stato del DOCK, non di una schermata.
 */
let ultimaPosa: { left: number; width: number } | null = null;

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
    href: "/app",
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
    href: "/app/mese",
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
    href: "/app/remember",
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

  const bolla = useRef<HTMLSpanElement | null>(null);
  const pillola = useRef<HTMLDivElement | null>(null);
  const tasti = useRef<Map<TabKey, HTMLAnchorElement>>(new Map());

  /* Dentro il guscio iOS 26 il vetro della pillola e VERO (una lastra
     nativa sopra la WebView, vedi dock-vetro.ts): finche e accesa, il
     velo finto qui sotto si spegne (.jm-dock-nativo). Sul web, o se la
     lastra non c'e, questo e sempre false e non cambia niente. */
  const vetroNativo = useVetroNativo(pillola);

  const registra = useCallback((key: TabKey, el: HTMLAnchorElement | null) => {
    if (el) tasti.current.set(key, el);
    else tasti.current.delete(key);
  }, []);

  /* Morendo, il dock dice al prossimo dove si trovava la bolla IN QUEL
     MOMENTO — non dove stava andando. E cio che rende il viaggio unico
     anche se i dock che se lo passano sono due o tre. */
  /* useLayoutEffect e non useEffect, ed e tutta qui la differenza fra un
     viaggio e un salto: la pulizia di un effetto NORMALE arriva dopo il
     disegno, cioe DOPO che il dock nuovo si e gia posato, e gli
     consegnerebbe una posizione buona per niente. Misurato: la bolla
     partiva, faceva quattro pixel e poi saltava alla meta. */
  useLayoutEffect(() => {
    /* I due nodi si prendono ADESSO, non nella pulizia: quando React
       smonta, i ref sono gia stati azzerati. */
    const b = bolla.current;
    const p = pillola.current;
    return () => {
      if (!b || !p) return;
      const r = b.getBoundingClientRect();
      const q = p.getBoundingClientRect();
      if (r.width === 0) return;
      ultimaPosa = { left: r.left - q.left, width: r.width };
    };
  }, []);

  /* La misura: la bolla si posa sul tasto acceso. Se il dock di prima l'ha
     lasciata altrove, ci arriva viaggiando; se era gia li, si posa e
     basta (senza questo controllo il secondo montaggio — quello della
     schermata vera dopo lo scheletro — faceva uno stiramento fermo sul
     posto: un tremolio, non un viaggio). */
  useLayoutEffect(() => {
    const b = bolla.current;
    const p = pillola.current;
    const acceso = tasti.current.get(active);
    if (!b || !p) return;
    if (!acceso) {
      // Nessun tasto corrisponde (Impostazioni, Recap): niente bolla.
      b.style.opacity = "0";
      return;
    }
    const a = acceso.getBoundingClientRect();
    const q = p.getBoundingClientRect();
    const meta = { left: a.left - q.left, width: a.width };
    const partenza = ultimaPosa;
    ultimaPosa = meta;
    b.style.opacity = "1";

    const viaggia = partenza !== null && Math.abs(partenza.left - meta.left) > 4;
    /* Si parte da dove si era, senza transizione, e si forza il calcolo:
       il salto e gia avvenuto quando la transizione si riaccende, e il
       viaggio parte davvero invece di essere gia finito. */
    b.style.transition = "none";
    b.style.left = `${viaggia ? partenza.left : meta.left}px`;
    b.style.width = `${viaggia ? partenza.width : meta.width}px`;
    void b.offsetWidth;
    b.style.transition = "";
    if (!viaggia) return;
    b.style.left = `${meta.left}px`;
    b.style.width = `${meta.width}px`;
    /* Lo stiramento dura quanto il viaggio, non un millisecondo di piu:
       e questo, e non la sfocatura, a far dire "liquido". */
    b.classList.add("viaggio");
    const id = window.setTimeout(() => b.classList.remove("viaggio"), 240);
    return () => window.clearTimeout(id);
  }, [active, tabsRight.length]);

  /* Se lo schermo cambia misura (rotazione, tastiera che si apre) la
     bolla si rimisura senza viaggiare: non e successo niente. */
  useEffect(() => {
    const rimisura = () => {
      const b = bolla.current;
      const p = pillola.current;
      const acceso = tasti.current.get(active);
      if (!b || !p || !acceso) return;
      const a = acceso.getBoundingClientRect();
      const q = p.getBoundingClientRect();
      ultimaPosa = { left: a.left - q.left, width: a.width };
      b.style.transition = "none";
      b.style.left = `${ultimaPosa.left}px`;
      b.style.width = `${ultimaPosa.width}px`;
      void b.offsetWidth;
      b.style.transition = "";
    };
    window.addEventListener("resize", rimisura);
    window.addEventListener("orientationchange", rimisura);
    return () => {
      window.removeEventListener("resize", rimisura);
      window.removeEventListener("orientationchange", rimisura);
    };
  }, [active]);

  return (
    <>
      {/* Lo spazio che la pillola occuperebbe se non fosse sospesa. Sta
          nel flusso, cosi l'ultima riga di ogni schermata non finisce
          dietro il vetro. */}
      <div className="jm-dock-spazio lg:hidden" aria-hidden="true" />

      <nav className="jm-dock-wrap lg:hidden">
        <div
          className={`jm-dock${vetroNativo ? " jm-dock-nativo" : ""}`}
          ref={pillola}
        >
          <span className="jm-dock-bolla" ref={bolla} aria-hidden="true" />

          {SIDE_TABS_LEFT.map((tab) => (
            <SideTab
              key={tab.key}
              tab={tab}
              active={active === tab.key}
              onMount={registra}
            />
          ))}

          {/* Mic centrale — premium iOS-like, sempre disponibile */}
          <Link
            href="/app?record=1"
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
              active={active === tab.key}
              onMount={registra}
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
}: {
  tab: Tab;
  active: boolean;
  onMount: (key: TabKey, el: HTMLAnchorElement | null) => void;
}) {
  const t = useT();
  return (
    <Link
      href={tab.href}
      ref={(el) => onMount(tab.key, el)}
      className={`jm-dock-t${active ? " on" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      <span className="jm-dock-i">{tab.icon}</span>
      <span className="jm-dock-l">{t(tab.label)}</span>
    </Link>
  );
}
