import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireAdmin } from "@/lib/server/entitlement";
import { dimenticaRegalo } from "@/lib/server/regalo";
import { regaloDaRiga } from "@/lib/regalo";

/**
 * La voce "Regalo AI" del pannello (SPEC R4; mockup ospite-primo-avvio.html,
 * schermata 05, in attesa dell'ok): l'interruttore, le giornate per
 * ospite, il tetto mensile, e quanto e stato speso questo mese. Si cambia
 * qui e vale subito: la guardia rilegge la tabella entro mezzo minuto
 * (dimenticaRegalo() azzera la cache di questo processo).
 *
 * Lo SPESO non e un campo della tabella: e la somma di ai_usage del mese
 * (funzione SQL riassunto_regalo_mese), leggibile solo col service role.
 * La tabella `regalo` e pubblica in lettura e contiene solo i limiti.
 */

const COLONNE = "attivo, giornate_per_ospite, tetto_mensile_eur, cambio_usd_eur, updated_at";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configurato" }, { status: 500 });
  }

  const { data, error } = await supabase.from("regalo").select(COLONNE).eq("id", 1).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    return NextResponse.json(
      { error: "La migration 023 non e ancora stata applicata su questo database." },
      { status: 500 },
    );
  }
  const regalo = regaloDaRiga(data as Record<string, unknown>);

  const { data: riassunto } = await supabase.rpc("riassunto_regalo_mese");
  const r = (riassunto ?? {}) as { speso_usd?: number | string; ospiti?: number; giornate?: number };
  const spesoUsd = Number(r.speso_usd ?? 0) || 0;

  return NextResponse.json({
    regalo,
    updatedAt: (data as { updated_at?: string }).updated_at ?? null,
    mese: {
      spesoUsd,
      spesoEur: regalo ? spesoUsd * regalo.cambioUsdEur : spesoUsd,
      ospiti: Number(r.ospiti ?? 0) || 0,
      giornate: Number(r.giornate ?? 0) || 0,
    },
  });
}

export async function PUT(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configurato" }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Record<string, string | number | boolean> = { updated_at: new Date().toISOString() };

  if (body.attivo !== undefined) {
    if (typeof body.attivo !== "boolean") {
      return NextResponse.json({ error: "attivo deve essere vero o falso" }, { status: 400 });
    }
    patch.attivo = body.attivo;
  }
  if (body.giornate_per_ospite !== undefined) {
    const n = Number(body.giornate_per_ospite);
    if (!Number.isInteger(n) || n < 0 || n > 1000) {
      return NextResponse.json({ error: "giornate_per_ospite: un intero fra 0 e 1000" }, { status: 400 });
    }
    patch.giornate_per_ospite = n;
  }
  if (body.tetto_mensile_eur !== undefined) {
    const n = Number(body.tetto_mensile_eur);
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
      return NextResponse.json({ error: "tetto_mensile_eur: un numero fra 0 e 1000000" }, { status: 400 });
    }
    patch.tetto_mensile_eur = n;
  }
  if (body.cambio_usd_eur !== undefined) {
    const n = Number(body.cambio_usd_eur);
    if (!Number.isFinite(n) || n <= 0 || n > 10) {
      return NextResponse.json({ error: "cambio_usd_eur: un numero fra 0 e 10" }, { status: 400 });
    }
    patch.cambio_usd_eur = n;
  }

  const { data, error } = await supabase
    .from("regalo")
    .update(patch)
    .eq("id", 1)
    .select(COLONNE)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  dimenticaRegalo();
  return NextResponse.json({ regalo: regaloDaRiga((data ?? null) as Record<string, unknown> | null) });
}
