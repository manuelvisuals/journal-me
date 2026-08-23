/**
 * La porta del modulo OGGI (passo D, ARCHITETTURA.md): cio che gli ALTRI
 * moduli possono importare. Tutto il resto e interno: il lint dei confini
 * blocca gli import di @/modules/oggi/* da fuori.
 */
export { RecordingOverlay } from "@/modules/oggi/components/recording-overlay";
