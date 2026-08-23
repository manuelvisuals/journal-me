import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { requireUser } from "@/lib/server/entitlement";

/**
 * Apre una sessione di Stripe Checkout per l'abbonamento premium (PR 11).
 *
 * - Chi chiama e un utente AUTENTICATO ma tipicamente GRATIS: requireUser,
 *   non requirePremium.
 * - client_reference_id + metadata.user_id legano la sessione all'utente
 *   Supabase: e il filo che il webhook segue per scrivere profiles.plan.
 * - Se le env Stripe non sono configurate risponde 503 con un messaggio
 *   onesto: il muro premium lo mostra senza fingere un checkout.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!secretKey || !priceId) {
    return NextResponse.json(
      { error: "L'acquisto non e ancora attivo." },
      { status: 503 },
    );
  }

  const origin =
    req.headers.get("origin") ??
    process.env.NEXT_PUBLIC_APP_ORIGIN ??
    "https://journal-me-weld.vercel.app";

  try {
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.userId,
      customer_email: user.email ?? undefined,
      subscription_data: {
        metadata: { user_id: user.userId },
      },
      metadata: { user_id: user.userId },
      success_url: `${origin}/settings?upgraded=1`,
      cancel_url: `${origin}/`,
      locale: "it",
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Errore Stripe sconosciuto";
    return NextResponse.json(
      { error: `Checkout non disponibile: ${message}` },
      { status: 502 },
    );
  }
}
