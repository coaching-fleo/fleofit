-- ═══════════════════════════════════════════════════════════════════════════
-- come_stai — «Come stai oggi», le quattro risposte dell'atleta prima di allenarsi
-- Scritta il 13/10/2026 · sì ESPLICITO del committente in sessione, lo stesso giorno
-- (CLAUDE.md §0, regola 0-bis: ogni migrazione richiede il suo sì).
--
-- Migrazione ADDITIVA: una tabella nuova che `main` (la web app di oggi) non
-- conosce e non legge. Nessuna tabella esistente cambia.
--
-- Una riga per atleta per GIORNO, non per seduta: chi fa due allenamenti nello
-- stesso giorno risponde una volta. Le quattro risposte vanno da 1 a 5 e sono
-- tutte orientate allo stesso modo — **5 è sempre la cosa buona**:
--   sonno   1 pessimo   → 5 ottimo
--   energia 1 a terra   → 5 al massimo
--   dolori  1 molti     → 5 nessuno
--   stress  1 alto      → 5 basso
-- Così la media delle quattro è un numero solo («Come sta», 1–5) senza girare
-- nessuna scala. Ogni risposta può mancare: l'atleta può saltarne una.
--
-- Chi scrive e chi legge: l'atleta le proprie righe, gli admin tutte — la
-- stessa policy di `athlete_workouts`.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.come_stai (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  giorno date not null,
  sonno   smallint check (sonno   between 1 and 5),
  energia smallint check (energia between 1 and 5),
  dolori  smallint check (dolori  between 1 and 5),
  stress  smallint check (stress  between 1 and 5),
  creato_at timestamptz not null default now(),
  unique (athlete_id, giorno),
  -- Una riga tutta vuota non è una risposta: chi salta non scrive niente.
  check (coalesce(sonno, energia, dolori, stress) is not null)
);

create index come_stai_giorno on public.come_stai (giorno);

alter table public.come_stai enable row level security;

-- La lista admin è la stessa di supabase/functions/_shared/admin.ts e di
-- ADMIN_EMAILS in src/App.jsx, nello stesso ordine. USING e WITH CHECK
-- allineati: una lista disallineata è la causa del rifiuto App Store 2.3.1(a).
create policy "come_stai atleta e admin" on public.come_stai
  as permissive for all to authenticated
  using      ((auth.uid() = athlete_id) or ((auth.jwt() ->> 'email') = any (array['coaching@federicoleo.it','alessandro.patrone@hotmail.it','federico_leo@hotmail.it','federico.leo88@gmail.com','demo@fleofit.it'])))
  with check ((auth.uid() = athlete_id) or ((auth.jwt() ->> 'email') = any (array['coaching@federicoleo.it','alessandro.patrone@hotmail.it','federico_leo@hotmail.it','federico.leo88@gmail.com','demo@fleofit.it'])));

-- Dopo, per verificare (deve stampare UNA policy, comando ALL):
-- select policyname, cmd from pg_policies where tablename = 'come_stai';

-- Rollback (cancella tutte le risposte):
-- drop table public.come_stai;
