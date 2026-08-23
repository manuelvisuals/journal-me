/**
 * L'innesto per i rami PARALLELI che devono toccare frasi fuori dal loro
 * modulo (caso raro: normalmente scrivi nel catalogo del TUO modulo,
 * src/lib/i18n/catalogs/<modulo>.ts, che e solo tuo e non fa conflitti).
 *
 * Svuotato il 23 agosto 2026 (passo C): le 69 voci accumulate sono state
 * classificate e spostate nei cataloghi per modulo. t() consulta EN_EXTRA
 * prima di EN, quindi una voce scritta qui vince: al merge va spostata nel
 * catalogo giusto e tolta da qui.
 */
export const EN_EXTRA: Record<string, string> = {};
