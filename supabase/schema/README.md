# Schema e policy del database

⚠️ **Questa cartella NON è `supabase/migrations/`, e la differenza è voluta.**
I file qui dentro sono una **fotografia documentale**, non migrazioni: non vengono
applicati da `supabase db push` e non devono esserlo. Servono a rendere le policy
RLS *leggibili, revisionabili e ricostruibili*, cosa che finora non erano — il
database non aveva nessuna rappresentazione nel repository.

## Perché una fotografia e non un dump vero

`rls_snapshot_2026-08-25.sql` è stato **ricostruito** dall'output di `pg_policies`
interrogato il 25/08/2026. È fedele nella sostanza (tabelle, comandi, ruoli,
espressioni `USING` e `WITH CHECK`) ma non è garantito byte-identico a quello che
`pg_dump` produrrebbe: mancano dettagli come PERMISSIVE/RESTRICTIVE espliciti e
la formattazione originale.

Per un dump autentico, quando hai a disposizione la password del database:

```bash
supabase link --project-ref riyqtcssllupakjtoehj
supabase db dump --schema public --file supabase/schema/schema.sql
supabase db dump --schema public --data-only --file supabase/schema/data.sql   # opzionale
```

Da quel momento questa fotografia si può sostituire con il dump reale.

## Come tenerla aggiornata

Ogni volta che cambi una policy, rigenera la fotografia con:

```sql
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public'
order by tablename, policyname;
```

e riporta le modifiche qui. Vedi CLAUDE.md §4-bis per lo stato dei buchi noti.

## Migrazioni in attesa

File scritti e **non applicati**: aspettano lo sblocco esplicito del committente
(CLAUDE.md §0, regola 0-bis). Li applica lui, dal SQL editor di Supabase.

| File | Cosa fa | Perché la web app non ne è toccata |
|---|---|---|
| `note_estratte_2026-10-09.sql` | La tabella dei dati ricavati dalle note degli atleti («Dalle note» nella scheda atleta), con una policy solo admin | È una tabella nuova: `main` non la legge e non la scrive. La riempie solo la Edge Function `estrai-note` |

Dopo averla applicata, la riga si sposta nella fotografia delle policy e qui si cancella.
