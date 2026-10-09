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

## Migrazioni applicate a mano

Fuori da `supabase db push`: applicate dal SQL editor, ognuna con un sì esplicito del
committente (CLAUDE.md §0, regola 0-bis).

| File | Applicata | Cosa fa |
|---|---|---|
| `note_estratte_2026-10-09.sql` | 09/10/2026 | La tabella dei dati ricavati dalle note degli atleti («Dalle note»), policy solo admin. `main` non la conosce |

⚠️ La fotografia delle policy (`rls_snapshot_2026-08-25.sql`) è precedente: la policy
`note_estratte solo admin` sta nel file della migrazione.
