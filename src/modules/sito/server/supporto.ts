import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireAdmin } from "@/lib/server/entitlement";
import {
  CAMPO_ESCA,
  MAX_BYTE_IMMAGINE,
  MAX_IMMAGINI,
  contestoPulito,
  setaccio,
} from "@/modules/sito/supporto-regole";
import { notificaSupporto } from "@/modules/sito/server/posta-supporto";

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
 *   - due trappole per i robot che non costano un clic a nessuno (campo
 *     esca e orologio), in `supporto-regole.ts` perche le legge anche il
 *     modulo nel browser;
 *   - un tetto di richieste per indirizzo IP.
 *
 * DAL 13 SETTEMBRE 2026 IL MESSAGGIO AVVISA ANCHE PER EMAIL. L'ordine e
 * quello e non si inverte: prima si SALVA, poi si prova a mandare. Se la
 * posta non parte il messaggio esiste comunque, e l'anomalia si legge nei
 * log; se si invertisse, una chiave scaduta farebbe sparire le
 * segnalazioni. Per questo la risposta e "ok" anche quando l'email
 * fallisce: chi ha scritto non puo farci niente, e scoraggiarlo non aiuta
 * nessuno.
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

  // Le trappole PRIMA di tutto il resto: un robot non arriva nemmeno a
  // farsi validare i campi, e non consuma una query.
  const verdetto = setaccio({
    esca: body[CAMPO_ESCA],
    msDaApertura: body.msDaApertura,
  });
  if (!verdetto.ok) {
    // Niente contenuto nel log: sarebbe scrivere lo spam nei nostri registri.
    console.warn("[supporto] scartato:", verdetto.perche);
    // Si risponde "grazie" lo stesso: vedi il commento in supporto-regole.ts.
    return NextResponse.json({ ok: true });
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

  const contesto = contestoPulito(body.contesto);

  // L'id torna indietro perche finisce nell'email come riferimento: e cio
  // che lega la riga in tabella al messaggio che Manuel sta leggendo.
  const { data, error } = await supabase
    .from("supporto")
    .insert({
      oggetto,
      descrizione,
      email,
      lingua,
      immagini: grezze,
      contesto,
    })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const esito = await notificaSupporto({
    id: (data?.id as string | undefined) ?? null,
    oggetto,
    descrizione,
    email,
    lingua,
    immagini: grezze,
    contesto,
  });
  // Il messaggio e salvato: l'email che non parte e un guasto nostro, non
  // suo. Lo si legge qui, non lo si scarica su chi ha chiesto aiuto.
  if (!esito.inviata) console.error("[supporto] email non inviata:", esito.errore);

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
