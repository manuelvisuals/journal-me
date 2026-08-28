import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireUser } from "@/lib/server/entitlement";
import {
  avatarValido,
  MAX_AVATAR_LEN,
} from "@/modules/impostazioni/avatar-contract";

/**
 * La foto profilo: scriverla e toglierla (migration 016).
 *
 * Passa da qui e non da una policy RLS per una ragione di sicurezza, non di
 * gusto: `profiles` contiene anche `plan`, e in Postgres una policy di update
 * vale per RIGA. Dare all'utente il permesso di aggiornare la propria riga
 * significherebbe dargli il permesso di scriversi `plan = 'premium'`. Qui il
 * service role scrive SOLO avatar_data e avatar_updated_at, e solo per
 * l'utente che ha presentato il token: non c'e nessun id nel corpo della
 * richiesta, quindi non c'e nessun modo di toccare la riga di un altro.
 *
 * Il corpo e { avatar: string | null }: una data URL image/jpeg (il ritaglio
 * a 256px fatto nel telefono) oppure null per tornare all'iniziale.
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

  let avatar: unknown;
  try {
    ({ avatar } = await req.json());
  } catch {
    return NextResponse.json({ error: "Corpo non leggibile" }, { status: 400 });
  }

  // La regola vive in avatar-contract.ts, un file senza import, cosi un
  // banco la puo eseguire in Node: e la STESSA funzione che gira qui, non
  // una copia che domani diverge (scripts/verify-foto-profilo.mjs).
  // "Troppo grande" prima di "formato sbagliato": a chi manda un'immagine
  // enorme ma valida si deve dire la verita, non un errore di formato.
  if (typeof avatar === "string" && avatar.length > MAX_AVATAR_LEN) {
    return NextResponse.json({ error: "Immagine troppo grande" }, { status: 413 });
  }
  if (!avatarValido(avatar)) {
    return NextResponse.json(
      { error: "Formato non valido: serve una data URL image/jpeg o image/png" },
      { status: 400 },
    );
  }

  const { error } = await admin
    .from("profiles")
    .update({
      avatar_data: avatar,
      avatar_updated_at: avatar === null ? null : new Date().toISOString(),
    })
    .eq("user_id", user.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
