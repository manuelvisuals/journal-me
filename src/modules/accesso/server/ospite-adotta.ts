import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireUser } from "@/lib/server/entitlement";
import { braccialettoDaSegreto, segretoDalla } from "@/lib/server/ospite";

/**
 * POST /api/ospite/adotta: l'ospite ha messo l'email. Il braccialetto del
 * telefono si lega all'account e, se porta un premium comprato senza
 * email (migration 025), il premium PASSA al profilo: da ora vale sul web
 * e su ogni dispositivo dell'account. La regola vive nella funzione SQL
 * adotta_braccialetto, in una transazione. Lo chiama il cancello
 * (auth-gate) una volta, al primo ingresso con la sessione.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const segreto = segretoDalla(req);
  if (!segreto) return NextResponse.json({ esito: "senza_braccialetto" });
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase non configurato" }, { status: 500 });
  const id = await braccialettoDaSegreto(segreto, user.userId, { crea: true });
  if (!id) return NextResponse.json({ error: "Cannot read braccialetti" }, { status: 500 });
  const { data, error } = await admin.rpc("adotta_braccialetto", {
    p_braccialetto_id: id,
    p_user_id: user.userId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { esito: "legato" });
}
