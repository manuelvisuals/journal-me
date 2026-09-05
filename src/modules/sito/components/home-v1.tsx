import Link from "next/link";
import type { ReactNode } from "react";
import type { LinguaSito } from "@/modules/sito/seo";
import { prefisso, testiDi, type Testi } from "@/modules/sito/testi";
import { NavSito, PiedeSito } from "@/modules/sito/components/guscio";

/**
 * LA HOME PRECEDENTE (5 settembre 2026), congelata su /v1 e /en/v1 mentre
 * la 2.0 prende forma in home.tsx. E una copia tale e quale, raggiungibile
 * dal link temporaneo nel piede: quando la 2.0 e approvata, si cancellano
 * questo file, le due pagine src/app/v1 e src/app/en/v1, il link e la voce
 * `piede.precedente` in testi.ts. Non e nella mappa del sito e chiede ai
 * motori di non indicizzarla.
 *
 * (Testo originale del file, per capire cosa faceva.)
 * La home di dayalogue.com (mockup design/mockups/sito-v2.html, approvato
 * da Manuel il 5 settembre 2026; il primo sito era del 31 agosto).
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

/* -------------------------------------------------------------- foto */

function Foto({ nome, className }: { nome: string; className?: string }) {
  // Fotografie statiche in public/sito, decorative: next/image non
  // aggiungerebbe niente a una pagina server con un'immagine per sezione.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/sito/${nome}.webp`}
      alt=""
      aria-hidden="true"
      draggable={false}
      loading="lazy"
      decoding="async"
      className={className}
    />
  );
}

/* --------------------------------------------- icone (tratto, 24px) */

function Icona({ nome }: { nome: "voce" | "chiave" | "apri" | "oggi" | "mese" | "memo" | "recap" | "mic" | "condividi" | "lucchetto" }) {
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

/* ---------------------------------------------------------- la home */

export function HomeSitoV1({
  lingua,
  altraLingua,
}: {
  lingua: LinguaSito;
  altraLingua: string;
}) {
  const t = testiDi(lingua);
  const p = prefisso(lingua);
  const temi = ["carta", "minimal", "macchina", "malva", "wine"];

  return (
    <div className="jm-sito">
      <NavSito lingua={lingua} altraLingua={altraLingua} />

      <main>
        {/* ------------------------------------------------------ eroe */}
        <section className="jm-sito-eroe">
          <div className="jm-sito-cont jm-sito-eroe-in">
            <div className="jm-sito-eroe-t">
              <h1 className="jm-sito-h1">
                {t.eroe.titolo}
                <br />
                {t.eroe.titoloDue}
              </h1>
              <p className="jm-sito-sotto">{t.eroe.sotto}</p>
              <div className="jm-sito-cta">
                <Link href="/login" className="jm-sito-b chiaro lg">
                  {t.eroe.cta}
                </Link>
                <a href="#come" className="jm-sito-link">
                  {t.eroe.ctaSecondo}
                </a>
              </div>
              <p className="jm-sito-sotto-cta">{t.eroe.sottoCta}</p>
            </div>
            <div className="jm-sito-eroe-app">
              <div className="jm-sito-dev">
                <SchermoOggi t={t} />
              </div>
            </div>
          </div>
        </section>

        {/* -------------------------------------------- tre promesse */}
        <section className="jm-sito-promesse-sez">
          <div className="jm-sito-cont">
            <div className="jm-sito-promesse">
              {t.promesse.map((q) => (
                <div key={q.titolo} className="jm-sito-promessa">
                  <Icona nome={q.icona} />
                  <h3>{q.titolo}</h3>
                  <p>{q.testo}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------- la sera */}
        <section className="jm-sito-foto-sez">
          <div className="jm-sito-cont">
            <div className="jm-sito-banda">
              <Foto nome="divano-notte" className="arte" />
              <div className="ft">
                <h2>{t.sera.titolo}</h2>
                <p>{t.sera.testo}</p>
              </div>
            </div>
          </div>
        </section>

        {/* -------------------------------------------- come funziona */}
        <section className="jm-sito-sez" id="come">
          <div className="jm-sito-cont">
            <div className="jm-sito-testa">
              <p className="jm-sito-kick">{t.passi.etichetta}</p>
              <svg className="jm-sito-voce-testo" viewBox="0 0 320 90" aria-hidden="true">
                <g className="onda">
                  <line x1="8" y1="40" x2="8" y2="50" />
                  <line x1="20" y1="30" x2="20" y2="60" />
                  <line x1="32" y1="22" x2="32" y2="68" />
                  <line x1="44" y1="34" x2="44" y2="56" />
                  <line x1="56" y1="18" x2="56" y2="72" />
                  <line x1="68" y1="30" x2="68" y2="60" />
                  <line x1="80" y1="38" x2="80" y2="52" />
                  <line x1="92" y1="26" x2="92" y2="64" />
                  <line x1="104" y1="36" x2="104" y2="54" />
                </g>
                <path className="filo" d="M118 45 C 140 45, 140 45, 158 45" />
                <g className="righe">
                  <rect x="172" y="26" width="120" height="7" rx="3.5" />
                  <rect x="172" y="41" width="140" height="7" rx="3.5" opacity=".55" />
                  <rect x="172" y="56" width="96" height="7" rx="3.5" opacity=".55" />
                </g>
              </svg>
              <h2 className="jm-sito-h2">{t.passi.titolo}</h2>
            </div>
            <div className="jm-sito-passi">
              {t.passi.voci.map((v, i) => (
                <div key={v.titolo} className="jm-sito-passo">
                  <div>
                    <p className="num">0{i + 1}</p>
                    <h3>{v.titolo}</h3>
                    <p>{v.testo}</p>
                  </div>
                  {i === 0 ? <SchermoRegistra t={t} /> : i === 1 ? <SchermoChiedi t={t} /> : <SchermoMese t={t} />}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------ mentre fai altro */}
        <section className="jm-sito-sez mentre" id="mentre">
          <div className="jm-sito-cont">
            <div className="jm-sito-testa">
              <p className="jm-sito-kick">{t.mentre.etichetta}</p>
              <h2 className="jm-sito-h2">{t.mentre.titolo}</h2>
              <p>{t.mentre.testo}</p>
            </div>
            <div className="jm-sito-duo">
              {(["barba", "skincare"] as const).map((f, i) => (
                <figure key={f}>
                  <Foto nome={f} />
                  <figcaption>{t.mentre.didascalie[i]}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* --------------------------------------------- la cassaforte */}
        <section className="jm-sito-sez jm-sito-cassa" id="cassaforte">
          <div className="jm-sito-cont">
            <div className="jm-sito-testa larga">
              <p className="jm-sito-kick">{t.cassaforte.etichetta}</p>
              <h2 className="jm-sito-h2">{t.cassaforte.titolo}</h2>
              <p className="big">{t.cassaforte.testo}</p>
            </div>
            <div className="jm-sito-cassa-viz">
              <div className="jm-sito-cassa-box">
                <p className="l">
                  <span>{t.cassaforte.telefono}</span>
                  <b>{t.cassaforte.leggibile}</b>
                </p>
                <p className="chiaro">
                  <b>{t.esempio.titolo}</b>
                  {t.esempio.prosa}
                </p>
              </div>
              <div className="jm-sito-cassa-freccia" aria-hidden="true">
                <Icona nome="lucchetto" />
                <span>AES-256</span>
              </div>
              <div className="jm-sito-cassa-box">
                <p className="l">
                  <span>{t.cassaforte.server}</span>
                  <b>{t.cassaforte.illeggibile}</b>
                </p>
                <p className="cifra" aria-hidden="true">
                  qN3f8Vb2xLm0pRt7Kc9ZwYh4Ej6Ga1sd5UoiIeWnBvA2lP0mQ7rT9yXz4kJ8cF3hG6bD1nS5vM0wE2uR7tY9iO4pL6aZ8xC3vB5nM1kJ7hG2fD4sA9qW0eR6tY3uI8oP5lK1jH7gF2dS4a6zX9cV0bN3m
                </p>
              </div>
            </div>
            <div className="jm-sito-cassa-griglia">
              <figure className="jm-sito-cassa-chiave">
                <Foto nome="chiave" />
              </figure>
              <div className="jm-sito-cassa-punti">
                {t.cassaforte.punti.map((x) => (
                  <div key={x.titolo}>
                    <h3>{x.titolo}</h3>
                    <p>{x.testo}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
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
            <div className="jm-sito-store">
              <div className="jm-sito-store-t">
                <p className="jm-sito-kick">{t.iphone.etichetta}</p>
                <h2 className="jm-sito-h2 piccolo">{t.iphone.titolo}</h2>
                <p>{t.iphone.testo}</p>
                <p className="jm-sito-store-home">
                  <Icona nome="condividi" />
                  {t.iphone.home}
                </p>
                {/* Il badge: disegnato al suo posto, spento finche l'app non
                    e pubblicata (regola del progetto: nessuna schermata
                    promette cio che non esiste). Con APP_STORE_URL diventa
                    un link vero, senza toccare il resto. */}
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
              <div className="jm-sito-store-dev">
                <div className="jm-sito-dev piccolo">
                  <SchermoOggi t={t} tutte={false} dock={false} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------- domande */}
        <section className="jm-sito-sez" id="domande">
          <div className="jm-sito-cont">
            <div className="jm-sito-testa">
              <p className="jm-sito-kick">{t.domande.etichetta}</p>
              <h2 className="jm-sito-h2">{t.domande.titolo}</h2>
            </div>
            <div className="jm-sito-faq">
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

        {/* -------------------------------------------------- chiusura */}
        <section className="jm-sito-fine">
          <div className="jm-sito-cont">
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

      <PiedeSito lingua={lingua} altraLingua={altraLingua} versione="v1" />

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
