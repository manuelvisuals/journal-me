import Link from "next/link";
import type { LinguaSito } from "@/modules/sito/seo";
import { prefisso, testiDi, type Testi } from "@/modules/sito/testi";
import { NavSito, PiedeSito } from "@/modules/sito/components/guscio";

/**
 * La home di dayalogue.com (mockup design/mockups/sito-seo.html, approvato
 * da Manuel il 31 agosto 2026).
 *
 * COMPONENTE SERVER, senza nemmeno una riga di stato. E il punto di tutta
 * la faccenda: cio che il motore di ricerca scarica deve essere gia la
 * pagina finita — titoli, paragrafi, domande e risposte, link — non un
 * guscio vuoto che si riempie con JavaScript. Per la stessa ragione non
 * c'e nessun `t()` qui dentro (vedi testi.ts) e i due indirizzi `/` e
 * `/en` sono due pagine vere, non un interruttore.
 *
 * Le finestrelle accanto alle funzioni sono DISEGNI, non screenshot: un
 * PNG di una schermata invecchia al primo cambio di interfaccia e nessuno
 * se ne accorge finche non e imbarazzante. Questi riquadri usano i token
 * del tema, quindi seguono l'app da soli.
 */

function Riquadro({ forma, t }: { forma: Testi["funzioni"][number]["forma"]; t: Testi }) {
  if (forma === "oggi") {
    return (
      <div className="jm-sito-riq">
        <p className="jm-sito-lab">{t.esempio.data}</p>
        <p className="jm-sito-shot-tit">{t.esempio.titolo}</p>
        <p className="jm-sito-shot-pro">{t.esempio.prosa}</p>
      </div>
    );
  }
  if (forma === "mese") {
    // 28 celle: un mese verosimile, con i vuoti che restano vuoti.
    const pieni = new Set([2, 3, 4, 6, 7, 8, 10, 11, 12, 13, 14, 16, 17, 18, 19, 21, 22, 23]);
    return (
      <div className="jm-sito-riq">
        <div className="jm-sito-griglia">
          {Array.from({ length: 28 }, (_, i) => (
            <i
              key={i}
              className={i === 24 ? "oggi" : pieni.has(i) ? "pieno" : undefined}
            />
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <div className="jm-sito-riga-g">
            <span className="d">27</span>
            <span className="h">{t.esempio.titolo}</span>
          </div>
        </div>
      </div>
    );
  }
  if (forma === "recap") {
    return (
      <div className="jm-sito-riq">
        <p className="jm-sito-lab">{t.esempio.data}</p>
        <p className="jm-sito-rec">{t.esempio.prosa}</p>
      </div>
    );
  }
  if (forma === "ricorda") {
    return (
      <div className="jm-sito-riq">
        <p>
          {t.esempio.aree.map((a, i) => (
            <span key={a.nome} className={i === 0 ? "jm-sito-chip on" : "jm-sito-chip"}>
              {a.nome}
            </span>
          ))}
        </p>
        {t.esempio.aree.slice(0, 3).map((a) => (
          <div key={a.nome} className="jm-sito-riga-g">
            <span className="h">{a.testo}</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="jm-sito-riq">
      <div className="jm-sito-due">
        {t.modalita.map((m) => (
          <div key={m.titolo}>
            <p className="t">{m.titolo}</p>
            <p className="d">{m.testo}</p>
          </div>
        ))}
      </div>
      <p className="jm-sito-nota">{t.eroe.sottoCta}</p>
    </div>
  );
}

export function HomeSito({
  lingua,
  altraLingua,
}: {
  lingua: LinguaSito;
  altraLingua: string;
}) {
  const t = testiDi(lingua);
  const p = prefisso(lingua);

  return (
    <div className="jm-sito">
      <NavSito lingua={lingua} altraLingua={altraLingua} />

      <main>
        <section className="jm-sito-eroe jm-sito-cont">
          <h1 className="jm-sito-h1">
            {t.eroe.titolo}
            <span>{t.eroe.titoloDue}</span>
          </h1>
          <p className="jm-sito-sotto">{t.eroe.sotto}</p>
          <div className="jm-sito-cta">
            <Link href="/login" className="jm-sito-b p lg">
              {t.eroe.ctaPrimo}
            </Link>
            <Link href="/login" className="jm-sito-b g lg">
              {t.eroe.ctaSecondo}
            </Link>
          </div>
          <p className="jm-sito-sotto-cta">{t.eroe.sottoCta}</p>

          <div className="jm-sito-shot">
            <div className="jm-sito-shot-bar" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <div className="jm-sito-shot-in">
              <div>
                <p className="jm-sito-lab">{t.esempio.data}</p>
                <p className="jm-sito-shot-tit">{t.esempio.titolo}</p>
                <p className="jm-sito-shot-pro">{t.esempio.prosa}</p>
                <div className="jm-sito-aree">
                  {t.esempio.aree.map((a) => (
                    <div key={a.nome} className="jm-sito-area">
                      <p className="n">{a.nome}</p>
                      <p className="t">{a.testo}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="jm-sito-side">
                {t.esempio.metriche.map((m) => (
                  <div key={m.nome} className="jm-sito-metrica">
                    <span className="n">{m.nome}</span>
                    <span className="v">{m.valore}</span>
                  </div>
                ))}
                <p className="jm-sito-lab" style={{ marginTop: 18 }}>
                  {t.esempio.obiettivi}
                </p>
                <div className="jm-sito-pallini" aria-hidden="true">
                  <i className="on" />
                  <i className="on" />
                  <i />
                  <i className="on" />
                  <i />
                  <i />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="jm-sito-quattro">
          {t.promesse.map((q) => (
            <div key={q.titolo}>
              <p className="t">{q.titolo}</p>
              <p className="d">{q.testo}</p>
            </div>
          ))}
        </section>

        <section className="jm-sito-sez jm-sito-cont" id="prodotto">
          <p className="jm-sito-sez-lab">{t.prodotto.etichetta}</p>
          <h2 className="jm-sito-sez-h">{t.prodotto.titolo}</h2>
          <p className="jm-sito-sez-p">{t.prodotto.testo}</p>

          <div id="funzioni">
            {t.funzioni.map((f, i) => (
              <div key={f.titolo} className={i % 2 === 1 ? "jm-sito-fun gira" : "jm-sito-fun"}>
                <div className="jm-sito-fun-t">
                  <h3>{f.titolo}</h3>
                  <p>{f.testo}</p>
                  <Link href={f.href}>{f.link} &rarr;</Link>
                </div>
                <Riquadro forma={f.forma} t={t} />
              </div>
            ))}
          </div>
        </section>

        <section className="jm-sito-fascia">
          <div className="jm-sito-sez jm-sito-cont">
            <p className="jm-sito-sez-lab">{t.passi.etichetta}</p>
            <h2 className="jm-sito-sez-h">{t.passi.titolo}</h2>
            <div className="jm-sito-passi">
              {t.passi.voci.map((v, i) => (
                <div key={v.titolo} className="jm-sito-passo">
                  <p className="n">{i + 1}</p>
                  <p className="t">{v.titolo}</p>
                  <p className="d">{v.testo}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="jm-sito-sez jm-sito-cont" id="domande">
          <p className="jm-sito-sez-lab">{t.domande.etichetta}</p>
          <h2 className="jm-sito-sez-h">{t.domande.titolo}</h2>
          <div className="jm-sito-faq">
            {t.domande.voci.map((v) => (
              <div key={v.d} className="jm-sito-qa">
                <p className="q">{v.d}</p>
                <p className="a">{v.r}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="jm-sito-fine">
          <div className="jm-sito-cont">
            <h2>{t.fine.titolo}</h2>
            <p>{t.fine.testo}</p>
            <div className="jm-sito-cta">
              <Link href="/login" className="jm-sito-b p lg">
                {t.fine.cta}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PiedeSito lingua={lingua} />

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
