/**
 * Le parole del sito, in italiano e in inglese.
 *
 * PERCHE QUI E NON IN t(). Il resto dell'app traduce con `t()`, che e un
 * pezzo di client: risponde italiano finche React non si e idratato (vedi
 * HANDOVER §13.11) e poi cambia. Su una schermata dell'app va benissimo;
 * su una pagina che deve esistere gia scritta dentro l'HTML che riceve il
 * motore di ricerca, no: Google leggerebbe l'italiano su /en, e la pagina
 * inglese sarebbe inglese solo per chi ha JavaScript acceso.
 *
 * Quindi il sito e server-rendered e sceglie la lingua dall'INDIRIZZO —
 * `/` italiano, `/en` inglese — e le due versioni stanno qui, una accanto
 * all'altra, dove si vede subito se una frase e stata cambiata solo da un
 * lato. E l'unico posto del progetto dove la regola "sempre t()"
 * (AGENTS.md §4) non si applica, ed e scritto anche nel CLAUDE.md del
 * modulo.
 *
 * COSA NON C'E, E PERCHE. Nessun prezzo: il pagamento e spento per scelta
 * di Manuel e una pagina che dice "4,99 al mese" davanti a un tasto che
 * risponde "non ancora" e la stessa bugia del "primo mese incluso" tolto
 * il 20 agosto. Nessuna recensione e nessun numero (utenti, giornate
 * scritte): non ce ne sono. Nessuna promessa sull'App Store finche l'app
 * non c'e.
 */

import type { LinguaSito } from "@/modules/sito/seo";

export type Testi = {
  nav: { prodotto: string; funzioni: string; domande: string; accedi: string; inizia: string };
  eroe: {
    titolo: string;
    titoloDue: string;
    sotto: string;
    ctaPrimo: string;
    ctaSecondo: string;
    sottoCta: string;
  };
  /** La finestra col prodotto dentro l'eroe: un giorno finto, ma verosimile. */
  esempio: {
    data: string;
    titolo: string;
    prosa: string;
    aree: { nome: string; testo: string }[];
    metriche: { nome: string; valore: string }[];
    obiettivi: string;
  };
  promesse: { titolo: string; testo: string }[];
  /** Le due caselle del riquadro "dove tengo le mie giornate". */
  modalita: { titolo: string; testo: string }[];
  prodotto: { etichetta: string; titolo: string; testo: string };
  funzioni: {
    titolo: string;
    testo: string;
    link: string;
    href: string;
    /** Il riquadro accanto: etichetta e righe finte, cambia per funzione. */
    forma: "oggi" | "mese" | "recap" | "ricorda" | "modalita";
  }[];
  passi: { etichetta: string; titolo: string; voci: { titolo: string; testo: string }[] };
  domande: { etichetta: string; titolo: string; voci: { d: string; r: string }[] };
  fine: { titolo: string; testo: string; cta: string };
  piede: {
    riga: string;
    prodotto: string;
    legale: string;
    account: string;
    funzioni: string;
    assistenza: string;
    privacy: string;
    accedi: string;
    apri: string;
  };
  supporto: {
    titolo: string;
    intro: string;
    oggetto: string;
    descrizione: string;
    descrizioneAiuto: string;
    schermate: string;
    schermateAiuto: string;
    email: string;
    emailAiuto: string;
    annulla: string;
    invia: string;
    inviando: string;
    fatto: string;
    fattoTesto: string;
    errore: string;
    tornaAlSito: string;
    /** Gli errori che il modulo puo mostrare senza chiamare il server. */
    serveOggetto: string;
    serveDescrizione: string;
    serveEmail: string;
    troppeImmagini: string;
  };
};

const it: Testi = {
  nav: {
    prodotto: "Prodotto",
    funzioni: "Funzioni",
    domande: "Domande",
    accedi: "Accedi",
    inizia: "Inizia ora",
  },
  eroe: {
    titolo: "Racconta la giornata.",
    titoloDue: "Il resto lo scrive lui.",
    sotto:
      "Parli due minuti prima di dormire. dayalogue trascrive parola per parola, ne ricava un titolo e una sintesi per aree, e tiene in ordine persone, impegni e ricordi. Mese dopo mese, ne esce un libro.",
    ctaPrimo: "Inizia ora",
    ctaSecondo: "Tienilo solo sul mio dispositivo",
    sottoCta: "Gratis per scrivere e rileggere. Nessuna carta, nessuna pubblicita.",
  },
  esempio: {
    data: "Giovedi 27 agosto",
    titolo: "Consegnato il progetto, e la sera Marco ha chiamato dopo due anni",
    prosa:
      "La giornata e cominciata storta e si e raddrizzata alle sei. Il lavoro e chiuso; quello che resta e quella telefonata.",
    aree: [
      { nome: "Lavoro", testo: "Progetto consegnato, riunione spostata a lunedi." },
      { nome: "Relazioni", testo: "Marco, dopo due anni. Richiamare." },
      { nome: "Corpo", testo: "Poco sonno, mal di testa nel pomeriggio." },
      { nome: "Emozioni", testo: "Sollievo, e un po' di nostalgia." },
    ],
    metriche: [
      { nome: "Umore", valore: "4" },
      { nome: "Energia", valore: "3" },
      { nome: "Peso", valore: "81,4" },
    ],
    obiettivi: "Obiettivi",
  },
  promesse: [
    {
      titolo: "Resta dove vuoi tu",
      testo: "Tutto sul dispositivo, senza account: nemmeno una richiesta di rete.",
    },
    {
      titolo: "Si parla, non si compila",
      testo: "Tieni premuto e racconti. Il testo e la fonte, l'audio si butta.",
    },
    {
      titolo: "Si comincia gratis",
      testo: "Scrivere e rileggere non costa niente. Nessuna pubblicita, mai.",
    },
    {
      titolo: "Italiano e inglese",
      testo: "Anche quello che scrive l'intelligenza artificiale.",
    },
  ],
  modalita: [
    { titolo: "Solo qui", testo: "Nessun account. Zero rete. Le giornate stanno nel telefono." },
    { titolo: "Nel cloud", testo: "Su tutti i tuoi dispositivi, con titoli e recap scritti dall'AI." },
  ],
  prodotto: {
    etichetta: "Prodotto",
    titolo: "Tenere un diario e facile per tre giorni",
    testo:
      "Poi arriva la sera in cui sei stanco e la pagina bianca vince. dayalogue toglie la pagina bianca: parli come parleresti a un amico, e la giornata si scrive da sola. Quello che rileggi a fine mese sono parole tue, non un riassunto di qualcun altro.",
  },
  funzioni: [
    {
      titolo: "La giornata, raccontata a voce",
      testo:
        "Tieni premuto il microfono e parli. Nei silenzi non registra, quindi le voci intorno non entrano. Alla fine correggi i nomi propri se serve, e la giornata e salva: titolo, sintesi, aree. Se preferisci scrivere, si scrive.",
      link: "Guarda com'e fatta",
      href: "/app",
      forma: "oggi",
    },
    {
      titolo: "Il mese in una schermata",
      testo:
        "Una riga per giorno sul telefono, una scacchiera sul computer. I giorni pieni si aprono, quelli vuoti restano vuoti senza rimproverarti. In fondo, quante giornate hai scritto e cosa ricorre.",
      link: "Vai al mese",
      href: "/app/mese",
      forma: "mese",
    },
    {
      titolo: "Recap che si leggono come un libro",
      testo:
        "A fine mese, a fine semestre, a fine anno: un testo scritto per intero, non un elenco di statistiche. Serve a ricordare come stavi, non quante volte sei andato in palestra.",
      link: "Leggi un recap",
      href: "/app/recap",
      forma: "recap",
    },
    {
      titolo: "Ricorda: persone, impegni, luoghi, idee",
      testo:
        "Le cose che nomini mentre racconti finiscono qui da sole, e puoi aggiungerne a mano in due secondi. Le persone diventano anche il vocabolario della trascrizione: i nomi dei tuoi amici smettono di uscire storti.",
      link: "Apri Ricorda",
      href: "/app/remember",
      forma: "ricorda",
    },
    {
      titolo: "Sul tuo dispositivo, oppure nel cloud",
      testo:
        "Al primo avvio scegli tu. In locale le giornate non escono dal telefono e l'app non fa nemmeno una richiesta di rete: niente account, niente server. Nel cloud le ritrovi ovunque, e si accendono le funzioni con l'intelligenza artificiale. Si esporta e si reimporta tutto, quando vuoi.",
      link: "Come funziona",
      href: "/app/benvenuto",
      forma: "modalita",
    },
  ],
  passi: {
    etichetta: "Come si usa",
    titolo: "Tre cose, e poi basta",
    voci: [
      {
        titolo: "Scegli dove tenerle",
        testo:
          "Solo su questo dispositivo, oppure nel cloud con un codice via email. Niente password.",
      },
      {
        titolo: "La sera, parli",
        testo: "Due minuti tenendo premuto. Oppure scrivi, se e una di quelle sere.",
      },
      {
        titolo: "Rileggi quando vuoi",
        testo: "Il mese, la giornata singola, e i recap che arrivano da soli.",
      },
    ],
  },
  domande: {
    etichetta: "Domande",
    titolo: "Quello che chiedono tutti",
    voci: [
      {
        d: "dayalogue e gratis?",
        r: "Scrivere le giornate, rileggerle e portarti via tutto e gratis, senza carta di credito e senza pubblicita. Le funzioni che usano l'intelligenza artificiale - la trascrizione della voce, il titolo, la sintesi per aree, i recap - sono la parte premium.",
      },
      {
        d: "Dove finiscono le mie giornate?",
        r: "Dove decidi tu al primo avvio. In modalita locale restano dentro il dispositivo e l'app non contatta nessuno. Nel cloud stanno su un database europeo, dietro il tuo account, e le vedi solo tu.",
      },
      {
        d: "Chi legge quello che racconto?",
        r: "Nessuna persona. In modalita cloud il testo passa dai modelli di OpenAI per essere riassunto, e basta: non viene usato per addestrare niente e non viene venduto a nessuno.",
      },
      {
        d: "Posso portarmi via i miei dati?",
        r: "Si, in qualsiasi momento: un file solo con tutte le giornate, gli obiettivi, i ricordi e i recap, che si reimporta dove vuoi. E l'account si cancella dall'app, senza scrivere a nessuno.",
      },
      {
        d: "Serve internet?",
        r: "In modalita locale no, mai. Nel cloud serve per salvare e per le funzioni con l'intelligenza artificiale.",
      },
      {
        d: "C'e l'app per iPhone?",
        r: "Sta arrivando. Oggi dayalogue si usa dal browser e si installa sulla schermata Home come un'app.",
      },
    ],
  },
  fine: {
    titolo: "Com'e andata oggi?",
    testo: "Provalo stasera. Ci vogliono due minuti.",
    cta: "Inizia ora",
  },
  piede: {
    riga: "Un diario che si racconta a voce.",
    prodotto: "Prodotto",
    legale: "Legale",
    account: "Account",
    funzioni: "Funzioni",
    assistenza: "Assistenza",
    privacy: "Informativa privacy",
    accedi: "Accedi",
    apri: "Apri l'app",
  },
  supporto: {
    titolo: "Assistenza",
    intro: "Se qualcosa non funziona o hai una domanda, scrivimi. Rispondo a tutti.",
    oggetto: "Qual e il problema",
    descrizione: "Raccontamelo",
    descrizioneAiuto:
      "Cosa hai fatto, cosa e successo, cosa ti aspettavi. Anche poche righe vanno bene.",
    schermate: "Schermate",
    schermateAiuto:
      "Fino a 3 immagini. Le rimpiccioliamo noi prima di inviarle: non devi fare niente.",
    email: "La tua email",
    emailAiuto: "Serve solo per risponderti.",
    annulla: "Annulla",
    invia: "Invia",
    inviando: "Sto inviando...",
    fatto: "Arrivata.",
    fattoTesto: "Ti rispondo all'indirizzo che hai scritto, di solito entro un giorno.",
    errore: "Non sono riuscito a inviarla. Riprova fra poco.",
    tornaAlSito: "Torna a dayalogue",
    serveOggetto: "Scrivi in due parole qual e il problema.",
    serveDescrizione: "Raccontamelo un po' meglio: bastano due righe.",
    serveEmail: "Serve un indirizzo email valido per poterti rispondere.",
    troppeImmagini: "Al massimo tre immagini.",
  },
};

const en: Testi = {
  nav: {
    prodotto: "Product",
    funzioni: "Features",
    domande: "Questions",
    accedi: "Log in",
    inizia: "Get started",
  },
  eroe: {
    titolo: "Tell your day.",
    titoloDue: "It writes the rest.",
    sotto:
      "Talk for two minutes before bed. dayalogue transcribes it word for word, pulls out a headline and a summary by area, and keeps your people, tasks and memories in order. Month after month, it becomes a book.",
    ctaPrimo: "Get started",
    ctaSecondo: "Keep it on this device only",
    sottoCta: "Free to write and to read back. No card, no ads.",
  },
  esempio: {
    data: "Thursday 27 August",
    titolo: "Shipped the project, and Marco called after two years",
    prosa:
      "The day started badly and straightened out at six. Work is done; what stays with me is that phone call.",
    aree: [
      { nome: "Work", testo: "Project shipped, meeting moved to Monday." },
      { nome: "Relationships", testo: "Marco, after two years. Call him back." },
      { nome: "Body", testo: "Little sleep, headache in the afternoon." },
      { nome: "Emotions", testo: "Relief, and a bit of nostalgia." },
    ],
    metriche: [
      { nome: "Mood", valore: "4" },
      { nome: "Energy", valore: "3" },
      { nome: "Weight", valore: "81.4" },
    ],
    obiettivi: "Goals",
  },
  promesse: [
    {
      titolo: "It stays where you want",
      testo: "All on your device, no account: not a single network request.",
    },
    {
      titolo: "You talk, you don't fill in forms",
      testo: "Hold and speak. The text is the source; the audio is thrown away.",
    },
    {
      titolo: "Free to start",
      testo: "Writing and reading back costs nothing. No ads, ever.",
    },
    {
      titolo: "Italian and English",
      testo: "Including what the AI writes.",
    },
  ],
  modalita: [
    { titolo: "Only here", testo: "No account. No network. Your days stay in the phone." },
    { titolo: "In the cloud", testo: "On all your devices, with headlines and recaps written by the AI." },
  ],
  prodotto: {
    etichetta: "Product",
    titolo: "Keeping a journal is easy for three days",
    testo:
      "Then comes the evening when you are tired and the blank page wins. dayalogue removes the blank page: you talk the way you would talk to a friend, and the day writes itself. What you read back at the end of the month is your own words, not somebody else's summary.",
  },
  funzioni: [
    {
      titolo: "Your day, told out loud",
      testo:
        "Hold the microphone and talk. It does not record the silences, so the voices around you never get in. At the end you fix the names if you need to, and the day is saved: headline, summary, areas. If you would rather type, you can type.",
      link: "See how it works",
      href: "/app",
      forma: "oggi",
    },
    {
      titolo: "The whole month on one screen",
      testo:
        "One line per day on the phone, a grid on the computer. Full days open up; empty ones stay empty without telling you off. At the bottom: how many days you wrote, and what keeps coming back.",
      link: "Go to the month",
      href: "/app/mese",
      forma: "mese",
    },
    {
      titolo: "Recaps that read like a book",
      testo:
        "End of month, end of half-year, end of year: a written text, not a list of statistics. It is there to remind you how you were, not how many times you went to the gym.",
      link: "Read a recap",
      href: "/app/recap",
      forma: "recap",
    },
    {
      titolo: "Remember: people, tasks, places, ideas",
      testo:
        "The things you mention while talking end up here by themselves, and you can add more by hand in two seconds. People also become the vocabulary of the transcription: your friends' names stop coming out wrong.",
      link: "Open Remember",
      href: "/app/remember",
      forma: "ricorda",
    },
    {
      titolo: "On your device, or in the cloud",
      testo:
        "You choose the first time you open it. Locally, your days never leave the phone and the app makes not a single network request: no account, no server. In the cloud you find them on every device, and the AI features switch on. You can export and re-import everything, whenever you want.",
      link: "How it works",
      href: "/app/benvenuto",
      forma: "modalita",
    },
  ],
  passi: {
    etichetta: "How to use it",
    titolo: "Three things, and that is it",
    voci: [
      {
        titolo: "Choose where they live",
        testo: "This device only, or in the cloud with a code sent by email. No passwords.",
      },
      {
        titolo: "In the evening, you talk",
        testo: "Two minutes, holding the button. Or you write, if it is one of those evenings.",
      },
      {
        titolo: "Read back whenever",
        testo: "The month, a single day, and the recaps that arrive on their own.",
      },
    ],
  },
  domande: {
    etichetta: "Questions",
    titolo: "What everybody asks",
    voci: [
      {
        d: "Is dayalogue free?",
        r: "Writing your days, reading them back and taking everything with you is free, with no credit card and no ads. The features that use artificial intelligence - voice transcription, the headline, the summary by area, the recaps - are the premium part.",
      },
      {
        d: "Where do my days end up?",
        r: "Where you decide the first time you open it. In local mode they stay inside the device and the app contacts nobody. In the cloud they sit in a European database, behind your account, and only you can see them.",
      },
      {
        d: "Who reads what I say?",
        r: "No person. In cloud mode the text goes to OpenAI's models to be summarised, and that is all: it is not used to train anything and it is not sold to anyone.",
      },
      {
        d: "Can I take my data with me?",
        r: "Yes, at any time: a single file with all your days, goals, notes and recaps, which you can re-import anywhere. And you can delete your account from inside the app, without writing to anyone.",
      },
      {
        d: "Do I need the internet?",
        r: "In local mode, never. In the cloud you need it to save and for the AI features.",
      },
      {
        d: "Is there an iPhone app?",
        r: "It is coming. Today dayalogue runs in the browser and installs on your Home screen like an app.",
      },
    ],
  },
  fine: {
    titolo: "How was today?",
    testo: "Try it tonight. It takes two minutes.",
    cta: "Get started",
  },
  piede: {
    riga: "A journal you tell out loud.",
    prodotto: "Product",
    legale: "Legal",
    account: "Account",
    funzioni: "Features",
    assistenza: "Support",
    privacy: "Privacy policy",
    accedi: "Log in",
    apri: "Open the app",
  },
  supporto: {
    titolo: "Support",
    intro: "If something is not working, or you have a question, write to me. I answer everyone.",
    oggetto: "What is the problem",
    descrizione: "Tell me about it",
    descrizioneAiuto:
      "What you did, what happened, what you expected. A few lines are fine.",
    schermate: "Screenshots",
    schermateAiuto:
      "Up to 3 images. We shrink them for you before sending: nothing for you to do.",
    email: "Your email",
    emailAiuto: "Only used to reply to you.",
    annulla: "Cancel",
    invia: "Send",
    inviando: "Sending...",
    fatto: "Got it.",
    fattoTesto: "I will reply to the address you wrote, usually within a day.",
    errore: "I could not send it. Please try again shortly.",
    tornaAlSito: "Back to dayalogue",
    serveOggetto: "Say in a couple of words what the problem is.",
    serveDescrizione: "Tell me a little more: two lines are enough.",
    serveEmail: "A valid email address is needed so I can reply.",
    troppeImmagini: "Three images at most.",
  },
};

export function testiDi(lingua: LinguaSito): Testi {
  return lingua === "en" ? en : it;
}

/** Il prefisso degli indirizzi del sito nella lingua data: "" oppure "/en". */
export function prefisso(lingua: LinguaSito): string {
  return lingua === "en" ? "/en" : "";
}
