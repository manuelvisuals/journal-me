import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Warm-up endpoint. Called when the user lands on the Today screen (and when
 * they tap the mic) so the serverless function is already hot and the
 * server -> OpenAI TLS/DNS path is primed by the time a real recording starts.
 *
 * Deliberately does NOT touch the microphone or open a WebRTC session — we
 * learned (commit db7f5ac) that holding a mic stream open across sessions
 * reintroduces the iOS Safari stale-pipe bug, so the mic is only acquired
 * when the overlay actually opens. This warms only the cheap, safe parts.
 */
export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ ok: false, reason: "no-key" });
  }
  // Best-effort: prime the server -> OpenAI connection. Short timeout, errors
  // ignored — this is purely a latency optimization, never blocks anything.
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    await fetch("https://api.openai.com/v1/models", {
      method: "HEAD",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: ctrl.signal,
    }).catch(() => {});
    clearTimeout(t);
  } catch {
    // ignore
  }
  return Response.json({ ok: true });
}

/**
 * Backend relay for OpenAI Realtime API (transcription-only) over WebRTC.
 *
 * Flow:
 *   Browser creates an RTCPeerConnection + mic track, generates an SDP offer,
 *   POSTs that SDP here. We forward it to OpenAI together with the session
 *   config (multipart form-data), and pipe OpenAI's SDP answer back to the
 *   browser. The browser then calls setRemoteDescription(answer) and the
 *   call is established.
 *
 * The OPENAI_API_KEY stays on the server and never reaches the browser.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response("OPENAI_API_KEY not configured", { status: 500 });
  }

  const offerSdp = await req.text();
  if (!offerSdp || !offerSdp.startsWith("v=")) {
    return new Response("Invalid SDP offer", { status: 400 });
  }

  // Read the user's glossary (proper names they use often) so the
  // transcription model treats them as in-vocabulary.
  // Priority: explicit X-JM-Glossary header from the client (works for
  // demo users whose glossary lives in localStorage) -> Supabase
  // user_settings (for auth users) -> none.
  let glossaryTerms: string[] = [];
  const headerVal = req.headers.get("x-jm-glossary");
  if (headerVal) {
    try {
      const decoded = decodeURIComponent(headerVal);
      glossaryTerms = decoded
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    } catch {
      // ignore malformed header
    }
  }
  if (glossaryTerms.length === 0) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // Primary source: the people saved in Remember (kind = 'persona').
        // This replaced the old Glossario as the proper-name vocabulary.
        const { data: personaRows } = await supabase
          .from("remembers")
          .select("text")
          .eq("kind", "persona");
        const personaNames = Array.isArray(personaRows)
          ? personaRows
              .map((r) => (typeof r.text === "string" ? r.text.trim() : ""))
              .filter((s) => s.length > 0)
          : [];

        // Legacy fallback: any leftover glossary from before the migration.
        const { data } = await supabase
          .from("user_settings")
          .select("glossary")
          .eq("user_id", user.id)
          .maybeSingle();
        const legacy = Array.isArray(data?.glossary)
          ? (data.glossary as unknown[]).filter(
              (t): t is string => typeof t === "string" && t.trim().length > 0,
            )
          : [];

        // Merge, dedupe (case-insensitive).
        const seen = new Set<string>();
        const merged: string[] = [];
        for (const term of [...personaNames, ...legacy]) {
          const k = term.toLowerCase();
          if (seen.has(k)) continue;
          seen.add(k);
          merged.push(term);
        }
        glossaryTerms = merged;
      }
    } catch {
      // best-effort
    }
  }
  const glossaryHint =
    glossaryTerms.length > 0
      ? ` Nomi propri ricorrenti dell'utente (rispettare scrittura esatta): ${glossaryTerms.join(", ")}.`
      : "";

  // Realtime transcription session: streams Italian text deltas from the
  // user's microphone, no model voice response (we only want transcript).
  //
  // ANTI-HALLUCINATION PROMPT: gpt-4o-transcribe (like whisper) tends to
  // "complete" silence or unclear audio with plausible content matching
  // the prompt's stylistic bias. We explicitly tell it to be literal and
  // emit nothing on silence. Glossary is appended at the end as a hint,
  // not as creative context.
  const antiHallucinationPrompt = [
    "Trascrivi LETTERALMENTE in italiano solo le parole che senti chiaramente nell'audio.",
    "Se l'audio e silenzioso, contiene solo rumore o e incomprensibile, restituisci stringa vuota.",
    "NON inventare contenuto plausibile. NON parafrasare. NON completare frasi mai dette.",
    "Mantieni le concordanze grammaticali in base a quello che senti — NON assumere genere o numero.",
    "Punteggiatura naturale solo se la pausa lo suggerisce.",
  ].join(" ");

  const sessionConfig = {
    type: "transcription",
    audio: {
      input: {
        transcription: {
          model: "gpt-4o-transcribe",
          language: "it",
          prompt: antiHallucinationPrompt + glossaryHint,
        },
        // Background noise reduction — helps the VAD distinguish speech
        // from environmental noise so we don't transcribe coughs/clicks.
        noise_reduction: { type: "near_field" },
        // Server-side voice activity detection. threshold 0.3 keeps us
        // sensitive in noisy rooms; the anti-hallucination prompt above
        // is what prevents fabricated content on borderline chunks.
        turn_detection: {
          type: "server_vad",
          threshold: 0.3,
          prefix_padding_ms: 150,
          silence_duration_ms: 250,
        },
      },
    },
    include: ["item.input_audio_transcription.logprobs"],
  };

  const fd = new FormData();
  fd.set("sdp", offerSdp);
  fd.set("session", JSON.stringify(sessionConfig));

  const upstream = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return new Response(`OpenAI Realtime error ${upstream.status}: ${text}`, {
      status: upstream.status,
    });
  }

  const answerSdp = await upstream.text();
  return new Response(answerSdp, {
    status: 200,
    headers: { "Content-Type": "application/sdp" },
  });
}
