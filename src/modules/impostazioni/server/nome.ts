import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireUser } from "@/lib/server/entitlement";
import {
  NOME_MAX,
  nomeValido,
  normalizzaNome,
} from "@/modules/impostazioni/profilo-contract";

/**
 * Il nome mostrato: sceglierlo o toglierlo (migration 017).
 *
 * Stessa architettura della foto (server/avatar.ts) e per la stessa ragione
 * di sicurezza: `profiles` contiene anche `plan`, e una policy di update
 * varrebbe per l'intera riga. Qui il service role scrive SOLO display_name
 * e display_name_updated_at, e solo per l'utente che ha presentato il
 * token: nel corpo non c'e nessun id di cui fidarsi.
 *
 * Il corpo e { nome: string | null }: `null` toglie il nome scelto e fa
 * tornare l'app all'email tagliata alla chiocciola.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server non configurato" },
      { status: 500 },
    );
  }

  let nome: unknown;
  try {
    ({ nome } = await req.json());
  } catch {
    return NextResponse.json({ error: "Corpo non leggibile" }, { status: 400 });
  }

  if (typeof nome === "string" && nome.length > NOME_MAX) {
    return NextResponse.json({ error: "Nome troppo lungo" }, { status: 400 });
  }
  if (!nomeValido(nome)) {
    return NextResponse.json({ error: "Nome non valido" }, { status: 400 });
  }

  // Si salva il nome NORMALIZZATO, non quello grezzo: la stessa funzione che
  // gira nel client, cosi il database non riceve mai spazi doppi o a capo
  // incollati per sbaglio (profilo-contract.ts, provata da
  // scripts/verify-nome-profilo.mjs).
  const pulito = normalizzaNome(nome);

  const { error } = await admin
    .from("profiles")
    .update({
      display_name: pulito,
      display_name_updated_at: pulito === null ? null : new Date().toISOString(),
    })
    .eq("user_id", user.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
