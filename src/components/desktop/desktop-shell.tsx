"use client";

import { usePathname } from "next/navigation";
import { RailLeft } from "@/components/desktop/rail-left";
import { RailRightTarget } from "@/components/desktop/rail-right";

/**
 * Il guscio desktop (SPEC-v2 §5.2): sotto lg non rende NULLA di suo — il
 * telefono e il guscio iOS non devono accorgersi di niente. Da lg in su,
 * griglia a tre colonne: rail sinistra 222px, contenuto, rail destra 296px
 * (che ogni pagina riempie via <RailRight>).
 *
 * Stessa route, stesso componente client, layout diverso: se ti ritrovi a
 * scrivere today-client-desktop.tsx, ti sei perso.
 */

function isBareLayout(pathname: string): boolean {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/benvenuto")
  );
}

export function DesktopShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Le pagine pubbliche (login, benvenuto) restano una colonna centrata
  // anche su desktop: niente rail attorno a una schermata d'ingresso.
  if (isBareLayout(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="jm-shell">
      <RailLeft />
      <div className="jm-shell-c">{children}</div>
      <RailRightTarget />
    </div>
  );
}
