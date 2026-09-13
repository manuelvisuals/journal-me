import { Toaster } from "@/components/ui/toast";
import { ConfermaHost } from "@/components/ui/conferma";

/**
 * IL GUSCIO DEL PANNELLO ADMIN (13 settembre 2026, richiesta di Manuel:
 * "nell'admin il rail a sinistra tipico degli utenti normali non deve
 * esserci. Deve essere un sito web a parte, completamente disgiunto").
 *
 * Fino a oggi /admin viveva nel gruppo `(app)` e si portava dietro tutto il
 * pacchetto del diario: la rail con Oggi/Mese/Memo, la splash, il lucchetto
 * Face ID, il saluto del giorno e — il difetto pagato stasera — il cancello
 * della cassaforte, che chiedeva le otto parole a un pannello che non legge
 * nessuna giornata. Qui c'e solo cio che il pannello usa: l'avviso di
 * caricamento e il popup di conferma. La sessione e la stessa dell'app (il
 * gettone in localStorage): chi non e entrato vede l'invito a entrare, chi
 * e entrato ma non e admin non vede niente, come prima.
 */
export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Toaster />
      <ConfermaHost />
      {children}
    </>
  );
}
