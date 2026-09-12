import type { Metadata } from "next";
import { Marchio } from "@/components/brand/marchio";

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
 * richieste finche non si chiede l'AI (verify-pr10, verify-ospite), il
 * regalo dell'ospite passa dal braccialetto e da DeviceCheck
 * (src/lib/server/ospite.ts, devicecheck.ts: sul server restano l'hash del
 * segreto e il conteggio, migration 023), la cancellazione dell'account
 * esiste (/api/account/delete), il testo passa a OpenAI dalle route in
 * src/modules/oggi/server e recap/server.
 *
 * 12 settembre 2026: fino a oggi questa pagina diceva "modalita locale =
 * niente AI, niente rete". Era vero fino al 3 settembre; dal regalo
 * dell'ospite (SPEC-ospite-e-cassaforte R2) non lo era piu, e una policy
 * che nega una raccolta che avviene e il primo motivo di rifiuto sulla
 * 5.1.1. Le etichette App Privacy si compilano su QUESTA versione.
 */

export const metadata: Metadata = {
  title: "Privacy · dayalogue",
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
      <p className="mb-10">
        <Marchio className="jm-marchio-22" />
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
        Aggiornata al 12 settembre 2026 · English version below
      </p>

      <Sezione titolo="La cosa piu importante">
        <p>
          dayalogue e un diario. Quello che scrivi e racconti e tuo: non lo
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
          Non esiste un account e le giornate non salgono su nessun server:
          l&apos;app fa una richiesta di rete solo quando chiedi all&apos;AI
          di lavorare (vedi sotto, &quot;Il regalo dell&apos;AI&quot;). Se
          cancelli l&apos;app o i suoi dati, le giornate spariscono con lei
          — per questo esiste il backup su file, che fai tu, quando vuoi tu.
        </p>
        <p>
          <b>Il regalo dell&apos;AI.</b> Anche senza account, l&apos;app per
          iPhone ti regala l&apos;AI per le prime dieci giornate. Per contare
          le giornate senza sapere chi sei, il dispositivo genera un codice
          casuale (un &quot;braccialetto&quot;) e lo presenta al nostro server
          insieme a un gettone di Apple (DeviceCheck) che prova che si tratta
          di un iPhone vero e che il regalo non e gia stato dato. Il server
          conserva solo un&apos;impronta del codice e il conteggio delle
          giornate: niente nome, niente email, niente testo delle giornate.
          Quando chiedi all&apos;AI di lavorare, il testo o l&apos;audio della
          giornata passa a OpenAI come descritto sotto; sul nostro server non
          resta.
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
          Se non chiedi mai all&apos;AI di lavorare, niente esce dal
          dispositivo.
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
        Updated 12 September 2026
      </p>

      <Sezione titolo="What matters most">
        <p>
          dayalogue is a diary. What you write and tell is yours: we do not
          read it, sell it, use it for advertising or hand it to anyone to
          train models. No ads, no ad trackers, no third-party analytics.
        </p>
      </Sezione>

      <Sezione titolo="The two modes">
        <p>
          <b>Only on this device (free).</b> Your days stay on the device. No
          account, and your days never reach a server: the app makes a
          network request only when you ask the AI to work (see &quot;The AI
          gift&quot; below). Deleting the app deletes the days with it — that
          is what the file backup is for, made by you, whenever you want.
        </p>
        <p>
          <b>The AI gift.</b> Even without an account, the iPhone app gives
          you the AI for your first ten days. To count those days without
          knowing who you are, the device generates a random code (a
          &quot;wristband&quot;) and presents it to our server together with
          an Apple token (DeviceCheck) proving it is a real iPhone that has
          not received the gift before. The server keeps only a fingerprint
          of that code and the day count: no name, no email, no text of your
          days. When you ask the AI to work, the day&apos;s text or audio
          reaches OpenAI as described below; nothing of it stays on our
          server.
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
          not use this data to train models. If you never ask the AI to
          work, nothing leaves the device.
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
