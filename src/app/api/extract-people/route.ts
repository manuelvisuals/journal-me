import { NextRequest, NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/entitlement";
import { logAiUsage, type ChatUsage } from "@/lib/server/ai-usage";

/**
 * Extracts the names of people the user mentioned or interacted with in a
 * day's transcript. Used after the review step to (a) dedupe against the
 * user's existing roster and (b) suggest new people to add to Remember.
 *
 * Returns { people: string[] } — proper-name casing preserved, the user
 * themselves excluded, no duplicates. Best-effort: empty array on anything
 * ambiguous.
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
    return NextResponse.json({ people: [] });
  }

  const systemPrompt = [
    "Sei l'assistente di un diario personale italiano.",
    "Ricevi il transcript di una persona che racconta la sua giornata a voce libera.",
    "Devi estrarre i NOMI DELLE PERSONE che l'autore ha nominato o con cui ha avuto a che fare oggi.",
    "",
    "Regole:",
    "  - Restituisci un OGGETTO JSON { people: string[] }.",
    "  - Includi solo persone reali nominate (es. 'ho visto Mario', 'sentito Luca al telefono').",
    "  - NON includere l'autore stesso (chi parla in prima persona).",
    "  - NON includere nomi di luoghi, aziende, prodotti, animali.",
    "  - Mantieni il nome cosi' come pronunciato (di solito solo il nome di battesimo, es. 'Mario'). Se viene detto nome e cognome, tieni entrambi.",
    "  - Capitalizza correttamente la prima lettera del nome.",
    "  - Niente duplicati. Niente emoji. Niente apostrofo curvo.",
    "  - Se non ci sono persone chiare, restituisci array vuoto.",
  ].join("\n");

  const completion = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.1,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "people_extraction",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              people: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["people"],
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
  void logAiUsage({
    userId: gate.userId,
    route: "extract-people",
    model: "gpt-4o-mini",
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  });
  const raw = data.choices?.[0]?.message?.content ?? "";
  let parsed: { people: string[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ people: [] });
  }

  // Defensive normalization: trim, drop empties, dedupe (case-insensitive).
  const seen = new Set<string>();
  const people: string[] = [];
  for (const p of Array.isArray(parsed.people) ? parsed.people : []) {
    if (typeof p !== "string") continue;
    const t = p.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    people.push(t);
  }

  return NextResponse.json({ people });
}
