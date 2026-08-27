import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireUser } from "@/lib/server/entitlement";
import { PREMIUM_IOS_V1_GRATIS } from "@/lib/pricing";

/**
 * Il premium gratis della v1 iOS (vedi PREMIUM_IOS_V1_GRATIS in
 * src/lib/pricing.ts: la decisione e spiegata li, in un posto solo).
 *
 * Somiglia al pagamento finto (dev-checkout) ma NON e lui: qui non c'e
 * elenco di email autorizzate, perche la decisione di Manuel e che nella
 * v1 CHIUNQUE tocchi "inizia premium" sulla card Premium diventi premium.
 * Le differenze deliberate:
 *
 *  - `plan_source = 'ios-v1'` (non 'dev'): nel database questi account si
 *    riconoscono a colpo d'occhio, e quando arrivera l'acquisto vero si
 *    sapra esattamente chi convertire;
 *  - va solo in AVANTI (free -> premium): non esiste la strada inversa,
 *    che e roba da ambiente di prova;
 *  - NON tocca chi e gia premium: un abbonamento Stripe vero non deve
 *    farsi riscrivere il `plan_source` da un tocco su questa card.
 *
 * Quando l'acquisto vero (IAP) arrivera: PREMIUM_IOS_V1_GRATIS a false e
 * questa rotta risponde 404, come se non fosse mai esistita.
 */
export async function POST(req: NextRequest) {
  if (!PREMIUM_IOS_V1_GRATIS) {
    return new NextResponse(null, { status: 404 });
  }

  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server non configurato (env Supabase mancanti)" },
      { status: 500 },
    );
  }

  const { data: profile, error: readErr } = await supabase
    .from("profiles")
    .select("plan")
    .eq("user_id", user.userId)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }

  // Gia premium (Stripe, manuale o un giro precedente di questa rotta):
  // non si scrive niente, la provenienza vera resta quella che era.
  if (profile?.plan === "premium") {
    return NextResponse.json({ plan: "premium" });
  }

  // Upsert e non update: la riga la crea un trigger alla nascita
  // dell'utente (006_profiles.sql), ma se per qualunque ragione manca, un
  // update muto su zero righe lascerebbe l'utente free SENZA dirglielo.
  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: user.userId,
      plan: "premium",
      plan_source: "ios-v1",
      // Nessuna scadenza: non c'e nessun abbonamento dietro (per ora).
      current_period_end: null,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return NextResponse.json(
      { error: `Non sono riuscito a cambiare il piano: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ plan: "premium" });
}
