"use client";

/**
 * La sagoma generica: cosa si vede nel pallino quando non c'è una foto E
 * non c'è nemmeno un nome vero da cui prendere l'iniziale.
 *
 * PERCHÉ ESISTE (Manuel, 15 settembre 2026: "non mi piace che l'utente di
 * default si chiama 'Y' nel pallino, che cazzo mi rappresenta?"). Quella
 * "Y" veniva dalla prima lettera del riempimento di fabbrica in inglese
 * ("Your name"): una lettera vera, mostrata per un nome che non esiste.
 * Un'iniziale promette "qui c'è qualcuno che si chiama così" — per un
 * ospite che non ha ancora scelto un nome quella promessa è falsa. Meglio
 * una sagoma onesta che una lettera inventata dal segnaposto (la stessa
 * idea di Slack o Gmail per un account senza nome).
 *
 * Stesso tratto delle icone dei moduli (module-icons.tsx): stroke 1.7,
 * estremità arrotondate, currentColor — così eredita il colore del
 * cerchio che la contiene senza bisogno di una prop.
 */
export function IconaPersona() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ width: "56%", height: "56%" }}
    >
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M4.5 20c1.4-3.6 4.4-5.5 7.5-5.5s6.1 1.9 7.5 5.5" />
    </svg>
  );
}
