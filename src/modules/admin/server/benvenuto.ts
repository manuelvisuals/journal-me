import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/server/entitlement";
import { requireAdmin } from "@/modules/admin/server/guardia";

/**
 * La rotta del pannello admin per il messaggio di benvenuto: legge e scrive
 * l'unica riga della tabella `benvenuto` (migration 018).
 *
 * CHI ENTRA: `requireAdmin` in server/guardia.ts.
 *
 * COME SI SCRIVE. La tabella non ha nessuna policy di scrittura: si scrive
 * SOLO da qui, col service role, che non esce mai verso il browser. La riga
 * e' una sola per sempre (`check (id = 1)`), quindi qui non c'e' nessuna
 * insert e nessuna delete: solo un update.
 *
 * PERCHE `mostraDiNuovo` E' UN CAMPO E NON UN'AZIONE A PARTE. Chi ha
 * spuntato "non mostrare piu" resta in silenzio, e in modalita' locale quel
 * silenzio non scade mai (li' non esiste nessun logout). Alzare `versione`
 * di uno e' cio' che fa cadere tutti i silenzi in una volta: il client si
 * ricorda l'ultima versione vista e, quando il numero cambia, riapre il
 * messaggio. Sta nello stesso salvataggio del testo perche' e' li' che
 * serve: si riscrive la lettera e si vuole che la leggano.
 *
 * LE IMMAGINI SONO data URL. Il client le manda gia' ritagliate e ridotte;
 * qui si controlla solo che siano immagini e che stiano sotto il tetto
 * dello schema (65536 caratteri). Un controllo lato client e' una comodita',
 * non una difesa.
 */

const TETTO_IMMAGINE = 65536;

const CAMPI_TESTO = [
  "occhiello",
  "promessa",
  "evidenza",
  "testo",
  "firma",
  "bottone",
  "contatto_riga",
  "contatto_url",
  "occhiello_en",
  "promessa_en",
  "evidenza_en",
  "testo_en",
  "firma_en",
  "bottone_en",
  "contatto_riga_en",
] as const;

const CAMPI_IMMAGINE = [
  "foto_data",
  "logo_tema_chiaro_data",
  "logo_tema_scuro_data",
] as const;

const COLONNE = [
  "attivo",
  "versione",
  ...CAMPI_TESTO,
  ...CAMPI_IMMAGINE,
].join(", ");

type Aggiornamento = Record<string, string | number | boolean | null>;

/** Un data URL di immagine, oppure null. Mai una stringa qualunque. */
function immagineValida(v: unknown): v is string {
  return (
    typeof v === "string" &&
    v.length <= TETTO_IMMAGINE &&
    /^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(v)
  );
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configurato" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("benvenuto")
    .select(COLONNE)
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Nessuna riga vuol dire migration non applicata: si dice, non si
  // inventa una riga vuota che poi il pannello salverebbe sopra il seed.
  if (!data) {
    return NextResponse.json(
      { error: "La migration 018 non e ancora stata applicata su questo database." },
      { status: 500 },
    );
  }
  return NextResponse.json({ benvenuto: data });
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

  const patch: Aggiornamento = { updated_at: new Date().toISOString() };

  for (const campo of CAMPI_TESTO) {
    const v = body[campo];
    if (v === undefined) continue;
    if (typeof v !== "string") {
      return NextResponse.json({ error: `Il campo ${campo} non e testo` }, { status: 400 });
    }
    patch[campo] = v.trim();
  }

  for (const campo of CAMPI_IMMAGINE) {
    const v = body[campo];
    if (v === undefined) continue;
    // null e' un valore vero: vuol dire "rimetti quella di fabbrica".
    if (v === null) {
      patch[campo] = null;
      continue;
    }
    if (!immagineValida(v)) {
      return NextResponse.json(
        { error: `L'immagine ${campo} non e valida o supera il limite di 48 KB` },
        { status: 400 },
      );
    }
    patch[campo] = v;
  }

  if (typeof body.attivo === "boolean") patch.attivo = body.attivo;

  // Un indirizzo che non e un indirizzo aprirebbe una scheda vuota in
  // faccia a chi ha appena letto "scrivimi".
  const url = typeof patch.contatto_url === "string" ? patch.contatto_url : "";
  if (url !== "" && !/^(https?:\/\/|mailto:)/i.test(url)) {
    return NextResponse.json(
      { error: "L'indirizzo deve cominciare con https:// oppure mailto:" },
      { status: 400 },
    );
  }

  // "Mostralo di nuovo a tutti": si legge la versione e la si alza di uno.
  // Non un numero mandato dal client: due salvataggi ravvicinati
  // scriverebbero lo stesso valore e uno dei due silenzi resterebbe in
  // piedi.
  if (body.mostraDiNuovo === true) {
    const { data: riga, error: erroreLettura } = await supabase
      .from("benvenuto")
      .select("versione")
      .eq("id", 1)
      .maybeSingle();
    if (erroreLettura) {
      return NextResponse.json({ error: erroreLettura.message }, { status: 500 });
    }
    const adesso = typeof riga?.versione === "number" ? riga.versione : 1;
    patch.versione = adesso + 1;
  }

  const { data, error } = await supabase
    .from("benvenuto")
    .update(patch)
    .eq("id", 1)
    .select(COLONNE)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "La migration 018 non e ancora stata applicata su questo database." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, benvenuto: data });
}
