-- Controlli sull'account che diamo ad Apple (demo@fleofit.it).
-- Solo letture: nessuna modifica di schema, compatibile col congelamento
-- (CLAUDE.md regola 0-bis). Eseguire nell'SQL Editor di Supabase.

-- ─────────────────────────────────────────────────────────────────────────
-- A. PRIMA di provare: l'account esiste ed è pronto?
--    Se `riga_athletes` è false il revisore finisce in onboarding invece che
--    nella dashboard coach, e non vede niente di quello che deve valutare.
-- ─────────────────────────────────────────────────────────────────────────
select
  u.email,
  u.id                                        as user_id,
  u.email_confirmed_at is not null            as email_confermata,
  u.last_sign_in_at,
  exists (select 1 from public.athletes a where a.id = u.id) as riga_athletes
from auth.users u
where lower(u.email) = 'demo@fleofit.it';

-- ─────────────────────────────────────────────────────────────────────────
-- B. La dashboard coach non deve aprirsi vuota.
--    Un revisore che vede tre schermate vuote non riesce a valutare la
--    funzionalità, ed è di nuovo un 2.3.1(a).
-- ─────────────────────────────────────────────────────────────────────────
select
  (select count(*) from public.athletes         where deleted_at is null) as atleti_visibili,
  (select count(*) from public.workouts)                                  as workout_totali,
  (select count(*) from public.athlete_workouts)                          as assegnazioni,
  (select count(*) from public.invitation_codes where is_active)          as codici_attivi;

-- ─────────────────────────────────────────────────────────────────────────
-- C. DOPO aver provato ad assegnare dall'app: l'assegnazione è arrivata?
--
--    ⚠️ NON si può ordinare per "più recente": `athlete_workouts` non ha una
--    colonna created_at, e `id` è un UUID casuale — ordinarci sopra restituisce
--    righe di mesi diversi mescolate. (La prima versione di questa query faceva
--    esattamente questo errore, il 26/08/2026.)
--
--    Due modi affidabili. Il primo: contare prima e dopo.
--    Esegui la query B PRIMA di assegnare, segna `assegnazioni`, poi riesegui
--    questa dopo: deve essere esattamente uno in più.
-- ─────────────────────────────────────────────────────────────────────────
select count(*) as assegnazioni_ora from public.athlete_workouts;

--    Il secondo, più preciso: cerca la riga per atleta e data scelti nell'app.
--    Sostituisci i due valori con quelli che hai usato.
select aw.id, aw.status, aw.completed_date, w.title,
       a.name || ' ' || coalesce(a.surname, '') as atleta
from public.athlete_workouts aw
left join public.workouts  w on w.id = aw.workout_id
left join public.athletes  a on a.id = aw.athlete_id
where aw.completed_date = '2026-08-26'          -- ← la data scelta nell'app
order by w.title;

-- ─────────────────────────────────────────────────────────────────────────
-- D. Le tre porte che l'assegnazione attraversa, con demo@fleofit.it.
--    INSERT su athlete_workouts → with_check
--    .select('id') sulle righe inserite → qual
--    invoke send-reminders mode 'immediate' → _shared/admin.ts (non è RLS)
--    Tutte e tre devono dire true, o l'assegnazione fallisce a metà.
-- ─────────────────────────────────────────────────────────────────────────
select tablename, policyname, cmd,
       qual::text       like '%demo@fleofit.it%' as using_ok,
       with_check::text like '%demo@fleofit.it%' as check_ok
from pg_policies
where schemaname = 'public'
  and tablename in ('athletes', 'athlete_workouts', 'workouts')
order by tablename, policyname;


-- ─────────────────────────────────────────────────────────────────────────
-- E. Codici invito attivi. Rilevato 0 il 26/08/2026.
--
--    La registrazione è chiusa per scelta: senza un `invitation_code` valido il
--    ProtectedRoute fa signOut e rimanda a /login?error=unauthorized. Con ZERO
--    codici attivi, un revisore che provasse a registrarsi come atleta verrebbe
--    espulso senza spiegazione — e "flusso che non funziona" è esattamente il
--    tipo di osservazione che ha prodotto il 2.3.1(a) di maggio.
--
--    L'admin può generarne uno da Impostazioni → Codici invito. Farlo prima
--    della revisione costa un minuto e toglie un'incognita.
-- ─────────────────────────────────────────────────────────────────────────
select code, is_active, used_by_email, used_at, created_at
from public.invitation_codes
order by created_at desc
limit 10;
