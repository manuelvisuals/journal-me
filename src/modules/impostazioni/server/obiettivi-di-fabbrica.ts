import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireUser } from "@/lib/server/entitlement";
import { etichetteDiFabbrica } from "@/lib/data/store/default-goals";

/**
 * Il seme degli obiettivi di fabbrica, nella lingua del dispositivo
 * (Manuel, 12 settembre 2026, opzione 1: "O in inglese O in italiano").
 *
 * Fino alla migration 029 li seminava un trigger Postgres alla nascita
 * dell'utente, in italiano per chiunque: il database non sa che lingua ha
 * il telefono. Adesso e l'app a chiederli al primo accesso, dicendo la
 * lingua; il server:
 *
 *  1. guarda `profiles.goals_seeded_at`: se c'e, ha gia seminato (o l'ha
 *     fatto il trigger, per chi esisteva prima della 029) e risponde
 *     `{ seminati: 0 }` senza toccare niente — anche se la persona nel
 *     frattempo ha cancellato tutti gli obiettivi: cancellarli e una
 *     scelta, e non deve tornare indietro a ogni login;
 *  2. altrimenti inserisce le sei etichette che NON ci sono gia (confronto
 *     senza maiuscole: la migrazione dell'ospite puo aver fatto salire
 *     obiettivi suoi nello stesso istante) e segna la data.
 *
 * Il service role scrive per l'utente del token, mai per un id nel corpo,
 * e su `profiles` tocca SOLO goals_seeded_at (niente policy di update:
 * quella riga ha anche `plan`).
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server non configurato" }, { status: 500 });
  }

  let lingua: unknown = null;
  try {
    ({ lingua } = await req.json());
  } catch {
    // corpo assente: italiano
  }
  const etichette = etichetteDiFabbrica(typeof lingua === "string" ? lingua : null);

  const { data: profilo, error: errProfilo } = await admin
    .from("profiles")
    .select("goals_seeded_at")
    .eq("user_id", user.userId)
    .maybeSingle();
  if (errProfilo) {
    return NextResponse.json({ error: errProfilo.message }, { status: 500 });
  }
  if (profilo?.goals_seeded_at) {
    return NextResponse.json({ ok: true, seminati: 0 });
  }

  const { data: esistenti, error: errGoals } = await admin
    .from("goals")
    .select("label, position")
    .eq("user_id", user.userId);
  if (errGoals) {
    return NextResponse.json({ error: errGoals.message }, { status: 500 });
  }
  const presenti = new Set((esistenti ?? []).map((g) => String(g.label ?? "").trim().toLowerCase()));
  let position = (esistenti ?? []).reduce((m, g) => Math.max(m, Number(g.position ?? -1)), -1) + 1;
  const nuovi = etichette
    .filter((l) => !presenti.has(l.toLowerCase()))
    .map((label) => ({ user_id: user.userId, label, position: position++ }));

  if (nuovi.length > 0) {
    const { error } = await admin.from("goals").insert(nuovi);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  const { error: errSegno } = await admin
    .from("profiles")
    .update({ goals_seeded_at: new Date().toISOString() })
    .eq("user_id", user.userId);
  if (errSegno) {
    return NextResponse.json({ error: errSegno.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, seminati: nuovi.length });
}
