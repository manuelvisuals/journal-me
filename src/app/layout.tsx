import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Splash } from "@/components/splash";
import { AuthGate } from "@/components/auth-gate";
import { BiometricLock } from "@/components/biometric-lock";
import { ThemeWatcher } from "@/components/theme-watcher";
import { LangWatcher } from "@/components/lang-watcher";
import { Toaster } from "@/components/ui/toast";
import { PremiumWelcome } from "@/modules/abbonamento/components/premium-welcome";
import { Linguetta, SalutoAvvio } from "@/modules/accesso";
import { DesktopShell } from "@/components/desktop/desktop-shell";
import { defaultThemeCss, themeBootScript } from "@/themes/boot";

/**
 * Fonts ship with the app instead of coming from next/font/google.
 *
 * All the families of the included themes (SPEC-temi §7), pulled from the
 * @fontsource packages and committed in src/fonts/. The reason is the iOS
 * shell: a build that has to reach Google Fonts is a build that fails
 * without network, and a first launch on a mountain connection should not
 * be waiting on fonts.googleapis.com to know how to draw text.
 *
 * next/font/local is STATIC: the six families are all declared here, each
 * exposing a CSS variable, and the active theme just picks which variable
 * goes into --jm-font-sans / --jm-font-serif. Never load a font at runtime
 * based on the theme: that road ends in a flash of unstyled text on every
 * switch.
 */
const inter = localFont({
  src: [
    {
      path: "../fonts/inter-latin-wght-normal.woff2",
      style: "normal",
      weight: "100 900",
    },
  ],
  variable: "--font-inter",
  display: "swap",
});

const spectral = localFont({
  src: [
    { path: "../fonts/spectral-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "../fonts/spectral-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/spectral-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/spectral-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-spectral",
  display: "swap",
});

const newsreader = localFont({
  src: [
    {
      path: "../fonts/newsreader-latin-wght-normal.woff2",
      style: "normal",
      weight: "200 800",
    },
  ],
  variable: "--font-newsreader",
  display: "swap",
});

const ebGaramond = localFont({
  src: [
    {
      path: "../fonts/eb-garamond-latin-wght-normal.woff2",
      style: "normal",
      weight: "400 800",
    },
  ],
  variable: "--font-eb-garamond",
  display: "swap",
});

const dmSans = localFont({
  src: [
    {
      path: "../fonts/dm-sans-latin-wght-normal.woff2",
      style: "normal",
      weight: "100 1000",
    },
  ],
  variable: "--font-dm-sans",
  display: "swap",
});

const cormorantGaramond = localFont({
  src: [
    {
      path: "../fonts/cormorant-garamond-latin-wght-normal.woff2",
      style: "normal",
      weight: "300 700",
    },
  ],
  variable: "--font-cormorant-garamond",
  display: "swap",
});

const ibmPlexMono = localFont({
  src: [
    { path: "../fonts/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/ibm-plex-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/ibm-plex-mono-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Journal.me",
  description: "Diario personale: voce, memoria, recap.",
  applicationName: "Journal.me",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Journal.me",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#050304",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fontVars = [
    inter.variable,
    spectral.variable,
    newsreader.variable,
    ebGaramond.variable,
    dmSans.variable,
    cormorantGaramond.variable,
    ibmPlexMono.variable,
  ].join(" ");

  return (
    // suppressHydrationWarning sull'<html>: lo script di boot scrive
    // data-theme, data-mode e le custom property PRIMA dell'idratazione;
    // e voluto e React non deve provare a riconciliarlo.
    <html
      lang="it"
      className={`${fontVars} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* Tema e appearance PRIMA del primo paint (SPEC-temi §5): script
            inline sincrono, mai aspettare React o l'app lampeggia bianca.
            I valori vengono da src/themes/*.ts, serializzati qui dal server. */}
        {/* La cintura: il tema di default come CSS vero, cosi il primo
            paint e vestito anche se lo script qui sotto inciampa (successo
            nel guscio iOS il 24 agosto). Stessa fonte, due forme. */}
        <style dangerouslySetInnerHTML={{ __html: defaultThemeCss() }} />
        <script dangerouslySetInnerHTML={{ __html: themeBootScript() }} />
        <ThemeWatcher />
        <LangWatcher />
        {/* L'avviso di caricamento: uno solo, montato qui, usato da tutti. */}
        <Toaster />
        {/* Il popup dopo l'attivazione del premium: si accende solo con
            ?premium=1 nell'indirizzo, quindi qui non costa nulla. */}
        <PremiumWelcome />
        {/* Splash is a client component but server-rendered into the initial
            HTML, so it covers the cold load. It removes itself via React state
            only — never manual DOM removal (that crashed body re-renders). */}
        <Splash />
        {/* La linguetta: su OGNI schermata, anche per chi non e entrato, e
            a livello di <body> perche l'animazione di chiusura del saluto
            ne misura la posizione reale — dentro un antenato con transform
            quella misura mentirebbe. */}
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
      </body>
    </html>
  );
}
