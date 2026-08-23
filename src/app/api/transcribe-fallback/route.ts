// Guscio (passo E, ARCHITETTURA.md): la rotta e del modulo OGGI,
// la logica vive in src/modules/oggi/server/transcribe-fallback.ts. Qui restano solo
// l'indirizzo e gli eventuali segment config, che Next vuole letterali.
export const runtime = "nodejs";
export const maxDuration = 60;
export { GET, POST } from "@/modules/oggi/server/transcribe-fallback";
