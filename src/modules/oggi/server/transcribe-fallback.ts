import { NextRequest, NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/entitlement";
import { logAiUsage, type TranscribeUsage } from "@/lib/server/ai-usage";
import { langOf, type PromptLang } from "@/lib/server/lang";

/**
 * The transcription endpoint. Still called "fallback" for historical
 * reasons: it used to be the rescue path behind the live OpenAI Realtime
 * session (/api/realtime/session, deleted in the api-auth PR), but the
 * realtime path was dropped in August 2026 and this is now the only way a
 * finished recording becomes words. The client records the raw mic audio
 * with a MediaRecorder and POSTs it here whole.
 *
 * The OPENAI_API_KEY stays on the server and never reaches the browser.
 */


/**
 * Warm-up ping. This function is now on the critical path — it is what turns a
 * finished recording into words — so the user should never pay its cold start
 * while staring at "trascrivo...". Called when the Today screen mounts and when
 * the mic is tapped. Touches nothing: no OpenAI call, no audio, no state.
 *
 * Gated like everything else: a warm-up spends nothing, but an ungated
 * handler on a gated route is one more surface to reason about. A 401/402
 * still warms the lambda, so the client fires it regardless of plan.
 */
export async function GET(req: NextRequest) {
  const gate = await requirePremium(req);
  if (gate instanceof NextResponse) return gate;

  return Response.json({ ok: true, warm: true });
}

// Il prompt anti-allucinazione va scritto NELLA lingua che si sta
// trascrivendo: Whisper lo usa come contesto, e un prompt italiano su un
// audio inglese peggiora la trascrizione invece di migliorarla.
const ANTI_HALLUCINATION: Record<PromptLang, string> = {
  it:
    "Trascrivi LETTERALMENTE in italiano solo le parole effettivamente pronunciate. " +
    "Se l'audio e silenzioso, contiene solo rumore o e incomprensibile, restituisci stringa vuota. " +
    "NON inventare contenuto plausibile, NON parafrasare.",
  en:
    "Transcribe LITERALLY, in English, only the words actually spoken. " +
    "If the audio is silent, is only noise, or is unintelligible, return an empty string. " +
    "Do NOT invent plausible content, do NOT paraphrase.",
};

export async function POST(req: NextRequest) {
  const gate = await requirePremium(req);
  if (gate instanceof NextResponse) return gate;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY not configured" },
      { status: 500 },
    );
  }

  let inForm: FormData;
  try {
    inForm = await req.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = inForm.get("audio");
  if (!(file instanceof File) || file.size === 0) {
    // No usable audio captured at all — let the client treat this as "empty".
    return Response.json({ text: "", reason: "no-audio" });
  }

  // Optional proper-name vocabulary hint, same idea as the realtime path.
  const lang = langOf(req);
  const glossary = inForm.get("glossary");
  const glossaryHint =
    typeof glossary === "string" && glossary.trim().length > 0
      ? lang === "en"
        ? ` Recurring proper names (keep the exact spelling): ${glossary.trim()}.`
        : ` Nomi propri ricorrenti (rispettare scrittura esatta): ${glossary.trim()}.`
      : "";

  const upstream = new FormData();
  upstream.set("file", file, file.name || "audio.webm");
  upstream.set("model", "gpt-4o-transcribe");
  upstream.set("language", lang);
  upstream.set("response_format", "json");
  upstream.set("prompt", ANTI_HALLUCINATION[lang] + glossaryHint);

  let resp: Response;
  try {
    resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json(
      { error: `Upstream request failed: ${msg}` },
      { status: 502 },
    );
  }

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    return Response.json(
      { error: `Transcription error ${resp.status}: ${t.slice(0, 200)}` },
      { status: resp.status },
    );
  }

  const data = (await resp.json().catch(() => null)) as
    | { text?: unknown; usage?: TranscribeUsage }
    | null;
  // Conteggio consumi (token/secondi ufficiali di OpenAI, fire-and-forget).
  void logAiUsage({
    userId: gate.userId,
    route: "transcribe",
    model: "gpt-4o-transcribe",
    inputTokens: data?.usage?.input_tokens,
    outputTokens: data?.usage?.output_tokens,
    audioSeconds:
      typeof data?.usage?.seconds === "number" ? data.usage.seconds : undefined,
  });
  const text =
    data && typeof data.text === "string" ? data.text.trim() : "";
  return Response.json({ text });
}
