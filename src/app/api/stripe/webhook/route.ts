import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getAdminClient } from "@/lib/server/entitlement";

/**
 * Il webhook Stripe: l'UNICO posto che scrive profiles.plan (PR 11).
 *
 * - La firma si verifica sul body GREZZO (req.text()) con
 *   STRIPE_WEBHOOK_SECRET: senza firma valida, 400 e basta.
 * - L'utente si trova cosi: metadata.user_id / client_reference_id messi
 *   dal checkout; per gli eventi successivi (rinnovi, cancellazioni) vale
 *   stripe_customer_id salvato in profiles (migration 008).
 * - Idempotente: scrivere due volte lo stesso stato non fa danni.
 * - Risponde sempre in fretta: Stripe ritenta sui non-2xx.
 */

function planFromStatus(status: Stripe.Subscription.Status): "premium" | "free" {
  return status === "active" || status === "trialing" || status === "past_due"
    ? "premium"
    : "free";
}

function periodEndISO(sub: Stripe.Subscription): string | null {
  const epoch = sub.items.data[0]?.current_period_end;
  return typeof epoch === "number" ? new Date(epoch * 1000).toISOString() : null;
}

export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe non configurato" },
      { status: 503 },
    );
  }
  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase non configurato" },
      { status: 500 },
    );
  }

  const stripe = new Stripe(secretKey);
  const signature = req.headers.get("stripe-signature") ?? "";
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
    );
  } catch {
    return NextResponse.json({ error: "Firma non valida" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId =
          session.metadata?.user_id ?? session.client_reference_id ?? null;
        if (!userId) break;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id ?? null;
        let periodEnd: string | null = null;
        if (typeof session.subscription === "string") {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          periodEnd = periodEndISO(sub);
        }
        await supabase
          .from("profiles")
          .update({
            plan: "premium",
            plan_source: "stripe",
            stripe_customer_id: customerId,
            current_period_end: periodEnd,
          })
          .eq("user_id", userId);
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const plan =
          event.type === "customer.subscription.deleted"
            ? "free"
            : planFromStatus(sub.status);
        const patch = {
          plan,
          plan_source: "stripe",
          current_period_end: plan === "premium" ? periodEndISO(sub) : null,
        };
        const userId = sub.metadata?.user_id ?? null;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        if (userId) {
          await supabase.from("profiles").update(patch).eq("user_id", userId);
        } else {
          await supabase
            .from("profiles")
            .update(patch)
            .eq("stripe_customer_id", customerId);
        }
        break;
      }

      default:
        // Eventi non gestiti: 200 e via, Stripe non deve ritentare.
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "errore sconosciuto";
    // Non-2xx: Stripe ritentera — giusto per un errore transitorio di DB.
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
