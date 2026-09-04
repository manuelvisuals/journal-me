import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/server/entitlement";
import {
  corpoNonVerificato,
  pianoDaTransazione,
  transazioneDaApple,
  type TransazioneApple,
} from "@/modules/abbonamento/server/apple-api";

/**
 * POST /api/apple/notifiche  (App Store Server Notifications, versione 2)
 *
 * Apple avvisa di rinnovi, disdette, scadenze, rimborsi, problemi di
 * pagamento. Il piano resta giusto anche con l'app chiusa: e il gemello del
 * webhook Stripe.
 *
 * Fiducia: il corpo che Apple manda e un JWS; qui NON lo si verifica in
 * casa (vedi apple-api.ts): se ne legge l'id della transazione e si
 * richiede la transazione ad Apple. Cio che Apple risponde in TLS decide il
 * piano. Chi mandasse una notifica finta otterrebbe solo che il server
 * rilegga la verita da Apple.
 *
 * Idempotenza: ogni notifica ha un UUID; si registra in `apple_notifiche`
 * (migration 024) e la stessa consegnata due volte non si applica due
 * volte. Si risponde SEMPRE 200 quando la notifica e leggibile: con un
 * errore Apple riprova per ore, e un profilo non trovato non e una cosa
 * che riprovare risolve.
 */

type Avviso = {
  notificationType?: string;
  subtype?: string;
  notificationUUID?: string;
  data?: {
    environment?: string;
    bundleId?: string;
    signedTransactionInfo?: string;
    signedRenewalInfo?: string;
  };
};

export async function POST(req: NextRequest) {
  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configurato" }, { status: 500 });
  }

  let body: { signedPayload?: string };
  try {
    body = (await req.json()) as { signedPayload?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const avviso = typeof body.signedPayload === "string" ? corpoNonVerificato<Avviso>(body.signedPayload) : null;
  if (!avviso || !avviso.notificationUUID || !avviso.notificationType) {
    return NextResponse.json({ error: "notifica non leggibile" }, { status: 400 });
  }

  const dentro = avviso.data?.signedTransactionInfo
    ? corpoNonVerificato<TransazioneApple>(avviso.data.signedTransactionInfo)
    : null;
  const transactionId = dentro?.transactionId ? String(dentro.transactionId) : "";
  const originaleDichiarato = dentro?.originalTransactionId ? String(dentro.originalTransactionId) : null;

  // Registro: se c'e gia, e un doppione.
  const { error: errIns } = await supabase.from("apple_notifiche").insert({
    notification_uuid: avviso.notificationUUID,
    tipo: avviso.notificationType,
    sottotipo: avviso.subtype ?? null,
    original_transaction_id: originaleDichiarato,
    ambiente: avviso.data?.environment ?? null,
  });
  if (errIns) {
    if (errIns.code === "23505") return NextResponse.json({ ok: true, doppione: true });
    return NextResponse.json({ error: errIns.message }, { status: 500 });
  }

  const segna = async (esito: string, applicata: boolean, userId: string | null = null) => {
    await supabase
      .from("apple_notifiche")
      .update({ esito, applicata, user_id: userId })
      .eq("notification_uuid", avviso.notificationUUID);
  };

  if (!/^\d{1,30}$/.test(transactionId)) {
    await segna("senza transazione", false);
    return NextResponse.json({ ok: true, applicata: false });
  }

  let t: TransazioneApple | null;
  try {
    t = await transazioneDaApple(transactionId);
  } catch (e) {
    await segna(`Apple non risponde: ${String((e as Error).message)}`, false);
    // Qui SI vale la pena che Apple riprovi: era un nostro problema di rete.
    return NextResponse.json({ error: "Apple non risponde" }, { status: 503 });
  }
  if (!t) {
    await segna("Apple non conosce la transazione", false);
    return NextResponse.json({ ok: true, applicata: false });
  }

  const originale = String(t.originalTransactionId);
  const piano = pianoDaTransazione(t);
  const scadenza = typeof t.expiresDate === "number" ? new Date(t.expiresDate).toISOString() : null;
  const patch = {
    plan: piano,
    plan_source: "apple",
    apple_product_id: t.productId,
    apple_environment: t.environment ?? null,
    current_period_end: scadenza,
    apple_ultimo_avviso: `${avviso.notificationType}${avviso.subtype ? "/" + avviso.subtype : ""}`,
  };

  // Chi tiene questo abbonamento: un profilo (con email) o un braccialetto
  // (comprato senza email, migration 025).
  const { data: profilo } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("apple_original_transaction_id", originale)
    .maybeSingle();
  if (profilo) {
    const { error } = await supabase.from("profiles").update(patch).eq("user_id", profilo.user_id);
    if (error) {
      await segna(error.message, false, profilo.user_id as string);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await segna(`piano ${piano}`, true, profilo.user_id as string);
    return NextResponse.json({ ok: true, applicata: true, plan: piano });
  }

  const { data: braccialetto } = await supabase
    .from("braccialetti")
    .select("id")
    .eq("apple_original_transaction_id", originale)
    .maybeSingle();
  if (braccialetto) {
    const { error } = await supabase.from("braccialetti").update(patch).eq("id", braccialetto.id);
    if (error) {
      await segna(error.message, false);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await segna(`piano ${piano} (braccialetto)`, true);
    return NextResponse.json({ ok: true, applicata: true, plan: piano, dove: "dispositivo" });
  }

  // Comprato ma mai passato da /api/apple/verifica (l'app si e chiusa
  // prima): al prossimo avvio l'app rimanda la transazione non finita.
  await segna("nessun profilo ne braccialetto con questa transazione", false);
  return NextResponse.json({ ok: true, applicata: false });
}
