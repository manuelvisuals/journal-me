import { Splash } from "@/components/splash";
import { AuthGate } from "@/components/auth-gate";
import { BiometricLock } from "@/components/biometric-lock";
import { Toaster } from "@/components/ui/toast";
import { PremiumWelcome } from "@/modules/abbonamento/components/premium-welcome";
import { Linguetta, SalutoAvvio } from "@/modules/accesso";
import { DesktopShell } from "@/components/desktop/desktop-shell";

/**
 * IL GUSCIO DELL'APP (31 agosto 2026).
 *
 * Fino a ieri tutto questo stava nel layout di radice, cioe addosso a
 * QUALUNQUE indirizzo del dominio. Da quando `/` e il sito pubblico
 * (decisione di Manuel: "/ e la home seo, /app e tutta l'app") quel
 * pacchetto non puo piu essere di tutti: la splash, il lucchetto
 * biometrico e il cancello che rimbalza a /login sono cose dell'app, e su
 * una pagina di vendita sarebbero, nell'ordine, un velo nero davanti al
 * testo, una richiesta di Face ID a uno sconosciuto e un rimbalzo al login
 * di chi era arrivato da Google.
 *
 * Percio il layout di radice e rimasto quello che serve a tutti (html,
 * body, i font, il tema prima del paint) e tutto il resto e sceso qui, nel
 * gruppo di rotte `(app)`: le parentesi dicono a Next di NON metterlo
 * nell'indirizzo, quindi `/app`, `/login`, `/privacy` e `/admin` restano
 * dove erano e si portano dietro il guscio; `/` e `/support` no.
 */
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {/* L'avviso di caricamento: uno solo, montato qui, usato da tutti. */}
      <Toaster />
      {/* Il popup dopo l'attivazione del premium: si accende solo con
          ?premium=1 nell'indirizzo, quindi qui non costa nulla. */}
      <PremiumWelcome />
      {/* Splash is a client component but server-rendered into the initial
          HTML, so it covers the cold load. It removes itself via React state
          only — never manual DOM removal (that crashed body re-renders). */}
      <Splash />
      {/* La linguetta: su OGNI schermata dell'app, anche per chi non e
          entrato, e a livello alto perche l'animazione di chiusura del
          saluto ne misura la posizione reale — dentro un antenato con
          transform quella misura mentirebbe. */}
      <Linguetta />
      {/* The auth redirect used to live in src/proxy.ts (Next middleware).
          A statically exported bundle has no server to run middleware, so
          the same rule is enforced here, in the app. */}
      <BiometricLock>
        <AuthGate>
          {/* Da lg in su: rail + colonna + rail destra (PR 6). Sotto lg il
              guscio e display:contents e non esiste. */}
          {/* Il saluto all'avvio: dentro AuthGate, quindi un utente c'e
              gia per costruzione. Si disegna prima del paint, cosi i
              secondi in cui l'app finisce di caricarsi passano dietro
              il velo invece che davanti a una schermata nuda. */}
          <SalutoAvvio />
          <DesktopShell>{children}</DesktopShell>
        </AuthGate>
      </BiometricLock>
    </>
  );
}
