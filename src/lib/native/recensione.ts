/**
 * Il foglio di Apple "Ti piace dayalogue?" (SKStoreReviewController), via
 * il plugin ios/App/App/Recensione.swift, registrato a mano in
 * DockVetro.swift come gli altri che vivono dentro l'app.
 *
 * Sul web non esiste: `chiediRecensioneNativa()` torna false e nessuno se
 * ne accorge. Per i banchi c'e `window.__jmRecensioneFinto`, con la stessa
 * forma del plugin.
 *
 * Apple decide da sola se mostrare davvero il foglio (al massimo tre volte
 * l'anno per persona) e non dice mai ne se l'ha mostrato ne se la persona
 * ha scritto: "true" qui vuol dire solo "gliel'abbiamo chiesto".
 */
import { registerPlugin } from "@capacitor/core";
import { isNative } from "@/lib/native/platform";

type PluginRecensione = {
  chiedi(): Promise<{ chiesto: boolean }>;
};

declare global {
  interface Window {
    __jmRecensioneFinto?: PluginRecensione;
  }
}

let plugin: PluginRecensione | null = null;

function nativo(): PluginRecensione | null {
  if (typeof window !== "undefined" && window.__jmRecensioneFinto) return window.__jmRecensioneFinto;
  if (!isNative()) return null;
  if (!plugin) plugin = registerPlugin<PluginRecensione>("Recensione");
  return plugin;
}

/** True se qui c'e un iPhone (o il finto dei banchi). */
export function recensionePossibile(): boolean {
  return nativo() !== null;
}

export async function chiediRecensioneNativa(): Promise<boolean> {
  const n = nativo();
  if (!n) return false;
  try {
    const { chiesto } = await n.chiedi();
    return chiesto === true;
  } catch {
    return false;
  }
}
