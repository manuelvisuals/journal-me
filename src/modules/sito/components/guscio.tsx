import Link from "next/link";
import type { LinguaSito } from "@/modules/sito/seo";
import { prefisso, testiDi } from "@/modules/sito/testi";

/**
 * La barra in alto e il piede del sito. Componenti SERVER: nessun "use
 * client" qui dentro e nessuno stato — quello che il motore di ricerca
 * riceve deve essere gia scritto nell'HTML, link compresi.
 *
 * Il selettore di lingua non e un menu a tendina ma due link veri, uno per
 * indirizzo: e cio che permette a Google di indicizzare le due versioni
 * come due pagine (con hreflang nei metadata) invece che come una pagina
 * che cambia da sola.
 */

export function NavSito({
  lingua,
  altraLingua,
  ancore = true,
}: {
  lingua: LinguaSito;
  /** L'indirizzo della stessa pagina nell'altra lingua. */
  altraLingua: string;
  /** Su /support non ci sono sezioni a cui saltare. */
  ancore?: boolean;
}) {
  const t = testiDi(lingua);
  const p = prefisso(lingua);
  return (
    <header className="jm-sito-nav">
      <div className="jm-sito-nav-in">
        <Link href={`${p}/`} className="jm-sito-marchio jm-marchio">
          dayalogue
        </Link>
        {ancore ? (
          <nav className="jm-sito-nav-l">
            <a href="#prodotto">{t.nav.prodotto}</a>
            <a href="#funzioni">{t.nav.funzioni}</a>
            <a href="#domande">{t.nav.domande}</a>
          </nav>
        ) : null}
        <div className="jm-sito-nav-r">
          <span className="jm-sito-lang">
            {lingua === "it" ? (
              <>
                <span className="on">IT</span>
                <Link href={altraLingua}>EN</Link>
              </>
            ) : (
              <>
                <Link href={altraLingua}>IT</Link>
                <span className="on">EN</span>
              </>
            )}
          </span>
          <Link href="/login" className="jm-sito-b g jm-sito-nav-accedi">
            {t.nav.accedi}
          </Link>
          <Link href="/login" className="jm-sito-b p">
            {t.nav.inizia}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function PiedeSito({ lingua }: { lingua: LinguaSito }) {
  const t = testiDi(lingua);
  const p = prefisso(lingua);
  return (
    <footer className="jm-sito-piede">
      <div className="jm-sito-piede-in">
        <div>
          <p className="jm-sito-marchio jm-marchio">dayalogue</p>
          <p className="nota">
            {t.piede.riga}
            <br />
            &copy; 2026 dayalogue
          </p>
        </div>
        <div>
          <h4>{t.piede.prodotto}</h4>
          <a href={`${p}/#funzioni`}>{t.piede.funzioni}</a>
          <Link href={`${p}/support`}>{t.piede.assistenza}</Link>
        </div>
        <div>
          <h4>{t.piede.legale}</h4>
          {/* Solo la privacy. I termini di servizio NON esistono ancora
              (HANDOVER, "Cosa manca davvero"): un link a una pagina che non
              c'e e peggio di un link mancante, perche promette. Torna qui il
              giorno in cui la pagina esiste. */}
          <Link href="/privacy">{t.piede.privacy}</Link>
        </div>
        <div>
          <h4>{t.piede.account}</h4>
          <Link href="/login">{t.piede.accedi}</Link>
          <Link href="/app">{t.piede.apri}</Link>
        </div>
      </div>
    </footer>
  );
}
