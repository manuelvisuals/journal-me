import { NextRequest, NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/entitlement";
import { logAiUsage, type ChatUsage } from "@/lib/server/ai-usage";
import { langName, langOf } from "@/lib/server/lang";
import { fakeCheckoutEnabled } from "@/lib/dev-checkout";

/**
 * I DUBBI dell'AI, dichiarati invece che risolti a caso.
 *
 * Regola dettata da Manuel il 23 agosto 2026: "l'AI non deve MAI indovinare".
 * Nasce da due difetti che sono lo stesso difetto:
 *
 *   - "mio fratello" finiva fra le persone come se fosse un nome, e
 *     correggerlo non serviva a niente perche la rilettura del testo lo
 *     rimetteva;
 *   - la stessa piscina finiva in Relazioni una domenica e in Movimento il
 *     lunedi, perche dal testo non si puo sapere se era sport o compagnia.
 *
 * In tutti e due i casi il modello incontrava una cosa che dal racconto NON
 * si puo ricavare, e sceglieva. Adesso si ferma e la chiede.
 *
 * DUE SPECIE DI DOMANDA, e non vanno confuse (la distinzione e di Manuel, ed
 * e la cosa piu importante di questo file):
 *
 *   identita  "mio fratello" e Daniele. "Da Charlie" e un ristorante.
 *             Vale PER SEMPRE: la risposta va in fact_aliases e non si
 *             richiede mai piu, su nessuna giornata.
 *
 *   episodio  La piscina di OGGI era stare con gli amici. Domani, da solo a
 *             fare vasche, sara allenamento. Vale SOLO per quella giornata,
 *             e si richiede ogni volta che il caso torna ambiguo.
 *
 * Trattarle allo stesso modo produce uno dei due danni: o chiedere ogni sera
 * chi e tuo fratello, o decidere per sempre che la piscina e sport.
 *
 * QUESTA ROTTA NON DECIDE NIENTE. Restituisce domande. Chi risponde e
 * l'utente, e chi applica la risposta e il client (src/lib/chiarimenti.ts).
 */

const MODELLO_DEFAULT = "gpt-5.6-luna";

const AREE = [
  "Lavoro",
  "Relazioni",
  "Cibo",
  "Movimento",
  "Corpo",
  "Emozioni",
] as const;

const RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "chiarimenti",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        domande: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              // 'identita' = vale per sempre. 'episodio' = vale solo oggi.
              specie: { type: "string", enum: ["identita", "episodio"] },
              // Cosa si applica con la risposta. Il client sa fare queste tre
              // cose e nient'altro: se un giorno servisse una quarta, va
              // aggiunta QUI e li, non improvvisata nel prompt.
              //   persona -> il soprannome e questa persona (per sempre)
              //   specie  -> non e una persona, e un luogo/cibo/... (per sempre)
              //   area    -> in questa giornata va in quest'area (solo oggi)
              azione: { type: "string", enum: ["persona", "specie", "area"] },
              // La cosa dubbia, ESATTAMENTE come compare nel racconto.
              soggetto: { type: "string" },
              // Una frase breve del racconto che contiene il soggetto: serve
              // all'utente per ricordarsi di cosa si sta parlando.
              citazione: { type: "string" },
              testo: { type: "string" },
              // Una riga sola: cosa cambia la risposta. Niente cerimonie.
              perche: { type: "string" },
              opzioni: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    // Il valore macchina. azione=persona: il nome.
                    // azione=specie: cibo|attivita|persona|lavoro|luogo.
                    // azione=area: una delle sei aree, oppure due unite da
                    // '+' quando e davvero tutte e due.
                    valore: { type: "string" },
                    etichetta: { type: "string" },
                    // Riga piccola sotto il bottone. "" se non serve.
                    sotto: { type: "string" },
                    // azione=specie: con che nome va mostrata la cosa
                    // ("casa di Charlie"). "" negli altri casi.
                    nome_vero: { type: "string" },
                  },
                  required: ["valore", "etichetta", "sotto", "nome_vero"],
                },
              },
              // Solo per azione=persona: si puo scrivere un nome a mano.
              libero: { type: "boolean" },
            },
            required: [
              "specie",
              "azione",
              "soggetto",
              "citazione",
              "testo",
              "perche",
              "opzioni",
              "libero",
            ],
          },
        },
      },
      required: ["domande"],
    },
  },
} as const;

type OpzioneGrezza = {
  valore: string;
  etichetta: string;
  sotto: string;
  nome_vero: string;
};
type DomandaGrezza = {
  specie: string;
  azione: string;
  soggetto: string;
  citazione: string;
  testo: string;
  perche: string;
  opzioni: OpzioneGrezza[];
  libero: boolean;
};

export async function POST(req: NextRequest) {
  const gate = await requirePremium(req);
  if (gate instanceof NextResponse) return gate;
  const { userId } = gate;

  // QUESTA ROTTA NON FALLISCE MAI CON UN ERRORE, e non e pigrizia.
  //
  // Le domande sono un di piu: se non arrivano, la giornata si salva
  // comunque e l'AI resta col suo dubbio. Rispondere 500 non aiuta nessuno —
  // il client le ignora gia — e in cambio dipinge un errore rosso nella
  // console di una pagina dove non si e rotto niente. Il motivo vero viaggia
  // nel corpo, dove chi sviluppa lo vede e chi usa il diario no.
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ domande: [], errore: "OPENAI_API_KEY non configurata" });
  }

  let body: {
    transcript?: string;
    model?: string;
    /** Le persone gia in Ricorda: diventano i bottoni di una domanda sui nomi. */
    roster?: string[];
    /** I soprannomi gia chiariti: "alias -> chi e". Non si richiedono. */
    aliases?: { kind: string; alias: string; labelKey: string }[];
    /** Cosa ha capito l'analisi: serve per sapere su cosa c'e da dubitare. */
    people?: string[];
    areas?: { label: string; text: string }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const transcript = (body.transcript ?? "").trim();
  // Sotto i venti caratteri non c'e abbastanza racconto per avere un dubbio
  // sensato: e la stessa soglia di process-entry, e la decide il codice.
  if (transcript.length < 20) return NextResponse.json({ domande: [] });

  const model =
    fakeCheckoutEnabled() && typeof body.model === "string" && body.model
      ? body.model
      : MODELLO_DEFAULT;

  const lingua = langName(langOf(req));
  const roster = (body.roster ?? []).filter((r) => typeof r === "string").slice(0, 60);
  const aliases = (body.aliases ?? []).filter(
    (a) => a && typeof a.alias === "string" && typeof a.labelKey === "string",
  );
  const people = (body.people ?? []).filter((p) => typeof p === "string");
  const areas = (body.areas ?? []).map((a) => a?.label).filter(Boolean);

  const systemPrompt = [
    `Ricevi il racconto di una giornata in ${lingua}, e cio che ne e stato capito.`,
    "Il tuo compito NON e riassumere: e dire cosa NON si puo sapere dal testo.",
    "",
    "Restituisci le domande da fare all'utente. Non indovinare mai: se una",
    "cosa dal racconto non si puo ricavare, si chiede.",
    "",
    "DUE SPECIE, e sbagliarle e il danno peggiore:",
    "",
    "  specie='identita' — vale PER SEMPRE, non si richiede mai piu.",
    "    Chi e questa persona nominata per parentela o ruolo ('mio fratello',",
    "    'il mio capo', 'la mia ex'). Cosa e un nome ambiguo ('da Charlie' e",
    "    un amico o un ristorante?). Sono cose che nella vita non cambiano.",
    "",
    "  specie='episodio' — vale SOLO per questa giornata.",
    "    Come va interpretata una cosa fatta oggi. La piscina di oggi era",
    "    allenamento o stare con gli amici? La stessa piscina, un altro",
    "    giorno, puo essere l'opposto: per questo non diventa una regola.",
    "",
    "AZIONI possibili, e non ce ne sono altre:",
    "  azione='persona' — il soggetto e una persona e va dato il suo nome.",
    "    Le opzioni sono i nomi che l'utente ha gia. libero=true.",
    "  azione='specie' — il soggetto e stato preso per una cosa che non e.",
    "    'valore' e il TIPO: cibo, attivita, persona, lavoro, luogo. Non e un",
    "    nome, e un codice, e non si traduce.",
    "    'nome_vero' e come va mostrata la cosa se si sceglie quel tipo:",
    "    'Gino' se e la persona, 'da Gino' se e il locale.",
    "    'etichetta' e 'sotto' NON devono essere due nomi qualsiasi: chi",
    "    legge deve capire dal bottone quale delle due strade sta prendendo.",
    "    libero=false.",
    `  azione='area' — in che area macro va messa una cosa fatta oggi. Le`,
    `    opzioni sono fra: ${AREE.join(", ")}. Per dire che vale per due aree,`,
    "    uniscile con '+': 'Relazioni+Movimento'. libero=false.",
    "",
    "QUANDO NON CHIEDERE. Questa e la regola che tiene la sera corta, e vale",
    "piu di tutte le altre: se la risposta non cambia NIENTE di cio che",
    "l'utente rileggera, la domanda non si fa.",
    "  - Non chiedere come si scrive una cosa: si scrive come l'ha detta lui.",
    "  - Non chiedere conferma di cio che il testo dice gia chiaramente. Se",
    "    c'e scritto 'ho corso 40 minuti', non c'e niente da chiarire.",
    "  - Non chiedere dettagli che non ha detto ('quanto hai corso?'): non e",
    "    un'intervista, e un diario. Si chiarisce cio che c'e, non si",
    "    aggiunge cio che manca.",
    "  - Non chiedere due volte la stessa cosa nella stessa giornata.",
    "  - Non chiedere di cose gia chiarite (elenco qui sotto).",
    "",
    "Metti le domande in ordine di importanza: la prima e quella che, se non",
    "risposta, sbaglierebbe di piu la giornata.",
    "",
    `Scrivi testo, perche, etichetta e sotto in ${lingua}, brevi e diretti,`,
    "senza cerimonie e senza scusarti di stare chiedendo.",
    "",
    "COME SI SCRIVE UNA DOMANDA:",
    "  - Non elencare le risposte dentro la domanda. 'La piscina di oggi,",
    "    cos'era?' e giusto; 'la piscina va letta come Movimento, Relazioni o",
    "    Movimento+Relazioni?' e la stessa cosa detta due volte, e i bottoni",
    "    sono li sotto.",
    "  - Con azione='persona', 'soggetto' deve essere ESATTAMENTE una delle",
    "    persone lette in questa giornata, copiata carattere per carattere.",
    "    Se la giornata dice 'fratello', il soggetto e 'fratello', non 'mio",
    "    fratello': su quella parola si applica la risposta.",
    "I valori di 'valore' e 'azione' NON si traducono mai: sono codici.",
    "",
    roster.length > 0
      ? `Persone che l'utente ha gia: ${roster.join(", ")}.`
      : "L'utente non ha ancora nessuna persona in rubrica.",
    aliases.length > 0
      ? `Gia chiarito una volta per sempre, NON richiedere: ${aliases
          .map((a) => `"${a.alias}" = ${a.labelKey} (${a.kind})`)
          .join("; ")}.`
      : "",
    people.length > 0 ? `Persone lette in questa giornata: ${people.join(", ")}.` : "",
    areas.length > 0 ? `Aree assegnate a questa giornata: ${areas.join(", ")}.` : "",
    "",
    "Se non c'e niente di veramente ambiguo, restituisci un elenco VUOTO.",
    "Una domanda inutile costa piu di un dubbio taciuto: la prima la legge",
    "ogni sera, il secondo lo si scopre e si aggiusta.",
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
      // Vedi extract-facts: i modelli 5.x rifiutano la temperatura.
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
    // Stesso motivo di sopra: un OpenAI che fa i capricci non deve diventare
    // un errore sulla giornata di chi sta solo scrivendo il suo diario.
    return NextResponse.json({
      domande: [],
      errore: `OpenAI ${completion.status}: ${text.slice(0, 300)}`,
      model,
    });
  }

  const data = (await completion.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: ChatUsage;
  };
  void logAiUsage({
    userId,
    route: "chiarimenti",
    model,
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  });

  const raw = data.choices?.[0]?.message?.content ?? "";
  let grezze: DomandaGrezza[] = [];
  try {
    grezze = (JSON.parse(raw) as { domande?: DomandaGrezza[] }).domande ?? [];
  } catch {
    // Risposta illeggibile: nessuna domanda. Il diario funziona lo stesso,
    // e l'alternativa sarebbe bloccare il salvataggio per un dubbio.
    return NextResponse.json({ domande: [] });
  }

  // Il prompt e una richiesta, non una garanzia. Qui si buttano via le
  // domande che non si potrebbero comunque applicare, e quelle su cose gia
  // decise: una domanda gia risposta e la piu irritante di tutte.
  const giaChiarito = new Set(
    aliases.map((a) => normalizza(a.alias)),
  );
  const visti = new Set<string>();
  const domande = grezze
    .filter((d) => {
      if (!d || typeof d.soggetto !== "string") return false;
      const s = normalizza(d.soggetto);
      if (!s) return false;
      if (giaChiarito.has(s)) return false;
      const chiave = `${d.azione}|${s}`;
      if (visti.has(chiave)) return false;
      // Almeno due strade: una domanda con un bottone solo non e una domanda.
      const opzioni = (d.opzioni ?? []).filter(
        (o) => o && typeof o.valore === "string" && o.valore.trim() !== "",
      );
      if (opzioni.length < 2 && !d.libero) return false;
      visti.add(chiave);
      return true;
    })
    .map((d, i) => ({
      id: `q${i + 1}`,
      specie: d.specie === "identita" ? "identita" : "episodio",
      azione: d.azione,
      soggetto: d.soggetto.trim(),
      citazione: (d.citazione ?? "").trim(),
      testo: (d.testo ?? "").trim(),
      perche: (d.perche ?? "").trim(),
      libero: d.azione === "persona" ? true : false,
      opzioni: (d.opzioni ?? [])
        .filter((o) => o && typeof o.valore === "string" && o.valore.trim() !== "")
        .map((o) => ({
          valore: o.valore.trim(),
          etichetta: (o.etichetta ?? o.valore).trim(),
          sotto: (o.sotto ?? "").trim(),
          nomeVero: (o.nome_vero ?? "").trim(),
        })),
    }));

  return NextResponse.json({ domande, model });
}

function normalizza(testo: string): string {
  return testo
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}
