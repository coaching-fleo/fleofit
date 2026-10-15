-- ═══════════════════════════════════════════════════════════════════════════
-- messaggi_coach — «Messaggio a tutti», la bacheca del coach per gli atleti
-- Scritta il 15/10/2026 · sì ESPLICITO del committente in sessione, lo stesso
-- giorno («vai»), e applicata il 15/10/2026 con `supabase db query --linked -f`
-- (CLAUDE.md §0, regola 0-bis: ogni migrazione richiede il suo sì).
--
-- Migrazione ADDITIVA: una tabella nuova che `main` (la web app di oggi) non
-- conosce e non legge. Nessuna tabella esistente cambia.
--
-- Un messaggio del coach a tutti gli atleti, senza titolo: l'anteprima è
-- l'inizio del testo. `fissato` è la puntina. `autore` sopravvive all'account
-- (on delete set null). `modificato_at` resta null finché non viene corretto.
--
-- Chi legge: tutti gli utenti autenticati. La registrazione è chiusa (codice
-- invito), quindi «autenticato» vuol dire atleta o coach.
--
-- Chi scrive: SOLO gli admin, e la lista qui sotto NON include
-- demo@fleofit.it, a differenza delle altre tabelle. È voluto: l'account demo
-- è quello del revisore App Store, e non deve poter scrivere messaggi che
-- arriverebbero agli atleti veri. È l'unica tabella dove la lista di scrittura
-- differisce dalle altre.
--
-- La regola «fissati + dalla tua iscrizione» vive nell'app, non qui: è una
-- regola di ordine, non di segretezza.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.messaggi_coach (
  id uuid primary key default gen_random_uuid(),
  testo text not null check (char_length(btrim(testo)) between 1 and 2000),
  fissato boolean not null default false,
  autore uuid references auth.users (id) on delete set null default auth.uid(),
  creato_at timestamptz not null default now(),
  modificato_at timestamptz
);

create index messaggi_coach_creato on public.messaggi_coach (creato_at desc);

alter table public.messaggi_coach enable row level security;

create policy "messaggi_coach lettura" on public.messaggi_coach
  as permissive for select to authenticated
  using (true);

-- La lista admin è la stessa di supabase/functions/_shared/admin.ts e di
-- ADMIN_EMAILS in src/App.jsx, nello stesso ordine, MENO demo@fleofit.it (vedi
-- l'intestazione). USING e WITH CHECK allineati: una lista disallineata è la
-- causa del rifiuto App Store 2.3.1(a).
create policy "messaggi_coach scrittura admin" on public.messaggi_coach
  as permissive for all to authenticated
  using      ((auth.jwt() ->> 'email') = any (array['coaching@federicoleo.it','alessandro.patrone@hotmail.it','federico_leo@hotmail.it','federico.leo88@gmail.com']))
  with check ((auth.jwt() ->> 'email') = any (array['coaching@federicoleo.it','alessandro.patrone@hotmail.it','federico_leo@hotmail.it','federico.leo88@gmail.com']));

-- Dopo, per verificare (deve stampare DUE policy: SELECT e ALL):
-- select policyname, cmd from pg_policies where tablename = 'messaggi_coach';

-- Rollback (cancella tutti i messaggi):
-- drop table public.messaggi_coach;
