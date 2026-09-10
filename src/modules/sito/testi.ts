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
 * VERSIONE 2 (mockup design/mockups/sito-v2.html, approvato da Manuel il
 * 5 settembre 2026). Cosa e cambiato rispetto al 31 agosto: si apre e
 * basta (ospite), la cassaforte al centro, l'AI in regalo per dieci
 * giornate, le fotografie.
 *
 * COSA NON C'E, E PERCHE. Nessun prezzo: sul web non si paga, chi vuole
 * premium viene mandato all'app per iPhone, e un prezzo davanti a un tasto
 * che non c'e e la stessa bugia del "primo mese incluso" tolto il 20
 * agosto. Nessuna recensione e nessun numero (utenti, giornate scritte):
 * non ce ne sono. Il badge App Store e disegnato ma spento finche l'app
 * non e pubblicata (vedi APP_STORE_URL in home.tsx).
 */

import type { LinguaSito } from "@/modules/sito/seo";

export type Testi = {
  nav: { come: string; cassaforte: string; domande: string; privacy: string; diario: string; accedi: string; inizia: string };
  eroe: {
    etichetta: string;
    titolo: string;
    titoloDue: string;
    sotto: string;
    cta: string;
    ctaSecondo: string;
    sottoCta: string;
  };
  /**
   * L'eroe della home VIVA, rifatto il 10 settembre 2026 sull'audit di un
   * revisore esterno approvato da Manuel. Sta a parte da `eroe` perche
   * quello lo usano ancora gli archivi /v1../v6, che devono restare
   * identici. Il titolo invece e lo stesso e si legge da `eroe`.
   */
  eroeVivo: {
    etichetta: string;
    sotto: string;
    cta: string;
    ctaSecondo: string;
    /** Il micro-lettore nella scena: non e un tasto, e il rituale reso visibile. */
    quando: string;
    domanda: string;
    garanzie: string[];
  };
  rituale: {
    etichetta: string;
    titolo: string;
    voci: { titolo: string; testo: string; icona: "voce" | "apri" | "scintilla" | "recap" }[];
  };
  /** La giornata finta, ma verosimile, che compare in tutte le schermate. */
  esempio: {
    data: string;
    titolo: string;
    prosa: string;
    aree: { nome: string; testo: string }[];
    persona: string;
    impegno: string;
    foto: string;
    metriche: { nome: string; valore: string }[];
    dock: string[];
    registrazione: { tempo: string; stato: string; prima: string; forte: string; dopo: string; tieni: string };
    chiedi: { etichetta: string; contatore: string; domanda: string; estratto: string; risposta: string; salta: string; avanti: string };
    mese: string;
    giorni: { n: string; titolo: string; aree?: string }[];
    memo: { titolo: string; gruppi: { nome: string; righe: { t: string; m?: string; fatto?: boolean }[] }[] };
    recap: { etichetta: string; sezione: string; titolo: string; paragrafi: string[] };
  };
  promesse: { titolo: string; testo: string; icona: "voce" | "chiave" | "apri" }[];
  /** Il blocco dopo l'eroe: la giornata finita, mostrata grande. */
  giornata: { etichetta: string; titolo: string; testo: string; punti: { titolo: string; testo: string }[] };
  vocePagina: {
    etichetta: string;
    titolo: string;
    testo: string;
    donna: string;
    uomo: string;
    stato: string;
    chiusura: string;
  };
  /** Le due giornate scritte che entrano dai lati nella sezione "La giornata". */
  giornate: {
    lei: { data: string; titolo: string; prosa: string; area: string; umore: string };
    lui: { data: string; titolo: string; prosa: string; area: string; umore: string };
  };
  /** La cassaforte rifatta (10 settembre 2026): "Solo tu hai la chiave". */
  chiave: {
    /** Le tre frasi che si danno il cambio mentre l'animazione va. */
    titoloUno: string;
    titoloDue: string;
    titoloTre: string;
    testo: string;
    etichettaGiornata: string;
    etichettaChiave: string;
    otto: string;
    /** Otto parole d'esempio: non sono una chiave vera. */
    parole: string[];
    punti: { titolo: string; testo: string }[];
  };
  vocePaginaTre: {
    etichetta: string;
    titoloPrima: string;
    titoloDopo: string;
    testo: string;
    donna: string;
    uomo: string;
    stato: string;
    nota: string;
    chiusura: string;
  };
  sera: { titolo: string; testo: string };
  passi: { etichetta: string; titolo: string; voci: { titolo: string; testo: string }[] };
  mentre: { etichetta: string; titolo: string; testo: string; didascalie: string[] };
  cassaforte: {
    etichetta: string;
    titolo: string;
    testo: string;
    soloTu: string;
    telefono: string;
    server: string;
    leggibile: string;
    illeggibile: string;
    punti: { titolo: string; testo: string }[];
  };
  funzioni: {
    etichetta: string;
    titolo: string;
    voci: { titolo: string; testo: string; link: string; href: string; forma: "oggi" | "mese" | "memo" | "recap" }[];
  };
  temi: { titolo: string; testo: string };
  lingue: { titolo: string; testo: string; frase: string; fraseAltra: string };
  condizioni: {
    etichetta: string;
    titolo: string;
    testo: string;
    carte: { nome: string; titolo: string; testo: string; voci: { testo: string; presto?: boolean }[]; fine: string; premium?: boolean }[];
    inArrivo: string;
    nota: string;
  };
  iphone: { etichetta: string; titolo: string; testo: string; home: string; badgeSopra: string; badgeNome: string };
  domande: { etichetta: string; titolo: string; voci: { d: string; r: string }[] };
  fine: { titolo: string; testo: string; cta: string };
  piede: {
    riga: string;
    prodotto: string;
    legale: string;
    account: string;
    come: string;
    cassaforte: string;
    domande: string;
    apri: string;
    privacy: string;
    accedi: string;
    assistenza: string;
    lingua: string;
    /** TEMPORANEI: i due link di confronto fra la home nuova e la v1. */
    precedente: string;
    congelata: string;
    congelata3: string;
    congelata4: string;
    congelata5: string;
    congelata6: string;
    nuovo: string;
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
    come: "Come funziona",
    cassaforte: "Cassaforte",
    domande: "Domande",
    privacy: "Privacy",
    diario: "Diario",
    accedi: "Accedi",
    inizia: "Inizia ora",
  },
  eroe: {
    etichetta: "Un diario privato, raccontato",
    titolo: "Racconta il giorno.",
    titoloDue: "Conserva la vita.",
    sotto:
      "Due minuti a voce. La mattina, il tuo giorno e scritto, privato, limpido, pronto per essere ritrovato.",
    cta: "Inizia stasera",
    ctaSecondo: "Come funziona",
    sottoCta: "Nessun account per iniziare · Cifrato sul tuo dispositivo",
  },
  eroeVivo: {
    etichetta: "Il tuo diario, a voce",
    sotto:
      "Parla per due minuti. Dayalogue trasforma la tua voce in una pagina privata, pronta da ritrovare.",
    cta: "Provalo stasera",
    ctaSecondo: "Guarda come funziona",
    quando: "Stasera \u00b7 2 minuti",
    domanda: "\u201cCom'e andata oggi?\u201d",
    garanzie: ["Nessun account per iniziare", "Cifrato sul tuo dispositivo"],
  },
  rituale: {
    etichetta: "Un piccolo rituale",
    titolo: "Parla. Ricorda. Ritorna.",
    voci: [
      { titolo: "Parla", testo: "Due minuti, a voce.", icona: "voce" },
      { titolo: "Ricorda", testo: "Il giorno diventa una pagina.", icona: "scintilla" },
      { titolo: "Ritorna", testo: "La tua vita, pronta da rileggere.", icona: "recap" },
    ],
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
    persona: "Marco",
    impegno: "Richiamare Marco",
    foto: "Foto",
    metriche: [
      { nome: "Umore", valore: "4" },
      { nome: "Energia", valore: "3" },
      { nome: "Peso", valore: "81,4" },
    ],
    dock: ["Oggi", "Mese", "Memo", "Recap"],
    registrazione: {
      tempo: "1:42",
      stato: "Sto ascoltando",
      prima: "...la riunione l'hanno spostata a lunedi, e va bene cosi. Poi stasera, verso le nove, ",
      forte: "mi ha chiamato Marco. Due anni",
      dopo: " che non ci sentivamo...",
      tieni: "Tieni premuto. Lascia quando hai finito.",
    },
    chiedi: {
      etichetta: "Da chiarire",
      contatore: "1 di 2",
      domanda: "Chi e Marco?",
      estratto: "\"...mi ha chiamato Marco. Due anni che non ci sentivamo...\"",
      risposta: "Un amico dell'universita",
      salta: "Salta",
      avanti: "Avanti",
    },
    mese: "Agosto 2026",
    giorni: [
      { n: "27", titolo: "Consegnato il progetto, e la sera Marco ha chiamato dopo due anni", aree: "Lavoro, Relazioni, Corpo, Emozioni" },
      { n: "26", titolo: "Una giornata di attesa, e la corsa al fiume", aree: "Lavoro, Corpo" },
      { n: "25", titolo: "Niente, e va bene cosi" },
      { n: "24", titolo: "Pranzo con mamma, e il progetto che non finisce", aree: "Relazioni, Lavoro, Emozioni" },
      { n: "23", titolo: "Domenica lenta, il libro finito sul divano", aree: "Corpo, Emozioni" },
    ],
    memo: {
      titolo: "Memo",
      gruppi: [
        {
          nome: "Persone",
          righe: [
            { t: "Marco", m: "amico dell'universita" },
            { t: "Mamma", m: "pranzo la domenica" },
            { t: "Giulia", m: "collega" },
          ],
        },
        {
          nome: "Impegni",
          righe: [
            { t: "Richiamare Marco", m: "27 ago" },
            { t: "Riunione spostata", m: "lun 31" },
            { t: "Consegnare il progetto", m: "27 ago", fatto: true },
          ],
        },
        { nome: "Idee", righe: [{ t: "Un weekend al lago, a settembre" }] },
      ],
    },
    recap: {
      etichetta: "Recap",
      sezione: "Il mese",
      titolo: "Un agosto di consegne, e una telefonata che ha cambiato il tono",
      paragrafi: [
        "E stato un mese tirato, con il progetto che ha preso quasi tutte le sere e il sonno che ne ha risentito. Eppure, rileggendo, quello che resta non e la fatica.",
        "Resta Marco che chiama dopo due anni, la corsa al fiume, i pranzi della domenica. Le cose piccole hanno tenuto insieme le grandi.",
      ],
    },
  },
  promesse: [
    {
      titolo: "Si parla, non si compila",
      testo: "Tieni premuto e racconti. Nei silenzi non registra. Se preferisci scrivere, si scrive.",
      icona: "voce",
    },
    {
      titolo: "Chiuso a chiave sul telefono",
      testo: "Ogni giornata parte gia cifrata. Nessuno la puo leggere, nemmeno chi ha fatto l'app.",
      icona: "chiave",
    },
    {
      titolo: "Si apre e basta",
      testo: "Niente account, niente carta, niente pubblicita. L'AI e in regalo per dieci giornate.",
      icona: "apri",
    },
  ],
  giornata: {
    etichetta: "La giornata",
    titolo: "Parli tu. Scrive lui.",
    testo: "Alla fine dei due minuti la giornata e gia una pagina. Parole tue, messe in ordine.",
    punti: [
      { titolo: "Titolo e sintesi", testo: "Un titolo che ricorda, due righe che raccontano." },
      { titolo: "Le foto del giorno", testo: "Dal rullino, in miniatura, accanto alle parole." },
      { titolo: "Umore, energia, peso", testo: "I numeri che dici a voce finiscono nelle caselle." },
    ],
  },
  vocePagina: {
    etichetta: "La tua giornata, scritta",
    titolo: "Parli tu. Dayalogue la scrive.",
    testo: "Due minuti di parole diventano una pagina chiara, intima e pronta da ritrovare.",
    donna: "...oggi finalmente abbiamo chiuso il progetto.",
    uomo: "...poi mi ha chiamato Marco. Dopo due anni.",
    stato: "Sto ascoltando",
    chiusura: "Le tue parole. Una vita più tua.",
  },
  giornate: {
    lei: {
      data: "Giovedi 27 agosto",
      titolo: "Abbiamo chiuso il progetto, e per la prima volta ho cenato senza pensarci",
      prosa:
        "Giornata storta fino alle sei, poi la firma e il silenzio buono che viene dopo. Stasera niente schermi.",
      area: "Lavoro",
      umore: "Umore \u00b7 4",
    },
    lui: {
      data: "Martedi 2 settembre",
      titolo: "Mi ha chiamato Marco, dopo due anni",
      prosa:
        "Stavo per andare a dormire. Quarantatre minuti al telefono, come se non fosse passato niente. Domani lo richiamo io.",
      area: "Marco",
      umore: "Umore \u00b7 5",
    },
  },
  chiave: {
    titoloUno: "Solo tu hai la chiave.",
    titoloDue: "Otto parole. Non passano mai da noi.",
    titoloTre: "Senza quelle otto parole il diario non si riapre.",
    testo:
      "Se scegli di tenere il diario anche sul cloud, il backup viene cifrato con una chiave di otto parole che possiedi soltanto tu. Senza quelle otto parole il diario non si riapre: non possiamo farlo noi, non puo farlo nessuno.",
    etichettaGiornata: "La tua giornata",
    etichettaChiave: "La tua chiave",
    otto: "Otto parole",
    parole: ["salpare", "cardo", "vetrina", "molo", "ruggine", "fienile", "tacco", "brina"],
    punti: [
      {
        titolo: "Le otto parole le ricevi una volta",
        testo: "Le tieni con uno screenshot, o le lasci nel portachiavi di iCloud. Non passano mai da noi.",
      },
      {
        titolo: "Il backup sul cloud e una tua scelta",
        testo: "Puoi tenere il diario solo sul dispositivo. Se lo salvi anche sul cloud, sale gia cifrato.",
      },
      {
        titolo: "Senza la chiave non si torna indietro",
        testo: "Chi perde le otto parole e i dispositivi perde il diario. Nessuno puo recuperarlo: e il punto.",
      },
    ],
  },
  vocePaginaTre: {
    etichetta: "La tua giornata, scritta",
    titoloPrima: "Parli tu.",
    titoloDopo: "la scrive.",
    testo: "Due minuti di parole diventano una pagina chiara, intima e pronta da ritrovare.",
    donna: "...poi mi ha chiamato Marco. Dopo due anni.",
    uomo: "...oggi finalmente abbiamo chiuso il progetto.",
    stato: "Sto ascoltando",
    nota: "Le cose importanti trovano sempre il modo.",
    chiusura: "Le tue parole. Una vita più tua.",
  },
  sera: {
    titolo: "Due minuti, prima di dormire.",
    testo: "Non serve la penna, non serve la pagina bianca. Serve solo dire com'e andata.",
  },
  passi: {
    etichetta: "Come funziona",
    titolo: "Come funziona?",
    voci: [
      { titolo: "La sera, parli", testo: "Due minuti col microfono premuto. O scrivi, se e una di quelle sere." },
      { titolo: "Si scrive da sola", testo: "Titolo, sintesi, persone, impegni. Se un nome non e chiaro, te lo chiede." },
      { titolo: "Rileggi quando vuoi", testo: "Il mese, una giornata sola, o il recap che arriva da se." },
    ],
  },
  mentre: {
    etichetta: "Mentre fai altro",
    titolo: "Non e un compito. E una chiacchiera.",
    testo: "Mentre ti fai la barba, mentre aspetti che l'acqua bolla. Parli, ed e scritta.",
    didascalie: [
      "\"...e la riunione l'hanno spostata a lunedi, va bene cosi...\"",
      "\"...e poi stasera mi ha chiamato Marco. Due anni.\"",
    ],
  },
  cassaforte: {
    etichetta: "La cassaforte",
    titolo: "Nemmeno noi possiamo leggere il tuo diario.",
    testo:
      "Ogni giornata si chiude a chiave sul dispositivo, con la serratura di Safari e Chrome. Sul server arriva un blocco illeggibile: anche noi vediamo solo quello.",
    soloTu: "Solo tu hai la chiave.",
    telefono: "Sul tuo telefono",
    server: "Sul server",
    leggibile: "leggibile",
    illeggibile: "illeggibile",
    punti: [
      {
        titolo: "La chiave sono otto parole",
        testo: "Le ricevi una volta e le tieni con uno screenshot. Viaggiano nel portachiavi di iCloud.",
      },
      {
        titolo: "Nessun recupero",
        testo: "Chi perde le parole e i dispositivi perde il diario. Nessuno puo recuperarlo: e il punto.",
      },
      {
        titolo: "L'AI legge solo quando glielo chiedi",
        testo:
          "Il testo esce dal dispositivo solo nel momento in cui chiedi all'AI di lavorarci, e solo per quello: passa dai modelli di OpenAI per essere trascritto e riassunto, non viene conservato ne usato per addestrare niente.",
      },
    ],
  },
  funzioni: {
    etichetta: "Cosa c'e dentro",
    titolo: "Quattro schermate, un libro",
    voci: [
      {
        titolo: "Oggi: la giornata, raccontata a voce",
        testo:
          "Tieni premuto il microfono e parli. Alla fine correggi i nomi se serve, e la giornata e salva: titolo, sintesi, aree, persone, misure, obiettivi. E le foto del giorno, dal rullino.",
        link: "Guarda com'e fatta",
        href: "/app",
        forma: "oggi",
      },
      {
        titolo: "Mese: una riga per giorno",
        testo:
          "Sul telefono una riga per giorno, sul computer una scacchiera. I giorni pieni si aprono, quelli vuoti restano vuoti senza rimproverarti.",
        link: "Vai al mese",
        href: "/app/mese",
        forma: "mese",
      },
      {
        titolo: "Memo: persone, impegni, luoghi, idee",
        testo:
          "Le cose che nomini mentre racconti finiscono qui da sole. Le persone diventano anche il vocabolario della trascrizione: i nomi dei tuoi amici smettono di uscire storti.",
        link: "Apri Memo",
        href: "/app/remember",
        forma: "memo",
      },
      {
        titolo: "Recap: il mese, scritto come un capitolo",
        testo:
          "A fine mese, a fine semestre, a fine anno: un testo scritto per intero, non un elenco di statistiche. Serve a ricordare come stavi, non quante volte sei andato in palestra.",
        link: "Leggi un recap",
        href: "/app/recap",
        forma: "recap",
      },
    ],
  },
  temi: {
    titolo: "Cinque temi, chiaro e scuro",
    testo: "Carta, Minimal, Macchina, Malva, Wine. Il sito segue il tema che hai scelto nell'app.",
  },
  lingue: {
    titolo: "Italiano e inglese",
    testo: "Anche in quello che scrive l'AI: titolo, sintesi, recap.",
    frase: "Com'e andata oggi?",
    fraseAltra: "How was your day?",
  },
  condizioni: {
    etichetta: "Come si comincia",
    titolo: "Si apre e basta.",
    testo:
      "Nessuna domanda al primo avvio. Quando vorrai ritrovare le giornate su un altro dispositivo, ti chiederemo una email. Niente password, mai.",
    carte: [
      {
        nome: "Ospite",
        titolo: "Apri e parli",
        testo: "Nessun account, nessuna domanda.",
        voci: [
          { testo: "Le giornate stanno sul dispositivo" },
          { testo: "L'AI in regalo: dieci giornate" },
          { testo: "Scrivere e rileggere, per sempre" },
        ],
        fine: "Inizia ora",
      },
      {
        nome: "Account",
        titolo: "Una email, un codice",
        testo: "Te la chiediamo noi, dopo cinque giornate. Niente password.",
        voci: [
          { testo: "Sul dispositivo e sul server, chiuse a chiave" },
          { testo: "Le ritrovi su iPhone, iPad e computer" },
          { testo: "Lo stesso regalo di AI" },
        ],
        fine: "Si attiva dentro l'app",
      },
      {
        nome: "Premium",
        titolo: "Senza limiti",
        testo: "Per chi racconta tutte le sere.",
        voci: [
          { testo: "AI senza limiti" },
          { testo: "I Recap del mese, del semestre, dell'anno" },
          { testo: "Backup automatico ogni notte", presto: true },
        ],
        fine: "Si attiva dall'app per iPhone, con un periodo di prova",
        premium: true,
      },
    ],
    inArrivo: "in arrivo",
    nota: "Quando il regalo finisce, finisce solo l'AI: scrivere, salvare e rileggere restano gratis, per sempre. Nessuna pubblicita, mai.",
  },
  iphone: {
    etichetta: "dayalogue per iPhone e iPad",
    titolo: "Sul telefono, come un'app.",
    testo: "Oggi si usa dal browser e si installa sulla Home come un'app. L'app per iPhone e in arrivo sull'App Store.",
    home: "Da Safari: Condividi, poi \"Aggiungi alla schermata Home\"",
    badgeSopra: "In arrivo su",
    badgeNome: "App Store",
  },
  domande: {
    etichetta: "Domande",
    titolo: "Domande Frequenti",
    voci: [
      {
        d: "dayalogue e gratis?",
        r: "Scrivere, salvare e rileggere e gratis per sempre. L'AI e in regalo per dieci giornate, poi senza limiti con premium.",
      },
      {
        d: "Dove finiscono le mie giornate?",
        r: "Sul tuo dispositivo. Con un account anche sul server, ma chiuse a chiave prima di partire: nessuno le puo leggere, nemmeno noi.",
      },
      {
        d: "Chi legge quello che racconto?",
        r: "Nessuna persona. Il testo esce dal dispositivo solo quando chiedi all'AI di lavorarci: passa dai modelli di OpenAI per essere trascritto e riassunto, non viene conservato ne usato per addestrare niente.",
      },
      {
        d: "E se perdo il telefono?",
        r: "Con un account e le tue otto parole ritrovi tutto altrove. Senza, il diario non si recupera: nessuno ha la chiave.",
      },
      {
        d: "Posso portarmi via i miei dati?",
        r: "Si, quando vuoi: un file solo con tutto, che si reimporta dove vuoi. E l'account si cancella dall'app.",
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
    come: "Come funziona",
    cassaforte: "Cassaforte",
    domande: "Domande",
    apri: "Apri l'app",
    privacy: "Informativa privacy",
    accedi: "Accedi",
    assistenza: "Assistenza",
    lingua: "English",
    precedente: "Sito precedente (v1)",
    congelata: "Sito del 5 settembre (v2)",
    congelata3: "Sito del 7 settembre (v3)",
    congelata4: "Sito editoriale approvato (v4)",
    congelata5: "Sito prima della versione mobile (v5)",
    congelata6: "Sito prima delle animazioni (v6)",
    nuovo: "Sito nuovo (2.0)",
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
    come: "How it works",
    cassaforte: "The vault",
    domande: "Questions",
    privacy: "Privacy",
    diario: "Journal",
    accedi: "Log in",
    inizia: "Get started",
  },
  eroe: {
    etichetta: "A private journal, spoken",
    titolo: "Tell the day.",
    titoloDue: "Keep the life.",
    sotto:
      "Two minutes out loud. By morning, your day is written, private, clear, and yours to return to.",
    cta: "Start tonight",
    ctaSecondo: "How it works",
    sottoCta: "No account to begin · Encrypted on your device",
  },
  eroeVivo: {
    etichetta: "Your journal, spoken",
    sotto:
      "Talk for two minutes. Dayalogue turns your voice into a private page, ready to return to.",
    cta: "Try it tonight",
    ctaSecondo: "See how it works",
    quando: "Tonight \u00b7 2 minutes",
    domanda: "\u201cHow did today go?\u201d",
    garanzie: ["No account to start", "Encrypted on your device"],
  },
  rituale: {
    etichetta: "A small ritual",
    titolo: "Speak. Remember. Return.",
    voci: [
      { titolo: "Speak", testo: "Two minutes, out loud.", icona: "voce" },
      { titolo: "Remember", testo: "The day becomes a page.", icona: "scintilla" },
      { titolo: "Return", testo: "Your life, ready to revisit.", icona: "recap" },
    ],
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
    persona: "Marco",
    impegno: "Call Marco back",
    foto: "Photos",
    metriche: [
      { nome: "Mood", valore: "4" },
      { nome: "Energy", valore: "3" },
      { nome: "Weight", valore: "81.4" },
    ],
    dock: ["Today", "Month", "Memo", "Recap"],
    registrazione: {
      tempo: "1:42",
      stato: "Listening",
      prima: "...they moved the meeting to Monday, which is fine. Then tonight, around nine, ",
      forte: "Marco called. Two years",
      dopo: " since we last spoke...",
      tieni: "Hold. Let go when you are done.",
    },
    chiedi: {
      etichetta: "To clarify",
      contatore: "1 of 2",
      domanda: "Who is Marco?",
      estratto: "\"...Marco called. Two years since we last spoke...\"",
      risposta: "A friend from university",
      salta: "Skip",
      avanti: "Next",
    },
    mese: "August 2026",
    giorni: [
      { n: "27", titolo: "Shipped the project, and Marco called after two years", aree: "Work, Relationships, Body, Emotions" },
      { n: "26", titolo: "A day of waiting, and the run by the river", aree: "Work, Body" },
      { n: "25", titolo: "Nothing, and that is fine" },
      { n: "24", titolo: "Lunch with mum, and the project that never ends", aree: "Relationships, Work, Emotions" },
      { n: "23", titolo: "Slow Sunday, the book finished on the sofa", aree: "Body, Emotions" },
    ],
    memo: {
      titolo: "Memo",
      gruppi: [
        {
          nome: "People",
          righe: [
            { t: "Marco", m: "friend from university" },
            { t: "Mum", m: "Sunday lunch" },
            { t: "Giulia", m: "colleague" },
          ],
        },
        {
          nome: "Tasks",
          righe: [
            { t: "Call Marco back", m: "27 Aug" },
            { t: "Meeting moved", m: "Mon 31" },
            { t: "Ship the project", m: "27 Aug", fatto: true },
          ],
        },
        { nome: "Ideas", righe: [{ t: "A weekend at the lake, in September" }] },
      ],
    },
    recap: {
      etichetta: "Recap",
      sezione: "The month",
      titolo: "An August of deadlines, and a phone call that changed the tone",
      paragrafi: [
        "It was a tight month, with the project taking almost every evening and sleep paying for it. And yet, reading it back, what stays is not the effort.",
        "What stays is Marco calling after two years, the run by the river, the Sunday lunches. The small things held the big ones together.",
      ],
    },
  },
  promesse: [
    {
      titolo: "You talk, you don't fill in forms",
      testo: "Hold the button and tell it. Silence is not recorded. If you would rather write, you write.",
      icona: "voce",
    },
    {
      titolo: "Locked on your phone",
      testo: "Every day leaves already encrypted. Nobody can read it, not even the people who made the app.",
      icona: "chiave",
    },
    {
      titolo: "Just open it",
      testo: "No account, no card, no ads. The AI is a gift for ten days.",
      icona: "apri",
    },
  ],
  giornata: {
    etichetta: "Your day",
    titolo: "You talk. It writes.",
    testo: "When the two minutes are over, the day is already a page. Your words, put in order.",
    punti: [
      { titolo: "Headline and summary", testo: "A headline that remembers, two lines that tell." },
      { titolo: "The day's photos", testo: "From your camera roll, as thumbnails, next to the words." },
      { titolo: "Mood, energy, weight", testo: "The numbers you say out loud land in their boxes." },
    ],
  },
  vocePagina: {
    etichetta: "Your day, written",
    titolo: "You talk. Dayalogue writes it.",
    testo: "Two minutes of words become a clear, intimate page, ready to return to.",
    donna: "...today we finally finished the project.",
    uomo: "...then Marco called me. After two years.",
    stato: "Listening",
    chiusura: "Your words. A life that feels more yours.",
  },
  giornate: {
    lei: {
      data: "Thursday 27 August",
      titolo: "We closed the project, and for once I had dinner without thinking about it",
      prosa:
        "The day went sideways until six, then the signature and the good quiet that follows. No screens tonight.",
      area: "Work",
      umore: "Mood \u00b7 4",
    },
    lui: {
      data: "Tuesday 2 September",
      titolo: "Marco called me, after two years",
      prosa:
        "I was about to go to bed. Forty-three minutes on the phone, as if no time had passed. Tomorrow I call him.",
      area: "Marco",
      umore: "Mood \u00b7 5",
    },
  },
  chiave: {
    titoloUno: "Only you hold the key.",
    titoloDue: "Eight words. They never pass through us.",
    titoloTre: "Without those eight words the journal never opens again.",
    testo:
      "If you choose to keep your journal in the cloud too, the backup is encrypted with an eight-word key that only you hold. Without those eight words the journal never opens again: not by us, not by anyone.",
    etichettaGiornata: "Your day",
    etichettaChiave: "Your key",
    otto: "Eight words",
    parole: ["harbour", "thistle", "window", "pier", "rust", "barn", "heel", "frost"],
    punti: [
      {
        titolo: "You receive the eight words once",
        testo: "Keep them with a screenshot, or leave them in the iCloud keychain. They never pass through us.",
      },
      {
        titolo: "The cloud backup is your choice",
        testo: "You can keep the journal on your device alone. If you save it to the cloud too, it goes up already encrypted.",
      },
      {
        titolo: "Without the key there is no way back",
        testo: "Lose the eight words and your devices and you lose the journal. Nobody can recover it: that is the point.",
      },
    ],
  },
  vocePaginaTre: {
    etichetta: "Your day, written",
    titoloPrima: "You talk.",
    titoloDopo: "writes it.",
    testo: "Two minutes of words become a clear, intimate page, ready to return to.",
    donna: "...then Marco called me. After two years.",
    uomo: "...today we finally finished the project.",
    stato: "Listening",
    nota: "The important things always find a way.",
    chiusura: "Your words. A life that feels more yours.",
  },
  sera: {
    titolo: "Two minutes, before sleep.",
    testo: "No pen, no blank page. Just say how it went.",
  },
  passi: {
    etichetta: "How it works",
    titolo: "How does it work?",
    voci: [
      { titolo: "In the evening, you talk", testo: "Two minutes with the microphone held down. Or you write, if it is one of those evenings." },
      { titolo: "It writes itself", testo: "Headline, summary, people, tasks. If a name is unclear, it asks." },
      { titolo: "Read back whenever", testo: "The month, a single day, or the recap that arrives on its own." },
    ],
  },
  mentre: {
    etichetta: "While you do something else",
    titolo: "It is not a chore. It is a chat.",
    testo: "While you shave, while you wait for the water to boil. You talk, and it is written.",
    didascalie: [
      "\"...and they moved the meeting to Monday, which is fine...\"",
      "\"...and then tonight Marco called. Two years.\"",
    ],
  },
  cassaforte: {
    etichetta: "The vault",
    titolo: "Not even we can read your journal.",
    testo:
      "Every day is locked on your device, with the lock Safari and Chrome use. What reaches the server is an unreadable block: that is all we see too.",
    soloTu: "Only you hold the key.",
    telefono: "On your phone",
    server: "On the server",
    leggibile: "readable",
    illeggibile: "unreadable",
    punti: [
      {
        titolo: "The key is eight words",
        testo: "You get them once and keep them with a screenshot. They travel in your iCloud Keychain.",
      },
      {
        titolo: "No recovery",
        testo: "Lose the words and every device, and the journal is gone. Nobody can recover it: that is the point.",
      },
      {
        titolo: "The AI reads only when you ask",
        testo:
          "The text leaves the device only when you ask the AI to work on it, and only for that: it goes through OpenAI's models to be transcribed and summarised, it is not stored and it is not used to train anything.",
      },
    ],
  },
  funzioni: {
    etichetta: "What is inside",
    titolo: "Four screens, one book",
    voci: [
      {
        titolo: "Today: your day, told out loud",
        testo:
          "Hold the microphone and talk. At the end you fix names if needed, and the day is saved: headline, summary, areas, people, measures, goals. And the day's photos, from your camera roll.",
        link: "See what it looks like",
        href: "/app",
        forma: "oggi",
      },
      {
        titolo: "Month: one line per day",
        testo:
          "One line per day on the phone, a grid on the computer. Full days open up, empty days stay empty without telling you off.",
        link: "Go to the month",
        href: "/app/mese",
        forma: "mese",
      },
      {
        titolo: "Memo: people, tasks, places, ideas",
        testo:
          "The things you mention while talking end up here by themselves. People also become the vocabulary of the transcription: your friends' names stop coming out wrong.",
        link: "Open Memo",
        href: "/app/remember",
        forma: "memo",
      },
      {
        titolo: "Recap: the month, written like a chapter",
        testo:
          "End of month, end of half-year, end of year: a written text, not a list of statistics. It is there to remind you how you were, not how many times you went to the gym.",
        link: "Read a recap",
        href: "/app/recap",
        forma: "recap",
      },
    ],
  },
  temi: {
    titolo: "Five themes, light and dark",
    testo: "Carta, Minimal, Macchina, Malva, Wine. The site follows the theme you chose in the app.",
  },
  lingue: {
    titolo: "Italian and English",
    testo: "Also in what the AI writes: headline, summary, recaps.",
    frase: "How was your day?",
    fraseAltra: "Com'e andata oggi?",
  },
  condizioni: {
    etichetta: "How you start",
    titolo: "Just open it.",
    testo:
      "No questions the first time. When you want to find your days on another device, we will ask for an email. No passwords, ever.",
    carte: [
      {
        nome: "Guest",
        titolo: "Open and talk",
        testo: "No account, no questions.",
        voci: [
          { testo: "Your days stay on the device" },
          { testo: "The AI as a gift: ten days" },
          { testo: "Write and read back, forever" },
        ],
        fine: "Get started",
      },
      {
        nome: "Account",
        titolo: "An email, a code",
        testo: "We ask you, after five days. No password.",
        voci: [
          { testo: "On the device and on the server, locked" },
          { testo: "Find them on iPhone, iPad and computer" },
          { testo: "The same AI gift" },
        ],
        fine: "Switched on inside the app",
      },
      {
        nome: "Premium",
        titolo: "No limits",
        testo: "For those who tell every evening.",
        voci: [
          { testo: "Unlimited AI" },
          { testo: "The month, half-year and year Recaps" },
          { testo: "Automatic backup every night", presto: true },
        ],
        fine: "Switched on from the iPhone app, with a trial period",
        premium: true,
      },
    ],
    inArrivo: "coming",
    nota: "When the gift ends, only the AI ends: writing, saving and reading back stay free, forever. No ads, ever.",
  },
  iphone: {
    etichetta: "dayalogue for iPhone and iPad",
    titolo: "On your phone, like an app.",
    testo: "Today it runs in the browser and installs on your Home screen like an app. The iPhone app is coming to the App Store.",
    home: "From Safari: Share, then \"Add to Home Screen\"",
    badgeSopra: "Coming to the",
    badgeNome: "App Store",
  },
  domande: {
    etichetta: "Questions",
    titolo: "Frequently asked questions",
    voci: [
      {
        d: "Is dayalogue free?",
        r: "Writing, saving and reading back is free forever. The AI is a gift for ten days, then unlimited with premium.",
      },
      {
        d: "Where do my days end up?",
        r: "On your device. With an account also on the server, but locked before they leave: nobody can read them, not even us.",
      },
      {
        d: "Who reads what I say?",
        r: "No person. The text leaves the device only when you ask the AI to work on it: it goes through OpenAI's models to be transcribed and summarised, it is not stored and it is not used to train anything.",
      },
      {
        d: "What if I lose my phone?",
        r: "With an account and your eight words you get everything back elsewhere. Without them, it cannot be recovered: nobody has the key.",
      },
      {
        d: "Can I take my data with me?",
        r: "Yes, whenever: one file with everything, which you can re-import anywhere. And the account deletes from inside the app.",
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
    come: "How it works",
    cassaforte: "The vault",
    domande: "Questions",
    apri: "Open the app",
    privacy: "Privacy policy",
    accedi: "Log in",
    assistenza: "Support",
    lingua: "Italiano",
    precedente: "Previous site (v1)",
    congelata: "Site of 5 September (v2)",
    congelata3: "Site of 7 September (v3)",
    congelata4: "Approved editorial site (v4)",
    congelata5: "Site before the mobile edition (v5)",
    congelata6: "Site before the scroll animations (v6)",
    nuovo: "New site (2.0)",
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
