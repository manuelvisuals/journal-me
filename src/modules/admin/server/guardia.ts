import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server/entitlement";

/**
 * La porta del pannello admin: un account solo, per email, controllato QUI
 * sul server. Il client puo' nascondere la pagina, ma la porta vera e'
 * questa.
 *
 * A chiunque altro si risponde 404, non 403: la rotta non deve nemmeno
 * confermare di esistere.
 *
 * Sta in un file suo da quando le rotte del pannello sono piu' di una: due
 * copie della stessa guardia sono due posti dove sbagliarla.
 */

const ADMIN_EMAIL = "madh52@gmail.com";

export async function requireAdmin(
  req: NextRequest,
): Promise<{ userId: string; email: string } | NextResponse> {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const email = (user.email ?? "").trim().toLowerCase();
  if (email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return { userId: user.userId, email };
}
