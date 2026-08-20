import { NextRequest, NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/entitlement";
import { logAiUsage, type ChatUsage } from "@/lib/server/ai-usage";

/**
 * Post-processes a daily journal transcript: produces headline, snippet,
 * and macro-area summaries (Lavoro, Relazioni, Corpo, Emozioni).
 *
 * Uses OpenAI's Chat Completions API in JSON mode for a strict schema.
 * The OPENAI_API_KEY stays on the server.
 */
export async function POST(req: NextRequest) {
  const gate = await requirePremium(req);
  if (gate instanceof NextResponse) return gate;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured" },
      { status: 500 },
    );
  }

  let body: { transcript?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const transcript = (body.transcript ?? "").trim();
  if (!transcript) {
    return NextResponse.json({ error: "Empty transcript" }, { status: 400 });
  }

  const systemPrompt = [
    "Sei l'assistente di un diario personale italiano.",
    "Ricevi il transcript di una persona che racconta la sua giornata a voce libera.",
    "Devi produrre un OGGETTO JSON con questi campi esatti:",
    "  - headline: una frase breve e densa, stile 'notizie di borsa', 4-12 parole, in italiano, in minuscolo tranne nomi propri. Cattura il tema dominante della giornata.",
    "  - snippet: 1-2 frasi (max 30 parole totali) che riassumono i fatti principali della giornata.",
    "  - areas: array di oggetti { label, text } per le aree macro presenti nella giornata. Etichette ammesse SOLO: 'Lavoro', 'Relazioni', 'Corpo', 'Emozioni'. Includi solo le aree effettivamente menzionate (puoi anche restituire array vuoto). Per ogni area, scrivi 1-2 frasi factual (cosa è successo, no interpretazioni psicologiche), max 25 parole.",
    "",
    "Regole assolute:",
    "  - Niente moralismi, giudizi o coaching.",
    "  - Niente emoji.",
    "  - Niente apostrofo curvo: solo l'apostrofo dritto ASCII.",
    "  - Mantieni i nomi propri come pronunciati dall'utente.",
    "  - Se il transcript è troppo breve o incomprensibile, restituisci headline 'Giornata raccontata' + snippet con il transcript troncato + areas vuoto.",
  ].join("\n");

  const completion = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.4,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "journal_summary",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              headline: { type: "string" },
              snippet: { type: "string" },
              areas: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    label: {
                      type: "string",
                      enum: ["Lavoro", "Relazioni", "Corpo", "Emozioni"],
                    },
                    text: { type: "string" },
                  },
                  required: ["label", "text"],
                },
              },
            },
            required: ["headline", "snippet", "areas"],
          },
        },
      },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcript },
      ],
    }),
  });

  if (!completion.ok) {
    const text = await completion.text().catch(() => "");
    return NextResponse.json(
      { error: `OpenAI error ${completion.status}: ${text}` },
      { status: completion.status },
    );
  }

  const data = (await completion.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: ChatUsage;
  };
  // Conteggio consumi: token ufficiali di OpenAI, fire-and-forget.
  void logAiUsage({
    userId: gate.userId,
    route: "process-entry",
    model: "gpt-4o-mini",
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  });
  const raw = data.choices?.[0]?.message?.content ?? "";
  let parsed: { headline: string; snippet: string; areas: { label: string; text: string }[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "AI returned non-JSON content" },
      { status: 502 },
    );
  }

  return NextResponse.json(parsed);
}
