"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { resolveStorageMode, useStorageMode } from "@/lib/data/store";

/**
 * La rail sinistra del guscio desktop (mockup desktop-v1.html): brand,
 * navigazione, "Racconta a voce", account con badge modalita in fondo.
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
    label: "Altro",
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
    <nav className="jm-rail-l" aria-label="Navigazione principale">
      <div className="jm-rail-brand">
        Journal<span>.me</span>
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
            {item.label}
          </Link>
        ))}
        <div className="jm-rail-sep" />
        <Link href="/?record=1" className="jm-rail-i rec">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
          </svg>
          {mode === "local" ? "Scrivi la giornata" : "Racconta a voce"}
          <span className="jm-rail-kbd">{"⌘⇧R"}</span>
        </Link>
      </div>
      <div className="jm-rail-foot">
        <div className="jm-rail-acct">
          <div className="jm-rail-avatar">
            {account ? account.name.slice(0, 1).toUpperCase() : "•"}
          </div>
          <div className="jm-rail-acct-txt">
            <div className="jm-rail-acct-nm">{account?.name ?? "…"}</div>
            {account && (
              <span
                className={`jm-rail-pill${account.badge === "Premium" ? " prem" : ""}`}
              >
                {account.badge}
              </span>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
