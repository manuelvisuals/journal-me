import Link from "next/link";
import type { LinguaSito } from "@/modules/sito/seo";
import { prefisso, testiDi } from "@/modules/sito/testi";
import { NavSito } from "@/modules/sito/components/guscio";
import { ModuloSupporto } from "@/modules/sito/components/supporto";

/**
 * dayalogue.com/support (mockup §03). La pagina e server-rendered come la
 * home — titolo, intro e piede stanno nell'HTML — e l'unico pezzo che si
 * idrata e il modulo, perche li si scrive.
 *
 * Il piede qui e corto di proposito: tre uscite e basta. Chi arriva su
 * questa pagina ha un problema, non voglia di navigare.
 */
export function PaginaSupporto({
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
      <NavSito lingua={lingua} altraLingua={altraLingua} ancore={false} />
      <main className="jm-sito-sup">
        <h1>{t.supporto.titolo}</h1>
        <p className="jm-sito-sup-intro">{t.supporto.intro}</p>

        <ModuloSupporto lingua={lingua} />

        <div className="jm-sito-sup-piede">
          <Link href="/privacy">{t.piede.privacy}</Link>
          <span aria-hidden="true">&middot;</span>
          <Link href={`${p}/`}>{t.supporto.tornaAlSito}</Link>
        </div>
      </main>
    </div>
  );
}
