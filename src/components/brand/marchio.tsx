import { BrandMark } from "@/components/brand/brand-mark";

/**
 * IL MARCHIO (2 settembre 2026, scelta di Manuel sul mockup
 * design/mockups/sfondo-lancio.html, "02 . Newsreader"): il segno SOPRA,
 * la parola SOTTO. La parola e in Newsreader — lo stesso serif con cui
 * l'app scrive la giornata — con "day" pesante e "alogue" leggero. Il
 * corsivo Sacramento del 31 agosto e stato tolto insieme al suo file.
 *
 * UN COMPONENTE, non un frammento copiato otto volte: prima ogni
 * schermata scriveva il nome a modo suo (una con lo span accent, una col
 * segno accanto, una con un punto in fondo) e il marchio era otto marchi
 * quasi uguali. Adesso il segno, l'ordine e i pesi stanno qui; le
 * schermate decidono solo la MISURA, con la loro classe accanto
 * (`.jm-rail-brand`, `.jm-splash-mark`, ...), e il resto e uguale
 * dappertutto per costruzione. La tipografia sta in overrides.css sotto
 * `.jm-marchio` (li e non altrove: e l'ultimo import, vince).
 *
 * `segno={false}` esiste per un posto solo: il piede del sito, dove il
 * nome sta in una riga di testo e un segno alto sarebbe rumore.
 */
export function Marchio({
  className,
  segno = true,
}: {
  className?: string;
  segno?: boolean;
}) {
  return (
    <span className={className ? `jm-marchio ${className}` : "jm-marchio"}>
      {segno && <BrandMark />}
      <span className="jm-marchio-parola">
        <b>day</b>alogue
      </span>
    </span>
  );
}
