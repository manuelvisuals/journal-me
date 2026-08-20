import { NextRequest, NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/entitlement";
import { logAiUsage, type ChatUsage } from "@/lib/server/ai-usage";
import { langName, langOf } from "@/lib/server/lang";

/**
 * Splits a free-form Italian transcript into per-day segments based on
 * relative date markers ("ieri", "stamattina", "l'altro ieri", "lunedi", ...).
 *
 * Input:  { transcript: string, defaultDate: "YYYY-MM-DD" }
 * Output: { segments: [{ date: "YYYY-MM-DD", text: string }] }
 *
 * Each output `date` is computed relative to `defaultDate` (the date the
 * user is currently recording from). Segments that have no temporal marker
 * default to `defaultDate`. If the AI cannot identify any markers, the entire
 * transcript is returned as a single segment.
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

  let body: { transcript?: string; defaultDate?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const transcript = (body.transcript ?? "").trim();
  const defaultDate = (body.defaultDate ?? "").trim();
  if (!transcript) {
    return NextResponse.json({ error: "Empty transcript" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(defaultDate)) {
    return NextResponse.json(
      { error: "Invalid defaultDate (expected YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  // Il nome del giorno serve all'AI per risolvere "lunedi" / "monday"
  // rispetto a oggi, e va nella lingua in cui la persona ha parlato.
  const lang = langOf(req);
  const lingua = langName(lang);
  const d = new Date(`${defaultDate}T12:00:00`);
  const weekday = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "it-IT", {
    weekday: "long",
  }).format(d);

  const MARKERS = {
    it: [
      "  - 'oggi', 'stamattina', 'stasera', 'questa mattina', 'stanotte' -> data di registrazione",
      "  - 'ieri', 'ieri sera', 'ieri mattina' -> giorno prima",
      "  - 'l\\'altro ieri', 'due giorni fa' -> due giorni prima",
      "  - 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica' -> giorno della settimana piu recente (no futuro)",
      "  - 'la settimana scorsa', 'sabato scorso' -> 7 giorni indietro (o piu se serve)",
    ],
    en: [
      "  - 'today', 'this morning', 'tonight', 'last night' -> data di registrazione",
      "  - 'yesterday', 'yesterday evening', 'yesterday morning' -> giorno prima",
      "  - 'the day before yesterday', 'two days ago' -> due giorni prima",
      "  - 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday' -> giorno della settimana piu recente (no futuro)",
      "  - 'last week', 'last saturday' -> 7 giorni indietro (o piu se serve)",
    ],
  };

  const systemPrompt = [
    `Sei un parser di un diario personale. Il transcript e in ${lingua}.`,
    `La data di registrazione e ${defaultDate} (${weekday}).`,
    `Ricevi un transcript di parlato libero. Devi splittarlo in segmenti per giornata, basandoti sui marker temporali in ${lingua}:`,
    ...MARKERS[lang],
    "",
    "Restituisci un OGGETTO JSON: { segments: [{ date, text }] }",
    "  - date: formato YYYY-MM-DD",
    "  - text: il pezzo di transcript che riguarda quella data (parole originali dell'utente, senza modifiche)",
    "",
    "Regole:",
    "  - Se il transcript non ha marker temporali espliciti, restituisci un solo segmento con date = data di registrazione.",
    "  - Mantieni l'ordine narrativo dei segmenti (no sorting).",
    "  - Non inventare contenuto. Il text di ogni segmento deve venire dal transcript originale.",
    "  - Se hai dubbi su un marker, default alla data di registrazione.",
    "  - Niente date future rispetto alla data di registrazione.",
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
          name: "date_segments",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              segments: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    date: { type: "string" },
                    text: { type: "string" },
                  },
                  required: ["date", "text"],
                },
              },
            },
            required: ["segments"],
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
    route: "split-by-date",
    model: "gpt-4o-mini",
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  });
  const raw = data.choices?.[0]?.message?.content ?? "";
  let parsed: { segments: { date: string; text: string }[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "AI returned non-JSON content" },
      { status: 502 },
    );
  }

  // Defensive: drop segments with bad shape, fall back to single default-date if empty.
  const segments = (parsed.segments ?? []).filter(
    (s) =>
      s &&
      typeof s.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(s.date) &&
      typeof s.text === "string" &&
      s.text.trim().length > 0,
  );
  if (segments.length === 0) {
    return NextResponse.json({
      segments: [{ date: defaultDate, text: transcript }],
    });
  }

  return NextResponse.json({ segments });
}
