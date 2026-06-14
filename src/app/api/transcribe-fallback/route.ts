import { NextRequest } from "next/server";

/**
 * Fallback transcription endpoint — the safety net.
 *
 * The primary path is the live OpenAI Realtime session (see
 * /api/realtime/session). That path can silently yield zero text on some
 * devices (notably iOS Safari on the very first mic grant, where the WebRTC
 * sender ships silence even though the mic track is live). To make sure the
 * user NEVER loses their words, the client records the raw mic audio in
 * parallel with a MediaRecorder and, if the live transcript came back empty,
 * POSTs that audio here for a non-realtime transcription.
 *
 * MediaRecorder reads the track directly (not through the WebRTC sender), so
 * it captures real audio exactly in the cases where the realtime path fails.
 *
 * The OPENAI_API_KEY stays on the server and never reaches the browser.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const ANTI_HALLUCINATION =
  "Trascrivi LETTERALMENTE in italiano solo le parole effettivamente pronunciate. " +
  "Se l'audio e silenzioso, contiene solo rumore o e incomprensibile, restituisci stringa vuota. " +
  "NON inventare contenuto plausibile, NON parafrasare.";

export async function POST(req: NextRequest) {
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
  const glossary = inForm.get("glossary");
  const glossaryHint =
    typeof glossary === "string" && glossary.trim().length > 0
      ? ` Nomi propri ricorrenti (rispettare scrittura esatta): ${glossary.trim()}.`
      : "";

  const upstream = new FormData();
  upstream.set("file", file, file.name || "audio.webm");
  upstream.set("model", "gpt-4o-transcribe");
  upstream.set("language", "it");
  upstream.set("response_format", "json");
  upstream.set("prompt", ANTI_HALLUCINATION + glossaryHint);

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

  const data = (await resp.json().catch(() => null)) as { text?: unknown } | null;
  const text =
    data && typeof data.text === "string" ? data.text.trim() : "";
  return Response.json({ text });
}
