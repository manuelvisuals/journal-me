/**
 * Il regalo AI per l'ospite: il contratto (SPEC-ospite-e-cassaforte R2-R4,
 * tabella `regalo`, migration 023).
 *
 * PERCHE STA NELLO SCHELETRO. I limiti li SCRIVE il pannello admin, ma li
 * LEGGONO la guardia delle route AI (server) e, domani, la riga "AI in
 * regalo" di Impostazioni (client). Come per le aree: il diario non deve
 * dipendere dal suo pannello di controllo.
 *
 * QUI CI SONO SOLO I LIMITI, MAI LA SPESA. La tabella e a lettura pubblica
 * (come `aree` e `benvenuto`): quanto e stato speso e un dato del server e
 * si legge solo dal pannello admin con il service role.
 *
 * I VALORI DI FABBRICA sono la proposta della notte del 3 settembre 2026
 * (decisioni A e B del mockup ospite-primo-avvio.html, in attesa dell'ok di
 * Manuel): 10 giornate per ospite, 100 euro al mese, regalo acceso. Se il
 * database non risponde si usano questi, cosi un ospite non resta senza AI
 * per una tabella di configurazione irraggiungibile.
 */

export type Regalo = {
  attivo: boolean;
  /** Quante giornate con l'AI riceve ogni braccialetto. */
  giornatePerOspite: number;
  /** Il tetto di spesa del mese, in euro, oltre il quale il regalo si spegne. */
  tettoMensileEur: number;
  /** La spesa si stima in USD (listini di ai-usage.ts): il cambio e fisso. */
  cambioUsdEur: number;
  /**
   * L'abbonamento ANNUALE e in vendita? (migration 024, decisione di Manuel
   * del 4 settembre 2026: il prodotto puo esistere su App Store Connect e
   * restare nascosto finche questo e falso.)
   */
  annualeAttivo: boolean;
};

export const REGALO_DI_FABBRICA: Regalo = {
  attivo: true,
  giornatePerOspite: 10,
  tettoMensileEur: 100,
  cambioUsdEur: 0.92,
  annualeAttivo: false,
};

function numero(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/** Da una riga della tabella al contratto; null se la riga non ha senso. */
export function regaloDaRiga(riga: Record<string, unknown> | null | undefined): Regalo | null {
  if (!riga || typeof riga !== "object") return null;
  if (typeof riga.attivo !== "boolean") return null;
  return {
    attivo: riga.attivo,
    giornatePerOspite: Math.max(
      0,
      Math.round(numero(riga.giornate_per_ospite, REGALO_DI_FABBRICA.giornatePerOspite)),
    ),
    tettoMensileEur: Math.max(0, numero(riga.tetto_mensile_eur, REGALO_DI_FABBRICA.tettoMensileEur)),
    cambioUsdEur: numero(riga.cambio_usd_eur, REGALO_DI_FABBRICA.cambioUsdEur) || REGALO_DI_FABBRICA.cambioUsdEur,
    annualeAttivo: riga.annuale_attivo === true,
  };
}

/** L'intestazione con cui il dispositivo si presenta come ospite. */
export const HEADER_BRACCIALETTO = "x-jm-braccialetto";

/**
 * La risposta 402 del server quando il regalo non copre la chiamata. E
 * diversa da { error: "Premium required" }: il client deve poter aprire due
 * muri diversi (uno per chi ha finito un regalo, uno per chi non ha premium).
 */
export const ERRORE_REGALO_FINITO = "regalo_finito";
export type MotivoRegaloFinito = "quota" | "tetto" | "spento";
