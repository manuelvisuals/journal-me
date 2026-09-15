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
 *   3. se e nostra, non revocata e non scaduta, chi ha fatto la chiamata
 *      diventa premium con plan_source 'apple', la transazione originale
 *      (l'identita dell'abbonamento presso Apple) e la scadenza.
 *
 * COMPRARE SENZA ACCOUNT (Apple, bocciatura del 14 settembre 2026, linea
 * guida 5.1.1(v); decisione di Manuel del 15 settembre). Dal 10 settembre
 * questa route voleva il gettone: "premium vende il cloud, e il cloud vuole
 * un account". Apple ha risposto prima che glielo dicessimo: un acquisto
 * in-app che non e legato a un account non puo pretendere una
 * registrazione, e l'obbligo di rendere l'abbonamento disponibile su tutti
 * i dispositivi NON autorizza a imporla. Quindi:
 *
 *   - con il gettone, il premium si scrive sul PROFILO (come sempre);
 *   - senza gettone ma con il braccialetto (x-jm-braccialetto), il premium
 *     si scrive sulla riga di `braccialetti` (migration 025: le colonne ci
 *     sono ancora). Il braccialetto DEVE gia esistere: dal 10 settembre
 *     (DeviceCheck) nasce solo da registraBraccialetto, al primo avvio,
 *     quindi qui non si crea niente e un braccialetto sconosciuto e un 401.
 *     Quando la persona mettera una email, adotta_braccialetto (migration
 *     025) portera il premium sul profilo.
 *
 * Due regole ferme, in entrambe le strade:
 *   - una transazione originale gia legata a un PROFILO non torna su un
 *     braccialetto ne su un altro profilo: 409, "entra con quell'account";
 *   - una gia su un ALTRO braccialetto lo lascia (stesso Apple ID, telefono
 *     nuovo senza email, ripristino): l'ultimo vince, l'indice e unico.
 *
 * La risposta dice `dove` e finito: "account" o "dispositivo".
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
  // Vale per l'ospite che cambia telefono e per l'ospite che ha appena
  // messo l'email e ripristina: da quel momento il premium sta sul profilo.
  const { data: suBraccialetto } = await supabase
    .from("braccialetti")
    .select("id")
    .eq("apple_original_transaction_id", originale)
    .maybeSingle();
  const rigaLibera = {
    plan: "free",
    plan_source: null,
    current_period_end: null,
    apple_original_transaction_id: null,
    apple_product_id: null,
    apple_environment: null,
  };

  if (userId) {
    if (suBraccialetto) {
      await supabase.from("braccialetti").update(rigaLibera).eq("id", suBraccialetto.id);
    }
    const { error } = await supabase.from("profiles").upsert({ user_id: userId, ...campi }, { onConflict: "user_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    // Senza gettone: il braccialetto deve esistere gia (nasce con
    // DeviceCheck al primo avvio, mai qui).
    const braccialettoId = await braccialettoDaSegreto(segreto as string, null, { crea: false });
    if (!braccialettoId) {
      return NextResponse.json(
        { error: "braccialetto_sconosciuto", messaggio: "Questo dispositivo non e ancora registrato: riapri l'app e riprova." },
        { status: 401 },
      );
    }
    if (suBraccialetto && suBraccialetto.id !== braccialettoId) {
      await supabase.from("braccialetti").update(rigaLibera).eq("id", suBraccialetto.id);
    }
    const { error } = await supabase.from("braccialetti").update(campi).eq("id", braccialettoId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    plan: piano,
    productId: t.productId,
    expiresAt: scadenza,
    environment: t.environment ?? null,
    // Dove e finito: "account" (il profilo) o "dispositivo" (il braccialetto).
    dove: userId ? "account" : "dispositivo",
  });
}
