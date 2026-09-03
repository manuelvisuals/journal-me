import { NextRequest } from "next/server";
import { statoOspite } from "@/lib/server/ospite";

/**
 * GET /api/ospite/stato: quante giornate del regalo ha usato questo
 * dispositivo e quante ne restano. Non crea niente e non spende niente.
 * La legge la riga "AI in regalo" di Impostazioni (mockup
 * ospite-primo-avvio.html, schermata 04, in attesa dell'ok) e la usano i
 * banchi per provare che la quota scende SUL SERVER (SPEC R2).
 */
export async function GET(req: NextRequest) {
  return statoOspite(req);
}
