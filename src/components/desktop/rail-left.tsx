"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStorageMode } from "@/lib/data/store";
import { BrandMark } from "@/components/brand/brand-mark";
import { AccountMenu } from "@/components/ui/account-menu";
import { useT } from "@/lib/i18n";
import { MODULE_ICONS } from "@/components/ui/module-icons";
import { useActiveModules } from "@/lib/modules";

/**
 * La rail sinistra del guscio desktop (mockup desktop-v1.html): brand,
 * navigazione, "Racconta" (una parola: vedi sotto), account con badge in fondo.
 *
 * Le voci vengono dal mockup approvato: Recap e di primo livello e
 * l'etichetta e "Ricorda" (SPEC-v2 §10.7 le segnava come decisione aperta;
 * la rail approvata le chiude cosi — cambiarle e editare NAV_ITEMS).
 */

// "altro" non esiste piu (28 agosto 2026, mockup porta-account): le
// Impostazioni si aprono dal pallino dell'account in fondo, e questa
// lista contiene solo posti del diario.
type NavKey = "today" | "mese" | "ricorda" | "recap";

const NAV_ITEMS: { key: NavKey; href: string; label: string; icon: React.ReactNode }[] = [
  {
    key: "today",
    href: "/app",
    label: "Oggi",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    ),
  },
  {
    key: "mese",
    href: "/app/mese",
    label: "Mese",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
        <path d="M3 9.5h18M8 3v3M16 3v3" />
      </svg>
    ),
  },
  {
    key: "ricorda",
    href: "/app/remember",
    label: "Ricorda",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1z" />
      </svg>
    ),
  },
  {
    key: "recap",
    href: "/app/recap",
    label: "Recap",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
        <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5" />
      </svg>
    ),
  },
];

function activeKeyFor(pathname: string): NavKey | null {
  if (pathname === "/app" || pathname.startsWith("/app/giorno")) return "today";
  if (pathname.startsWith("/app/mese")) return "mese";
  if (pathname.startsWith("/app/remember")) return "ricorda";
  if (pathname.startsWith("/app/recap")) return "recap";
  return null;
}

export function RailLeft() {
  const t = useT();
  const moduli = useActiveModules();
  const pathname = usePathname();
  const mode = useStorageMode();
  const active = activeKeyFor(pathname);

  return (
    <nav className="jm-rail-l" aria-label={t("Navigazione principale")}>
      <div className="jm-rail-brand">
        <BrandMark />
        <span>day</span>alogue
      </div>
      <div className="jm-rail-nav">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={`jm-rail-i${active === item.key ? " on" : ""}`}
            aria-current={active === item.key ? "page" : undefined}
          >
            {item.icon}
            {t(item.label)}
          </Link>
        ))}

        {/* I moduli accesi: sul desktop ci stanno TUTTI, incolonnati, perche
            qui lo spazio c'e (sul telefono la barra ne mostra uno solo).
            Sono sotto le voci fisse, dentro il vassoio: sono sezioni,
            non azioni. */}
        {moduli.map((m) => (
          <Link
            key={m.id}
            href={m.href}
            className={`jm-rail-i${pathname === m.href ? " on" : ""}`}
            aria-current={pathname === m.href ? "page" : undefined}
          >
            {MODULE_ICONS[m.id]}
            {t(m.label)}
          </Link>
        ))}
      </div>

      {/* Fuori dal vassoio di proposito (mockup dock-desktop.html §02):
          nel dock il microfono non e una destinazione fra le altre, e
          l'azione, e sta separato. Qui vale lo stesso, e per questo la
          riga divisoria che c'era prima non serve piu: a dividere sono il
          bordo del vassoio e il pieno del tasto. */}
      <Link href="/app?record=1" className="jm-rail-i rec">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
        </svg>
        {/* Una parola sola: "Racconta a voce" andava a capo dentro i 222px
            della rail, e una voce di navigazione su due righe rompe la
            colonna che tutte le altre tengono. Il verbo resta quello del
            progetto — si racconta la giornata — solo senza il complemento. */}
        {mode === "local" ? t("Scrivi") : t("Racconta")}
        <span className="jm-rail-kbd">{"⌘⇧R"}</span>
      </Link>

      {/* Il pallino non e piu un <div> morto: e LA porta dell'account
          (mockup porta-account §01). Chi sei, il menu e il logout vivono
          nel componente, perche il pallino ora esiste su due superfici. */}
      <div className="jm-rail-foot">
        <AccountMenu variant="rail" />
      </div>
    </nav>
  );
}
