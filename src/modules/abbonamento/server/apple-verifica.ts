import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireUser } from "@/lib/server/entitlement";
import {
  corpoNonVerificato,
  pianoDaTransazione,
  transazioneDaApple,
  type TransazioneApple,
  configurata,
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
 * PREMIUM VUOLE UN ACCOUNT (Manuel, 10 settembre 2026). Dal 4 settembre
 * questa route accettava anche il solo braccialetto e scriveva il premium
 * sul BRACCIALETTO (migration 025): si comprava senza email. Adesso no.
 * L'abbonamento vende la copia cifrata nel cloud e il diario su tutti i
 * dispositivi: senza un account non c'e dove metterlo, e chi paga si
 * ritroverebbe un premium legato a un telefono. Quindi qui serve il
 * gettone, e senza si risponde 401: e il client a mandare la persona al
 * login PRIMA di aprire il foglio di Apple, cosi non si prendono soldi per
 * una cosa che non si puo consegnare.
 *
 * Chi aveva gia comprato senza email non perde niente: la riga sul
 * braccialetto resta e adotta_braccialetto la sposta sul profilo al primo
 * accesso. E se ripristina da qui con l'account, il ramo qui sotto libera
 * quella riga e scrive il premium sul profilo.
 *
 * Il piano si scrive SOLO qui e nelle notifiche di Apple: mai dal client.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const userId = user.userId;

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

  // Senza la chiave di App Store Connect sul server non si chiede niente ad
  // Apple: lo si dice per quello che e (4 settembre 2026: le variabili non
  // erano su Vercel e la risposta era "Apple non conosce questa
  // transazione", una bugia sul motivo).
  if (!configurata() && !process.env.APPLE_API_BASE_URL) {
    return NextResponse.json(
      { error: "apple_non_configurato", messaggio: "Il server non e ancora collegato ad Apple. L'acquisto e al sicuro: riprova piu tardi." },
      { status: 503 },
    );
  }

  let t: TransazioneApple | null;
  try {
    t = await transazioneDaApple(transactionId);
  } catch (e) {
    return NextResponse.json({ error: `Apple non risponde: ${String((e as Error).message)}` }, { status: 502 });
  }
  if (!t) {
    return NextResponse.json({ error: "Apple non trova questa transazione." }, { status: 404 });
  }

  const piano = pianoDaTransazione(t);
  const originale = String(t.originalTransactionId);

  // La transazione e gia di qualcun altro (un profilo)?
  const { data: altro } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("apple_original_transaction_id", originale)
    .maybeSingle();
  if (altro && altro.user_id !== userId) {
    return NextResponse.json(
      { error: "abbonamento_di_altro_account", messaggio: "Questo abbonamento e legato a un altro account: entra con quello." },
      { status: 409 },
    );
  }

  const scadenza = typeof t.expiresDate === "number" ? new Date(t.expiresDate).toISOString() : null;
  const campi = {
    plan: piano,
    plan_source: "apple",
    apple_original_transaction_id: originale,
    apple_product_id: t.productId,
    apple_environment: t.environment ?? null,
    current_period_end: scadenza,
  };

  // La stessa transazione ferma su un braccialetto (comprata prima del 10
  // settembre 2026, quando si poteva comprare senza email): si libera, che
  // l'indice e unico, e il premium passa al profilo. E il ripristino di chi
  // aveva comprato da ospite e ora ha messo l'email.
  const { data: suBraccialetto } = await supabase
    .from("braccialetti")
    .select("id")
    .eq("apple_original_transaction_id", originale)
    .maybeSingle();

  if (suBraccialetto) {
    await supabase
      .from("braccialetti")
      .update({ plan: "free", plan_source: null, current_period_end: null, apple_original_transaction_id: null, apple_product_id: null, apple_environment: null })
      .eq("id", suBraccialetto.id);
  }
  const { error } = await supabase.from("profiles").upsert({ user_id: userId, ...campi }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    plan: piano,
    productId: t.productId,
    expiresAt: scadenza,
    environment: t.environment ?? null,
  });
}
