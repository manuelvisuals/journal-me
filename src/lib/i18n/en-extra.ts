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
export const EN_EXTRA: Record<string, string> = {
  /* Mese, avanti e indietro (ramo mese-nav) */
  "Mese precedente": "Previous month",
  "Mese successivo": "Next month",

  /* Consumi AI (ramo consumi-ai) */
  "Consumi AI": "AI spend",
  "Quanto e costato questo mese": "What it has cost this month",
  "circa {v}": "about {v}",
  "non disponibile": "not available",
  "{mese}, dal giorno 1": "{mese}, since the 1st",
  "Sto leggendo i consumi...": "Reading your AI spend...",
  "Non sono riuscito a leggere i consumi": "I could not read your AI spend",
  "La richiesta non e andata a buon fine, quindi questa schermata non sa dirti niente: non vuol dire che non hai speso.": "The request did not go through, so this screen cannot tell you anything: it does not mean you have spent nothing.",
  "Questo mese l'AI non l'hai ancora usata": "You have not used AI yet this month",
  "Il conto riparte da zero il primo di ogni mese. Compare qualcosa appena racconti una giornata a voce o chiudi una giornata col riassunto.": "The count restarts from zero on the first of every month. Something shows up as soon as you tell a day out loud or close a day with its summary.",
  "Stima su {d} giornate, di cui {r} raccontate a voce.": "An estimate over {d} days, {r} of them told out loud.",
  "Stima su {d} giornate.": "An estimate over {d} days.",
  "Stima su una giornata, raccontata a voce.": "An estimate over one day, told out loud.",
  "Stima su una giornata.": "An estimate over one day.",
  "Stima su {r} registrazioni.": "An estimate over {r} recordings.",
  "Stima su una registrazione.": "An estimate over one recording.",
  "Stima sulle chiamate di questo mese.": "An estimate over this month's calls.",
  "Circa {c} centesimi a giornata.": "About {c} cents a day.",
  "Da cosa arriva": "Where it comes from",
  "Trascrizione della voce": "Voice transcription",
  "Recap del mese": "Monthly recap",
  "Titoli e sintesi delle giornate": "Day titles and summaries",
  "Persone, date e note di Ricorda": "People, dates and Remember notes",
  "1 registrazione": "1 recording",
  "{n} registrazioni": "{n} recordings",
  "1 registrazione . {m} minuti": "1 recording . {m} minutes",
  "{n} registrazioni . {m} minuti": "{n} recordings . {m} minutes",
  "{n} recap . il modello grande": "{n} recap . the large model",
  "1 giornata": "1 day",
  "{n} giornate": "{n} days",
  "1 chiamata in tutto": "1 call in total",
  "{n} chiamate in tutto": "{n} calls in total",
  "meno di {v}": "less than {v}",
  "E una stima, non la tua bolletta": "An estimate, not your bill",
  "I token sono quelli": "The tokens are the",
  "ufficiali": "official ones",
  "che OpenAI riporta a ogni risposta, quindi il conteggio e esatto. Il prezzo no: e un listino salvato ad agosto 2026 in": "OpenAI reports with every response, so the count is exact. The price is not: it is a price list saved in August 2026 in",
  ", e se OpenAI lo cambia questa cifra resta indietro finche non lo aggiorni. Il conto vero e sul tuo pannello OpenAI.": ", and if OpenAI changes it this figure stays behind until you update it. The real bill is on your OpenAI dashboard.",
};
