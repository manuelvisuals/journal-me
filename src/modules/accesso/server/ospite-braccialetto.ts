import { NextRequest } from "next/server";
import { registraBraccialetto } from "@/lib/server/ospite";

/**
 * POST /api/ospite/braccialetto: il braccialetto dell'ospite nasce sul
 * server (decisione 2A, 10 settembre 2026). Il dispositivo presenta il
 * segreto nell'intestazione e, nel guscio iOS, il token DeviceCheck nel
 * corpo. La logica e nello scheletro (src/lib/server/ospite.ts): qui solo
 * la porta del modulo accesso, che possiede il primo avvio.
 */
export async function POST(req: NextRequest) {
  return registraBraccialetto(req);
}
