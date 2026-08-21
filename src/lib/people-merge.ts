/**
 * Unire i nomi di una giornata, invece di sostituirli.
 *
 * IL BUG (21 agosto 2026). Manuel racconta la mattina "lezione con Anna
 * Katereta", e la sera aggiunge "cena con Francesco". Alla fine, nella
 * giornata, restava SOLO Francesco: Anna era sparita.
 *
 * Perche: l'estrazione dei nomi gira sul testo APPENA aggiunto, e il
 * salvataggio scriveva quell'elenco al posto di quello vecchio. Il secondo
 * racconto non aggiungeva una persona, la sostituiva. E una perdita di dati
 * silenziosa: nessun errore, nessun avviso, e te ne accorgi solo se guardi.
 *
 * La schermata di conferma dei nomi puo solo AGGIUNGERE: mostra le persone
 * trovate nel testo nuovo, e di quelle vecchie non sa niente. Quindi unire e
 * l'unico comportamento corretto — togliere un nome, quando servira, dovra
 * essere un gesto esplicito, non l'effetto collaterale di un'aggiunta.
 *
 * Confronto senza maiuscole: "christian" e "Christian" sono uno solo, e
 * vince la grafia gia salvata (quella che l'utente vede da giorni).
 */
export function mergePeople(
  previous: readonly string[],
  added: readonly string[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [...previous, ...added]) {
    const clean = name.trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}
