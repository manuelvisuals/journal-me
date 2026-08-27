import type { CapacitorConfig } from "@capacitor/cli";

/**
 * iOS shell configuration.
 *
 * `webDir` points at the static export produced by `JM_MOBILE=1 next build`
 * (see next.config.ts), so the whole interface ships inside the binary and the
 * first paint costs no network at all. Only data and the AI endpoints go over
 * the wire, to NEXT_PUBLIC_API_BASE.
 *
 * There is deliberately no `server.url` here: pointing the shell at the Vercel
 * site would have been a day's work instead of a week's, but it would also mean
 * every launch waits on a page load, which is the opposite of what this app is
 * for.
 */
const config: CapacitorConfig = {
  appId: "com.manuelvisuals.dayalogue",
  appName: "dayalogue",
  webDir: ".next-mobile",
  ios: {
    // The app draws its own dark background under the status bar and home
    // indicator; letting WebKit inset the content would put a light band there.
    contentInset: "never",
    backgroundColor: "#050304",
    // Recording holds the screen awake and uses the mic; a bounce-scroll on a
    // full-screen overlay reads as a bug, not as iOS.
    scrollEnabled: true,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_icon",
      iconColor: "#E3A15F",
    },
  },
};

export default config;
