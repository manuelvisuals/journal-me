import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireUser } from "@/lib/server/entitlement";

/**
 * Cancellazione dell'ACCOUNT, non solo dei dati (App Store 5.1.1(v),
 * PIANO-APPSTORE §1b): un'app che fa creare un account deve permettere di
 * eliminarlo DENTRO l'app. Qui si elimina l'utente Supabase con la chiave
 * admin: ogni tabella con user_id ha il vincolo `on delete cascade` verso
 * auth.users (verificato sulle migration 001-014), quindi giornate, fatti,
 * obiettivi, remembers, recap, consumi, profili e impostazioni spariscono
 * in cascata, senza un elenco a mano che domani dimentica una tabella.
 *
 * Autenticata come tutte le altre: si cancella solo l'account di chi
 * chiama, mai per id arbitrario. Se Stripe un giorno avra abbonamenti
 * attivi, la disdetta andra fatta PRIMA di arrivare qui (per ora il
 * checkout e spento in produzione).
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server non configurato" },
      { status: 500 },
    );
  }

  const { error } = await admin.auth.admin.deleteUser(user.userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
