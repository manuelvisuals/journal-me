import Link from "next/link";
import { Marchio } from "@/components/brand/marchio";
import type { LinguaSito } from "@/modules/sito/seo";
import { prefisso, testiDi } from "@/modules/sito/testi";
import { ModuloSupporto, type Precompilato } from "@/modules/sito/components/supporto";

/**
 * dayalogue.com/support (mockup §03). La pagina e server-rendered come la
 * home — titolo, intro e piede stanno nell'HTML — e l'unico pezzo che si
 * idrata e il modulo, perche li si scrive.
 *
 * DAL 13 SETTEMBRE 2026 LA PAGINA E NUDA: niente barra del sito, solo il
 * marchio e le due lingue. Scelta di Manuel sul mockup
 * "MOCKUP-supporto-e-feedback.html" (opzione A), sul modello di
 * stoqfolio.com/supporto. Il motivo e che chi apre questa pagina ha un
 * problema: "Inizia ora" gli proponeva di iscriversi mentre cercava aiuto, e
 * il revisore di Apple — che questo indirizzo lo apre a freddo, perche e il
 * Support URL della scheda — deve trovarsi il modulo davanti, non una
 * vetrina. Il marchio resta, perche chi arriva dall'App Store deve capire a
 * chi sta scrivendo; le due lingue restano perche sono due indirizzi veri
 * (/support e /en/support) e Google li indicizza come due pagine.
 *
 * Il piede qui e corto di proposito: due uscite e basta. Chi arriva su
 * questa pagina ha un problema, non voglia di navigare.
 */
export function PaginaSupporto({
  lingua,
  altraLingua,
  precompilato,
}: {
  lingua: LinguaSito;
  altraLingua: string;
  /** Cio che la linguetta Feedback dell'app ha messo nell'indirizzo. */
  precompilato?: Precompilato;
}) {
  const t = testiDi(lingua);
  const p = prefisso(lingua);

  return (
    <div className="jm-sito">
      <header className="jm-sito-sup-testata">
        <Link href={`${p}/`} className="jm-sito-marchio">
          <Marchio />
        </Link>
        {/* Lo stesso selettore della barra, stessa classe e stesse misure:
            due link veri, uno per indirizzo. */}
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
      </header>
      <main className="jm-sito-sup">
        <h1>{t.supporto.titolo}</h1>
        <p className="jm-sito-sup-intro">{t.supporto.intro}</p>

        <ModuloSupporto lingua={lingua} precompilato={precompilato} />

        <div className="jm-sito-sup-piede">
          <Link href="/privacy">{t.piede.privacy}</Link>
          <span aria-hidden="true">&middot;</span>
          <Link href={`${p}/`}>{t.supporto.tornaAlSito}</Link>
        </div>
      </main>
    </div>
  );
}
