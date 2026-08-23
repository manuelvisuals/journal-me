import type { Metadata } from "next";
import { BrandMark } from "@/components/brand/brand-mark";

/**
 * La privacy policy (PIANO-APPSTORE §2): App Store Connect PRETENDE un URL
 * pubblico, e questa pagina e quell'URL. Statica, server-rendered, niente
 * client: non c'e un solo motivo per cui una pagina legale debba eseguire
 * JavaScript.
 *
 * Non passa da t() di proposito: un testo legale non si traduce riga per
 * riga con un catalogo UI — vive qui per intero nelle due lingue, prima
 * italiano poi inglese, e si cambia come un documento, non come una label.
 * Tutto cio che afferma e verificato nel codice: la modalita locale non fa
 * richieste (verify-pr10), la cancellazione dell'account esiste
 * (/api/account/delete), il testo passa a OpenAI dalle route in
 * src/modules/oggi/server e recap/server.
 */

export const metadata: Metadata = {
  title: "Privacy · Journal.me",
  robots: { index: true },
};

function Sezione({
  titolo,
  children,
}: {
  titolo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2
        className="mb-2 font-semibold"
        style={{ fontSize: "calc(17px * var(--jm-ui-scale))" }}
      >
        {titolo}
      </h2>
      <div
        className="space-y-3"
        style={{
          fontSize: "calc(15px * var(--jm-ui-scale))",
          lineHeight: 1.65,
          color: "var(--color-ink-muted)",
        }}
      >
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-[680px] px-7 py-12">
      <p
        className="mb-10 font-semibold tracking-tight"
        style={{ fontSize: "calc(22px * var(--jm-ui-scale))" }}
      >
        <BrandMark />
        Journal<span className="text-accent">.me</span>
      </p>

      <h1
        className="mb-1 font-semibold"
        style={{ fontSize: "calc(26px * var(--jm-ui-scale))" }}
      >
        Privacy
      </h1>
      <p
        className="mb-10"
        style={{
          fontSize: "calc(13px * var(--jm-ui-scale))",
          color: "var(--color-ink-faint)",
        }}
      >
        Aggiornata al 23 agosto 2026 · English version below
      </p>

      <Sezione titolo="La cosa piu importante">
        <p>
          Journal.me e un diario. Quello che scrivi e racconti e tuo: non lo
          leggiamo, non lo vendiamo, non lo usiamo per pubblicita e non lo
          diamo a nessuno per addestrare modelli. Non ci sono inserzioni, non
          ci sono tracciatori pubblicitari, non ci sono analytics di terze
          parti.
        </p>
      </Sezione>

      <Sezione titolo="Le due modalita">
        <p>
          <b>Solo su questo dispositivo (gratis).</b> Le tue giornate restano
          nel dispositivo, dentro l&apos;archivio del browser o dell&apos;app.
          Non esiste un account, non esiste un server: in questa modalita
          l&apos;app non fa nemmeno una richiesta di rete. Se cancelli
          l&apos;app o i suoi dati, le giornate spariscono con lei — per
          questo esiste il backup su file, che fai tu, quando vuoi tu.
        </p>
        <p>
          <b>Premium (cloud).</b> Crei un account con la tua email (un codice
          di accesso, niente password) e le tue giornate vengono salvate sui
          nostri server, cifrate, per seguirti su tutti i dispositivi.
        </p>
      </Sezione>

      <Sezione titolo="Che dati trattiamo, in modalita premium">
        <p>
          <b>La tua email</b>, per farti entrare e per niente altro: nessuna
          newsletter, nessun marketing.
        </p>
        <p>
          <b>Le tue giornate</b> (testo, titoli, sintesi, obiettivi, metriche,
          persone e luoghi che annoti): salvate su Supabase, con accesso
          riservato al tuo account.
        </p>
        <p>
          <b>L&apos;audio dei racconti a voce</b>: viene trascritto e poi
          scartato. La fonte di verita e il testo, non la registrazione.
        </p>
        <p>
          <b>I consumi AI</b>: contiamo i token usati dal tuo account per
          mostrarti quanto hai consumato della quota inclusa. Sono numeri, non
          contenuti.
        </p>
      </Sezione>

      <Sezione titolo="L'intelligenza artificiale">
        <p>
          Titoli, sintesi, recap e trascrizioni vengono generati da modelli di
          OpenAI: per farlo, il testo (o l&apos;audio) della giornata passa ai
          loro server tramite la nostra API. Usiamo le API business di OpenAI,
          che per contratto non usano questi dati per addestrare i modelli.
          Nella modalita locale tutto questo non esiste: niente AI, niente
          rete.
        </p>
      </Sezione>

      <Sezione titolo="Cancellare tutto">
        <p>
          Dentro l&apos;app, in Impostazioni, puoi eliminare l&apos;account:
          sparisce l&apos;utente e spariscono tutte le sue giornate, i fatti,
          gli obiettivi, i recap e i contatori — dai nostri server, in
          cascata, senza doverlo chiedere a nessuno. Nella modalita locale
          puoi cancellare tutte le giornate dal dispositivo, sempre dalle
          Impostazioni.
        </p>
      </Sezione>

      <Sezione titolo="Pagamenti">
        <p>
          L&apos;abbonamento premium sul web e gestito da Stripe: i dati della
          carta li vede solo Stripe, noi no. Nell&apos;app iOS
          l&apos;acquisto non e ancora disponibile.
        </p>
      </Sezione>

      <hr
        className="my-10"
        style={{ borderColor: "var(--color-line)" }}
      />

      <h1
        className="mb-1 font-semibold"
        style={{ fontSize: "calc(26px * var(--jm-ui-scale))" }}
      >
        Privacy (English)
      </h1>
      <p
        className="mb-10"
        style={{
          fontSize: "calc(13px * var(--jm-ui-scale))",
          color: "var(--color-ink-faint)",
        }}
      >
        Updated 23 August 2026
      </p>

      <Sezione titolo="What matters most">
        <p>
          Journal.me is a diary. What you write and tell is yours: we do not
          read it, sell it, use it for advertising or hand it to anyone to
          train models. No ads, no ad trackers, no third-party analytics.
        </p>
      </Sezione>

      <Sezione titolo="The two modes">
        <p>
          <b>Only on this device (free).</b> Your days stay on the device. No
          account, no server: in this mode the app does not make a single
          network request. Deleting the app deletes the days with it — that
          is what the file backup is for, made by you, whenever you want.
        </p>
        <p>
          <b>Premium (cloud).</b> You create an account with your email (a
          sign-in code, no password) and your days are stored encrypted on
          our servers so they follow you across devices.
        </p>
      </Sezione>

      <Sezione titolo="What we process, in premium mode">
        <p>
          <b>Your email</b>, to sign you in and for nothing else. <b>Your
          days</b> (text, titles, summaries, goals, metrics, people and
          places), stored on Supabase and accessible only to your account.
          <b> Voice audio</b> is transcribed and then discarded — the text is
          the source of truth. <b>AI usage</b> is counted in tokens to show
          you your monthly quota: numbers, not content.
        </p>
      </Sezione>

      <Sezione titolo="Artificial intelligence">
        <p>
          Titles, summaries, recaps and transcriptions are generated by OpenAI
          models: the day&apos;s text (or audio) reaches their servers through
          our API. We use OpenAI&apos;s business APIs, which by contract do
          not use this data to train models. In local mode none of this
          exists: no AI, no network.
        </p>
      </Sezione>

      <Sezione titolo="Deleting everything">
        <p>
          Inside the app, in Settings, you can delete your account: the user
          and every one of their days, facts, goals, recaps and counters
          disappear from our servers, in cascade, without asking anyone. In
          local mode you can erase all days from the device, also from
          Settings.
        </p>
      </Sezione>

      <Sezione titolo="Payments">
        <p>
          The premium subscription on the web is handled by Stripe: only
          Stripe sees your card details. In the iOS app the purchase is not
          available yet.
        </p>
      </Sezione>
    </main>
  );
}
