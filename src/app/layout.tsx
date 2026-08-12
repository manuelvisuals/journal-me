import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Splash } from "@/components/splash";
import { AuthGate } from "@/components/auth-gate";
import { BiometricLock } from "@/components/biometric-lock";

/**
 * Fonts ship with the app instead of coming from next/font/google.
 *
 * Same two typefaces as before (Inter for UI, Spectral for prose), same files
 * Google would have served — pulled from the @fontsource packages and committed
 * here. The reason is the iOS shell: a build that has to reach Google Fonts is a
 * build that fails without network, and a first launch on a mountain connection
 * should not be waiting on fonts.googleapis.com to know how to draw text.
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
  return (
    <html
      lang="it"
      className={`${inter.variable} ${spectral.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Splash is a client component but server-rendered into the initial
            HTML, so it covers the cold load. It removes itself via React state
            only — never manual DOM removal (that crashed body re-renders). */}
        <Splash />
        {/* The auth redirect used to live in src/proxy.ts (Next middleware).
            A statically exported bundle has no server to run middleware, so
            the same rule is enforced here, in the app. */}
        <BiometricLock>
          <AuthGate>{children}</AuthGate>
        </BiometricLock>
      </body>
    </html>
  );
}
