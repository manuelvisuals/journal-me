"use client";

/**
 * Apre un URL FUORI dall'app: Safari dentro il guscio nativo, una scheda
 * nuova sul web.
 *
 * PERCHE ESISTE (controaudit Apple 5.1.1, 15 settembre 2026, rischio R6 —
 * confermato da codice il giorno stesso). I link Termini/Privacy del muro
 * premium avevano un commento che diceva "si apre il sito in Safari" ma
 * non lo facevano davvero: un `<a target="_blank">` dentro una WKWebView
 * di Capacitor non apre il browser di sistema, e nel repo non c'era né
 * `@capacitor/browser` né un gestore nativo (`WKUIDelegate`) che lo
 * sostituisse. La promessa era nel commento, non nel codice.
 *
 * Da qui in poi ogni link che deve uscire dall'app passa da QUESTA
 * funzione sola — mai più un `<a target="_blank">` nudo dentro il guscio —
 * così la stessa lacuna non può tornare in un punto e non nell'altro.
 */
import { isNative } from "@/lib/native/platform";

export async function apriEsterno(url: string): Promise<void> {
  if (isNative()) {
    // Import dinamico: il plugin non deve pesare sul bundle web, dove
    // negozioDisponibile() è già false e questo ramo non gira mai.
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
