/**
 * Il catalogo inglese delle FUNZIONI IN LAVORAZIONE IN PARALLELO.
 *
 * Perche esiste, e non e un dettaglio organizzativo: quando due sessioni
 * lavorano insieme sullo stesso repo, `en.ts` e il file che si scontra per
 * primo. Ha 400 righe e ogni funzione nuova ne aggiunge in fondo — cioe
 * esattamente nello stesso punto, cioe un conflitto garantito a ogni
 * merge, su un file dove un conflitto risolto male perde traduzioni in
 * silenzio.
 *
 * Regola: chi lavora su un ramo parallelo scrive QUI. `en.ts` resta di chi
 * lavora su main. Al merge i due file si uniscono senza toccarsi, e quando
 * la funzione e stabile le sue righe si possono spostare in `en.ts`.
 *
 * Valgono le stesse regole di traduzione di `en.ts`: stesso tono, niente
 * punto finale se l'italiano non ce l'ha, i nomi propri dell'app non si
 * traducono.
 */
export const EN_EXTRA: Record<string, string> = {};
