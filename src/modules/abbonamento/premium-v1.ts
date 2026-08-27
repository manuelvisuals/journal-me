import { apiFetch } from "@/lib/api";
import { forcePlanRefresh, setPlanNow } from "@/lib/plan";
import { openPremiumWelcome } from "@/modules/abbonamento/components/premium-welcome";

/**
 * "Inizia cosi" sulla card Premium, dentro il guscio iOS (v1).
 *
 * La decisione e in PREMIUM_IOS_V1_GRATIS (src/lib/pricing.ts): nella v1
 * il premium su iOS si attiva gratis, senza vendita, per la guideline
 * 3.1.1 di Apple. Questa funzione E il punto d'acquisto della card: oggi
 * chiama la rotta gratuita, domani — quando arrivera l'In-App Purchase —
 * si sostituisce QUESTA implementazione (StoreKit, validazione ricevuta)
 * e nessuna schermata deve cambiare.
 *
 * Fa tutto quello che faceva il pagamento simulato riuscito
 * (checkout-finto): scrive subito il piano anche lato client, cosi la
 * schermata dopo e gia quella giusta, e apre il benvenuto premium.
 * Ritorna false se il server dice di no: chi chiama mostra l'errore.
 */
export async function startPremiumV1(): Promise<boolean> {
  try {
    const resp = await apiFetch("/api/premium-v1", { method: "POST" });
    if (!resp.ok) return false;
    setPlanNow("premium");
    void forcePlanRefresh();
    openPremiumWelcome();
    return true;
  } catch {
    return false;
  }
}
