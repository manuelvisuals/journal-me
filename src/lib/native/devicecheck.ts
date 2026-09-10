/**
 * Il token DeviceCheck del dispositivo (decisione 2A, 10 settembre 2026).
 *
 * iOS lo produce con DCDevice.generateToken; solo Apple sa leggerlo, e il
 * nostro server lo manda ad Apple per sapere se questo dispositivo il regalo
 * delle dieci giornate l'ha gia avuto (src/lib/server/devicecheck.ts). Il
 * plugin nativo e ios/App/App/DeviceCheck.swift, registrato a mano in
 * DockVetro.swift come gli altri che vivono dentro l'app.
 *
 * Sul web non esiste: torna null, e il server decide cosa farne. Per i
 * banchi c'e `window.__jmDeviceCheckFinto`, con la stessa forma del plugin.
 */
import { registerPlugin } from "@capacitor/core";
import { isNative } from "@/lib/native/platform";

type PluginDeviceCheck = {
  token(): Promise<{ token: string | null }>;
};

declare global {
  interface Window {
    __jmDeviceCheckFinto?: PluginDeviceCheck;
  }
}

let plugin: PluginDeviceCheck | null = null;

function nativo(): PluginDeviceCheck | null {
  if (typeof window !== "undefined" && window.__jmDeviceCheckFinto) return window.__jmDeviceCheckFinto;
  if (!isNative()) return null;
  if (!plugin) plugin = registerPlugin<PluginDeviceCheck>("DeviceCheck");
  return plugin;
}

/** Il token, o null se qui non c'e un dispositivo Apple (o iOS lo nega). */
export async function tokenDeviceCheck(): Promise<string | null> {
  const n = nativo();
  if (!n) return null;
  try {
    const { token } = await n.token();
    return token && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}
