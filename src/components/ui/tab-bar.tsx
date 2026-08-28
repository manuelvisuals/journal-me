"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
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
  const colonne = SIDE_TABS_LEFT.length + 1 + tabsRight.length;
  return (
    <nav
      className="sticky bottom-0 left-0 right-0 z-10 grid items-center border-t backdrop-blur lg:hidden"
      style={{
        gridTemplateColumns: `repeat(${colonne}, 1fr)`,
        borderColor: "var(--color-line)",
        background: "color-mix(in oklab, var(--color-bg) 50%, transparent)",
        paddingTop: 12,
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
      }}
    >
      {SIDE_TABS_LEFT.map((tab) => (
        <SideTab key={tab.key} tab={tab} active={active === tab.key} />
      ))}

      {/* Mic centrale — premium iOS-like, sempre disponibile */}
      <Link
        href="/?record=1"
        aria-label={t("Registra")}
        className="flex flex-col items-center select-none"
        style={{
          gap: 4,
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
          color: "var(--color-accent)",
        }}
      >
        <span className="jm-mic-circle">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="22"
            height="22"
            aria-hidden="true"
          >
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <path d="M12 18v3" />
          </svg>
        </span>
        <span
          style={{
            fontSize: "calc(9px * var(--jm-ui-scale))",
            fontWeight: 600,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
          }}
        >
          {t("Registra")}
        </span>
      </Link>

      {tabsRight.map((tab) => (
        <SideTab key={tab.key} tab={tab} active={active === tab.key} />
      ))}
    </nav>
  );
}

function SideTab({ tab, active }: { tab: Tab; active: boolean }) {
  const t = useT();
  return (
    <Link
      href={tab.href}
      className="flex flex-col items-center gap-1 select-none"
      style={{
        color: active ? "var(--color-accent)" : "var(--color-ink-faint)",
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
      }}
    >
      <span style={{ width: 22, height: 22, display: "block" }}>
        {tab.icon}
      </span>
      <span
        style={{
          fontSize: "calc(9px * var(--jm-ui-scale))",
          fontWeight: 600,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
        }}
      >
        {t(tab.label)}
      </span>
    </Link>
  );
}
