import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireAdmin } from "@/lib/server/entitlement";

/**
 * Le richieste di assistenza che arrivano da dayalogue.com/support.
 *
 * POST e PUBBLICA: chi scrive non ha un account, e spesso scrive PROPRIO
 * perche non riesce ad averlo. Quindi qui non c'e nessun gate, e per la
 * stessa ragione tutto il resto e stretto:
 *
 *   - la tabella non ha nessuna policy (migration 019): si scrive solo da
 *     qui, col service role, che valida prima;
 *   - ogni campo ha un tetto, e i tetti sono anche nello schema: un limite
 *     che vive solo nel client non e un limite;
 *   - le immagini devono essere JPEG in data URL, al massimo tre, ognuna
 *     sotto i 400 KB di testo. Il browser le riduce gia (supporto.tsx);
 *     questo controllo esiste per chi non passa dal browser;
 *   - un tetto di richieste per indirizzo IP.
 *
 * IL TETTO PER IP E' UNA PORTA, NON UN MURO. Vive nella memoria
 * dell'istanza, e su Vercel le istanze sono piu di una: uno che ci tiene
 * davvero passa. Serve a fermare lo script distratto e il doppio click,
 * non un attacco: per quello servirebbe un contatore condiviso, cioe un
 * pezzo di infrastruttura che oggi non esiste e che non vale la pena
 * inventare per un modulo di assistenza. Detto qui perche chi legge non
 * creda di essere protetto piu di quanto sia.
 *
 * GET e per il pannello: la legge solo l'amministratore.
 */

const MAX_IMMAGINI = 3;
const MAX_BYTE_IMMAGINE = 400_000;
const TETTO_PER_IP = 5;
const FINESTRA_MS = 60 * 60 * 1000;

const visite = new Map<string, number[]>();

function troppeVolte(ip: string): boolean {
  const ora = Date.now();
  const precedenti = (visite.get(ip) ?? []).filter((t) => ora - t < FINESTRA_MS);
  precedenti.push(ora);
  visite.set(ip, precedenti);
  // La mappa non cresce all'infinito: quando e grande si buttano le voci
  // scadute. Senza questa riga un processo longevo terrebbe in memoria ogni
  // indirizzo mai visto.
  if (visite.size > 5000) {
    for (const [k, v] of visite) {
      if (v.every((t) => ora - t >= FINESTRA_MS)) visite.delete(k);
    }
  }
  return precedenti.length > TETTO_PER_IP;
}

function indirizzo(req: NextRequest): string {
  const inoltrato = req.headers.get("x-forwarded-for") ?? "";
  return inoltrato.split(",")[0]?.trim() || "sconosciuto";
}

function immagineValida(v: unknown): v is string {
  return (
    typeof v === "string" &&
    v.startsWith("data:image/jpeg;base64,") &&
    v.length <= MAX_BYTE_IMMAGINE
  );
}

function emailPlausibile(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

export async function POST(req: NextRequest) {
  if (troppeVolte(indirizzo(req))) {
    return NextResponse.json(
      { error: "Troppe richieste. Riprova fra un'ora." },
      { status: 429 },
    );
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase non configurato" },
      { status: 500 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const oggetto = typeof body.oggetto === "string" ? body.oggetto.trim() : "";
  const descrizione =
    typeof body.descrizione === "string" ? body.descrizione.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const lingua = body.lingua === "en" ? "en" : "it";

  if (oggetto.length < 3 || oggetto.length > 200) {
    return NextResponse.json({ error: "Oggetto non valido" }, { status: 400 });
  }
  if (descrizione.length < 10 || descrizione.length > 5000) {
    return NextResponse.json(
      { error: "Descrizione non valida" },
      { status: 400 },
    );
  }
  if (email.length > 320 || !emailPlausibile(email)) {
    return NextResponse.json({ error: "Email non valida" }, { status: 400 });
  }

  const grezze = Array.isArray(body.immagini) ? body.immagini : [];
  if (grezze.length > MAX_IMMAGINI || !grezze.every(immagineValida)) {
    return NextResponse.json({ error: "Immagini non valide" }, { status: 400 });
  }

  // Del contesto si tiene solo cio che serve a rispondere, e per un numero
  // fisso di chiavi: cosi il campo non diventa un imbuto dove il client puo
  // infilare qualunque cosa.
  const c = (body.contesto ?? {}) as Record<string, unknown>;
  const stringa = (v: unknown, max: number) =>
    typeof v === "string" ? v.slice(0, max) : "";
  const contesto = {
    ua: stringa(c.ua, 400),
    schermo: stringa(c.schermo, 40),
    lingua_browser: stringa(c.lingua_browser, 20),
  };

  const { error } = await supabase.from("supporto").insert({
    oggetto,
    descrizione,
    email,
    lingua,
    immagini: grezze,
    contesto,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
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

  // Le immagini NON entrano nell'elenco: sono la parte pesante, e il
  // pannello ne mostra solo il numero. Si aprono una richiesta alla volta.
  const { data, error } = await supabase
    .from("supporto")
    .select("id, creata_il, oggetto, descrizione, email, lingua, stato, contesto, immagini")
    .order("creata_il", { ascending: false })
    .limit(100);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const righe = (data ?? []).map((r) => {
    const { immagini, ...resto } = r as Record<string, unknown> & {
      immagini: unknown;
    };
    return { ...resto, quante_immagini: Array.isArray(immagini) ? immagini.length : 0 };
  });

  return NextResponse.json({ richieste: righe });
}
