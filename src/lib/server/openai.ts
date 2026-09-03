/**
 * L'indirizzo di OpenAI, in un posto solo.
 *
 * OPENAI_BASE_URL serve ai banchi: puntano le route a un OpenAI finto sulla
 * stessa macchina e provano il giro intero (guardia, quota, log dei
 * consumi) senza spendere e senza rete. In produzione non esiste e vince
 * l'indirizzo vero. La chiave (OPENAI_API_KEY) resta dove era.
 */
export function openaiUrl(path: string): string {
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
  return `${base}${path}`;
}
