import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireAdmin } from "@/lib/server/entitlement";
import { recensioneDaRiga } from "@/lib/recensione-contract";
import { dimenticaRecensione } from "@/lib/server/recensione";

/**
 * La voce "Recensione" del pannello (13 settembre 2026; mockup
 * design/mockups/admin-iscritti.html, sezione 04): l'interruttore, le
 * giornate minime, e il contatore delle richieste (da sempre, questo mese,
 * l'ultima). Si cambia qui e vale per tutte le app installate entro mezzo
 * minuto (dimenticaRecensione() azzera la cache).
 */

const COLONNE = "attiva, giornate_minime, updated_at";

function inizioMeseUtc(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Supabase non configurato" }, { status: 500 });

  const { data, error } = await supabase.from("recensione").select(COLONNE).eq("id", 1).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    return NextResponse.json({ error: "La migration 030 non e ancora stata applicata su questo database." }, { status: 500 });
  }
  const recensione = recensioneDaRiga(data as Record<string, unknown>);

  const [tutte, mese, ultima] = await Promise.all([
    supabase.from("recensione_richieste").select("id", { count: "exact", head: true }),
    supabase.from("recensione_richieste").select("id", { count: "exact", head: true }).gte("creato_il", inizioMeseUtc()),
    supabase.from("recensione_richieste").select("creato_il").order("creato_il", { ascending: false }).limit(1).maybeSingle(),
  ]);

  return NextResponse.json({
    recensione,
    updatedAt: (data as { updated_at?: string }).updated_at ?? null,
    richieste: {
      totali: tutte.count ?? 0,
      mese: mese.count ?? 0,
      ultima: (ultima.data as { creato_il?: string } | null)?.creato_il ?? null,
    },
  });
}

export async function PUT(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Supabase non configurato" }, { status: 500 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const patch: Record<string, string | number | boolean> = { updated_at: new Date().toISOString() };
  if (body.attiva !== undefined) {
    if (typeof body.attiva !== "boolean") return NextResponse.json({ error: "attiva deve essere vero o falso" }, { status: 400 });
    patch.attiva = body.attiva;
  }
  if (body.giornate_minime !== undefined) {
    const n = Number(body.giornate_minime);
    if (!Number.isInteger(n) || n < 0 || n > 1000) return NextResponse.json({ error: "giornate_minime: un intero fra 0 e 1000" }, { status: 400 });
    patch.giornate_minime = n;
  }
  const { data, error } = await supabase.from("recensione").update(patch).eq("id", 1).select(COLONNE).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  dimenticaRecensione();
  return NextResponse.json({ recensione: recensioneDaRiga((data ?? null) as Record<string, unknown> | null) });
}
