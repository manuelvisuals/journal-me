import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/server/entitlement";

/**
 * L'accesso del revisore Apple (PIANO-APPSTORE §1c).
 *
 * Il login normale manda un codice via email, e il revisore le nostre
 * email non le riceve: senza una porta di servizio la revisione muore su
 * "unable to review". Questa e quella porta, con tre serrature:
 *
 *  1. esiste solo se il server ha TUTTE E DUE le variabili
 *     `JM_REVIEW_EMAILS` (elenco separato da virgole) e `JM_REVIEW_CODE`
 *     (il codice fisso scritto nelle Review Notes). Senza, ogni chiamata
 *     risponde come se la porta non esistesse;
 *  2. vale solo per le email dell'elenco: per chiunque altro il flusso
 *     resta quello vero, codice via email;
 *  3. il codice fisso viene confrontato qui, lato server. Sbagliato = 401,
 *     senza dire perche.
 *
 * Due usi della stessa rotta:
 *  - POST {email}          -> {review: boolean}: il client decide se
 *    saltare l'invio dell'email;
 *  - POST {email, code}    -> {tokenHash}: se il codice fisso e giusto, si
 *    genera un magic link amministrativo e si restituisce l'hash del
 *    token, che il client scambia con una sessione via verifyOtp. La
 *    sessione che ne esce e IDENTICA a una vera: l'app non ha percorsi
 *    speciali da revisione, che e esattamente cio che Apple vuole vedere.
 */

function reviewEmails(): string[] {
  return (process.env.JM_REVIEW_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function POST(req: NextRequest) {
  const fixedCode = process.env.JM_REVIEW_CODE ?? "";
  const emails = reviewEmails();

  let body: { email?: string; code?: string };
  try {
    body = (await req.json()) as { email?: string; code?: string };
  } catch {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();

  const enabled = fixedCode.length > 0 && emails.includes(email);

  // Prima fase: "questa email e da revisione?". Per tutti gli altri la
  // risposta e no, indistinguibile da una porta che non esiste.
  if (body.code === undefined) {
    return NextResponse.json({ review: enabled });
  }

  if (!enabled || body.code !== fixedCode) {
    return NextResponse.json({ error: "Codice non valido" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server non configurato" },
      { status: 500 },
    );
  }

  // L'account demo puo non esistere ancora: si crea confermato, cosi il
  // magic link non aspetta nessuna email.
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (createErr && !/already.*registered|already.*exists/i.test(createErr.message)) {
    return NextResponse.json({ error: createErr.message }, { status: 500 });
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data.properties?.hashed_token) {
    return NextResponse.json(
      { error: error?.message ?? "Link non generato" },
      { status: 500 },
    );
  }
  return NextResponse.json({ tokenHash: data.properties.hashed_token });
}
