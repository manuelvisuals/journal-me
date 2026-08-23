/**
 * Misurare il testo senza dare per scontata la dimensione dell'interfaccia.
 *
 * Il 22 agosto 2026 la misura di partenza dell'app e passata da 1 a 1,15
 * (`DEFAULT_UI_SCALE`, src/lib/ui-scale-contract.ts). Il giorno dopo due
 * suite - verify-pr7 e verify-pr9 - sono diventate rosse senza che niente
 * fosse rotto: pretendevano `17px` e `26px` esatti, e l'app rispondeva
 * 19,55 e 29,9. Cioe esattamente 17 e 26 moltiplicati per 1,15.
 *
 * Un test che si rompe quando l'app fa la cosa giusta e' peggio di un test
 * che manca: insegna a ignorare il rosso. Il contratto vero non e' "il
 * titolo e' 26px", e' "il titolo e' 26px ALLA MISURA 1, e cresce con la
 * misura". Queste funzioni lo scrivono cosi, e la prossima volta che
 * cambia il passo di partenza non si rompe piu niente.
 */

/** La misura dell'interfaccia letta dalla pagina viva, non ipotizzata. */
export async function scalaUi(page) {
  const grezzo = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--jm-ui-scale"),
  );
  const n = Number.parseFloat(grezzo);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** "19.55px" -> 19.55. Torna NaN su tutto il resto, di proposito. */
export function numeroPx(valore) {
  return Number.parseFloat(String(valore));
}

/**
 * Il valore misurato corrisponde a `baseA1` moltiplicato per la misura?
 *
 * La tolleranza esiste perche il browser arrotonda: 26 x 1,15 fa 29,9 e
 * viene reso 29,9px, ma altre combinazioni cadono a meta di un pixel.
 */
export function eAllaScala(misurato, baseA1, scala, tolleranza = 0.6) {
  const v = numeroPx(misurato);
  if (!Number.isFinite(v)) return false;
  return Math.abs(v - baseA1 * scala) <= tolleranza;
}

/** Per i messaggi: "atteso 29,9px (26 alla misura 1,15), letto 19,55px". */
export function spiega(misurato, baseA1, scala) {
  return `atteso ${(baseA1 * scala).toFixed(2)}px (${baseA1} alla misura ${scala}), letto ${misurato}`;
}
