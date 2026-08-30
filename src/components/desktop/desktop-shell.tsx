"use client";

import { usePathname } from "next/navigation";
import { AppBar, titoloSchermata } from "@/components/ui/app-bar";
import { RailLeft } from "@/components/desktop/rail-left";
import { RailRightTarget } from "@/components/desktop/rail-right";
import { CommandPalette } from "@/components/desktop/command-palette";
import { FocusEscape } from "@/components/desktop/focus-toggle";
import { useShortcuts } from "@/components/desktop/use-shortcuts";
import { PremiumWall } from "@/modules/abbonamento/components/premium-wall";

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

  // Scorciatoie desktop (PR 8): registrate qui, in un solo posto, sempre —
  // il listener stesso si spegne sotto lg e sulle pagine bare.
  useShortcuts();

  // Le pagine pubbliche (login, benvenuto) restano una colonna centrata
  // anche su desktop: niente rail attorno a una schermata d'ingresso.
  if (isBareLayout(pathname)) {
    return <>{children}</>;
  }

  // La barra in alto del telefono (mockup pallino-ovunque, strada B): la
  // monta il guscio, UNA volta, e non un modulo — e tutto il punto. La
  // classe accanto dice al CSS "sopra c'e la barra", e serve a due cose
  // sole: togliere alle intestazioni la safe-area (che adesso e della
  // barra) e togliere alla schermata l'altezza della barra, cosi il
  // telefono non guadagna una striscia di scorrimento.
  const conBarra = titoloSchermata(pathname) !== null;

  return (
    <div className={`jm-shell${conBarra ? " jm-conbarra" : ""}`}>
      <AppBar />
      <RailLeft />
      <div className="jm-shell-c">{children}</div>
      <RailRightTarget />
      <CommandPalette />
      <FocusEscape />
      {/* Il muro premium vive nel guscio ma NON e roba desktop: sotto lg
          il guscio e display:contents e il muro (position:fixed) funziona
          identico sul telefono, dove serve di piu. */}
      <PremiumWall />
    </div>
  );
}
