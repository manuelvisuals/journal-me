import { NextRequest, NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/entitlement";
import { logAiUsage, type ChatUsage } from "@/lib/server/ai-usage";

/**
 * Auto-classifies a short remember snippet (manually saved by Manuel from the
 * /remember quick-capture) into one of the 5 buckets. Runs in background after
 * a save with kind = 'nota' (the catch-all default), so a freshly typed/spoken
 * remember slots into the right tab without manual picking.
 *
 * Returns { kind } where kind is one of persona|todo|luogo|idea|nota.
 * If the text is ambiguous, returns 'nota' (no-op for the client).
 */

type Kind = "persona" | "todo" | "luogo" | "idea" | "nota";

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

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "Empty text" }, { status: 400 });
  }

  const systemPrompt = [
    "Classifichi un appunto breve in italiano scritto o dettato a voce da una persona nella sua app di journaling.",
    "Devi scegliere UNA categoria fra esattamente queste cinque:",
    "  - persona: nome di una persona, descrizione/note su qualcuno, contatto, relazione (es. 'Marco lavora ora in Stripe', 'mia cugina Anna')",
    "  - todo: azione da fare, promemoria operativo, compito (es. 'chiamare avvocato', 'comprare olio', 'rinnovare passaporto')",
    "  - luogo: posto fisico, indirizzo, ristorante, viaggio (es. 'osteria Bella vista a Trastevere', 'spiaggia di Otranto', 'casa di Lara')",
    "  - idea: spunto creativo, intuizione, concetto, riflessione astratta (es. 'app per leggere i giornali in 5 min', 'il tempo lineare e' una convenzione')",
    "  - nota: tutto cio' che non rientra chiaramente sopra. Default in caso di dubbio.",
    "",
    "Regole:",
    "  - Scegli sempre la categoria piu' specifica possibile.",
    "  - Se e' ambiguo o troppo generico, scegli 'nota'.",
    "  - NON inventare contenuti, classifica solo cio' che leggi.",
    "  - Restituisci solo JSON {\"kind\": \"<categoria>\"}.",
  ].join("\n");

  const completion = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
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
            name: "remember_classification",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                kind: {
                  type: "string",
                  enum: ["persona", "todo", "luogo", "idea", "nota"],
                },
              },
              required: ["kind"],
            },
          },
        },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
      }),
    },
  );

  if (!completion.ok) {
    const errTxt = await completion.text().catch(() => "");
    return NextResponse.json(
      { error: `OpenAI error ${completion.status}: ${errTxt}` },
      { status: completion.status },
    );
  }

  const data = (await completion.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: ChatUsage;
  };
  void logAiUsage({
    userId: gate.userId,
    route: "classify",
    model: "gpt-4o-mini",
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  });
  const raw = data.choices?.[0]?.message?.content ?? "";
  let parsed: { kind: Kind };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "AI returned non-JSON content" },
      { status: 502 },
    );
  }

  return NextResponse.json({ kind: parsed.kind });
}
