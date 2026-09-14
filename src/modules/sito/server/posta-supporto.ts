/**
 * L'email che avvisa Manuel quando qualcuno scrive da dayalogue.com/support.
 *
 * PERCHE ESISTE. Fino al 13 settembre 2026 il messaggio si salvava e basta:
 * restava in tabella, e se nessuno andava a guardarla nessuno sapeva che era
 * arrivato. Una pagina di assistenza che non avvisa nessuno e una buca delle
 * lettere murata.
 *
 * L'ORDINE CONTA, ed e scritto nella rotta: PRIMA si salva, POI si prova a
 * mandare. Se la posta non parte il messaggio esiste comunque; se si
 * invertisse, una chiave scaduta farebbe sparire le segnalazioni.
 *
 * IL DESTINATARIO. Di fabbrica e l'indirizzo dell'account Resend, ed e una
 * scelta obbligata finche il mittente e quello di prova: onboarding@resend.dev
 * consegna SOLTANTO al titolare dell'account Resend, e qualunque altro
 * indirizzo torna un errore. E lo stesso indirizzo a cui arriva l'assistenza
 * di Stoqfolio (13 settembre 2026, scelta di Manuel: "lo stesso").
 * Per liberarlo servono due cose, in quest'ordine: verificare dayalogue.com
 * su Resend, poi mettere SUPPORT_FROM_EMAIL su Vercel (per esempio
 * "dayalogue <assistenza@dayalogue.com>"). Da quel momento SUPPORT_TO_EMAIL
 * puo essere qualunque indirizzo.
 *
 * NIENTE LIBRERIA. Resend e una chiamata HTTP con un JSON: una dipendenza in
 * piu nel pacchetto del server, per tre campi, non si ripaga.
 */

const A_CHI_DI_FABBRICA = "aidev.madh52@gmail.com";
const MITTENTE_DI_RIPIEGO = "dayalogue <onboarding@resend.dev>";

export type EsitoPosta = { inviata: boolean; errore?: string };

export type MessaggioSupporto = {
  id: string | null;
  oggetto: string;
  descrizione: string;
  email: string;
  lingua: string;
  /** Le schermate come data URL, esattamente come arrivano dal browser. */
  immagini: string[];
  contesto: Record<string, string>;
};

function destinatario(): string {
  return process.env.SUPPORT_TO_EMAIL?.trim() || A_CHI_DI_FABBRICA;
}

function mittente(): string {
  return process.env.SUPPORT_FROM_EMAIL?.trim() || MITTENTE_DI_RIPIEGO;
}

/** Da "data:image/jpeg;base64,XXXX" al solo XXXX, che e cio che vuole Resend. */
function soloBase64(dataUrl: string): string {
  const virgola = dataUrl.indexOf(",");
  return virgola === -1 ? "" : dataUrl.slice(virgola + 1);
}

function corpo(m: MessaggioSupporto): string {
  const righe = [m.descrizione, "", "---"];
  righe.push(`Scritta da: dayalogue.com/support - ${m.lingua}`);
  const c = m.contesto;
  if (c.da) righe.push(`Arrivata da: ${c.da}${c.schermata ? ` (${c.schermata})` : ""}`);
  if (c.versione) righe.push(`Versione: ${c.versione}`);
  if (c.schermo || c.ua) righe.push(`Schermo: ${c.schermo || "?"} - ${c.ua || "?"}`);
  if (m.id) righe.push(`Riferimento: ${m.id}`);
  return righe.join("\n");
}

/**
 * Manda l'email. Non lancia mai: chi la chiama ha gia salvato il messaggio e
 * deve rispondere "ok" comunque, quindi qui un errore e un dato, non
 * un'eccezione.
 */
export async function notificaSupporto(m: MessaggioSupporto): Promise<EsitoPosta> {
  const chiave = process.env.RESEND_API_KEY?.trim();
  if (!chiave) return { inviata: false, errore: "RESEND_API_KEY assente" };

  const allegati = m.immagini.slice(0, 3).map((src, i) => ({
    filename: `schermata-${i + 1}.jpg`,
    content: soloBase64(src),
  }));

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chiave}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: mittente(),
        to: [destinatario()],
        // Il "rispondi" va dritto a chi ha scritto: niente copia-incolla.
        reply_to: m.email,
        // Il titolo nell'oggetto: e l'unica cosa che si legge nell'elenco
        // della posta senza aprire niente.
        subject: `[dayalogue] ${m.oggetto}`,
        text: corpo(m),
        ...(allegati.length ? { attachments: allegati } : {}),
      }),
      // Se Resend non risponde, il messaggio e gia salvato: meglio mollare
      // presto che tenere in piedi la richiesta di chi sta aspettando.
      signal: AbortSignal.timeout(10_000),
    });
    if (r.ok) return { inviata: true };
    // Il testo dell'errore lo produce lo strumento, non questo file: una
    // causa inventata manda a cercare nel posto sbagliato.
    const detto = await r.text().catch(() => "");
    return { inviata: false, errore: `${r.status} ${detto.slice(0, 300)}` };
  } catch (e) {
    return { inviata: false, errore: e instanceof Error ? e.message : "errore sconosciuto" };
  }
}
