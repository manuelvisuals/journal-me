import type { Metadata, Viewport } from "next";
import { Inter, Spectral } from "next/font/google";
import "./globals.css";
import { SplashController } from "@/components/splash";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spectral = Spectral({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
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
        {/* Server-rendered splash: paints instantly to cover the cold load.
            SplashController prefetches the tabs then fades + removes it; the
            inline script below is an independent failsafe. */}
        <div id="jm-splash" className="jm-splash" aria-hidden="true">
          <div className="jm-splash-halo" />
          <div className="jm-splash-mark">
            Journal<span className="jm-splash-dot">.</span>me
          </div>
          <div className="jm-splash-bar">
            <i />
          </div>
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "setTimeout(function(){var e=document.getElementById('jm-splash');if(e){e.style.opacity='0';e.style.pointerEvents='none';setTimeout(function(){if(e&&e.remove)e.remove();},500);}},2600);",
          }}
        />
        <SplashController />
        {children}
      </body>
    </html>
  );
}
