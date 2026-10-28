-- ═══════════════════════════════════════════════════════════════════════════
-- garmin — il collegamento con Garmin Connect: token, attività, giornate, invii
-- Scritta il 27/10/2026 · NON APPLICATA.
-- Spec: docs/superpowers/specs/2026-10-27-garmin-design.md (§7).
--
-- 🔒 CLAUDE.md §0, regola 0-bis: lo schema è congelato. Il committente ha dato
-- un sì DI PRINCIPIO il 27/10/2026; su QUESTO file serve ancora il suo sì
-- ESPLICITO, in sessione, prima di incollarlo nel SQL editor. Finché non c'è,
-- il file resta qui e basta.
--
-- ⚠️ PRIMA di incollare il resto, il committente crea il segreto del Vault che
-- la funzione `garmin_avvisa` legge (il valore è lo stesso di GARMIN_INTERNO_TOKEN
-- nei secret delle Edge Function, e NON va scritto in nessun file):
--     select vault.create_secret('<GARMIN_INTERNO_TOKEN>', 'garmin_interno');
-- Servono anche le estensioni `pg_net` e `supabase_vault` (su Supabase sono già
-- disponibili; se non attive: Database → Extensions).
--
-- Migrazione ADDITIVA: quattro tabelle nuove, due funzioni, tre trigger. Tre
-- tabelle esistenti ricevono un trigger ciascuna (athletes, athlete_workouts,
-- workouts): nessuna loro colonna cambia, nessuna loro policy cambia. `main` non conosce
-- niente di tutto questo.
--
-- Chi scrive e chi legge, in breve:
--  · garmin_collegamenti — TOKEN CIFRATI e dati PKCE. RLS attiva e NESSUNA
--    policy: né l'atleta né un admin la leggono dall'app. Ci lavora solo la
--    service role delle Edge Function. L'app chiede lo stato con `stato_garmin`
--    (che non restituisce mai un token). Non va nel backup notturno.
--  · garmin_attivita, garmin_giornate, garmin_invii — l'atleta legge le sue, il
--    suo coach quelle dei suoi atleti (`mio_atleta`, che per un admin vale
--    sempre). Nessuna insert/delete dall'app: scrivono le Edge Function.
--    Unica scrittura dall'app: l'abbinamento di un'attività a un allenamento
--    (`athlete_workout_id`, `abbinamento` di garmin_attivita) e solo quelle due
--    colonne, per colonna (grant) oltre che per policy.
--  · I trigger avvisano le Edge Function con net.http_post e un segreto del
--    Vault nell'header `x-garmin-interno`. Quello di «atleta eliminato» è ATTIVO
--    subito (serve a revocare il collegamento); i due degli invii all'orologio
--    nascono SPENTI: li accende la fase dei workout all'orologio.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. garmin_collegamenti ─────────────────────────────────────────────────
create table public.garmin_collegamenti (
  athlete_id        uuid primary key references public.athletes (id) on delete cascade,
  garmin_user_id    text unique,
  stato             text not null default 'in_attesa'
                      check (stato in ('in_attesa', 'attivo', 'da_ricollegare')),
  -- Token cifrati dalla Edge Function (mai in chiaro nel database).
  access_cifrato    text,
  refresh_cifrato   text,
  access_scade_at   timestamptz,
  refresh_scade_at  timestamptz,
  permessi          text[] not null default '{}',
  invia_workout     boolean not null default true,
  consenso_versione smallint,
  consenso_at       timestamptz,
  collegato_at      timestamptz,
  -- Passaggio di consegne OAuth (PKCE): vivono solo fra l'avvio e il ritorno.
  pkce_state        text unique,
  pkce_verifier     text,
  pkce_ritorno      text,
  pkce_at           timestamptz,
  aggiornato_at     timestamptz not null default now()
);

-- RLS attiva e nessuna policy: per authenticated e anon la tabella è chiusa.
alter table public.garmin_collegamenti enable row level security;
-- In più, niente privilegi: la RLS bastava già, ma così la tabella sparisce
-- anche dall'introspezione di pg_graphql. La service role non ne risente.
revoke all on public.garmin_collegamenti from anon, authenticated;

-- ── 2. garmin_attivita ─────────────────────────────────────────────────────
create table public.garmin_attivita (
  garmin_id          text primary key,
  athlete_id         uuid not null references public.athletes (id) on delete cascade,
  inizio             timestamptz not null,
  giorno             date not null,
  tipo               text not null,
  durata_s           integer,
  distanza_m         numeric,
  dati               jsonb not null default '{}',
  -- Se l'allenamento assegnato sparisce, l'attività resta (è un dato dell'orologio).
  athlete_workout_id uuid references public.athlete_workouts (id) on delete set null,
  abbinamento        text check (abbinamento in ('auto', 'atleta')),
  ricevuto_at        timestamptz not null default now()
);

create index garmin_attivita_atleta_giorno on public.garmin_attivita (athlete_id, giorno);

alter table public.garmin_attivita enable row level security;

create policy "garmin_attivita lettura" on public.garmin_attivita
  as permissive for select to authenticated
  using (athlete_id = auth.uid() or public.mio_atleta(athlete_id));

-- L'abbinamento lo può correggere chi la vede, ma SOLO quelle due colonne:
-- il grant per colonna impedisce di toccare durata, distanza, dati…
revoke update on public.garmin_attivita from authenticated;
grant update (athlete_workout_id, abbinamento) on public.garmin_attivita to authenticated;

create policy "garmin_attivita abbinamento" on public.garmin_attivita
  as permissive for update to authenticated
  using      (athlete_id = auth.uid() or public.mio_atleta(athlete_id))
  with check (
    (athlete_id = auth.uid() or public.mio_atleta(athlete_id))
    -- L'allenamento abbinato deve essere dello STESSO atleta dell'attività.
    and (
      athlete_workout_id is null
      or exists (select 1 from public.athlete_workouts aw
                 where aw.id = athlete_workout_id
                   and aw.athlete_id = garmin_attivita.athlete_id)
    )
  );

-- ── 3. garmin_giornate ─────────────────────────────────────────────────────
create table public.garmin_giornate (
  athlete_id    uuid not null references public.athletes (id) on delete cascade,
  giorno        date not null,
  giornata      jsonb,
  sonno         jsonb,
  hrv           jsonb,
  aggiornato_at timestamptz not null default now(),
  primary key (athlete_id, giorno)
);

alter table public.garmin_giornate enable row level security;

create policy "garmin_giornate lettura" on public.garmin_giornate
  as permissive for select to authenticated
  using (athlete_id = auth.uid() or public.mio_atleta(athlete_id));

-- ── 4. garmin_invii ────────────────────────────────────────────────────────
create table public.garmin_invii (
  athlete_workout_id uuid primary key references public.athlete_workouts (id) on delete cascade,
  athlete_id         uuid not null references public.athletes (id) on delete cascade,
  garmin_workout_id  text,
  garmin_schedule_id text,
  data               date not null,
  stato              text not null check (stato in ('inviato', 'da_rifare', 'errore')),
  errore             text,
  aggiornato_at      timestamptz not null default now()
);

alter table public.garmin_invii enable row level security;

create policy "garmin_invii lettura" on public.garmin_invii
  as permissive for select to authenticated
  using (athlete_id = auth.uid() or public.mio_atleta(athlete_id));

-- ── 5. stato_garmin — quello che l'app può sapere del collegamento ─────────
-- security definer perché garmin_collegamenti non ha policy: la funzione la
-- legge al posto del chiamante e restituisce SOLO i campi non segreti.
-- Nessuna riga se il collegamento è solo «in_attesa» (OAuth non concluso).
create or replace function public.stato_garmin(atleta uuid)
returns table (stato text, collegato_at timestamptz, permessi text[], invia_workout boolean)
language sql stable security definer set search_path = '' as $$
  select c.stato, c.collegato_at, c.permessi, c.invia_workout
  from public.garmin_collegamenti c
  where c.athlete_id = atleta
    and (atleta = auth.uid() or public.mio_atleta(atleta))
    and c.stato <> 'in_attesa'
$$;

revoke execute on function public.stato_garmin(uuid) from public, anon;
grant  execute on function public.stato_garmin(uuid) to authenticated;

-- ── 6. garmin_avvisa — il trigger che chiama la Edge Function ──────────────
-- TG_ARGV[0] è il nome della funzione: 'garmin-auth' o 'garmin-training'.
-- Il segreto sta nel Vault (`garmin_interno`, vedi in cima), mai nel codice.
-- net.http_post (pg_net) è asincrono: non rallenta né fa fallire la scrittura.
-- ⚠️ Fire-and-forget: se la chiamata fallisce, nessuno riprova (accettato per
-- la Fase 0; prima della Fase 1 serve un giro di recupero).
-- Il corpo ha la forma di un database webhook di Supabase, ma porta SOLO gli
-- identificatori (mai la riga intera): `{ id }`, più `athlete_id` per
-- athlete_workouts. La Fase 3 rileggerà le righe lato server.
create or replace function public.garmin_avvisa() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  segreto text;
  nuovo   jsonb;
  vecchio jsonb;
begin
  -- In INSERT `old` è null, in DELETE `new` è null. IF e non CASE: plpgsql
  -- risolve tutti i campi di un'espressione, e `new.athlete_id` su `athletes`
  -- o `workouts` (che non ce l'hanno) farebbe fallire il trigger.
  if TG_OP <> 'DELETE' then
    if TG_TABLE_NAME = 'athlete_workouts' then
      nuovo := jsonb_build_object('id', new.id, 'athlete_id', new.athlete_id);
    else
      nuovo := jsonb_build_object('id', new.id);
    end if;
  end if;
  if TG_OP <> 'INSERT' then
    if TG_TABLE_NAME = 'athlete_workouts' then
      vecchio := jsonb_build_object('id', old.id, 'athlete_id', old.athlete_id);
    else
      vecchio := jsonb_build_object('id', old.id);
    end if;
  end if;

  select ds.decrypted_secret into segreto
  from vault.decrypted_secrets ds
  where ds.name = 'garmin_interno';

  perform net.http_post(
    url     := 'https://riyqtcssllupakjtoehj.supabase.co/functions/v1/' || TG_ARGV[0],
    body    := jsonb_build_object(
                 'type',       TG_OP,
                 'table',      TG_TABLE_NAME,
                 'record',     nuovo,
                 'old_record', vecchio
               ),
    headers := jsonb_build_object(
                 'Content-Type',     'application/json',
                 'x-garmin-interno', coalesce(segreto, '')
               ),
    timeout_milliseconds := 5000
  );
  return null; -- trigger AFTER: il valore di ritorno è ignorato
end
$$;

-- Non è una funzione da chiamare dall'app: solo il trigger la esegue.
revoke execute on function public.garmin_avvisa() from public, anon, authenticated;

-- ── 7. I trigger ───────────────────────────────────────────────────────────
-- Atleta eliminato (soft delete: deleted_at, bigint in ms, passa da null a un
-- valore): la Edge Function revoca il collegamento presso Garmin. ATTIVO.
create trigger garmin_atleta_eliminato
  after update of deleted_at on public.athletes
  for each row
  when (old.deleted_at is null and new.deleted_at is not null)
  execute function public.garmin_avvisa('garmin-auth');

-- Invii all'orologio: creati ma SPENTI. Si accendono con la fase dei workout
-- all'orologio (alter table … enable trigger …), non prima.
-- ⚠️ Quando saranno accesi: la cancellazione fisica di un atleta (cron di
-- mezzanotte) cancella in cascata le sue assegnazioni e farebbe partire un
-- avviso per ciascuna; la funzione garmin-training dovrà tollerarlo.
create trigger garmin_invii_assegnazioni
  after insert or update or delete on public.athlete_workouts
  for each row execute function public.garmin_avvisa('garmin-training');
alter table public.athlete_workouts disable trigger garmin_invii_assegnazioni;

create trigger garmin_invii_workout
  after update or delete on public.workouts
  for each row execute function public.garmin_avvisa('garmin-training');
alter table public.workouts disable trigger garmin_invii_workout;

-- ── Dopo, per verificare ───────────────────────────────────────────────────
-- Policy attese: garmin_attivita lettura (SELECT) e abbinamento (UPDATE),
-- garmin_giornate lettura (SELECT), garmin_invii lettura (SELECT);
-- garmin_collegamenti NESSUNA.
--   select tablename, policyname, cmd from pg_policies where tablename like 'garmin_%';
-- Trigger attesi: garmin_atleta_eliminato 'O' (attivo), gli altri due 'D' (spenti).
--   select tgname, tgenabled from pg_trigger where tgname like 'garmin_%';
-- Il segreto c'è (deve stampare 1):
--   select count(*) from vault.decrypted_secrets where name = 'garmin_interno';

-- ── Rollback (cancella token, attività, giornate e invii) ──────────────────
-- drop trigger garmin_invii_workout on public.workouts;
-- drop trigger garmin_invii_assegnazioni on public.athlete_workouts;
-- drop trigger garmin_atleta_eliminato on public.athletes;
-- drop function public.garmin_avvisa();
-- drop function public.stato_garmin(uuid);
-- drop table public.garmin_invii;
-- drop table public.garmin_giornate;
-- drop table public.garmin_attivita;
-- drop table public.garmin_collegamenti;
-- (il segreto del Vault, se non serve più: delete from vault.secrets where name = 'garmin_interno';)
