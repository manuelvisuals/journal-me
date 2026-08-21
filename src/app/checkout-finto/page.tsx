import { notFound } from "next/navigation";
import { fakeCheckoutEnabled } from "@/lib/dev-checkout";
import { CheckoutFintoClient } from "@/app/checkout-finto/client";

/**
 * /checkout-finto — il pagamento simulato (richiesta di Manuel del 21
 * agosto 2026, mockup design/mockups/checkout-finto.html §01, approvato).
 *
 * Il controllo sta QUI, in un componente server: a interruttore spento la
 * pagina non esiste proprio, e chi ci arriva vede il 404 di Next come per
 * qualunque indirizzo inventato. Un messaggio del tipo "funzione non
 * attiva" direbbe a chi passa che qui c'e qualcosa che si puo accendere.
 *
 * Il permesso vero pero non e questo: e la rotta /api/dev-checkout, che
 * ricontrolla interruttore ed elenco email prima di scrivere il piano. Chi
 * apre la pagina non ottiene niente per il solo fatto di vederla.
 */
export default function CheckoutFintoPage() {
  if (!fakeCheckoutEnabled()) notFound();
  return <CheckoutFintoClient />;
}
