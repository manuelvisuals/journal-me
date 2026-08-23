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

  const [usageRes, profileRes] = await Promise.all([
    admin
      .from("ai_usage")
      .select("route, model, input_tokens, output_tokens, audio_seconds")
      .eq("user_id", user.userId)
      .gte("created_at", monthStart),
    admin
      .from("profiles")
      .select("plan")
      .eq("user_id", user.userId)
      .maybeSingle(),
  ]);
  const { data, error } = usageRes;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Quota mensile del tier (plan_limits, migration 010). Se la tabella non
  // c'e ancora o il tier non ha una riga, la barra semplicemente non ha un
  // tetto: allowanceUsd null.
  const plan = profileRes.data?.plan === "premium" ? "premium" : "free";
  let allowanceUsd: number | null = null;
  try {
    const { data: limit } = await admin
      .from("plan_limits")
      .select("monthly_allowance_usd")
      .eq("tier", plan)
      .maybeSingle();
    if (limit && limit.monthly_allowance_usd !== null) {
      allowanceUsd = Number(limit.monthly_allowance_usd);
    }
  } catch {
    allowanceUsd = null;
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

  let totalTokens = 0;
  for (const agg of Object.values(byRoute)) {
    totalTokens += agg.inputTokens + agg.outputTokens;
  }

  const roundedUsd = Math.round(totalUsd * 10_000) / 10_000;
  const pct =
    allowanceUsd && allowanceUsd > 0
      ? Math.min(999, Math.round((roundedUsd / allowanceUsd) * 100))
      : null;

  return NextResponse.json({
    monthStart,
    plan,
    byRoute,
    totalTokens,
    totalUsd: roundedUsd,
    allowanceUsd,
    pct,
  });
}
