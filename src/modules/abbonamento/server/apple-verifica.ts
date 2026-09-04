import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireUser } from "@/lib/server/entitlement";
import { braccialettoDaSegreto, segretoDalla } from "@/lib/server/ospite";
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
 * SENZA ACCOUNT (4 settembre 2026, mockup premium-senza-password, B1):
 * l'ospite compra con il foglio di Apple e basta. Se non c'e un gettone ma
 * c'e il braccialetto (x-jm-braccialetto), il premium si scrive sul
 * BRACCIALETTO (migration 025). Quando la persona mettera una email,
 * adotta_braccialetto lo portera sull'account. Una transazione gia legata a
 * un profilo non torna su un braccialetto (409: e di un account, entra con
 * quello); una gia su un ALTRO braccialetto lo lascia (nuovo telefono
 * senza email, ripristino con lo stesso Apple ID): l'ultimo vince.
 *
 * Il piano si scrive SOLO qui e nelle notifiche di Apple: mai dal client.
 */
export async function POST(req: NextRequest) {
  const conGettone = (req.headers.get("authorization") ?? "").startsWith("Bearer ");
  let userId: string | null = null;
  if (conGettone) {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    userId = user.userId;
  }
  const segreto = segretoDalla(req);
  if (!userId && !segreto) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

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

  // La stessa transazione su un braccialetto: si libera (l'indice e unico).
  // Vale sia per l'ospite che cambia telefono, sia per l'ospite che ha
  // appena messo l'email e ripristina: da ora il premium sta sul profilo.
  const { data: suBraccialetto } = await supabase
    .from("braccialetti")
    .select("id")
    .eq("apple_original_transaction_id", originale)
    .maybeSingle();

  if (userId) {
    if (suBraccialetto) {
      await supabase
        .from("braccialetti")
        .update({ plan: "free", plan_source: null, current_period_end: null, apple_original_transaction_id: null, apple_product_id: null, apple_environment: null })
        .eq("id", suBraccialetto.id);
    }
    const { error } = await supabase.from("profiles").upsert({ user_id: userId, ...campi }, { onConflict: "user_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const braccialettoId = await braccialettoDaSegreto(segreto as string, null, { crea: true });
    if (!braccialettoId) return NextResponse.json({ error: "Cannot read braccialetti" }, { status: 500 });
    if (suBraccialetto && suBraccialetto.id !== braccialettoId) {
      await supabase
        .from("braccialetti")
        .update({ plan: "free", plan_source: null, current_period_end: null, apple_original_transaction_id: null, apple_product_id: null, apple_environment: null })
        .eq("id", suBraccialetto.id);
    }
    const { error } = await supabase.from("braccialetti").update(campi).eq("id", braccialettoId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    plan: piano,
    productId: t.productId,
    expiresAt: scadenza,
    environment: t.environment ?? null,
    // Dove e finito: "account" o "dispositivo" (il braccialetto).
    dove: userId ? "account" : "dispositivo",
  });
}
