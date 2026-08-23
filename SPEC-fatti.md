# SPEC fatti · Journal.me — dal racconto ai dati

Specifica di implementazione. Scritta il 20 agosto 2026 su `main` a `3ab95bd`.
Destinatario: chi scrive il codice, senza il contesto della conversazione in cui e nata.

Prima di toccare qualsiasi cosa, leggi `HANDOVER.md` (stato del progetto, regole
operative, trappole gia pagate) e `SPEC-v2.md` §2 (il contratto dei dati: una
interfaccia, due implementazioni). Se questa spec e il codice si contraddicono,
vince il codice — e poi correggi qui.

---

## 1. Cosa si sta costruendo, e perche

Oggi Journal.me sa **raccontare** una giornata e non sa **contarla**.

Se dici "stasera pizza con Christian, prima un'ora di palestra", l'app produce un
titolo, due righe di sintesi e forse una frase sotto "Corpo". Fra un mese non
puo rispondere a nessuna di queste domande:

- quante volte ho mangiato la pizza a maggio?
- quante volte sono andato in palestra?
- quand'e l'ultima volta che ho visto Christian?

Non perche l'AI sia debole: perche **non esiste un posto dove mettere quei
fatti**. `process-entry` ha uno schema `strict` con quattro etichette chiuse
(`Lavoro`, `Relazioni`, `Corpo`, `Emozioni`) e la tabella `entries` ha tre sole
colonne numeriche (`mood`, `weight_kg`, `sleep_hours`). Anche un modello
perfetto non avrebbe dove scrivere "pizza".

### 1.1 Le quattro mezze soluzioni che esistono gia

| Cosa c'e | Cosa fa | Perche non basta |
|---|---|---|
| `entries.areas` (jsonb) | quattro frasi di sintesi | e testo libero: non si conta, non si aggrega |
| `entries.people` (jsonb) | i nomi citati quel giorno | solo persone, nessuna storia interrogabile |
| `remembers` | appunti sparsi con cinque categorie | e una casella della posta, non una linea del tempo |
| `goals` + `entry_goals` | caselle si/no per giornata | la lista va decisa PRIMA: "pizza" non sara mai un obiettivo |

Hanno tutte la stessa forma a meta: *il giorno X e successo qualcosa*. Questa
spec la completa una volta sola invece di aggiungere una colonna per argomento.

### 1.2 Il principio

Una tabella sola. Ogni riga e **un fatto**: un giorno, un tipo, un'etichetta,
qualche attributo. "Pizza" e "palestra" e "Christian" sono la stessa struttura
con `kind` diverso.

Il criterio per giudicare qualsiasi scelta di questo documento:

> aggiungere "yoga" o "sushi" l'anno prossimo non deve richiedere ne una
> migration, ne una schermata nuova, ne un rilascio.

---

## 2. Cosa NON e

Confini espliciti, per non riaprirli a meta implementazione.

1. **Non e un contatore di calorie.** Non c'e nessun database nutrizionale,
   nessun peso in grammi, nessun apporto. Si conta cosa hai mangiato, non
   quanto ti fa male.
2. **Non da voti.** Vedi §9. Nessun campo `sano: boolean`, nessun punteggio.
3. **Non e un'agenda.** I fatti descrivono cio che e successo, mai cio che
   deve succedere: quello sono i `todo` di Ricorda, che restano dove sono.
4. **Non sostituisce le macro-aree.** `entries.areas` resta: e il racconto.
   I fatti sono i dati. Convivono, e la giornata piena mostra tutte e due.
5. **I pattern comportamentali non sono in questa spec.** Ne parla §8, come
   direzione, e la conclusione e "non prima di avere mesi di dati veri".

---

## 3. Il modello dati

### 3.1 La tabella

Nome inglese come tutte le altre (`entries`, `goals`, `remembers`, `recaps`);
in interfaccia si chiamano "fatti" e le etichette le traduce `t()`.

```sql
create table facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Il legame con la giornata. entry_id per cancellare in cascata quando
  -- la giornata sparisce; entry_date duplicata perche TUTTE le query utili
  -- sono per data e un join per contare le pizze del mese e sprecato.
  entry_id uuid references entries(id) on delete cascade,
  entry_date date not null,
  kind text not null
    check (kind in ('cibo', 'attivita', 'persona', 'lavoro', 'luogo')),
  -- Come l'ha detto lui: "una margherita da Gino". Si mostra questa.
  label text not null,
  -- Normalizzata: "pizza". Si CONTA questa. Vedi 3.3.
  label_key text not null,
  attrs jsonb not null default '{}'::jsonb,
  -- 0..1, quanto l'AI e sicura. Sotto soglia il fatto si mostra ma va
  -- confermato: vedi 5.2.
  confidence real,
  origin text not null default 'ai' check (origin in ('ai', 'manual')),
  created_at timestamptz not null default now()
);

create index facts_user_date_idx on facts (user_id, entry_date desc);
create index facts_user_kind_key_idx on facts (user_id, kind, label_key);
create index facts_entry_idx on facts (entry_id);
```

RLS identica alle altre quattro tabelle (select/insert/update/delete own).
**Nessuna policy per il service role**: il server non legge i diari, e questa
tabella non fa eccezione (HANDOVER §8, analisi di sicurezza del 20 agosto).

### 3.2 I tipi e i loro attributi

`kind` e un elenco chiuso e corto **di proposito**. Cinque voci coprono tutto
quello che Manuel ha elencato; la varieta vive in `label`, non in `kind`.

| kind | esempi di label | attrs |
|---|---|---|
| `cibo` | pizza, insalata, sushi, caffe | `meal`, `where` |
| `attivita` | palestra, corsa, meditazione, chitarra, lettura | `minutes`, `intensity` |
| `persona` | Christian, Luca, mia sorella | `how` |
| `lavoro` | riunione, deploy, chiamata cliente | — |
| `luogo` | Trastevere, ufficio, casa di Lara | — |

```ts
type FactAttrs = {
  cibo: { meal?: "colazione" | "pranzo" | "cena" | "spuntino";
          where?: "casa" | "fuori" };
  attivita: { minutes?: number; intensity?: "leggera" | "media" | "forte" };
  persona: { how?: "di persona" | "telefono" | "messaggi" };
  lavoro: Record<string, never>;
  luogo: Record<string, never>;
};
```

Tutti gli attributi sono **facoltativi**. Se l'utente non ha detto quanto e
durata la palestra, `minutes` non c'e: non si inventa e non si mette zero, che
sarebbe una bugia numerica.

**Perche non un `kind` libero:** con un enum, un errore dell'AI produce al
massimo un'etichetta sbagliata dentro un tipo giusto. Senza, produce un tipo
nuovo (`sport`, `fitness`, `allenamento`) e i conteggi si spezzano in silenzio.

### 3.3 La normalizzazione — la parte difficile

Questo e il punto dove la funzione riesce o e inutile.

L'utente dira "ho mangiato una pizza", "pizzata da Gino", "ho preso una
margherita". Sono lo stesso fatto. Se finiscono come tre `label_key` diverse,
il mese risponde "1, 1, 1" invece di "3" e nessuno si fida piu del contatore.

**Regola meccanica** (deterministica, in `src/lib/facts/normalize.ts`):
minuscolo, accenti rimossi, punteggiatura via, spazi compressi, articoli
iniziali tolti (`il`/`la`/`una`/`un`/`dei`...). Copre "La Pizza" -> `pizza`,
non copre "margherita" -> `pizza`.

**Dizionario dell'utente** — copre il resto:

```sql
create table fact_aliases (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  alias text not null,        -- gia passato dalla regola meccanica
  label_key text not null,    -- il canonico
  created_at timestamptz not null default now(),
  primary key (user_id, kind, alias)
);
```

Si riempie da solo in due modi:

1. **Correzione dell'utente.** Se nella schermata di §5 corregge "margherita"
   in "pizza", si scrive l'alias. Dalla volta dopo e deterministico: nessuna
   chiamata AI, nessun dubbio.
2. **Contesto nel prompt.** Le `label_key` gia esistenti dell'utente (per tipo,
   le piu frequenti, un tetto di ~80 voci) entrano nel prompt come elenco di
   etichette da **riusare quando calzano**. E lo stesso meccanismo del glossario
   dei nomi propri gia usato in `transcribe-fallback`, e funziona per la stessa
   ragione: un modello che vede "pizza" fra le etichette esistenti non inventa
   "pizza margherita".

**Il canonico non e mai deciso dal server in modo definitivo.** L'utente puo
rinominare una `label_key` da Impostazioni (fase 2): l'operazione riscrive le
righe e gli alias. Senza questa via d'uscita, un errore di normalizzazione di
gennaio resta addosso per sempre.

### 3.4 Modalita locale

I fatti sono estratti dall'AI, e l'AI e una capability premium: in locale
`can("aiSummary")` e falso e **non parte nessuna estrazione**, come per il
titolo e la sintesi. La promessa "in locale nemmeno una richiesta di rete"
non si tocca.

Cosa NON si fa: mostrare schermate vuote senza spiegazione. In locale la
sezione dei conteggi dice cosa manca e perche, con l'uscita gratuita — i
fatti si possono **aggiungere a mano** (`origin: 'manual'`), e quelli si
contano esattamente come gli altri. Chi tiene il diario sul dispositivo puo
segnare le sue pizze da solo; semplicemente nessuno gliele scrive.

Lo store locale (IndexedDB) prende gli stessi due object store: `facts` e
`factAliases`, con gli stessi campi.

---

## 4. L'estrazione

### 4.1 Una route sola, che assorbe `extract-people`

`/api/extract-facts` sostituisce `/api/extract-people`, che viene **cancellata**.
Le persone sono fatti con `kind: 'persona'`: tenerle su due strade separate
significherebbe due prompt, due modelli, due punti dove sbagliare.

Conseguenza importante sui costi: il numero di chiamate AI per salvataggio
**non cambia** (`split-by-date`, `process-entry`, `extract-facts` — erano tre,
restano tre).

### 4.2 Lo schema di risposta

`strict: true`, come le altre route:

```ts
{
  facts: Array<{
    kind: "cibo" | "attivita" | "persona" | "lavoro" | "luogo";
    label: string;        // come detto dall'utente
    label_key: string;    // proposta di canonico, minuscolo
    attrs: object;        // per tipo, tutto facoltativo
    confidence: number;   // 0..1
  }>
}
```

Regole del prompt, in aggiunta a quelle gia in uso nelle altre route:

- estrai solo cio che e **effettivamente detto**; se non e chiaro se un fatto
  e successo oggi o e un ricordo, non estrarlo;
- **riusa** le etichette dell'elenco fornito quando calzano, invece di
  inventarne di simili;
- niente giudizi in `label` (vedi §9): "pizza", non "pizza (sgarro)";
- `confidence` bassa quando il fatto e dedotto invece che detto;
- nessuna persona in prima persona (chi parla), come gia in `extract-people`.

### 4.3 Il modello

`gpt-4o-mini` **non basta qui**, e questa e la differenza rispetto alle altre
route. Scrivere un titolo e un compito di stile; estrarre dodici entita
tipizzate con normalizzazione da un parlato disordinato e un compito di
precisione, dove un errore non e brutto ma **falso**, e i falsi si accumulano
nei conteggi.

Da usare: un modello della famiglia corrente (5.x), scelto in fase di
implementazione **verificando cosa e disponibile sull'account** e non fidandosi
di questo documento. Nota da `HANDOVER.md`: i 4o sono legacy dall'estate 2026 e
i modelli correnti costano meno, quindi qui la qualita non si paga.

### 4.4 Dove si inserisce

In `today-client.tsx`, dove oggi c'e `extractPeople`. Due note:

- `process-entry` e `extract-facts` lavorano sullo stesso transcript e non
  dipendono l'una dall'altra: vanno lanciate **in parallelo**, non in fila.
- **Ri-elaborazione**: quando il transcript di una giornata viene modificato
  (`reprocessEntryTranscript`), i fatti con `origin: 'ai'` di quella giornata
  si cancellano e si riestraggono. Quelli con `origin: 'manual'` **non si
  toccano mai**: sono roba scritta a mano dall'utente, e un'AI non cancella
  cio che ha scritto una persona.

---

## 5. La correzione — senza questa, i conteggi sono spazzatura

### 5.1 Il principio

L'estrazione sbagliera. Se l'utente non puo correggerla, gli errori entrano
nei conteggi e il mese dice numeri falsi con tono sicuro — il modo peggiore di
sbagliare per un'app che dovrebbe aiutarti a capirti.

Il meccanismo esiste gia e funziona: la schermata "persone di oggi"
(`people-review.tsx`), che dopo l'elaborazione mostra i nomi trovati come
pillole modificabili, con la x per togliere e "+ aggiungi persona".

### 5.2 Cosa cambia

Quella schermata diventa **"cosa ho capito di oggi"** e mostra i fatti
raggruppati per tipo, con le stesse regole di interazione. In fase 1 mostra
solo il gruppo `cibo` (vedi §11); gli altri tipi vengono estratti e salvati
lo stesso, ma non si vedono ancora.

- fatti con `confidence` sotto soglia (proposta: 0.6) partono **non
  selezionati**: vanno confermati, non tolti;
- correggere l'etichetta scrive un alias (§3.3);
- "salta" salva comunque i fatti ad alta confidenza — la schermata non deve
  diventare un pedaggio ogni sera, o smetti di raccontare la giornata.

**Serve un mockup HTML approvato prima di scrivere questo componente**
(regola di progetto per ogni cambiamento visivo non banale).

---

## 6. Le viste (fase 2)

Cosa diventa possibile, in ordine di valore:

1. **Mese › conteggi.** "questo mese: 4 pizze, 11 palestre, 6 sere fuori".
   Una query, `group by label_key`. Va nella rail destra di Mese, dove oggi
   ci sono gia le statistiche.
2. **La scheda di un'etichetta.** Tocchi "pizza" e vedi le date, e da li salti
   alle giornate. E la stessa cosa che oggi fa il tocco su una giornata.
3. **Persone.** L'elenco con "ultima volta che l'hai visto", ordinato per
   distanza nel tempo. Sostituisce l'elenco piatto in Ricorda › Persone.
4. **Rinomina e unisci.** Da Impostazioni: due etichette che erano la stessa
   cosa diventano una. Vedi la nota finale di §3.3 — questa non e una comodita,
   e la valvola di sfogo degli errori di normalizzazione.

---

## 7. I promemoria (fase 3)

Il caso raccontato da Manuel: *"Christian l'hai visto poco ultimamente"*.

Una volta che i fatti esistono, e una query, non una funzione:
`max(entry_date) where kind='persona' and label_key='christian'`.

Regole, e non sono dettagli:

- **si dice il fatto, non il giudizio.** "Non vedi Christian da 6 settimane" si.
  "Stai perdendo un'amicizia" no. La differenza e la stessa fra un diario e
  qualcuno che ti dice come vivere;
- la soglia la decide l'utente per persona, o si deduce dalla sua frequenza
  storica (chi vedi ogni giorno e chi vedi due volte l'anno non hanno la
  stessa "poco");
- niente notifiche push per questo. L'app non ha notifiche (vedi la riga
  mancante in Impostazioni) e questo non e il motivo per aggiungerle: e una
  riga nella rail, che leggi quando apri.

---

## 8. I pattern (fase 4) — e perche non ora

Prima di 2-3 mesi di fatti veri, qualsiasi correlazione e rumore. Con pochi
dati l'app direbbe cose false con tono sicuro.

Quando ci saranno, il confine da tenere e quello gia scritto nel prompt di
`process-entry`: **fatti, non interpretazioni psicologiche**.

- dentro: "nelle settimane in cui vai in palestra 3+ volte, il sonno medio e
  di 40 minuti piu lungo". E una misura, verificabile, e l'utente ne fa cio
  che vuole;
- fuori: "tendi a evitare le persone quando sei sotto stress". E una diagnosi.
  Un diario che diagnostica smette di essere un posto dove scrivere la verita.

Questa distinzione va decisa con Manuel prima di scrivere una riga della fase 4,
non durante.

---

## 9. Neutralita: la regola dei voti

`src/lib/data/store/default-goals.ts` contiene una regola scelta a maggio e
riconfermata il 20 agosto:

> i micro-goal sono tracker neutri, non voti. "mosso il corpo" descrive una
> cosa fatta; "no junkfood" descrive una colpa evitata, e trasforma un diario
> in una pagella.

Un contatore delle "schifezze" e una pagella. Quindi:

- **l'AI non giudica mai il cibo.** Nessun campo `healthy`, nessun tag
  "sgarro". Salva `pizza`, `insalata`, `fritto`, e gli attributi fattuali
  (`meal`, `where`);
- **il raggruppamento e dell'utente.** Se Manuel vuole vedere "quante volte
  ho mangiato schifezze", crea lui un gruppo con dentro le etichette che
  considera tali (fase 2, tabella `fact_groups`). Il conteggio e lo stesso,
  ma il giudizio e suo e resta modificabile. L'app non gli da del maiale.

Manuel puo ribaltare questa scelta — e il suo prodotto — ma deve essere una
decisione presa, non un effetto collaterale del modo in cui e scritto un prompt.

---

## 10. Dati esistenti, backup

**Migrazione delle persone.** `entries.people` (jsonb) diventa righe `facts`
con `kind='persona'`, `origin='ai'`, `confidence: null`. Una migration sola,
idempotente.

`entries.people` **resta** come copia denormalizzata: la usa la giornata piena
per le pillole, e toglierla vorrebbe dire toccare quattro componenti per un
guadagno nullo. La sorgente di verita diventano i fatti; chi scrive le persone
scrive tutti e due, nello stesso punto (`saveEntryPeople`).

**Backup.** `BACKUP_VERSION` passa a **2**, con due array nuovi (`facts`,
`factAliases`) e i conteggi corrispondenti. Un backup v1 si importa ancora
(niente fatti dentro, niente da fare); un backup v2 su un'app vecchia viene
rifiutato con il messaggio che esiste gia (`Questo backup e della versione
{v}: serve un'app piu recente per importarlo.`).

---

## 11. Il piano di lavoro

**Decisione presa il 20 agosto:** l'estrazione e il salvataggio partono con
**tutti e cinque i tipi**, l'interfaccia della fase 1 mostra **solo il cibo**.

Il motivo e che il costo e identico (un prompt, una chiamata) e i dati sono
l'unica cosa che non si puo recuperare dopo: quando fra due mesi si costruisce
la vista delle persone o quella della palestra, ci saranno due mesi di storia
invece di zero.

| Fase | Cosa | Si vede? |
|---|---|---|
| **1a** | migration `facts` + `fact_aliases` + RLS + store (cloud e locale) | no |
| **1b** | `/api/extract-facts`, via `extract-people`, normalizzazione, alias | no |
| **1c** | mockup + schermata "cosa ho capito di oggi", solo cibo | si |
| **1d** | conteggi del cibo nel Mese | si |
| **2** | le altre viste (§6): etichette, persone, rinomina/unisci | si |
| **3** | i promemoria (§7) | si |
| **4** | i pattern (§8) — solo con mesi di dati e una decisione esplicita | si |

### 11.1 Come si verifica

Le regole del progetto valgono tutte (tsc, eslint, i due build, le suite
esistenti riseguite). In piu, due cose specifiche di questa spec:

1. **`scripts/eval-extract.mjs`** — 10-15 transcript veri, scritti a mano, con
   accanto i fatti attesi. Misura quanti fatti giusti trova, quanti ne inventa,
   quanti ne perde. **Va scritta PRIMA di scegliere il modello**, altrimenti la
   scelta del modello e un'opinione. Si rilancia a ogni cambio di prompt.
2. **`scripts/verify-fatti.mjs`** — Playwright, come le altre: la schermata di
   correzione salva davvero, l'alias rende deterministica la volta dopo, i
   conteggi del mese corrispondono alle righe, in locale non parte nessuna
   richiesta di rete.

La soglia per considerare la fase 1 riuscita non e "il codice gira": e
**l'eval sopra il 90% sui fatti detti esplicitamente**, e zero invenzioni su
un transcript che non contiene cibo. Un'app che inventa una pizza che non hai
mangiato e peggio di un'app che non conta le pizze.
