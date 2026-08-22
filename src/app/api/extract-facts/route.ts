import { NextRequest, NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/entitlement";
import { logAiUsage, type ChatUsage } from "@/lib/server/ai-usage";
import { langName, langOf } from "@/lib/server/lang";
import { fakeCheckoutEnabled } from "@/lib/dev-checkout";

/**
 * L'estrazione dei FATTI da una giornata (SPEC-fatti.md §4).
 *
 * Un fatto e un giorno + un tipo + un'etichetta: "pizza", "panca piana 60x10",
 * "Christian". La stessa struttura per il cibo, gli allenamenti, le persone e
 * i posti — ed e questo che permette di rispondere a "quante volte ho mangiato
 * la pizza a maggio" senza aggiungere una colonna per argomento.
 *
 * IL MODELLO NON E FISSO. Scrivere un titolo e un compito di stile; estrarre
 * dodici entita tipizzate da un parlato disordinato e un compito di
 * PRECISIONE, dove un errore non e brutto ma falso, e i falsi si sommano nei
 * conteggi. Quale modello regga davvero non si decide leggendo un listino: si
 * misura (scripts/eval-fatti.mjs). Per questo il modello si puo passare nel
 * corpo della richiesta, ma SOLO in ambiente di prova: in produzione lo
 * sceglie il server, o chiunque potrebbe farsi servire il modello piu caro a
 * spese nostre.
 */

const MODELLO_DEFAULT = "gpt-4o-mini";

const RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "day_facts",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        facts: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              kind: {
                type: "string",
                enum: ["cibo", "attivita", "persona", "lavoro", "luogo"],
              },
              // Come l'ha detto lui: "una margherita da Gino". Si mostra questa.
              label: { type: "string" },
              // Normalizzata: "pizza". Si CONTA questa (SPEC-fatti §3.3).
              label_key: { type: "string" },
              // Attributi liberi per tipo, tutti facoltativi: peso, serie,
              // ripetizioni, minuti, pasto. Stringa JSON perche lo schema
              // strict non ammette oggetti a forma libera.
              attrs_json: { type: "string" },
              confidence: { type: "number" },
            },
            required: ["kind", "label", "label_key", "attrs_json", "confidence"],
          },
        },
      },
      required: ["facts"],
    },
  },
} as const;

export async function POST(req: NextRequest) {
  const gate = await requirePremium(req);
  if (gate instanceof NextResponse) return gate;
  const { userId } = gate;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured" },
      { status: 500 },
    );
  }

  let body: { transcript?: string; model?: string; known?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const transcript = (body.transcript ?? "").trim();
  if (!transcript) return NextResponse.json({ facts: [] });

  // Il modello si sceglie da fuori solo in ambiente di prova (vedi in testa).
  const model =
    fakeCheckoutEnabled() && typeof body.model === "string" && body.model
      ? body.model
      : MODELLO_DEFAULT;

  const lingua = langName(langOf(req));
  // Le etichette gia usate da questo utente: riusarle invece di inventarne di
  // simili e meta della normalizzazione (SPEC-fatti §3.3). "panca piana" oggi
  // e "panca" domani sono due righe che non si sommano mai.
  const known = (body.known ?? []).filter((k) => typeof k === "string").slice(0, 120);

  const systemPrompt = [
    `Ricevi il racconto di una giornata, scritto o dettato in ${lingua}.`,
    "Estrai i FATTI: cose concrete che sono successe quel giorno.",
    "",
    "Tipi (kind):",
    "  - cibo: un pasto, un piatto, una bevanda. Un fatto per PIATTO, non per pasto.",
    "  - attivita: sport, allenamenti, camminate, meditazione, hobby.",
    "  - persona: qualcuno che ha visto, sentito o nominato.",
    "  - lavoro: attivita lavorative o di studio concrete.",
    "  - luogo: posti dove e stato (locali, citta, palestre).",
    "",
    "Per ogni fatto:",
    "  - label: come lo ha detto lui, ripulito. 'una margherita da Gino' -> 'margherita da Gino'.",
    "  - label_key: la forma con cui si CONTA, minuscola, singolare, senza",
    "    articoli, senza luoghi, senza quantita. 'margherita da Gino' -> 'pizza'.",
    "    'panca piana' e 'panca' -> 'panca piana'. Due modi di dire la stessa",
    "    cosa devono dare la STESSA label_key, o i conteggi non funzionano.",
    "  - attrs_json: una stringa JSON con quello che e stato detto e nient'altro.",
    "    cibo: {\"pasto\":\"colazione|pranzo|cena|spuntino\"}.",
    "    attivita: {\"minuti\":60,\"serie\":[{\"peso_kg\":60,\"ripetizioni\":10}]}.",
    "    Se non e stato detto, NON metterlo. Stringa vuota se non c'e niente: {}.",
    "  - confidence: 1 se e detto chiaramente, piu basso se lo stai deducendo.",
    "",
    "Regole assolute:",
    "  - Solo cio che e EFFETTIVAMENTE detto. Non aggiungere un caffe perche",
    "    di solito si fa colazione col caffe. Inventare un fatto e il danno",
    "    peggiore: finisce nei conteggi e non si distingue dai veri.",
    "  - SOLO OGGI. Un proposito ('vorrei andare in palestra', 'domani corro')",
    "    non e un fatto. Un ricordo non e un fatto, nemmeno se contiene nomi e",
    "    posti: in 'mi e tornato in mente quando l'anno scorso sono andato a",
    "    Roma con Giulia' NON ci sono ne Roma ne Giulia, c'e solo un pensiero.",
    "    Se una frase e al passato remoto, ha una data diversa da oggi, o",
    "    comincia con 'mi ricordo', 'mi e tornato in mente', 'quella volta',",
    "    tutto cio che contiene va IGNORATO.",
    "  - Niente giudizi nelle etichette: 'pizza', mai 'pizza (sgarro)'.",
    "  - Mai l'autore fra le persone.",
    "  - Niente doppioni: lo stesso fatto una volta sola.",
    "  - Le etichette non si traducono: restano nella lingua del racconto.",
    known.length > 0
      ? `Etichette gia usate da questo utente, RIUSALE quando calzano invece di inventarne di simili: ${known.join(", ")}.`
      : "",
  ]
    .filter((r) => r !== "")
    .join("\n");

  const completion = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      // La temperatura si manda SOLO ai modelli che la accettano. I 5.x la
      // rifiutano con un 400 ("does not support 0 with this model"): la
      // tengono fissa e non si tocca. Meglio non mandarla che mandarla e
      // vedersi rifiutare la chiamata (scoperto provando, il 22 agosto 2026).
      ...(model.startsWith("gpt-4") ? { temperature: 0 } : {}),
      response_format: RESPONSE_FORMAT,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcript },
      ],
    }),
  });

  if (!completion.ok) {
    const text = await completion.text().catch(() => "");
    return NextResponse.json(
      { error: `OpenAI error ${completion.status}: ${text}`, model },
      { status: completion.status },
    );
  }

  const data = (await completion.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: ChatUsage;
  };
  void logAiUsage({
    userId,
    route: "extract-facts",
    model,
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  });

  const raw = data.choices?.[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(raw) as {
      facts: {
        kind: string;
        label: string;
        label_key: string;
        attrs_json: string;
        confidence: number;
      }[];
    };
    const facts = (parsed.facts ?? []).map((f) => {
      let attrs: Record<string, unknown> = {};
      try {
        const o: unknown = JSON.parse(f.attrs_json || "{}");
        if (o && typeof o === "object" && !Array.isArray(o)) {
          attrs = o as Record<string, unknown>;
        }
      } catch {
        // attributi illeggibili: il fatto vale lo stesso, gli attributi no
      }
      return {
        kind: f.kind,
        label: f.label,
        label_key: f.label_key,
        attrs,
        confidence: f.confidence,
      };
    });
    return NextResponse.json({
      facts,
      model,
      usage: {
        input: data.usage?.prompt_tokens ?? 0,
        output: data.usage?.completion_tokens ?? 0,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "AI returned non-JSON content", model },
      { status: 502 },
    );
  }
}
