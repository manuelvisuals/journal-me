import { Capacitor } from "@capacitor/core";

/**
 * True only inside the iOS shell. Everything native-only is behind this: the
 * same bundle still has to run in a browser tab, where Face ID and local
 * notifications do not exist and asking for them would throw.
 */
export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}
