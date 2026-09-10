import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { LinguaSito } from "@/modules/sito/seo";
import { prefisso, testiDi, type Testi } from "@/modules/sito/testi";
import { NavSito, PiedeSito } from "@/modules/sito/components/guscio";
import { Scorrimento } from "@/modules/sito/components/scorrimento";

/**
 * La home di dayalogue.com, VERSIONE 2.0 (dal 6 settembre 2026, su
 * istruzioni dirette di Manuel; la precedente, del 5 settembre, e
 * congelata in home-v1.tsx su /v1 finche questa non e approvata).
 *
 * Cosa cambia nella 2.0: l'eroe e chiaro, con la fotografia dell'iPhone
 * (public/sito/iphone-sera.webp, sfondo trasparente) al posto del salotto;
 * subito dopo, la giornata finita mostrata grande, con le foto.
 *
 * COMPONENTE SERVER, senza nemmeno una riga di stato. E il punto di tutta
 * la faccenda: cio che il motore di ricerca scarica deve essere gia la
 * pagina finita — titoli, paragrafi, domande e risposte, link — non un
 * guscio vuoto che si riempie con JavaScript. Per la stessa ragione non
 * c'e nessun `t()` qui dentro (vedi testi.ts) e i due indirizzi `/` e
 * `/en` sono due pagine vere, non un interruttore.
 *
 * LE SCHERMATE dentro il sito sono DISEGNI in HTML coi token del tema, non
 * screenshot: un PNG invecchia al primo cambio di interfaccia e nessuno
 * se ne accorge finche non e imbarazzante; un disegno segue il tema, la
 * lingua e la dimensione del testo da solo. Le FOTOGRAFIE invece sono
 * vere (public/sito/, nove file webp scelti da Manuel): il salotto al
 * tramonto nell'eroe, la sera sul divano, i due ritratti, la chiave con
 * le otto parole, il comodino. Sono decorative — il testo che contano
 * dire e scritto accanto — quindi `alt=""`.
 *
 * COSA NON C'E: prezzo, recensioni, numeri, badge App Store acceso (vedi
 * APP_STORE_URL). Le miniature "Foto" nella giornata mostrano una funzione
 * in costruzione (miniature dal rullino): se al lancio non c'e ancora, si
 * toglie `Miniature` dalle due schermate e basta.
 */

/**
 * L'indirizzo dell'app sull'App Store. Finche e null il badge e disegnato
 * ma SPENTO ("In arrivo su App Store") e la domanda "C'e l'app per
 * iPhone?" risponde "sta arrivando". Il giorno della pubblicazione si
 * scrive qui l'indirizzo e si aggiornano le due frasi in testi.ts
 * (`iphone.testo`, `iphone.badgeSopra`, ultima domanda): niente ridisegno.
 */
const APP_STORE_URL: string | null = null;

/**
 * Il blocco illeggibile che si vede al posto della giornata nella sezione
 * "Solo tu hai la chiave". E rumore, non una cifratura vera: sta qui e non in
 * testi.ts perche non e testo da tradurre, e `aria-hidden` perche a chi legge
 * con la voce non serve sentirlo.
 */
const CIFRATO =
  "qN3f8Vb2xLm0pRt7Kc9ZwYh4Ej6Ga1sd5UoiIeWnBvA2lP0mQ7rT9yXz4kJ8cF3hG6bD1nS5vM0wE2uR7tY9iO4p" +
  "L6aZ8xC3vB5nM1kJ7hG2fD4sA9qW0eR6tY3uI8oP5lK1jH7gF2dS4a6zX9cV0bN3mQ8wR2tY6uI0oP4lK9jH3gF" +
  "7dS1aZ5xC8vB2nM6kJ0hG4fD9sA3qW7eR1tY5uI9oP3lK7jH1gF5dS9aZ3xC7vB1nM5kJ9hG3fD8sA2qW6eR0tY" +
  "4uI8oP2lK6jH0gF4dS7aZ1xC5vB9nM3kJ7hG1fD6sA0qW4eR8tY2uI6oP0lK4jH8gF2dS5aZ9xC3v";

/* -------------------------------------------------------------- foto */

function Foto({ nome, className, eager = false }: { nome: string; className?: string; eager?: boolean }) {
  // Fotografie statiche in public/sito, decorative: next/image non
  // aggiungerebbe niente a una pagina server con un'immagine per sezione.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/sito/${nome.includes(".") ? nome : `${nome}.webp`}`}
      alt=""
      aria-hidden="true"
      draggable={false}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={className}
    />
  );
}

/* --------------------------------------------- icone (tratto, 24px) */

function Icona({ nome }: { nome: "voce" | "chiave" | "apri" | "scintilla" | "oggi" | "mese" | "memo" | "recap" | "mic" | "condividi" | "lucchetto" }) {
  const d: Record<typeof nome, ReactNode> = {
    voce: (
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
      </>
    ),
    mic: (
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </>
    ),
    chiave: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="3" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        <circle cx="12" cy="15.5" r="1.2" />
      </>
    ),
    lucchetto: (
      <>
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </>
    ),
    apri: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12h8M12 8v8" />
      </>
    ),
    scintilla: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5c.5 2.6 1.9 4 4.5 4.5-2.6.5-4 1.9-4.5 4.5-.5-2.6-1.9-4-4.5-4.5 2.6-.5 4-1.9 4.5-4.5z" />
      </>
    ),
    oggi: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </>
    ),
    mese: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
    memo: (
      <>
        <path d="M5 4h11l3 3v13H5z" />
        <path d="M9 12h6M9 16h6" />
      </>
    ),
    recap: (
      <path d="M4 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H4zM20 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z" />
    ),
    condividi: <path d="M12 3v12M8 7l4-4 4 4M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />,
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="jm-sito-ico">
      {d[nome]}
    </svg>
  );
}

/* ------------------------------------------- pezzi delle schermate */

function Testata({ testo }: { testo: string }) {
  return (
    <div className="jm-sito-app-top">
      <span className="d">{testo}</span>
      <span className="av" aria-hidden="true">
        <Foto nome="ritratto" />
      </span>
    </div>
  );
}

function Dock({ t }: { t: Testi }) {
  const icone = ["oggi", "mese", "memo", "recap"] as const;
  return (
    <div className="jm-sito-dock" aria-hidden="true">
      {t.esempio.dock.slice(0, 2).map((v, i) => (
        <span key={v} className={i === 0 ? "on" : undefined}>
          <Icona nome={icone[i]} />
          {v}
        </span>
      ))}
      <span className="mic">
        <Icona nome="mic" />
      </span>
      {t.esempio.dock.slice(2).map((v, i) => (
        <span key={v}>
          <Icona nome={icone[i + 2]} />
          {v}
        </span>
      ))}
    </div>
  );
}

function Misure({ t, quante = 3 }: { t: Testi; quante?: number }) {
  return (
    <div className="jm-sito-misure">
      {t.esempio.metriche.slice(0, quante).map((m) => (
        <div key={m.nome} className="jm-sito-mis">
          <span className="l">{m.nome}</span>
          <span className="v">{m.valore}</span>
        </div>
      ))}
    </div>
  );
}

/** Le foto del giorno, in miniatura: quattro ritagli di un'unica immagine. */
function Miniature({ t }: { t: Testi }) {
  return (
    <div className="jm-sito-foto-riga">
      <span className="l">{t.esempio.foto}</span>
      <div className="jm-sito-thumbs" aria-hidden="true">
        <i className="a" />
        <i className="b" />
        <i className="c" />
        <i className="d" />
      </div>
    </div>
  );
}

/** La schermata Oggi con la giornata salvata. */
function SchermoOggi({ t, tutte = true, dock = true }: { t: Testi; tutte?: boolean; dock?: boolean }) {
  const aree = tutte ? t.esempio.aree : t.esempio.aree.slice(0, 2);
  return (
    <div className="jm-sito-app">
      <Testata testo={t.esempio.data} />
      <div className="jm-sito-foglio">
        <p className="tit">{t.esempio.titolo}</p>
        <p className="prosa">{t.esempio.prosa}</p>
        <div className="jm-sito-aree">
          {aree.map((a) => (
            <div key={a.nome} className="jm-sito-area">
              <span className="l">{a.nome}</span>
              <span className="t">{a.testo}</span>
            </div>
          ))}
        </div>
        {tutte ? (
          <div className="jm-sito-chips">
            <span className="jm-sito-chip">{t.esempio.persona}</span>
            <span className="jm-sito-chip acc">{t.esempio.impegno}</span>
          </div>
        ) : null}
        <Miniature t={t} />
        <Misure t={t} quante={tutte ? 3 : 2} />
      </div>
      <div className={dock ? "jm-sito-app-fondo" : "jm-sito-app-fondo corto"} />
      {dock ? <Dock t={t} /> : null}
    </div>
  );
}

function SchermoRegistra({ t }: { t: Testi }) {
  const r = t.esempio.registrazione;
  return (
    <div className="jm-sito-app">
      <Testata testo={t.esempio.data} />
      <div className="jm-sito-reg">
        <div className="onda" aria-hidden="true">
          {Array.from({ length: 18 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
        <p className="tempo">{r.tempo}</p>
        <p className="stato">{r.stato}</p>
        <p className="parole">
          {r.prima}
          <b>{r.forte}</b>
          {r.dopo}
        </p>
        <span className="jm-sito-mic-big" aria-hidden="true">
          <Icona nome="mic" />
        </span>
        <p className="tieni">{r.tieni}</p>
      </div>
      <div className="jm-sito-app-fondo corto" />
    </div>
  );
}

function SchermoChiedi({ t }: { t: Testi }) {
  const c = t.esempio.chiedi;
  return (
    <div className="jm-sito-app">
      <Testata testo={`${c.etichetta} · ${c.contatore}`} />
      <div className="jm-sito-chiedi">
        <span className="l">{c.etichetta}</span>
        <p className="q">{c.domanda}</p>
        <p className="estratto">{c.estratto}</p>
        <p className="risp">
          {c.risposta}
          <span aria-hidden="true">|</span>
        </p>
        <div className="due" aria-hidden="true">
          <span>{c.salta}</span>
          <span className="p">{c.avanti}</span>
        </div>
      </div>
      <div className="jm-sito-app-fondo corto" />
    </div>
  );
}

function SchermoMese({ t, quanti = 4 }: { t: Testi; quanti?: number }) {
  return (
    <div className="jm-sito-app">
      <Testata testo={t.esempio.mese} />
      <div className="jm-sito-mese">
        {t.esempio.giorni.slice(0, quanti).map((g) => (
          <div key={g.n} className={g.aree ? "jm-sito-giorno" : "jm-sito-giorno vuoto"}>
            <span className="n">{g.n}</span>
            <span>
              <span className="t">{g.titolo}</span>
              {g.aree ? <span className="m">{g.aree}</span> : null}
            </span>
          </div>
        ))}
      </div>
      <div className="jm-sito-app-fondo corto" />
    </div>
  );
}

function SchermoMemo({ t }: { t: Testi }) {
  return (
    <div className="jm-sito-app">
      <Testata testo={t.esempio.memo.titolo} />
      <div className="jm-sito-memo">
        {t.esempio.memo.gruppi.map((g) => (
          <div key={g.nome} className="grp">
            <span className="l">{g.nome}</span>
            {g.righe.map((r) => (
              <div key={r.t} className={r.fatto ? "r fatto" : "r"}>
                {r.t}
                {r.m ? <span>{r.m}</span> : null}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="jm-sito-app-fondo corto" />
    </div>
  );
}

function Libro({ t }: { t: Testi }) {
  return (
    <div className="jm-sito-libro" aria-hidden="true">
      <div className="pag" />
      <div className="pag" />
      <div className="cop">
        <span className="m">dayalogue</span>
        <span className="a">
          <small>{t.esempio.recap.etichetta}</small>
          {t.esempio.mese}
        </span>
      </div>
    </div>
  );
}

function Riquadro({ forma, t }: { forma: Testi["funzioni"]["voci"][number]["forma"]; t: Testi }) {
  if (forma === "oggi") return <SchermoOggi t={t} tutte={false} dock={false} />;
  if (forma === "mese") return <SchermoMese t={t} quanti={5} />;
  if (forma === "memo") return <SchermoMemo t={t} />;
  return <Libro t={t} />;
}

/* ------------------------------- la giornata: un ritratto e la sua pagina

   Ordine dentro <figure>: fotografia, pagina, didascalia. La didascalia sta
   per ULTIMA perche <figcaption> deve essere il primo o l'ultimo figlio di
   <figure>, e qui fa anche da STRATO: e alta quanto la fotografia ed e lei a
   scorrere, cosi la corsa del vetro e in percentuale dell'immagine e vale
   uguale su ogni schermo. Il vetro vero e la <span> dentro. */

function Ritratto({
  lato,
  foto,
  voce,
  stato,
  g,
}: {
  lato: "donna" | "uomo";
  foto: string;
  voce: string;
  stato: string;
  g: Testi["giornate"]["lei"];
}) {
  return (
    <figure className={`jm-sito8-persona ${lato}`} data-fx="foto">
      <Foto nome={foto} />

      <article className="jm-sito8-pagina" aria-label={g.titolo}>
        <header>
          <span>{g.data}</span>
          <b>dayalogue</b>
        </header>
        <h3>{g.titolo}</h3>
        <p>{g.prosa}</p>
        <div className="jm-sito8-miniature" aria-hidden="true">
          <Foto nome="salotto-voce" />
          <Foto nome="comodino" />
          <Foto nome="divano-notte" />
        </div>
        <div className="jm-sito8-pagina-fondo">
          <span>{g.area}</span>
          <span>{g.umore}</span>
        </div>
      </article>

      <figcaption className="jm-sito8-strato">
        <span className="jm-sito8-vetro">
          <span className="jm-sito8-rec"><i /> {stato}</span>
          <q>{voce}</q>
          <span className="jm-sito8-onda" aria-hidden="true">
            {Array.from({ length: 18 }, (_, i) => <i key={i} />)}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}

/* ---------------------------------------------------------- la home */

export function HomeSito({
  lingua,
  altraLingua,
  archivioV5 = false,
}: {
  lingua: LinguaSito;
  altraLingua: string;
  archivioV5?: boolean;
}) {
  const t = testiDi(lingua);
  const p = prefisso(lingua);
  const temi = ["carta", "minimal", "macchina", "malva", "wine"];

  return (
    <div className={`jm-sito jm-sito4${archivioV5 ? " jm-sito4-archivio-v5" : " jm-sito7"}`}>
      {/* Le animazioni di scorrimento (solo la home viva: la v5 congelata
          non ha la classe jm-sito7 e resta ferma). */}
      {archivioV5 ? null : <Scorrimento />}
      <NavSito lingua={lingua} altraLingua={altraLingua} v4 />

      <main>
        {/* ------------------------------------------------------ eroe */}
        <section className="jm-sito2-eroe">
          <div className="jm-sito-cont jm-sito2-eroe-in">
            <div className="jm-sito2-eroe-t">
              <p className="jm-sito4-eyebrow">
                {t.eroeVivo.etichetta}
              </p>
              <h1 className="jm-sito-h1">
                {t.eroe.titolo}
                <br />
                {t.eroe.titoloDue}
              </h1>
              <p className="jm-sito2-sotto">{t.eroeVivo.sotto}</p>
              <div className="jm-sito-cta">
                <Link href="/login" className="jm-sito-b p lg">
                  {t.eroeVivo.cta}
                </Link>
                {/* Secondaria per davvero: un tasto di contorno, non un link
                    nudo. Resta accessibile, ma il gesto dominante e uno solo. */}
                <a href="#come" className="jm-sito-b jm-sito10-secondo">
                  {t.eroeVivo.ctaSecondo}
                </a>
              </div>
              <ul className="jm-sito10-garanzie">
                {t.eroeVivo.garanzie.map((g) => (
                  <li key={g}>
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="jm-sito10-spunta">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M8.2 12.3l2.6 2.6 5-5.4" />
                    </svg>
                    {g}
                  </li>
                ))}
              </ul>

            {/* Il rituale reso visibile: non e un lettore vero e non e un tasto,
                e la sera di chi usa Dayalogue messa nella scena. Serve a far
                capire il prodotto senza mostrare un mockup tecnologico. */}
            <div className="jm-sito10-rituale-vivo" aria-hidden="true">
              <span className="tondo">
                <span className="onda">
                  {Array.from({ length: 5 }, (_, i) => <i key={i} />)}
                </span>
              </span>
              <span className="parole">
                <span className="quando">{t.eroeVivo.quando}</span>
                <span className="domanda">{t.eroeVivo.domanda}</span>
              </span>
            </div>
            </div>
          </div>
          {/* LA SCENA. La fotografia e il telefono stanno nello STESSO
              riquadro, non uno sopra l'altro nella pagina: il telefono e
              posizionato in percentuale dentro la scena, quindi qualunque
              cosa faccia la finestra, resta sempre nello stesso punto
              rispetto a lei. Prima la foto era un background cover (il
              ritaglio cambia con la finestra) e il telefono era piazzato
              rispetto alla pagina: le due cose scorrevano una sull'altra e
              su certi schermi il telefono finiva sulla sua bocca. */}
          <div className="jm-sito2-eroe-media">
            <Foto nome="salotto-voce" className="scena" eager />
            <Foto nome="iphone-giornata" className="jm-sito4-telefono jm-sito4-telefono-foto" eager />
          </div>
          <section className="jm-sito4-rituale" id="rituale">
            <p className="jm-sito4-eyebrow">{t.rituale.etichetta}</p>
            <h2>{t.rituale.titolo}</h2>
            <div className="jm-sito4-rituale-voci">
              {t.rituale.voci.map((voce) => (
                <div key={voce.titolo}>
                  {/* Il v5 archiviato tiene la sua icona di allora. */}
                  <span><Icona nome={archivioV5 && voce.icona === "scintilla" ? "apri" : voce.icona} /></span>
                  <div>
                    <h3>{voce.titolo}</h3>
                    <p>{voce.testo}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>

        {/* La scena "voce → pagina" che si componeva allo scorrimento e stata
            rimossa dalla home viva (Manuel, 9 settembre 2026): resta intatta
            su /v6, insieme al suo CSS (.jm-sito6-*) e ai testi vocePaginaTre. */}

        {/* -------------------------------------------- tre promesse */}
        <section className="jm-sito-promesse-sez piana">
          <div className="jm-sito-cont">
            <div className="jm-sito-promesse">
              {t.promesse.map((q, i) => (
                <div key={q.titolo} className="jm-sito-promessa" data-fx="testo" style={{ "--i": i } as CSSProperties}>
                  <Icona nome={q.icona} />
                  <h3>{q.titolo}</h3>
                  <p>{q.testo}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* --------------------------------- come funziona (scena bloccata) */}
        {/* LA SCENA (jm-sito12, 11 settembre 2026, mockup approvato da Manuel).
            Prende il posto di DUE sezioni: i tre passi in colonna e la
            fotografia dello schermo, che erano la stessa cosa detta due volte
            a trenta pixel di distanza — i passi come disegni, il telefono come
            oggetto — e chi scorreva vedeva le stesse tre schermate di fila.

            Adesso e un racconto solo. Il telefono e gia mezzo fuori dal bordo
            sinistro quando la scena si incolla: non entra, c'e. Le tre carte
            salgono dal basso una alla volta, in dissolvenza dal basso e in
            dissolvenza verso l'alto, e il titolo in cima cambia con loro.
            Quando l'ultima e sparita il telefono scivola al centro e resta una
            frase sola.

            L'ancora #come resta qui: a lei puntano la barra in alto e il
            piede. Il titolo della sezione, per chi legge con lo schermo o
            senza JavaScript, e la frase finale (aria-labelledby). Senza
            JavaScript la scena non si incolla e diventa una colonna normale:
            titolo, carta, titolo, carta, e in fondo il telefono. */}
        <section className="jm-sito12" id="come" aria-labelledby="jm-sito12-fine">
          <div className="jm-sito12-pista" data-pista="avanti">
            <div className="jm-sito12-scena">
              <p className="jm-sito-kick jm-sito12-occhio">{t.passi.etichetta}</p>
              {t.passi.voci.map((v, i) => (
                <div className="jm-sito12-passo" key={v.titolo}>
                  <h2 className="jm-sito12-titolo">{v.titolo}</h2>
                  <div className="jm-sito12-carta">
                    <div className="jm-sito12-schermo">
                      {i === 0 ? <SchermoRegistra t={t} /> : i === 1 ? <SchermoChiedi t={t} /> : <SchermoMese t={t} />}
                    </div>
                    <p>{v.testo}</p>
                  </div>
                </div>
              ))}
              <h2 className="jm-sito12-titolo fine" id="jm-sito12-fine">{t.prova.finale}</h2>
              {/* Il telefono sta in fondo nel documento, non in cima: nella
                  scena e posizionato in assoluto e l'ordine non conta (lo
                  decide lo z-index), ma senza JavaScript la sezione si legge
                  nell'ordine in cui e scritta — e li l'oggetto va DOPO la
                  frase che chiude, non prima dei tre passi. */}
              <Foto nome="iphone-giornata" className="jm-sito12-telefono" />
            </div>
          </div>
        </section>

        {/* ------------------------------------------ solo tu hai la chiave */}
        {/* La cassaforte rifatta il 10 settembre 2026 (mockup approvato da
            Manuel). Tiene l'ancora #cassaforte a cui puntano menu e piede.
            La vecchia .jm-sito-cassa resta nel CSS e nei testi: la usano gli
            archivi /v1../v6. */}
        <section className="jm-sito9-chiave" id="cassaforte" aria-labelledby="jm-sito9-titolo">
          <div className="jm-sito9-cont">
            <p className="jm-sito9-intro">{t.chiave.testo}</p>

            <div className="jm-sito9-pista" data-pista="avanti">
              <div className="jm-sito9-scena" data-misura>
                {/* Il titolo sta DENTRO la scena ferma e racconta cosa sta
                    succedendo sotto: tre stati che si danno il cambio col
                    cursore. Essendo tutto funzione di --s, tornando su con lo
                    scorrimento la frase torna indietro da sola e il testo
                    cifrato ridiventa leggibile. */}
                <h2 className="jm-sito9-titolo" id="jm-sito9-titolo" data-titolo>
                  <span className="uno">{t.chiave.titoloUno}</span>
                  <span className="due">{t.chiave.titoloDue}</span>
                  <span className="tre">{t.chiave.titoloTre}</span>
                </h2>

                <div className="jm-sito9-palco">
                  <div className="jm-sito9-lastra" data-lastra>
                    <p className="jm-sito9-riga">
                      <span>{t.chiave.etichettaGiornata}</span>
                      <b>{t.esempio.data}</b>
                    </p>
                    <div className="jm-sito9-corpo" data-corpo>
                      <div className="jm-sito9-strato">
                        <p className="jm-sito9-chiaro">
                          <span className="t">{t.esempio.titolo}</span>
                          {t.esempio.prosa}
                        </p>
                      </div>
                      <div className="jm-sito9-strato cifrato" aria-hidden="true">
                        <p className="jm-sito9-cifra">{CIFRATO}</p>
                      </div>
                    </div>
                  </div>

                  {/* La chiave: parte sotto la lastra e sale DIETRO di lei. Il
                      suo bordo alto e anche il fronte di cifratura, quindi le
                      due cose non possono andare fuori sincrono. */}
                  <div className="jm-sito9-chiavi" data-chiavi>
                    <p className="jm-sito9-riga">
                      <span>{t.chiave.etichettaChiave}</span>
                      <b>{t.chiave.otto}</b>
                    </p>
                    <div className="jm-sito9-parole">
                      {t.chiave.parole.map((parola, i) => (
                        <div key={parola}>
                          <span className="n">{`0${i + 1}`}</span>
                          <span className="w">{parola}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="jm-sito9-punti">
              {t.chiave.punti.map((x, i) => (
                <div key={x.titolo} data-fx="testo" style={{ "--i": i } as CSSProperties}>
                  <h3>{x.titolo}</h3>
                  <p>{x.testo}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* LA GIORNATA. Dall'11 settembre 2026 sta QUI, dopo la cassaforte
            (Manuel). Prima veniva subito dopo l'eroe, cioe prima ancora di
            aver detto come funziona e a chi resta la chiave: due ritratti e
            due pagine private in faccia a chi era arrivato da trenta secondi.
            Nell'ordine di adesso il visitatore sa gia il gesto (l'eroe), il
            meccanismo (la scena bloccata) e chi puo leggere (la cassaforte);
            queste due giornate sono la conseguenza, e si leggono come tali.

            L'ancora #giornata resta la sua: la usa il menu del telefono negli
            archivi. Il tasto di contorno dell'eroe invece adesso punta a
            #come, che e la risposta vera a "guarda come funziona" — e che
            resta dov'era, poco sotto. */}
        <section className="jm-sito8-giornata" id="giornata" aria-labelledby="jm-sito8-titolo">
          <div className="jm-sito8-testa" data-fx="testo">
            <p className="jm-sito-kick">{t.vocePagina.etichetta}</p>
            <h2 id="jm-sito8-titolo">{t.vocePagina.titolo}</h2>
            <p>{t.vocePagina.testo}</p>
          </div>

          {/* La pista e alta piu di quattro schermate: la scena ci sta ferma
              dentro (sticky) e scorrerla muove --s da 0 a 1. Due atti in fila,
              i tempi stanno in styles.css sotto .jm-sito8-scena. */}
          <div className="jm-sito8-pista" data-pista>
            <div className="jm-sito8-scena">
              <Ritratto
                lato="donna"
                foto="skincare"
                voce={t.vocePagina.donna}
                stato={t.vocePagina.stato}
                g={t.giornate.lei}
              />
              <Ritratto
                lato="uomo"
                foto="barba"
                voce={t.vocePagina.uomo}
                stato={t.vocePagina.stato}
                g={t.giornate.lui}
              />
            </div>
          </div>

          {/* I tre punti che stavano nella sezione "La giornata" (tolta il 9
              settembre 2026): la promessa la fa la scena qui sopra, questi
              dicono cosa resta scritto. */}
          <div className="jm-sito8-punti">
            {t.giornata.punti.map((x, i) => (
              <div key={x.titolo} data-fx="testo" style={{ "--i": i } as CSSProperties}>
                <h3>{x.titolo}</h3>
                <p>{x.testo}</p>
              </div>
            ))}
          </div>

          <p className="jm-sito8-chiusura" data-fx="testo">{t.vocePagina.chiusura}</p>
        </section>

        {/* ------------------------------------------------- funzioni */}
        <section className="jm-sito-sez" id="funzioni">
          <div className="jm-sito-cont">
            <div className="jm-sito-testa">
              <p className="jm-sito-kick">{t.funzioni.etichetta}</p>
              <h2 className="jm-sito-h2">{t.funzioni.titolo}</h2>
            </div>
            <div className="jm-sito-funz">
              {t.funzioni.voci.map((f, i) => (
                <div key={f.titolo} className={i % 2 === 1 ? "jm-sito-fx inv" : "jm-sito-fx"}>
                  <div className="jm-sito-fx-t">
                    <h3>{f.titolo}</h3>
                    <p>{f.testo}</p>
                    <Link href={f.href} className="jm-sito-link">
                      {f.link}
                    </Link>
                  </div>
                  <div className="jm-sito-fx-v">
                    <Riquadro forma={f.forma} t={t} />
                  </div>
                </div>
              ))}
            </div>
            <div className="jm-sito-lingue">
              <div className="jm-sito-promessa">
                <h3>{t.temi.titolo}</h3>
                <p>{t.temi.testo}</p>
                <div className="jm-sito-temi" aria-hidden="true">
                  {temi.map((n) => (
                    <span key={n} className={`jm-sito-tema ${n}`} />
                  ))}
                </div>
              </div>
              <div className="jm-sito-promessa">
                <h3>{t.lingue.titolo}</h3>
                <p>{t.lingue.testo}</p>
                <p className="jm-sito-ital">
                  {t.lingue.frase} <span>{t.lingue.fraseAltra}</span>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------- le tre condizioni */}
        <section className="jm-sito-sez" id="condizioni">
          <div className="jm-sito-cont">
            <div className="jm-sito-testa">
              <p className="jm-sito-kick">{t.condizioni.etichetta}</p>
              <h2 className="jm-sito-h2">{t.condizioni.titolo}</h2>
              <p>{t.condizioni.testo}</p>
            </div>
            <div className="jm-sito-cond">
              {t.condizioni.carte.map((c, i) => (
                <div key={c.nome} className={c.premium ? "jm-sito-cc p" : "jm-sito-cc"}>
                  <p className="l">{c.nome}</p>
                  <h3>{c.titolo}</h3>
                  <p>{c.testo}</p>
                  <ul>
                    {c.voci.map((v) => (
                      <li key={v.testo} className={v.presto ? "presto" : undefined}>
                        {v.testo}
                        {v.presto ? <span className="tag">{t.condizioni.inArrivo}</span> : null}
                      </li>
                    ))}
                  </ul>
                  <div className="fine">
                    {i === 0 ? (
                      <Link href="/login" className="jm-sito-b g">
                        {c.fine}
                      </Link>
                    ) : (
                      <span className="nota">{c.fine}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="jm-sito-cond-nota">{t.condizioni.nota}</p>
          </div>
        </section>

        {/* ------------------------------------------- iPhone / App Store */}
        <section className="jm-sito-sez" id="iphone">
          <div className="jm-sito-cont">
            <div className="jm-sito4-store-banner" data-fx="testo">
              <div>
                <p className="jm-sito-kick">{t.iphone.etichetta}</p>
                <h2 className="jm-sito-h2 piccolo">{t.iphone.titolo}</h2>
                <p>{t.iphone.testo}</p>
              </div>
              {APP_STORE_URL ? (
                <a href={APP_STORE_URL} className="jm-sito-badge">
                  <BadgeDentro sopra={t.iphone.badgeSopra} nome={t.iphone.badgeNome} />
                </a>
              ) : (
                <span className="jm-sito-badge spento" aria-label={`${t.iphone.badgeSopra} ${t.iphone.badgeNome}`}>
                  <BadgeDentro sopra={t.iphone.badgeSopra} nome={t.iphone.badgeNome} />
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------- domande */}
        <section className="jm-sito-sez" id="domande">
          <div className="jm-sito-cont">
            <div className="jm-sito-testa" data-fx="testo">
              <p className="jm-sito-kick">{t.domande.etichetta}</p>
              <h2 className="jm-sito-h2">{t.domande.titolo}</h2>
            </div>
            <div className="jm-sito-faq" data-fx="testo" style={{ "--i": 1 } as CSSProperties}>
              {t.domande.voci.map((v, i) => (
                // <details> senza JavaScript: si apre e si chiude da solo, e
                // il testo della risposta e comunque nell'HTML per Google.
                <details key={v.d} open={i === 0}>
                  <summary>{v.d}</summary>
                  <p>{v.r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------------- la sera (l'ultimo respiro) */}
        {/* Dall'11 settembre 2026 sta QUI, in fondo, attaccata alla chiusura
            (Manuel). Prima veniva quasi in cima, fra le tre promesse e la
            scena: una fotografia grande e una frase lenta in mezzo al
            racconto di come funziona, cioe una pausa proprio dove il
            visitatore aveva appena cominciato a capire. In fondo invece fa
            quello per cui e nata — abbassare la voce — e passa il testimone
            alla domanda che chiude la pagina. */}
        <section className="jm-sito-foto-sez">
          <div className="jm-sito-cont">
            <div className="jm-sito-banda" data-fx="sfondo">
              <Foto nome="divano-notte" className="arte" />
              <div className="ft" data-fx="testo">
                <h2>{t.sera.titolo}</h2>
                <p>{t.sera.testo}</p>
              </div>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------- chiusura */}
        <section className="jm-sito-fine">
          <div className="jm-sito-cont" data-fx="testo">
            <h2>{t.fine.titolo}</h2>
            <p>{t.fine.testo}</p>
            <div className="jm-sito-cta centro">
              <Link href="/login" className="jm-sito-b p lg">
                {t.fine.cta}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PiedeSito lingua={lingua} altraLingua={altraLingua} versione={archivioV5 ? "v5" : "2"} />

      {/*
        I dati strutturati: e cio che permette a Google di mostrare le
        domande direttamente nel risultato, invece di una riga di testo.
        Sono le STESSE domande che si leggono sopra — generate dallo stesso
        elenco, quindi non possono divergere.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "SoftwareApplication",
                name: "dayalogue",
                applicationCategory: "LifestyleApplication",
                operatingSystem: "Web, iOS",
                url: `https://www.dayalogue.com${p}/`,
                inLanguage: lingua,
                description: t.eroe.sotto,
              },
              {
                "@type": "FAQPage",
                inLanguage: lingua,
                mainEntity: t.domande.voci.map((v) => ({
                  "@type": "Question",
                  name: v.d,
                  acceptedAnswer: { "@type": "Answer", text: v.r },
                })),
              },
            ],
          }),
        }}
      />
    </div>
  );
}

function BadgeDentro({ sopra, nome }: { sopra: string; nome: string }) {
  return (
    <>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="mela">
        <path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.8 1.3 10.3.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.2zM13.9 5c.7-.9 1.2-2 1-3.2-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1.1 3 1.1.1 2.3-.5 3-1.3z" />
      </svg>
      <span className="bt">
        <small>{sopra}</small>
        <b>{nome}</b>
      </span>
    </>
  );
}
