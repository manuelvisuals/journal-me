import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireUser } from "@/lib/server/entitlement";
import {
  corpoNonVerificato,
  pianoDaTransazione,
  transazioneDaApple,
  type TransazioneApple,
} from "@/modules/abbonamento/server/apple-api";

/**
 * POST /api/apple/verifica  { jws }  oppure  { transactionId }
 *
 * Il telefono ha comprato (o ripristinato) e manda la transazione. Qui:
 *   1. si legge dal JWS l'id della transazione, SENZA fidarsi;
 *   2. si chiede ad Apple quella transazione (apple-api.ts): e la verita;
 *   3. se e nostra, non revocata e non scaduta, l'account che ha fatto la
 *      chiamata diventa premium con plan_source 'apple', la transazione
 *      originale (l'identita dell'abbonamento presso Apple) e la scadenza.
 *
 * Una transazione originale appartiene a UN account: se e gia legata a un
 * altro (chi ripristina con un account diverso da quello con cui ha
 * comprato) si risponde 409 e si dice quale strada c'e: entrare con quello.
 *
 * Il piano si scrive SOLO qui e nelle notifiche di Apple: mai dal client.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configurato" }, { status: 500 });
  }

  let body: { jws?: string; transactionId?: string };
  try {
    body = (await req.json()) as { jws?: string; transactionId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let transactionId = typeof body.transactionId === "string" ? body.transactionId.trim() : "";
  if (!transactionId && typeof body.jws === "string") {
    const t = corpoNonVerificato<TransazioneApple>(body.jws);
    transactionId = t?.transactionId ? String(t.transactionId) : "";
  }
  if (!/^\d{1,30}$/.test(transactionId)) {
    return NextResponse.json({ error: "transactionId mancante" }, { status: 400 });
  }

  let t: TransazioneApple | null;
  try {
    t = await transazioneDaApple(transactionId);
  } catch (e) {
    return NextResponse.json({ error: `Apple non risponde: ${String((e as Error).message)}` }, { status: 502 });
  }
  if (!t) {
    return NextResponse.json({ error: "Apple non conosce questa transazione" }, { status: 404 });
  }

  const piano = pianoDaTransazione(t);
  const originale = String(t.originalTransactionId);

  // La transazione e gia di qualcun altro?
  const { data: altro } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("apple_original_transaction_id", originale)
    .maybeSingle();
  if (altro && altro.user_id !== user.userId) {
    return NextResponse.json(
      { error: "abbonamento_di_altro_account", messaggio: "Questo abbonamento e legato a un altro account: entra con quello." },
      { status: 409 },
    );
  }

  const scadenza = typeof t.expiresDate === "number" ? new Date(t.expiresDate).toISOString() : null;
  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: user.userId,
      plan: piano,
      plan_source: "apple",
      apple_original_transaction_id: originale,
      apple_product_id: t.productId,
      apple_environment: t.environment ?? null,
      current_period_end: scadenza,
    },
    { onConflict: "user_id" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    plan: piano,
    productId: t.productId,
    expiresAt: scadenza,
    environment: t.environment ?? null,
  });
}
