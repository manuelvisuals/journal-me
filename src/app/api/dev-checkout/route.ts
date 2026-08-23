import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireUser } from "@/lib/server/entitlement";
import {
  FAKE_PLAN_SOURCE,
  fakeCheckoutAllows,
  fakeCheckoutEnabled,
} from "@/lib/dev-checkout";

/**
 * Il pagamento finto: cambia `profiles.plan` senza passare da Stripe.
 *
 * Esiste per una ragione sola: senza, provare l'app da premium richiede di
 * modificare il database a mano a ogni giro, e ogni verifica delle funzioni
 * premium si ferma li.
 *
 * TRE CANCELLI, in quest'ordine:
 *  1. interruttore spento -> 404, non 403: chi passa non deve nemmeno
 *     sapere che questa rotta esiste;
 *  2. token di sessione valido (requireUser): il piano si scrive per l'utente
 *     che sta chiamando, mai per un id passato nel corpo — se il chiamante
 *     potesse scegliere l'utente, potrebbe fare premium chiunque;
 *  3. email in elenco.
 *
 * `plan_source = 'dev'` e non `'stripe'`: si distingue a colpo d'occhio chi
 * e premium finto, e il webhook vero (l'unico che scrive `'stripe'`) resta
 * l'unica autorita sugli abbonamenti veri.
 *
 * Va anche all'indietro (`plan: "free"`): senza, il primo giro di prova
 * brucia l'account e il percorso non si puo piu ripetere.
 */
export async function POST(req: NextRequest) {
  if (!fakeCheckoutEnabled()) {
    return new NextResponse(null, { status: 404 });
  }

  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  if (!fakeCheckoutAllows(user.email)) {
    return NextResponse.json(
      { error: "Questo account non e abilitato alla prova." },
      { status: 403 },
    );
  }

  let plan: "premium" | "free" = "premium";
  try {
    const body = (await req.json()) as { plan?: string };
    if (body.plan === "free") plan = "free";
  } catch {
    // Corpo assente o illeggibile: vale il caso normale, cioe premium.
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server non configurato (env Supabase mancanti)" },
      { status: 500 },
    );
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      plan,
      plan_source: FAKE_PLAN_SOURCE,
      // Nessuna scadenza: non c'e nessun abbonamento dietro. Lasciarla a
      // null evita che una data inventata finisca in una schermata.
      current_period_end: null,
    })
    .eq("user_id", user.userId);

  if (error) {
    return NextResponse.json(
      { error: `Non sono riuscito a cambiare il piano: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ plan });
}
