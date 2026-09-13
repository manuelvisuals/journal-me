import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireAdmin } from "@/lib/server/entitlement";
import { pianoEffettivo } from "@/lib/piano";

/**
 * La voce "Iscritti" del pannello (13 settembre 2026; mockup
 * design/mockups/admin-iscritti.html v2, scelte di Manuel A2 B2 C2):
 * chi ha un account e chi usa l'app da ospite, con quattro numeri in
 * cima, e il piano cambiabile a mano dall'ispettore.
 *
 * TUTTO SI LEGGE QUI, COL SERVICE ROLE. L'elenco degli account viene da
 * auth.users (email, iscrizione, ultimo accesso: sono dati che nessuna
 * tabella pubblica ha), il piano da `profiles`, gli ospiti da
 * `braccialetti`. Le giornate si CONTANO (righe di `entries` in chiaro
 * piu buste di `cassettine`): il contenuto e cifrato con la chiave che
 * sta sul telefono e questo pannello non lo vede, per costruzione.
 *
 * Le tabelle sono piccole (decine di persone): si leggono intere e si
 * aggregano qui, con un solo filtro di data su ai_usage, che e l'unica
 * che cresce ogni giorno. Il giorno in cui gli iscritti saranno migliaia
 * si passa a una funzione SQL, come `riassunto_regalo_mese`.
 *
 * IL PIANO A MANO (PUT). Scrive plan e plan_source = 'manual' in
 * profiles, come la SQL che Manuel ha gia usato per il revisore. Se il
 * piano e di Apple si rifiuta (409): lo governa l'App Store, e al primo
 * avviso il server lo riscriverebbe comunque; meglio dirlo che fingere.
 */

const PAGINA = 1000;

type Utente = { id: string; email?: string | null; created_at?: string; last_sign_in_at?: string | null };

type Profilo = {
  user_id: string;
  plan?: string | null;
  plan_source?: string | null;
  current_period_end?: string | null;
  display_name?: string | null;
  apple_environment?: string | null;
  apple_product_id?: string | null;
  apple_ultimo_avviso?: string | null;
};

export type AccountIscritto = {
  id: string;
  email: string;
  nome: string | null;
  iscrittoIl: string;
  ultimoAccesso: string | null;
  piano: "free" | "premium";
  fonte: "apple" | "manual" | "stripe" | null;
  scadenza: string | null;
  apple: { ambiente: string | null; prodotto: string | null; avviso: string | null } | null;
  giornate: number;
  aiEurMese: number;
  cassaforte: boolean;
  ospitePrima: string | null;
};

export type OspiteIscritto = {
  id: string;
  devicecheck: boolean;
  dal: string;
  ultimoUso: string;
  usate: number;
  max: number;
  aiEurMese: number;
  esito: { tipo: "in-corso" | "finito" | "account"; email?: string };
};

function inizioMeseUtc(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configurato" }, { status: 500 });
  }

  // auth.users, a pagine: l'API non ne da piu di mille per volta.
  const utenti: Utente[] = [];
  for (let page = 1; page < 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGINA });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const lista = (data?.users ?? []) as Utente[];
    utenti.push(...lista);
    if (lista.length < PAGINA) break;
  }

  const daMese = inizioMeseUtc();
  const [profili, entries, cassettine, cassaforte, usage, braccialetti, giornateOspiti, regalo] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, plan, plan_source, current_period_end, display_name, apple_environment, apple_product_id, apple_ultimo_avviso"),
    supabase.from("entries").select("user_id"),
    supabase.from("cassettine").select("user_id"),
    supabase.from("cassaforte_utente").select("user_id"),
    supabase.from("ai_usage").select("user_id, braccialetto_id, costo_usd").gte("created_at", daMese),
    supabase.from("braccialetti").select("id, user_id, creato_il, ultimo_uso, devicecheck"),
    supabase.from("braccialetto_giornate").select("braccialetto_id"),
    supabase.from("regalo").select("giornate_per_ospite, cambio_usd_eur").eq("id", 1).maybeSingle(),
  ]);
  for (const r of [profili, entries, cassettine, cassaforte, usage, braccialetti, giornateOspiti]) {
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
  }

  const cambio = Number((regalo.data as { cambio_usd_eur?: number } | null)?.cambio_usd_eur ?? 0.92) || 0.92;
  const maxRegalo = Number((regalo.data as { giornate_per_ospite?: number } | null)?.giornate_per_ospite ?? 0) || 0;

  const conta = (righe: { user_id?: string | null }[] | null) => {
    const m = new Map<string, number>();
    for (const r of righe ?? []) if (r.user_id) m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1);
    return m;
  };
  const giornatePerUtente = conta(entries.data as { user_id: string }[]);
  for (const [k, v] of conta(cassettine.data as { user_id: string }[])) {
    giornatePerUtente.set(k, (giornatePerUtente.get(k) ?? 0) + v);
  }
  const conCassaforte = new Set(((cassaforte.data ?? []) as { user_id: string }[]).map((r) => r.user_id));

  const eurPerUtente = new Map<string, number>();
  const eurPerBraccialetto = new Map<string, number>();
  let aiEurMese = 0;
  for (const r of (usage.data ?? []) as { user_id?: string | null; braccialetto_id?: string | null; costo_usd?: number | string }[]) {
    const eur = (Number(r.costo_usd ?? 0) || 0) * cambio;
    aiEurMese += eur;
    if (r.user_id) eurPerUtente.set(r.user_id, (eurPerUtente.get(r.user_id) ?? 0) + eur);
    else if (r.braccialetto_id) eurPerBraccialetto.set(r.braccialetto_id, (eurPerBraccialetto.get(r.braccialetto_id) ?? 0) + eur);
  }

  const profiloDi = new Map<string, Profilo>();
  for (const p of (profili.data ?? []) as Profilo[]) profiloDi.set(p.user_id, p);

  const usatePerBraccialetto = new Map<string, number>();
  for (const r of (giornateOspiti.data ?? []) as { braccialetto_id: string }[]) {
    usatePerBraccialetto.set(r.braccialetto_id, (usatePerBraccialetto.get(r.braccialetto_id) ?? 0) + 1);
  }
  const emailDi = new Map<string, string>();
  for (const u of utenti) if (u.email) emailDi.set(u.id, u.email);
  const braccialettoDiUtente = new Map<string, string>();

  const ospiti: OspiteIscritto[] = ((braccialetti.data ?? []) as {
    id: string; user_id?: string | null; creato_il: string; ultimo_uso: string; devicecheck?: boolean | null;
  }[]).map((b) => {
    const usate = usatePerBraccialetto.get(b.id) ?? 0;
    if (b.user_id && !braccialettoDiUtente.has(b.user_id)) braccialettoDiUtente.set(b.user_id, b.creato_il);
    const esito: OspiteIscritto["esito"] = b.user_id
      ? { tipo: "account", email: emailDi.get(b.user_id) ?? "" }
      : usate >= maxRegalo && maxRegalo > 0
        ? { tipo: "finito" }
        : { tipo: "in-corso" };
    return {
      id: b.id,
      devicecheck: Boolean(b.devicecheck),
      dal: b.creato_il,
      ultimoUso: b.ultimo_uso,
      usate,
      max: maxRegalo,
      aiEurMese: eurPerBraccialetto.get(b.id) ?? 0,
      esito,
    };
  });

  const account: AccountIscritto[] = utenti
    .filter((u) => Boolean(u.email))
    .map((u) => {
      const p = profiloDi.get(u.id);
      const piano = pianoEffettivo(p ?? null);
      const fonteGrezza = p?.plan_source ?? null;
      const fonte: AccountIscritto["fonte"] =
        fonteGrezza === "apple" || fonteGrezza === "manual" || fonteGrezza === "stripe" ? fonteGrezza : null;
      return {
        id: u.id,
        email: u.email as string,
        nome: p?.display_name?.trim() ? p.display_name.trim() : null,
        iscrittoIl: u.created_at ?? "",
        ultimoAccesso: u.last_sign_in_at ?? null,
        piano,
        fonte,
        scadenza: p?.current_period_end ?? null,
        apple: fonte === "apple"
          ? { ambiente: p?.apple_environment ?? null, prodotto: p?.apple_product_id ?? null, avviso: p?.apple_ultimo_avviso ?? null }
          : null,
        giornate: giornatePerUtente.get(u.id) ?? 0,
        aiEurMese: eurPerUtente.get(u.id) ?? 0,
        cassaforte: conCassaforte.has(u.id),
        ospitePrima: braccialettoDiUtente.get(u.id) ?? null,
      };
    });

  const adesso = Date.now();
  const setteGiorni = adesso - 7 * 86_400_000;
  const trentaGiorni = adesso - 30 * 86_400_000;
  const premium = account.filter((a) => a.piano === "premium");
  const numeri = {
    account: account.length,
    nuoviSettimana: account.filter((a) => Date.parse(a.iscrittoIl) >= setteGiorni).length,
    premium: premium.length,
    premiumApple: premium.filter((a) => a.fonte === "apple").length,
    premiumMano: premium.filter((a) => a.fonte === "manual").length,
    ospiti: ospiti.length,
    ospitiAttivi: ospiti.filter((o) => Date.parse(o.ultimoUso) >= trentaGiorni && o.usate > 0).length,
    aiEurMese,
  };

  return NextResponse.json({ numeri, account, ospiti });
}

export async function PUT(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configurato" }, { status: 500 });
  }

  let body: { userId?: unknown; piano?: unknown };
  try {
    body = (await req.json()) as { userId?: unknown; piano?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const userId = typeof body.userId === "string" ? body.userId : "";
  const piano = body.piano === "premium" ? "premium" : body.piano === "free" ? "free" : null;
  if (!userId || !piano) {
    return NextResponse.json({ error: "userId e piano ('free' | 'premium') sono obbligatori" }, { status: 400 });
  }

  const { data: attuale, error: errLettura } = await supabase
    .from("profiles")
    .select("user_id, plan, plan_source, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (errLettura) return NextResponse.json({ error: errLettura.message }, { status: 500 });

  if (attuale?.plan_source === "apple" && pianoEffettivo(attuale) === "premium") {
    return NextResponse.json(
      { error: "apple", messaggio: "Questo piano lo governa l'App Store: qui non si tocca." },
      { status: 409 },
    );
  }

  const campi = piano === "premium"
    ? { plan: "premium", plan_source: "manual", current_period_end: null }
    : { plan: "free", plan_source: null, current_period_end: null };

  const { data, error } = attuale
    ? await supabase.from("profiles").update(campi).eq("user_id", userId).select("user_id, plan, plan_source, current_period_end").maybeSingle()
    : await supabase.from("profiles").insert({ user_id: userId, ...campi }).select("user_id, plan, plan_source, current_period_end").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    piano: pianoEffettivo(data ?? null),
    fonte: (data as { plan_source?: string | null } | null)?.plan_source ?? null,
  });
}
