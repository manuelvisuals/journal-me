"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { resolveStorageMode, useStorageMode } from "@/lib/data/store";
import { BrandMark } from "@/components/brand/brand-mark";
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

type NavKey = "today" | "mese" | "ricorda" | "recap" | "altro";

const NAV_ITEMS: { key: NavKey; href: string; label: string; icon: React.ReactNode }[] = [
  {
    key: "today",
    href: "/",
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
    href: "/mese",
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
    href: "/remember",
    label: "Ricorda",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1z" />
      </svg>
    ),
  },
  {
    key: "recap",
    href: "/recap",
    label: "Recap",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
        <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5" />
      </svg>
    ),
  },
  {
    key: "altro",
    href: "/settings",
    label: "Impostazioni",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
        <circle cx="5" cy="12" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="19" cy="12" r="2" />
      </svg>
    ),
  },
];

function activeKeyFor(pathname: string): NavKey | null {
  if (pathname === "/" || pathname.startsWith("/giorno")) return "today";
  if (pathname.startsWith("/mese")) return "mese";
  if (pathname.startsWith("/remember")) return "ricorda";
  if (pathname.startsWith("/recap")) return "recap";
  if (pathname.startsWith("/settings")) return "altro";
  return null;
}

type Account = { name: string; badge: string };

export function RailLeft() {
  const t = useT();
  const moduli = useActiveModules();
  const pathname = usePathname();
  const mode = useStorageMode();
  const active = activeKeyFor(pathname);
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const m = await resolveStorageMode();
      if (m === "local") {
        if (alive) setAccount({ name: "questo dispositivo", badge: "Locale" });
        return;
      }
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!alive) return;
        const name = user?.email ? user.email.split("@")[0] : "ospite";
        let badge = "Cloud";
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("plan")
            .eq("user_id", user.id)
            .maybeSingle();
          if (profile?.plan === "premium") badge = "Premium";
        }
        if (alive) setAccount({ name, badge });
      } catch {
        if (alive) setAccount(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [mode]);

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
            Sono sotto le voci fisse e sopra il separatore: sono sezioni,
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

        <div className="jm-rail-sep" />
        <Link href="/?record=1" className="jm-rail-i rec">
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
      </div>
      <div className="jm-rail-foot">
        <div className="jm-rail-acct">
          <div className="jm-rail-avatar">
            {account ? account.name.slice(0, 1).toUpperCase() : "•"}
          </div>
          <div className="jm-rail-acct-txt">
            <div className="jm-rail-acct-nm">
              {account ? t(account.name) : "…"}
            </div>
            {account && (
              <span
                className={`jm-rail-pill${account.badge === "Premium" ? " prem" : ""}`}
              >
                {t(account.badge)}
              </span>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
