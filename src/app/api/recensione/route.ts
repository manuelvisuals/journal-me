import { NextRequest, NextResponse } from "next/server";
import { leggiRecensione, segnaRichiesta } from "@/lib/server/recensione";

/**
 * L'interruttore della recensione, letto dall'app (13 settembre 2026).
 *
 * GET: { attiva, giornateMinime }. Senza autenticazione, di proposito: e
 * una configurazione pubblica a due campi, come il prezzo su una vetrina,
 * e l'app la chiede prima ancora di sapere chi sei. Cache di 30 s sul
 * server; il telefono la tiene un giorno.
 *
 * POST: l'app ha appena chiesto il foglio ad Apple: una riga nel contatore
 * (`recensione_richieste`), senza chi. Non e un'azione che dia qualcosa a
 * chi la chiama (non sblocca niente), quindi non ha bisogno di una guardia:
 * al massimo qualcuno gonfia un contatore che vede solo Manuel.
 */
export async function GET() {
  const r = await leggiRecensione();
  return NextResponse.json(r, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: NextRequest) {
  let piattaforma = "ios";
  try {
    const body = (await req.json()) as { piattaforma?: unknown };
    if (body.piattaforma === "web") piattaforma = "web";
  } catch {
    // corpo vuoto: iOS
  }
  await segnaRichiesta(piattaforma);
  return NextResponse.json({ ok: true });
}
