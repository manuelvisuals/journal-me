import { NextRequest, NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/entitlement";
import { logAiUsage, type ChatUsage } from "@/lib/server/ai-usage";
import { langName, langOf } from "@/lib/server/lang";

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

  // La lingua dell'utente arriva in x-jm-lang: headline, snippet e testo
  // delle aree escono in quella lingua. Le ETICHETTE delle aree no: sono
  // un enum salvato a database (vedi src/lib/server/lang.ts).
  const lingua = langName(langOf(req));

  const systemPrompt = [
    `Sei l'assistente di un diario personale. L'utente scrive in ${lingua} e tutto cio che produci va scritto in ${lingua}.`,
    "Ricevi il transcript di una persona che racconta la sua giornata a voce libera.",
    "Devi produrre un OGGETTO JSON con questi campi esatti:",
    `  - headline: una frase breve e densa, stile 'notizie di borsa', 4-12 parole, in ${lingua}, in minuscolo tranne nomi propri. Cattura il tema dominante della giornata.`,
    "  - snippet: 1-2 frasi (max 30 parole totali) che riassumono i fatti principali della giornata.",
    `  - areas: array di oggetti { label, text } per le aree macro presenti nella giornata. Le etichette sono un elenco chiuso e restano in italiano ANCHE se scrivi in ${lingua}, perche sono valori salvati a database: 'Lavoro', 'Relazioni', 'Corpo', 'Emozioni'. Includi solo le aree effettivamente menzionate (puoi anche restituire array vuoto). Il campo text va in ${lingua}: 1-2 frasi factual (cosa e successo, no interpretazioni psicologiche), max 25 parole.`,
    "",
    "Regole assolute:",
    "  - Niente moralismi, giudizi o coaching.",
    "  - Niente emoji.",
    "  - Niente apostrofo curvo: solo l'apostrofo dritto ASCII.",
    "  - Mantieni i nomi propri come pronunciati dall'utente.",
    `  - Se il transcript e troppo breve o incomprensibile, restituisci una headline generica in ${lingua} (in italiano sarebbe 'giornata raccontata') + snippet con il transcript troncato + areas vuoto.`,
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
