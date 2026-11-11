# Template PDF del coach — design

Data: 11/11/2026 · Stato: design approvato in sessione («Sì, procedi», dopo la bozza
in localhost) · Migrazione: **undicesima eccezione** allo schema congelato, sì
esplicito del committente nella stessa sessione («Nel database (serve un tuo sì)»).

## Perché

Il PDF della scheda (menu della scheda → «Esporta PDF», `buildPDFDoc` in
`WorkoutDetail.jsx`) scrive a mano «Coach Federico Leo» in testa. Con più coach è
sbagliato per tutti gli altri. Il committente vuole che ogni coach:

1. veda **il suo nome** in testa al PDF;
2. possa aggiungere **note aggiuntive sue**, un testo fisso uguale in tutti i suoi
   PDF (contatti, regole, un saluto). Non sono le note del singolo workout
   (`coach_notes`), che restano come sono.

Nient'altro è personalizzabile (né logo, né colori, né ordine delle sezioni): lo ha
detto il committente.

## Cosa si vede

Pagina A4 come oggi (sfondo scuro, categoria, blocchi, note coach, glossario). Cambia:

- **Intestazione**: `FLEOFIT - Coach <nome>`. Senza un nome disponibile resta solo
  `FLEOFIT`: mai un nome inventato, mai più «Federico Leo» fisso.
- **«NOTE AGGIUNTIVE»**: titolo giallo e testo, subito dopo «NOTE COACH» (o al suo
  posto, se il workout non ha note). Senza note aggiuntive il riquadro non c'è. Il
  testo va a capo da solo; se arriverebbe a toccare il glossario (y 240 mm) si va
  a una pagina nuova, con lo sfondo scuro come le altre.

## Di chi è il template

Del coach che ha **creato il workout** (`workouts.creato_da`), chiunque esporti il
PDF: il coach, un admin o l'atleta. Così il PDF dice chi ha scritto la scheda.
Se `creato_da` è vuoto (workout autonomi vecchi) o la riga non si legge, si usa il
template di **chi sta esportando**, se è staff; altrimenti niente (solo `FLEOFIT`,
nessuna nota).

## Dati: tabella `pdf_coach`

File `supabase/schema/pdf_coach_2026-11-11.sql`, additiva, applicata **a mano** dal
committente come le altre.

```sql
create table public.pdf_coach (
  coach_id      uuid primary key references auth.users (id) on delete cascade,
  nome_firma    text check (nome_firma is null or char_length(btrim(nome_firma)) between 1 and 60),
  note_finali   text check (note_finali is null or char_length(note_finali) <= 600),
  aggiornato_at timestamptz not null default now()
);
```

- **RLS, lettura**: il proprietario, lo staff (`e_staff()`), e l'atleta di cui quel
  coach è coach (`e_mio_coach(coach_id)`). Un admin che crea il workout di un atleta
  non suo: l'atleta non lo legge, e il PDF ripiega (sezione precedente).
- **RLS, scrittura** (insert/update/delete): solo `coach_id = auth.uid()` **e**
  `puo_scrivere_messaggi()` (staff meno `demo@fleofit.it`: il revisore non scrive
  cose che finiscono sui PDF degli atleti veri). `USING` e `WITH CHECK` uguali.
- **Semina**: per ogni membro dello staff con un account, una riga con `nome_firma`
  = nome e cognome della sua riga `athletes` (come `elenco_staff`). Così il giorno
  dopo la migrazione il PDF di Federico dice ancora «Coach Federico Leo» senza che
  lui faccia niente. `on conflict do nothing`.
- **Backup notturno**: `pdf_coach:coach_id` in `TABLES` di `db-backup.yml` (attivo
  dopo il prossimo `app:main`, come ogni workflow).
- Rollback: `drop table public.pdf_coach;`.
- `main`, e le app già sugli Store, non la conoscono: per loro non cambia niente.

## Codice

### `src/lib/templatePdf.js` (puro, con test)
- `leggiTemplatePdf(supabase, { creatoDa, utente })` → `{ nome, note }`, ognuno
  stringa o `null`. Prova `creatoDa`, poi `utente`. Tabella assente
  (`42P01`/`PGRST205`), errore o rete giù → `{ nome: null, note: null }`, mai
  un'eccezione: il PDF si esporta sempre.
- `intestazioneCoach(nome)` → `' - Coach Mario Rossi'` oppure `''`.
- `pulisciTemplate({ nome, note })` → valori da salvare: spazi tolti, vuoti = `null`,
  limiti 60/600 come nel database.
- `salvaTemplatePdf(supabase, uid, valori)` → upsert; torna `{ errore }`.

### `WorkoutDetail.jsx`
- `buildPDFDoc` legge il template **all'esportazione** (non all'apertura della
  scheda: nessuna richiesta in più per chi non esporta), scrive l'intestazione con
  `intestazioneCoach` e aggiunge «NOTE AGGIUNTIVE». Nient'altro del PDF cambia.
  `jspdf` resta caricato solo lì.

### Impostazioni → «Solo coach» → «PDF delle schede»
- Riga nuova nella sezione «Solo coach» (telefono e desktop: la sezione è una sola,
  `pCoach`). Dettaglio: il nome scelto, o «Nome e note in fondo ai tuoi PDF».
- Apre `FoglioPdf.jsx` (bottom sheet come gli altri fogli): campo «Nome in
  intestazione» (placeholder: il nome dell'account), area «Note aggiuntive» con il
  contatore dei 600 caratteri, «Salva». Errori con `CustomAlert`, mai `alert()`.
- `demo@fleofit.it` vede il foglio ma il salvataggio fallisce per la RLS: il foglio
  mostra l'errore. Non serve nasconderlo.
- Ambiente di prova (`npm run demo`): `pdf_coach` nei semi, con una riga per il coach
  finto.

## Test

- `templatePdf.test.js`: nome e note del creatore; creatore senza riga → template di
  chi esporta; tabella assente → tutto `null`; `intestazioneCoach` con e senza nome;
  `pulisciTemplate` (spazi, vuoti, limiti).
- Test di pagina sul PDF (come quelli in `src/pages/__tests__/`, con `jspdf` finto):
  il testo dell'intestazione contiene il nome e «NOTE AGGIUNTIVE» compare solo con
  le note.
- Ogni test nuovo si vede fallire rompendo il codice, prima di dirlo verde.

## Fuori

Logo, colori, ordine delle sezioni, editor a blocchi, template diversi per categoria.
La story Instagram non cambia.
