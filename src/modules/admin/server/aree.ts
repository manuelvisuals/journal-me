import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/server/entitlement";
import { dimenticaAree } from "@/lib/server/aree";
import { requireAdmin } from "@/modules/admin/server/guardia";

/**
 * La rotta del pannello admin: legge e scrive la tabella `aree`.
 *
 * CHI ENTRA: lo decide `requireAdmin` in server/guardia.ts, la stessa
 * guardia di tutte le rotte del pannello.
 *
 * COME SI SCRIVE. La tabella non ha nessuna policy di scrittura (migration
 * 015): si scrive SOLO da qui, col service role (getAdminClient), che non
 * esce mai verso il browser.
 *
 * COSA NON SI PUO FARE, per contratto:
 *   - cambiare una chiave: e l'identita scritta dentro le giornate salvate.
 *     L'upsert lavora PER chiave, quindi "rinominare la chiave" qui non
 *     esiste come operazione;
 *   - cancellare: un'area si spegne (attiva=false), non si cancella. Questa
 *     rotta non ha DELETE di proposito.
 */

/** Una riga come viaggia fra pannello e database: i nomi della tabella. */
type RigaArea = {
  chiave: string;
  nome: string;
  nome_en: string;
  cosa_ci_va: string;
  ordine: number;
  icona: string | null;
  attiva: boolean;
};

function rigaValida(r: unknown): r is RigaArea {
  if (!r || typeof r !== "object") return false;
  const x = r as Record<string, unknown>;
  return (
    typeof x.chiave === "string" &&
    x.chiave.trim() !== "" &&
    typeof x.nome === "string" &&
    x.nome.trim() !== "" &&
    typeof x.nome_en === "string" &&
    x.nome_en.trim() !== "" &&
    typeof x.cosa_ci_va === "string" &&
    typeof x.ordine === "number" &&
    Number.isFinite(x.ordine) &&
    (x.icona === null || typeof x.icona === "string") &&
    typeof x.attiva === "boolean"
  );
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase non configurato" },
      { status: 500 },
    );
  }

  const { data, error } = await supabase
    .from("aree")
    .select("chiave, nome, nome_en, cosa_ci_va, ordine, icona, attiva")
    .order("ordine", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ aree: data ?? [] });
}

export async function PUT(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase non configurato" },
      { status: 500 },
    );
  }

  let body: { aree?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const grezze = Array.isArray(body.aree) ? body.aree : null;
  if (!grezze || grezze.length === 0) {
    // Zero aree non e uno stato che questo pannello possa produrre di
    // proposito: sarebbe un diario senza nessuna casella.
    return NextResponse.json(
      { error: "Serve un elenco di aree non vuoto" },
      { status: 400 },
    );
  }
  if (!grezze.every(rigaValida)) {
    return NextResponse.json(
      { error: "Una o piu righe non hanno la forma giusta" },
      { status: 400 },
    );
  }

  const righe = grezze.map((r) => ({
    chiave: r.chiave.trim(),
    nome: r.nome.trim(),
    nome_en: r.nome_en.trim(),
    cosa_ci_va: r.cosa_ci_va.trim(),
    ordine: r.ordine,
    icona: r.icona === null || r.icona.trim() === "" ? null : r.icona.trim(),
    attiva: r.attiva,
    updated_at: new Date().toISOString(),
  }));

  const chiavi = new Set(righe.map((r) => r.chiave));
  if (chiavi.size !== righe.length) {
    return NextResponse.json(
      { error: "Due righe hanno la stessa chiave" },
      { status: 400 },
    );
  }

  // Upsert per chiave: le righe nuove nascono, quelle esistenti si
  // aggiornano nei soli campi mutabili. Niente viene mai cancellato.
  const { error } = await supabase
    .from("aree")
    .upsert(righe, { onConflict: "chiave" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // La cache del server dura un minuto: svuotarla adesso vuol dire che la
  // PROSSIMA giornata raccontata vede gia le aree nuove.
  dimenticaAree();

  return NextResponse.json({ ok: true, salvate: righe.length });
}
