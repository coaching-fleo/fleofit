# Gruppi di atleti — disegno

Data: 16/11/2026 · Stato: **da approvare**

## Perché
Il coach assegna spesso lo stesso workout, lo stesso giorno, alle stesse persone.
Oggi le spunta una per una nel foglio «Assegna Workout» della scheda. Un **gruppo**
è una scorciatoia **solo del coach**: lo crea, ci mette i suoi atleti, e all'assegnazione
tocca il gruppo invece delle persone.

## Obiettivi
- Creare, rinominare, modificare e cancellare gruppi di propri atleti.
- Nel foglio «Assegna Workout», scegliere un gruppo = spuntare i suoi atleti in un tocco.
- Stessi gruppi su telefono, computer e web (salvati nel database).

## Non obiettivi
- Nessun consenso, nessuna notifica, nessuna schermata lato atleta: **l'atleta non sa
  di essere in un gruppo**. (I Team, con invito e accettazione, restano un'altra cosa.)
- Nessun legame fra gruppo e allenamento dopo l'assegnazione: sono assegnazioni
  normali, una per atleta, come oggi. Aggiungere qualcuno al gruppo dopo non gli
  assegna i workout già dati.
- Niente interruttore in `funzioni_app`: è una comodità del coach, accesa subito.

## Da non fare (anti-obiettivi)
- Un gruppo che assegna **senza** lasciar togliere qualcuno per quella volta.
- Un atleta di un altro coach che finisce in un tuo gruppo, o un gruppo che mostra
  persone che non vedi più.

## Vincoli
- Schema congelato (CLAUDE.md §0-bis): la tabella è un'**eccezione** col sì esplicito
  del committente (16/11/2026, «A, nel database»), additiva, applicata **a mano** dal
  SQL editor. `main` non la conosce. Senza la tabella l'app nasconde tutto, senza alert.
- Tre piattaforme dallo stesso codice; nulla di nativo.

## Approcci considerati
- **A. Tabella nel database** — scelto dal committente. Gruppi ovunque, solo del coach.
  Costo: una migrazione additiva.
- B. Solo sul dispositivo (localStorage) — scartato: gruppi diversi fra telefono e
  computer, persi cambiando telefono.
- C. Riusare i Team senza consenso — scartato: i Team esistono proprio per il consenso
  dell'atleta, e il trigger lo impone.

## Il disegno

### Database (`supabase/schema/gruppi_atleti_2026-11-16.sql`)
```sql
create table public.gruppi_atleti (
  id uuid primary key default gen_random_uuid(),
  coach uuid not null references auth.users (id) on delete cascade default auth.uid(),
  nome text not null check (char_length(btrim(nome)) between 1 and 40),
  atleti uuid[] not null default '{}',
  creato_at timestamptz not null default now(),
  modificato_at timestamptz
);
-- una policy sola, come modelli_blocco: solo il proprietario, se è staff
-- (anche un admin vede solo i suoi gruppi)
using / with check (coach = auth.uid() and public.e_staff())
```
- `atleti` è un elenco di id, non una tabella di collegamento: niente cascade, ma
  **all'uso** si tengono solo gli atleti che il coach vede ancora (lista caricata col
  filtro RLS e `deleted_at is null`). Un atleta cancellato o passato a un altro coach
  sparisce dal gruppo senza fare danni. *(Scelta di Claude: una tabella e una policy
  invece di due.)*
- Si scrive anche `demo@fleofit.it`: i gruppi sono suoi e non toccano nessuno.
- Nel backup notturno, come `modelli_blocco`.

### Logica (`src/lib/gruppiAtleti.js`, pura e testata)
- `membriVisibili(gruppo, atleti)` — gli atleti del gruppo che esistono ancora, in ordine
  di nome.
- `nomeGruppoValido(nome, gruppi, idEscluso)` — non vuoto, max 40, non doppio
  (maiuscole ignorate).
- `gruppoTuttoScelto(gruppo, scelti, atleti)` — per lo stato del chip.
Più `gruppiAtletiDb.js` per leggere/scrivere, con `assente(error)` che nasconde tutto se la
tabella non c'è (come `teamDb.js`).

### Foglio «Assegna Workout» (WorkoutDetail, passo 1)
```
 Assegna Workout                         ✕
 [ Cerca nome o cognome            ]
 Gruppi
 (● Hyrox martedì 6) (○ Doppie 4) (○ Corsa 8) →   ← chip a scorrimento orizzontale
 Seleziona atleti:              Seleziona tutti
 ...elenco come oggi...
 [ Procedi (6) ]
```
- Tocco su un chip: **aggiunge** alla selezione tutti i membri visibili; se erano già
  tutti scelti, li **toglie**. Gli altri atleti scelti a mano restano.
- Il chip pieno (giallo) quando tutti i suoi membri sono scelti.
- Poi si può ancora togliere chi quella volta non lo deve ricevere.
- Riga «Gruppi» assente se il coach non ne ha nessuno (o la tabella non c'è).
- Con 2+ atleti scelti e nessun gruppo uguale, un link piccolo **«Salva come gruppo»**
  sotto «Seleziona atleti» chiede il nome in un CustomPrompt/foglio e lo crea.
- Il passo 2 resta com'è («6 atleti selezionati», data, Conferma).

### Gestione dei gruppi (pagina Atleti, solo coach)
- Nella testata della pagina, un bottone **«Gruppi»** accanto a «Team» (sul desktop accanto a
  «Nuovo atleta») che apre il foglio «I tuoi gruppi». *(Scelta di Claude: lo stesso posto del
  bottone Team, invece di una riga in testa alla lista.)*
- Il foglio elenca i gruppi (nome, numero di atleti, prime tre facce). «Nuovo gruppo» e
  tocco su un gruppo aprono lo stesso editor: nome + elenco dei propri atleti con la
  spunta (con la ricerca, come il foglio di assegnazione) + «Elimina gruppo» con
  CustomConfirm.
- Un atleta può stare in più gruppi.

## Lasciato a chi costruisce
- Componenti e nomi dei file della UI (`FoglioGruppi`, ecc.), il posto esatto della riga
  sul desktop di `AtletiDesktop`.
- Tasto indietro Android: le modali nuove hanno la X `aria-label="Chiudi"`.
- Test della logica pura e della pagina col finto Supabase; verifica che fallisca
  rompendo il codice.
- Memoria: nuova voce in CLAUDE.md §0-bis (dodicesima eccezione, da applicare) e §4,
  note in `docs/memoria/atleti.md`.
