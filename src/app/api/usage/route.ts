import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireUser } from "@/lib/server/entitlement";
import { estimateUsd } from "@/lib/server/ai-usage";

/**
 * I consumi AI dell'utente autenticato, aggregati per il mese corrente
 * (UTC): chiamate, token e stima di costo in USD per route + totale.
 * La stima usa i listini in ai-usage.ts; i token sono quelli UFFICIALI
 * riportati da OpenAI e loggati da ogni route.
 */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server non configurato" },
      { status: 500 },
    );
  }

  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();

  const { data, error } = await admin
    .from("ai_usage")
    .select("route, model, input_tokens, output_tokens, audio_seconds")
    .eq("user_id", user.userId)
    .gte("created_at", monthStart);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Agg = {
    calls: number;
    inputTokens: number;
    outputTokens: number;
    audioSeconds: number;
    estUsd: number;
  };
  const byRoute: Record<string, Agg> = {};
  let totalUsd = 0;

  for (const row of data ?? []) {
    const agg = (byRoute[row.route] ??= {
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      audioSeconds: 0,
      estUsd: 0,
    });
    agg.calls += 1;
    agg.inputTokens += row.input_tokens ?? 0;
    agg.outputTokens += row.output_tokens ?? 0;
    agg.audioSeconds += Number(row.audio_seconds ?? 0);
    const usd = estimateUsd(
      row.model,
      row.input_tokens ?? 0,
      row.output_tokens ?? 0,
    );
    agg.estUsd += usd;
    totalUsd += usd;
  }

  return NextResponse.json({
    monthStart,
    byRoute,
    totalUsd: Math.round(totalUsd * 10_000) / 10_000,
  });
}
