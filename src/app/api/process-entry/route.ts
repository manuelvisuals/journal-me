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
const RESPONSE_FORMAT = {
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
                // contendevano la stessa casella da 25 parole e il modello ne
                // buttava via uno: un giorno spariva la pizza, il giorno dopo
                // gli esercizi. Non era il modello a essere debole, era la
                // casella a essere una sola. 'Corpo' resta, per sonno e
                // salute.
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
    `  - areas: array di oggetti { label, text } per le aree macro presenti nella giornata. Le etichette sono un elenco chiuso e restano in italiano ANCHE se scrivi in ${lingua}, perche sono valori salvati a database: 'Lavoro', 'Relazioni', 'Cibo', 'Movimento', 'Corpo', 'Emozioni'. Includi tutte le aree effettivamente menzionate, UNA SOLA VOLTA ciascuna. Il campo text va in ${lingua}: 1-2 frasi factual (cosa e successo, no interpretazioni psicologiche), max 30 parole.`,
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
    "NON PUOI RINUNCIARE. I testi vuoti o senza parole sono gia stati",
    "scartati prima di arrivare qui, dal codice: tutto cio che ricevi e una",
    "giornata da riassumere, e va riassunta. Non esiste nessun caso in cui",
    "puoi rispondere con un titolo generico.",
    "",
    "Un racconto a voce trascritto e quasi sempre telegrafico, sgrammaticato,",
    "senza soggetti e con i verbi all'infinito: 'cantato lezione, lavorato,",
    "stasera cena con amici', o anche solo 'colazione al bar con Marco'.",
    "Questo non e un testo incomprensibile: e il caso normale, ed e pieno di",
    "fatti. Anche una riga sola merita il suo titolo e almeno un'area.",
    "",
    "Se il testo nomina un pasto, un allenamento, del lavoro, una persona o",
    "uno stato d'animo, l'area corrispondente DEVE comparire. Un array di",
    "aree vuoto e ammesso solo se davvero non c'e niente di nessuna delle",
    "sei categorie.",
    "",
    "Regole assolute:",
    "  - Niente moralismi, giudizi o coaching.",
    "  - Niente emoji.",
    "  - Niente apostrofo curvo: solo l'apostrofo dritto ASCII.",
    "  - Mantieni i nomi propri come pronunciati dall'utente.",
  ].join("\n");

  type Riassunto = {
    headline: string;
    snippet: string;
    areas: { label: string; text: string }[];
  };

  /**
   * Una passata sul modello. `correzione`, quando c'e, e un secondo giro:
   * vedi sotto perche esiste.
   */
  async function chiedi(
    correzione?: string,
  ): Promise<{ ok: true; value: Riassunto } | { ok: false; response: NextResponse }> {
    const messages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: transcript },
    ];
    if (correzione) messages.push({ role: "system", content: correzione });

    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        // 0,2 e non 0,4: qui non serve fantasia, serve che le regole vengano
        // seguite. A 0,4 lo stesso testo, chiamato tre volte, due volte
        // rinunciava e una volta rispondeva bene (visto il 22 agosto 2026).
        temperature: 0.2,
        response_format: RESPONSE_FORMAT,
        messages,
      }),
    });

    if (!completion.ok) {
      const text = await completion.text().catch(() => "");
      return {
        ok: false,
        response: NextResponse.json(
          { error: `OpenAI error ${completion.status}: ${text}` },
          { status: completion.status },
        ),
      };
    }

    const data = (await completion.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: ChatUsage;
    };
    // Conteggio consumi: token ufficiali di OpenAI, fire-and-forget.
    void logAiUsage({
      userId,
      route: "process-entry",
      model: "gpt-4o-mini",
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    });
    const raw = data.choices?.[0]?.message?.content ?? "";
    try {
      return { ok: true, value: JSON.parse(raw) as Riassunto };
    } catch {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "AI returned non-JSON content" },
          { status: 502 },
        ),
      };
    }
  }

  const primo = await chiedi();
  if (!primo.ok) return primo.response;

  /**
   * LA SECONDA PASSATA, e perche esiste.
   *
   * Le istruzioni non bastano. Il 22 agosto 2026, con il prompt gia
   * corretto, lo stesso testo ("colazione con Marco, pranzo con Francesco,
   * telefonata con Andrea") chiamato tre volte ha risposto due volte con un
   * titolo generico e zero aree, e una volta bene. Un difetto che si
   * presenta due volte su tre non si chiude con una frase piu convincente:
   * si chiude controllando la risposta.
   *
   * Quindi: se torna senza nemmeno un'area su un testo che ha parole vere,
   * si richiede una volta sola, dicendo cosa non andava. Costa una seconda
   * chiamata solo quando serve, e chi legge il diario non vede piu una
   * giornata svuotata senza motivo.
   */
  let parsed = primo.value;
  const sembraUnaResa =
    parsed.areas.length === 0 && transcript.split(/\s+/).length >= 5;
  if (sembraUnaResa) {
    const secondo = await chiedi(
      "La risposta precedente non conteneva nessuna area, ma questo testo " +
        "contiene fatti. Rileggilo e elenca TUTTE le aree presenti fra " +
        "'Lavoro', 'Relazioni', 'Cibo', 'Movimento', 'Corpo', 'Emozioni'. " +
        "Un pasto e 'Cibo'. Una persona nominata e 'Relazioni'. Un " +
        "allenamento e 'Movimento'. Il titolo deve descrivere questa " +
        "giornata, non essere generico.",
    );
    if (secondo.ok && secondo.value.areas.length > 0) parsed = secondo.value;
  }

  return NextResponse.json(parsed);
}
