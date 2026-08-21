import { NextRequest, NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/entitlement";
import { logAiUsage, type ChatUsage } from "@/lib/server/ai-usage";
import { langName, langOf } from "@/lib/server/lang";

/**
 * Post-processes a daily journal transcript: produces headline, snippet,
 * and macro-area summaries (Lavoro, Relazioni, Cibo, Movimento, Corpo,
 * Emozioni).
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

  // La decisione "questo testo non dice niente" la prende il CODICE, con un
  // righello, non il modello a sensazione. Prima era una riga del prompt, e
  // il 21 agosto 2026 e successo il danno: una giornata vera ("cantato
  // lezione con Anna, lavorato, stasera cena con amici") e stata giudicata
  // incomprensibile, e Manuel si e ritrovato titolo generico, nessuna area e
  // il suo stesso testo come sintesi. Con la stessa frase, un attimo dopo, lo
  // stesso modello ha prodotto un riassunto perfetto: era una moneta lanciata
  // a ogni salvataggio.
  //
  // Venti caratteri: sotto, non c'e abbastanza per un titolo comunque.
  if (transcript.length < 20) {
    return NextResponse.json({
      headline: langOf(req) === "en" ? "day told" : "giornata raccontata",
      snippet: transcript.slice(0, 240),
      areas: [],
    });
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
    `  - areas: array di oggetti { label, text } per le aree macro presenti nella giornata. Le etichette sono un elenco chiuso e restano in italiano ANCHE se scrivi in ${lingua}, perche sono valori salvati a database: 'Lavoro', 'Relazioni', 'Cibo', 'Movimento', 'Corpo', 'Emozioni'. Includi solo le aree effettivamente menzionate (puoi anche restituire array vuoto), UNA SOLA VOLTA ciascuna. Il campo text va in ${lingua}: 1-2 frasi factual (cosa e successo, no interpretazioni psicologiche), max 30 parole.`,
    "",
    "Cosa va in quale area, quando c'e il dubbio:",
    "  - Cibo: cosa ha mangiato e bevuto. Pasti, piatti, locali, alcol, caffe. Elenca i piatti come li ha detti lui (pizza, insalata, sushi), senza aggiungerne di non menzionati.",
    "  - Movimento: attivita fisica. Palestra ed esercizi svolti, corsa, camminate, sport, bicicletta, minuti o serie se li ha detti.",
    "  - Corpo: il resto del corpo che non e ne cibo ne movimento: sonno, stanchezza, dolori, malattie, peso.",
    "  - Se la giornata contiene sia cibo sia attivita fisica devono comparire ENTRAMBE le aree. Non scegliere: erano due aree separate proprio per questo.",
    "",
    "Regole assolute:",
    "  - Niente moralismi, giudizi o coaching.",
    "  - Niente emoji.",
    "  - Niente apostrofo curvo: solo l'apostrofo dritto ASCII.",
    "  - Mantieni i nomi propri come pronunciati dall'utente.",
    "",
    "SULLA RINUNCIA. Esiste un solo caso in cui puoi rinunciare: un testo",
    "che non contiene NESSUN fatto (vuoto, una parola sola, lettere a caso).",
    "In quel caso, e solo in quello, restituisci una headline generica in",
    `${lingua} (in italiano sarebbe 'giornata raccontata'), lo snippet con il`,
    "transcript troncato e areas vuoto.",
    "",
    "Un racconto a voce trascritto e quasi sempre telegrafico, sgrammaticato,",
    "senza soggetti e con i verbi all'infinito: 'cantato lezione, lavorato,",
    "riletto diario, stasera cena con amici'. QUESTO NON E UN TESTO",
    "INCOMPRENSIBILE, e un testo pieno di fatti scritto male, ed e il caso",
    "normale, non l'eccezione. Rinunciare li significa cancellare la giornata",
    "di qualcuno per un problema di grammatica.",
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
                      // 'Cibo' e 'Movimento' sono nati il 21 agosto 2026,
                      // staccandoli da 'Corpo'. Prima cibo e palestra si
                      // contendevano la stessa casella da 25 parole e il
                      // modello ne buttava via uno: un giorno spariva la
                      // pizza, il giorno dopo gli esercizi. Non era il
                      // modello a essere debole, era la casella a essere
                      // una sola. 'Corpo' resta, per sonno e salute.
                      enum: [
                        "Lavoro",
                        "Relazioni",
                        "Cibo",
                        "Movimento",
                        "Corpo",
                        "Emozioni",
                      ],
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
