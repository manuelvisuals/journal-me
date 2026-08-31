import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireAdmin } from "@/lib/server/entitlement";
import { dimenticaSeo } from "@/modules/sito/server/seo";
import { PAGINE, type PaginaSito } from "@/modules/sito/seo";

/**
 * La rotta del pannello SEO: legge e scrive `sito_seo`.
 *
 * Stesse tre regole della rotta delle Aree, e per gli stessi motivi:
 *   - chi non e l'amministratore riceve 404, non 403 (requireAdmin);
 *   - la tabella non ha policy di scrittura, quindi si scrive solo da qui
 *     col service role, che non esce mai verso il browser;
 *   - la `pagina` e una chiave chiusa: si aggiorna una riga esistente, non
 *     si inventano pagine dal pannello. Una pagina nuova nasce quando
 *     nasce il suo file, non quando qualcuno scrive una parola in un campo.
 */

const CAMPI =
  "pagina,titolo_it,descrizione_it,titolo_en,descrizione_en,og_titolo_it,og_titolo_en,og_immagine,indicizzabile";

/** Il corpo accettato dal PUT: una riga sola, quella della pagina indicata. */
type CorpoSeo = {
  pagina: PaginaSito;
  titolo_it: string;
  descrizione_it: string;
  titolo_en: string;
  descrizione_en: string;
  og_titolo_it: string;
  og_titolo_en: string;
  og_immagine: string | null;
  indicizzabile: boolean;
};

/** Tetto sui testi: lo stesso numero che il pannello mostra come limite. */
const TETTI: Record<string, number> = {
  titolo_it: 200,
  titolo_en: 200,
  descrizione_it: 500,
  descrizione_en: 500,
  og_titolo_it: 200,
  og_titolo_en: 200,
};

function corpoValido(x: unknown): x is CorpoSeo {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  if (typeof r.pagina !== "string") return false;
  if (!PAGINE.includes(r.pagina as PaginaSito)) return false;
  for (const [campo, tetto] of Object.entries(TETTI)) {
    const v = r[campo];
    if (typeof v !== "string" || v.length > tetto) return false;
  }
  if (r.og_immagine !== null && typeof r.og_immagine !== "string") return false;
  if (typeof r.indicizzabile !== "boolean") return false;
  return true;
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
    .from("sito_seo")
    .select(CAMPI)
    .order("pagina", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ seo: data ?? [] });
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!corpoValido(body)) {
    return NextResponse.json(
      { error: "La riga non ha la forma giusta, oppure un testo e troppo lungo" },
      { status: 400 },
    );
  }

  // Update e non upsert: la riga della pagina esiste dalla migration 019.
  // Se non esiste, e un problema di migrazioni e va detto, non nascosto
  // creando una riga che nessuna pagina leggera mai.
  const { data, error } = await supabase
    .from("sito_seo")
    .update({
      titolo_it: body.titolo_it.trim(),
      descrizione_it: body.descrizione_it.trim(),
      titolo_en: body.titolo_en.trim(),
      descrizione_en: body.descrizione_en.trim(),
      og_titolo_it: body.og_titolo_it.trim(),
      og_titolo_en: body.og_titolo_en.trim(),
      og_immagine:
        body.og_immagine && body.og_immagine.trim() !== ""
          ? body.og_immagine.trim()
          : null,
      indicizzabile: body.indicizzabile,
      updated_at: new Date().toISOString(),
    })
    .eq("pagina", body.pagina)
    .select("pagina");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: `La pagina "${body.pagina}" non esiste nella tabella sito_seo` },
      { status: 404 },
    );
  }

  // La cache del sito dura mezzo minuto: svuotarla adesso vuol dire che il
  // prossimo caricamento della home mostra gia il titolo nuovo.
  dimenticaSeo();

  return NextResponse.json({ ok: true });
}
