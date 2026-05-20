import { NextRequest } from "next/server";

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
            "Trascrizione di un diario personale parlato in italiano colloquiale. Include nomi propri di persone, luoghi, brand. Punteggiatura naturale.",
        },
        // Server-side voice activity detection so partial transcripts are
        // emitted as the user pauses, not only at the end.
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 700,
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
