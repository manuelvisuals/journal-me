import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
        const { data } = await supabase
          .from("user_settings")
          .select("glossary")
          .eq("user_id", user.id)
          .maybeSingle();
        const terms = Array.isArray(data?.glossary)
          ? (data.glossary as unknown[]).filter(
              (t): t is string => typeof t === "string" && t.trim().length > 0,
            )
          : [];
        glossaryTerms = terms;
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
  const sessionConfig = {
    type: "transcription",
    audio: {
      input: {
        transcription: {
          model: "gpt-4o-transcribe",
          language: "it",
          prompt:
            "Trascrizione di un diario personale parlato in italiano colloquiale. Include nomi propri di persone, luoghi, brand. Punteggiatura naturale." +
            glossaryHint,
        },
        // Server-side voice activity detection. Lower silence_duration_ms
        // means chunks close faster -> transcript arrives with less perceived
        // lag, at the cost of more fragmentation if the user pauses mid-sentence.
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
