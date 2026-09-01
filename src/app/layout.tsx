import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeWatcher } from "@/components/theme-watcher";
import { LangWatcher } from "@/components/lang-watcher";
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

/* IL CARATTERE DEL MARCHIO e Newsreader dal 2 settembre 2026 (mockup
   sfondo-lancio.html, "02 . Newsreader", scelta di Manuel): e gia qui
   sopra, fra i caratteri dei temi. Il token che lo espone al marchio si
   chiama --jm-font-marchio e vive in base.css, non nel contratto dei
   temi: il nome del prodotto si scrive sempre uguale, in qualunque tema.
   Il corsivo Sacramento del 31 agosto e stato tolto col suo file. */

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
  title: "dayalogue",
  description: "Diario personale: voce, memoria, recap.",
  applicationName: "dayalogue",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "dayalogue",
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
        {/* Da qui in giu, fino al 31 agosto 2026, c'era il guscio dell'app
            (splash, lucchetto, cancello, rail). Ora sta in
            src/app/(app)/layout.tsx: il sito pubblico su "/" non deve
            ereditare ne un velo nero ne un rimbalzo al login. */}
        {children}
      </body>
    </html>
  );
}
