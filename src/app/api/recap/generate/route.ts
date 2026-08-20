import { NextRequest, NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/entitlement";
import { logAiUsage, type ChatUsage } from "@/lib/server/ai-usage";

/**
 * Generate a narrative literary recap from a set of entries.
 * Uses gpt-4o (not mini) for prose quality. Italian, intimist tone.
 *
 * Input:  { periodType: "month"|"semester"|"year", periodStart, periodEnd,
 *           entries: { entryDate, transcript, headline?, snippet? }[] }
 * Output: { title, snippet, body }
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

  let body: {
    periodType?: string;
    periodStart?: string;
    periodEnd?: string;
    entries?: {
      entryDate: string;
      transcript: string;
      headline?: string | null;
      snippet?: string | null;
    }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { periodType, periodStart, periodEnd } = body;
  const entries = body.entries ?? [];
  if (
    !periodType ||
    !["month", "semester", "year"].includes(periodType) ||
    !periodStart ||
    !periodEnd
  ) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }
  if (entries.length === 0) {
    return NextResponse.json(
      { error: "No entries in period" },
      { status: 400 },
    );
  }

  const periodLabel =
    periodType === "month"
      ? "del mese"
      : periodType === "semester"
        ? "del semestre"
        : "dell'anno";

  const targetWords =
    periodType === "month" ? "300-450" : periodType === "semester" ? "500-700" : "700-1000";

  const systemPrompt = [
    `Sei lo scrittore intimista del diario personale di un utente italiano.`,
    `Riguardi insieme a lui le sue giornate ${periodLabel} (${periodStart} -> ${periodEnd}) e ne scrivi un recap NARRATIVO LETTERARIO.`,
    "",
    "REGOLE DI STILE (fondamentali):",
    "  - Prosa, NON liste, NON bullet point, NON headline-asciutte.",
    "  - Tono: scrittore intimista, in seconda persona singolare ('tu'). Mai 'io', mai 'l'utente'.",
    "  - Frasi medie/lunghe con respiro narrativo. Immagini concrete (la luce, il tramonto, il deck di Marco, la cena con X).",
    "  - Non dare consigli, non fare moralismi, non suggerire azioni future.",
    "  - Italiano corrente, no inglesismi inutili. No emoji.",
    "  - Apostrofo dritto ASCII (l'aprile), non curvo.",
    "",
    `Lunghezza body: ${targetWords} parole.`,
    "",
    "OUTPUT JSON con questi campi:",
    "  - title: 1 frase 8-18 parole, evocativa, in minuscolo tranne nomi propri, tono da titolo di romanzo breve.",
    "  - snippet: 2-3 frasi (max 50 parole) che riassumono il mese in 1 sola immagine + 1 fatto concreto.",
    "  - body: la prosa narrativa completa, paragrafi separati da '\\n\\n'. Usa al massimo 1 citazione letterale presa dai transcript dell'utente, inserita come paragrafo a se' tra virgolette dritte (esempio: 'devo ricordarmi che la nuova ragazza di Gabriele si chiama Francesca').",
  ].join("\n");

  // Compose user message: list of entries with their date and transcript.
  const userBody = entries
    .map((e) => {
      const head = e.headline ? ` (titolo: ${e.headline})` : "";
      return `## ${e.entryDate}${head}\n${e.transcript}`;
    })
    .join("\n\n");

  const completion = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.7,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "recap",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              snippet: { type: "string" },
              body: { type: "string" },
            },
            required: ["title", "snippet", "body"],
          },
        },
      },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userBody },
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
  void logAiUsage({
    userId: gate.userId,
    route: "recap",
    model: "gpt-4o",
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  });
  const raw = data.choices?.[0]?.message?.content ?? "";
  let parsed: { title: string; snippet: string; body: string };
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
