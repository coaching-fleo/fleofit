-- ═══════════════════════════════════════════════════════════════════════════
-- multi_coach — più coach, ognuno vede SOLO i suoi atleti
-- Scritta il 15/10/2026 · spec: docs/superpowers/specs/2026-10-15-multi-coach-design.md
--                        piano: docs/superpowers/plans/2026-10-15-multi-coach.md
--
-- ⛔ NON APPLICATA. Serve il sì ESPLICITO del committente (CLAUDE.md §0, regola
-- 0-bis). A differenza delle tre eccezioni precedenti NON è solo additiva:
-- RISCRIVE le policy di tabelle esistenti (athletes, athlete_workouts,
-- workouts, invitation_codes, personal_records, come_stai, note_estratte,
-- messaggi_coach, storage voice-notes). Il database è uno solo e serve web,
-- iOS e Android in produzione, comprese le versioni già sugli Store.
--
-- Prima di applicare: il backup (`db-backup.yml`, o un export a mano).
-- Si applica in UNA transazione: o passa tutto, o niente.
--
-- L'ordine, tutto nella stessa seduta (docs/memoria/database.md, «multi_coach»):
--   1. backup (db-backup.yml a mano, o export);
--   2. i controlli della sezione 0 (letture), confrontati a occhio;
--   3. questa migrazione;
--   4. i conteggi della sezione 6;
--   5. deploy di ai-workout, ricerca-coach, estrai-note e send-reminders,
--      uno dopo l'altro, SUBITO: le versioni di oggi leggono ancora la lista
--      email e non conoscono coach_atleti;
--   6. le prove sul telefono (coach e atleta);
--   7. solo allora si aggiunge un secondo coach in `staff`.
-- La web app (app:main) si può pubblicare anche PRIMA della migrazione: senza
-- le tabelle nuove ricade sul comportamento di oggi. L'unica cosa che le
-- servirebbe, «Tutti gli atleti» in Messaggio a tutti, resta nascosta finché la
-- colonna `destinatari` non esiste.
--
-- Il modello
--   staff         chi lavora nell'app: ruolo 'admin' (vede e fa tutto) o
--                 'coach' (vede solo i suoi atleti). Chiave = email, così un
--                 coach si aggiunge PRIMA che crei l'account.
--   coach_atleti  atleta ↔ coach. Oggi uno a uno, ma la chiave è la COPPIA:
--                 un secondo coach è una riga in più, non una migrazione.
--                 Scritta solo dagli admin e dal trigger:
--                 l'atleta NON può cambiarsi coach (se fosse una colonna di
--                 `athletes`, la policy «auth.uid() = id» glielo
--                 permetterebbe).
--   workouts.creato_da  di chi è un workout, anche se non è assegnato a nessuno
--                 (la libreria dell'archivio). Default auth.uid(): le versioni
--                 vecchie dell'app, che non lo mandano, lo riempiono lo stesso.
--   messaggi_coach.destinatari  'miei' (gli atleti dell'autore) o 'tutti'
--                 (tutti gli atleti dell'app; SOLO un admin può sceglierlo).
--
-- Perché le versioni già pubblicate non si rompono: la lista admin dentro
-- l'app (ADMIN_EMAILS) decide solo cosa si DISEGNA. federico_leo@hotmail.it,
-- con l'app vecchia, vedrà ancora i bottoni da admin, ma il database gli
-- consegnerà solo i suoi atleti. Gli admin veri restano admin anche qui.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 0. Controlli (letture). Se uno di questi non torna, ROLLBACK. ──────────
-- Gli account dello staff: attesi coaching@, alessandro.patrone@,
-- federico_leo@, demo@ (federico.leo88@gmail.com oggi non ha un account).
-- select email, id from auth.users where lower(email) in
--   ('coaching@federicoleo.it','alessandro.patrone@hotmail.it',
--    'federico_leo@hotmail.it','federico.leo88@gmail.com','demo@fleofit.it');
--
-- Le policy che ci sono OGGI sulle tabelle toccate, da confrontare con le
-- `drop policy` della sezione 5. Le policy permissive si sommano in OR: una
-- policy in più, che qui non si toglie, RIAPRIREBBE l'accesso che le nuove
-- chiudono, senza nessun errore. Se ne compare una che la sezione 5 non
-- nomina, ci si ferma e si decide prima.
-- select schemaname, tablename, policyname, cmd, roles, qual, with_check
--   from pg_policies
--  where (schemaname = 'public' and tablename in
--          ('athletes','athlete_workouts','workouts','invitation_codes',
--           'personal_records','come_stai','note_estratte','messaggi_coach',
--           'workout_logs','athlete_photos'))
--     or (schemaname = 'storage' and tablename = 'objects')
--  order by 1, 2, 3;

-- L'account a cui vanno atleti e workout di oggi deve esistere, ed essere UNO:
-- senza, la sezione 2 non assegnerebbe niente a nessuno (o lo farebbe due volte).
do $$
begin
  if (select count(*) from auth.users where lower(email) = 'federico_leo@hotmail.it') <> 1 then
    raise exception 'account federico_leo@hotmail.it non trovato (o doppio)';
  end if;
end $$;


-- ── 1. Tabelle nuove ───────────────────────────────────────────────────────

create table public.staff (
  email text primary key check (email = lower(btrim(email))),
  ruolo text not null check (ruolo in ('admin', 'coach')),
  creato_at timestamptz not null default now()
);

create table public.coach_atleti (
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  coach_id   uuid not null references auth.users (id) on delete restrict,
  creato_at  timestamptz not null default now(),
  primary key (athlete_id, coach_id)
);
create index coach_atleti_coach on public.coach_atleti (coach_id);

-- Colonna nuova, nullable: `main` e le app vecchie non la conoscono e non
-- la mandano; il default la riempie per loro.
alter table public.workouts
  add column creato_da uuid references auth.users (id) on delete set null
  default auth.uid();
create index workouts_creato_da on public.workouts (creato_da);

-- Le righe di oggi diventano 'miei' (oggi la tabella è vuota).
alter table public.messaggi_coach
  add column destinatari text not null default 'miei'
  check (destinatari in ('miei', 'tutti'));


-- ── 2. Chi c'è: i dati di partenza ─────────────────────────────────────────

insert into public.staff (email, ruolo) values
  ('coaching@federicoleo.it',       'admin'),
  ('alessandro.patrone@hotmail.it', 'admin'),
  ('federico.leo88@gmail.com',      'admin'),
  ('demo@fleofit.it',               'admin'),   -- il revisore App Store: resta com'è oggi
  ('federico_leo@hotmail.it',       'coach');

-- Decisione D5 della spec: tutti gli atleti di oggi vanno a
-- federico_leo@hotmail.it. Gli account dello staff hanno anche una
-- riga in `athletes` (sono le loro schede), e quelle restano senza coach.
insert into public.coach_atleti (athlete_id, coach_id)
select a.id, c.id
from public.athletes a
cross join (select id from auth.users where lower(email) = 'federico_leo@hotmail.it') c
where a.id not in (
  select u.id from auth.users u join public.staff s on s.email = lower(u.email)
);

-- Decisione D6: suoi anche i workout di oggi, così la libreria non gli sparisce.
-- (Gli admin li vedono comunque tutti.) Esclusi gli allenamenti liberi
-- (isAutonomous): li ha scritti l'atleta, non sono di nessun coach, e il coach
-- li vede comunque attraverso l'assegnazione all'atleta.
update public.workouts
set creato_da = (select id from auth.users where lower(email) = 'federico_leo@hotmail.it')
where creato_da is null
  and (sections ->> 'isAutonomous') is distinct from 'true';

-- I messaggi già scritti da un admin parlavano a TUTTI gli atleti (la bacheca
-- di oggi non ha destinatari): restano così, invece di restringersi ai 'miei'.
update public.messaggi_coach m
set destinatari = 'tutti'
where exists (select 1 from auth.users u
              join public.staff s on s.email = lower(u.email)
              where u.id = m.autore and s.ruolo = 'admin');


-- ── 3. Le funzioni che usano le policy ─────────────────────────────────────
-- security definer: leggono staff/coach_atleti/athlete_workouts SENZA passare
-- dalla RLS. È quello che evita la ricorsione fra policy (workouts guarda
-- athlete_workouts che guarda…) e tiene le policy corte. search_path vuoto
-- e nomi qualificati: una funzione security definer non si fida dello schema
-- di chi la chiama.

create or replace function public.email_corrente() returns text
language sql stable set search_path = '' as $$
  select lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
$$;

create or replace function public.e_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff
                 where email = public.email_corrente() and ruolo = 'admin')
$$;

create or replace function public.e_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where email = public.email_corrente())
$$;

-- Chi può scrivere ai propri atleti: lo staff MENO l'account demo, come oggi
-- in messaggi_coach (il revisore non deve raggiungere atleti veri).
create or replace function public.puo_scrivere_messaggi() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.e_staff() and public.email_corrente() <> 'demo@fleofit.it'
$$;

-- L'atleta è mio? Un admin: sempre. Un coach: se è in coach_atleti con lui.
create or replace function public.mio_atleta(atleta uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.e_admin()
      or exists (select 1 from public.coach_atleti
                 where athlete_id = atleta and coach_id = auth.uid())
$$;

-- `c` è uno dei coach dell'atleta che sta chiamando? (Un atleta può averne più d'uno.)
create or replace function public.e_mio_coach(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.coach_atleti
                 where athlete_id = auth.uid() and coach_id = c)
$$;

-- L'utente `u` è un admin? Serve alla bacheca: un messaggio 'tutti' vale
-- solo se l'ha scritto un admin (lo garantisce anche la policy di scrittura,
-- ma un admin poi declassato a coach non deve continuare a parlare a tutti).
create or replace function public.utente_admin(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users x
                 join public.staff s on s.email = lower(x.email)
                 where x.id = u and s.ruolo = 'admin')
$$;

-- Posso vedere questo workout attraverso le ASSEGNAZIONI? Admin; l'atleta a
-- cui è assegnato; il coach di un atleta a cui è assegnato.
-- ⚠️ «L'ho creato io» NON sta qui ma nella policy, sulle colonne della riga:
-- una funzione `stable` vede il database com'era all'inizio dell'istruzione,
-- quindi in un `insert(…).select()` non troverebbe la riga appena scritta e
-- il workout nuovo tornerebbe vuoto al builder.
create or replace function public.vedo_workout(w uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.e_admin()
      or exists (select 1 from public.athlete_workouts aw
                 where aw.workout_id = w
                   and (aw.athlete_id = auth.uid() or public.mio_atleta(aw.athlete_id)))
$$;

-- L'elenco dello staff per la schermata «Coach» (Impostazioni): il client non
-- può leggere auth.users, quindi non saprebbe a quale account (id, nome)
-- corrisponde un'email. Solo un admin ottiene righe; per tutti gli altri è vuota.
create or replace function public.elenco_staff()
returns table(email text, ruolo text, user_id uuid, nome text)
language sql stable security definer set search_path = '' as $$
  select s.email, s.ruolo, u.id,
         nullif(btrim(coalesce(a.name, '') || ' ' || coalesce(a.surname, '')), '')
  from public.staff s
  left join auth.users u on lower(u.email) = s.email
  left join public.athletes a on a.id = u.id
  where public.e_admin()
  order by s.ruolo, s.email
$$;

-- Il grant di default è a PUBLIC (cioè anche ad anon): si toglie e si dà
-- solo agli utenti con account.
revoke execute on function public.e_admin(), public.e_staff(), public.puo_scrivere_messaggi(),
  public.mio_atleta(uuid), public.e_mio_coach(uuid), public.utente_admin(uuid), public.vedo_workout(uuid),
  public.elenco_staff() from public, anon;
grant execute on function public.e_admin(), public.e_staff(), public.puo_scrivere_messaggi(),
  public.mio_atleta(uuid), public.e_mio_coach(uuid), public.utente_admin(uuid), public.vedo_workout(uuid),
  public.elenco_staff() to authenticated;


-- ── 4. Il coach si assegna da solo ─────────────────────────────────────────
-- Quando nasce una riga `athletes`:
--   • la crea l'atleta stesso (registrazione con codice invito, App.jsx):
--     coach = chi ha creato il codice che ha usato, se è dello staff;
--   • la crea un coach a mano (Atleti → «Nuovo atleta»): coach = lui.
-- Un admin che crea un atleta a mano non se lo prende: lo assegna dopo.
-- `on conflict do nothing`: una riga esistente non si sovrascrive mai qui.

create or replace function public.assegna_coach() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  coach uuid;
begin
  if new.id = auth.uid() then
    select c.created_by into coach
    from public.invitation_codes c
    join auth.users u on u.id = c.created_by
    join public.staff s on s.email = lower(u.email)
    where c.used_by = new.id
    order by c.used_at desc nulls last
    limit 1;
  elsif public.e_staff() and not public.e_admin() then
    coach := auth.uid();
  end if;

  if coach is not null then
    insert into public.coach_atleti (athlete_id, coach_id)
    values (new.id, coach)
    on conflict (athlete_id, coach_id) do nothing;
  end if;
  return new;
end $$;

create trigger athletes_assegna_coach
  after insert on public.athletes
  for each row execute function public.assegna_coach();


-- ── 5. Le policy ───────────────────────────────────────────────────────────
-- Regola unica: l'atleta vede il suo, il coach vede quello dei suoi atleti,
-- l'admin vede tutto. USING e WITH CHECK sempre allineati.

-- staff: ognuno legge la propria riga (l'app ci legge il ruolo); gli admin tutto.
alter table public.staff enable row level security;
create policy "staff lettura" on public.staff
  for select to authenticated
  using (email = public.email_corrente() or public.e_admin());
create policy "staff scrittura admin" on public.staff
  for all to authenticated
  using (public.e_admin()) with check (public.e_admin());

-- coach_atleti: l'atleta legge le sue righe, il coach le sue, l'admin tutte.
-- Scrive solo l'admin (più il trigger, che è security definer).
alter table public.coach_atleti enable row level security;
create policy "coach_atleti lettura" on public.coach_atleti
  for select to authenticated
  using (athlete_id = auth.uid() or coach_id = auth.uid() or public.e_admin());
create policy "coach_atleti scrittura admin" on public.coach_atleti
  for all to authenticated
  using (public.e_admin()) with check (public.e_admin());

-- athletes
-- WITH CHECK ha in più `e_staff()`: un coach che crea un atleta a mano non
-- può essere già in coach_atleti (ci entra col trigger, DOPO il controllo).
-- Non apre niente: per modificare una riga serve prima passare USING.
drop policy "Gestione completa atleti" on public.athletes;
create policy "athletes proprio, del coach, admin" on public.athletes
  for all to authenticated
  using      (auth.uid() = id or public.mio_atleta(id))
  with check (auth.uid() = id or public.mio_atleta(id) or public.e_staff());

-- athlete_workouts
-- In scrittura il workout deve essere uno che chi scrive può VEDERE: senza,
-- un coach che conosce l'id di un workout altrui lo assegnerebbe a un suo
-- atleta e da lì lo leggerebbe.
drop policy "Accesso controllato ad athlete_workouts" on public.athlete_workouts;
create policy "athlete_workouts proprio, del coach, admin" on public.athlete_workouts
  for all to authenticated
  using      (auth.uid() = athlete_id or public.mio_atleta(athlete_id))
  with check ((auth.uid() = athlete_id or public.mio_atleta(athlete_id))
              and exists (select 1 from public.workouts w where w.id = workout_id));

-- workouts
drop policy "Tutti gli utenti loggati possono leggere i workout" on public.workouts;
drop policy "Solo gli admin possono modificare i workout" on public.workouts;
drop policy "Permetti creazione workout autonomi" on public.workouts;
drop policy "Permetti alla TV di leggere i workout" on public.workouts;

create policy "workouts lettura" on public.workouts
  for select to authenticated
  using (creato_da = auth.uid() or athlete_id = auth.uid() or public.vedo_workout(id));

-- Lo staff crea workout a nome proprio; un atleta solo quelli autonomi.
-- Un admin può inserire righe con un creato_da qualunque: è il ripristino da
-- backup (Impostazioni), che riscrive i workout col loro autore originale.
create policy "workouts creazione" on public.workouts
  for insert to authenticated
  with check (public.e_admin()
              or (creato_da = auth.uid()
                  and (public.e_staff() or (sections ->> 'isAutonomous')::boolean = true)));

-- Modifica e cancellazione: l'admin tutto, il coach SOLO i workout che ha creato.
-- Non basta vederlo: un workout di un altro coach assegnato anche a un mio
-- atleta lo vedo, ma non è mio da cambiare o cancellare (cancellarlo
-- toglierebbe la seduta agli atleti dell'altro). `e_staff()` resta, come oggi:
-- l'atleta che ha creato un allenamento libero (creato_da = lui) non lo
-- modifica né lo cancella dalla tabella workouts.
create policy "workouts modifica staff" on public.workouts
  for update to authenticated
  using (public.e_admin() or (public.e_staff() and creato_da = auth.uid()))
  with check (public.e_staff());
create policy "workouts cancellazione staff" on public.workouts
  for delete to authenticated
  using (public.e_admin() or (public.e_staff() and creato_da = auth.uid()));

-- La TV (senza login) legge SOLO un workout che è in onda su una sessione TV.
-- Prima leggeva l'INTERA programmazione con la sola anon key.
create policy "workouts lettura TV" on public.workouts
  for select to anon
  using (exists (select 1 from public.tv_sessions t where t.workout_id = workouts.id));

-- invitation_codes: il coach vede e cancella solo i suoi codici.
-- Restano com'erano le tre policy dell'atleta (validare e riscattare un codice).
drop policy "Admins can view all invitation codes" on public.invitation_codes;
drop policy "Admins can delete invitation codes" on public.invitation_codes;
drop policy "Admins can create invitation codes" on public.invitation_codes;
create policy "codici lettura staff" on public.invitation_codes
  for select to authenticated
  using (public.e_admin() or (public.e_staff() and created_by = auth.uid()));
create policy "codici cancellazione staff" on public.invitation_codes
  for delete to authenticated
  using (public.e_admin() or (public.e_staff() and created_by = auth.uid()));
create policy "codici creazione staff" on public.invitation_codes
  for insert to authenticated
  with check (public.e_staff() and created_by = auth.uid());

-- personal_records: era aperta a TUTTI gli autenticati (il buco peggiore).
drop policy "Permetti tutto agli utenti autenticati" on public.personal_records;
create policy "personal_records proprio, del coach, admin" on public.personal_records
  for all to authenticated
  using      (auth.uid() = athlete_id or public.mio_atleta(athlete_id))
  with check (auth.uid() = athlete_id or public.mio_atleta(athlete_id));

-- come_stai
drop policy "come_stai atleta e admin" on public.come_stai;
create policy "come_stai proprio, del coach, admin" on public.come_stai
  for all to authenticated
  using      (auth.uid() = athlete_id or public.mio_atleta(athlete_id))
  with check (auth.uid() = athlete_id or public.mio_atleta(athlete_id));

-- note_estratte: come oggi l'atleta NON le legge; il coach solo dei suoi.
drop policy "note_estratte solo admin" on public.note_estratte;
create policy "note_estratte del coach e admin" on public.note_estratte
  for all to authenticated
  using      (public.e_staff() and public.mio_atleta(athlete_id))
  with check (public.e_staff() and public.mio_atleta(athlete_id));

-- messaggi_coach: l'atleta legge i messaggi dei suoi coach e quelli 'tutti'
-- degli admin; il coach i suoi; l'admin tutti. Si scrive solo a nome proprio,
-- e 'tutti' solo da admin (decisione D8).
drop policy "messaggi_coach lettura" on public.messaggi_coach;
drop policy "messaggi_coach scrittura admin" on public.messaggi_coach;
create policy "messaggi_coach lettura" on public.messaggi_coach
  for select to authenticated
  using (autore = auth.uid()
         or public.e_admin()
         or public.e_mio_coach(autore)
         or (destinatari = 'tutti' and public.utente_admin(autore)));
create policy "messaggi_coach creazione" on public.messaggi_coach
  for insert to authenticated
  with check (public.puo_scrivere_messaggi() and autore = auth.uid()
              and (destinatari = 'miei' or public.e_admin()));
create policy "messaggi_coach modifica" on public.messaggi_coach
  for update to authenticated
  using      (public.puo_scrivere_messaggi() and (autore = auth.uid() or public.e_admin()))
  with check (public.puo_scrivere_messaggi() and (autore = auth.uid() or public.e_admin())
              and (destinatari = 'miei' or public.e_admin()));
create policy "messaggi_coach cancellazione" on public.messaggi_coach
  for delete to authenticated
  using (public.puo_scrivere_messaggi() and (autore = auth.uid() or public.e_admin()));

-- Storage, vocali del coach: la lista email diventa e_staff() (prima era ferma
-- a 4 admin). ⚠️ Vedi la sezione 7: due policy permissive su storage.objects
-- annullano comunque queste restrizioni.
drop policy "Solo i coach possono caricare vocali" on storage.objects;
drop policy "Solo i coach possono aggiornare i vocali" on storage.objects;
drop policy "Solo i coach possono eliminare i vocali" on storage.objects;
create policy "Solo i coach possono caricare vocali" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'voice-notes' and public.e_staff());
create policy "Solo i coach possono aggiornare i vocali" on storage.objects
  for update to authenticated
  using (bucket_id = 'voice-notes' and public.e_staff());
create policy "Solo i coach possono eliminare i vocali" on storage.objects
  for delete to authenticated
  using (bucket_id = 'voice-notes' and public.e_staff());

-- Tabelle legacy, mai lette dall'app: le si chiude con la stessa regola,
-- così non restano porte aperte sui dati degli atleti.
drop policy "Accesso controllato a workout_logs" on public.workout_logs;
create policy "workout_logs proprio, del coach, admin" on public.workout_logs
  for all to authenticated
  using      (auth.uid() = athlete_id or public.mio_atleta(athlete_id))
  with check (auth.uid() = athlete_id or public.mio_atleta(athlete_id));
drop policy "Accesso agli utenti autenticati" on public.athlete_photos;
create policy "athlete_photos proprio, del coach, admin" on public.athlete_photos
  for all to authenticated
  using      (auth.uid() = athlete_id or public.mio_atleta(athlete_id))
  with check (auth.uid() = athlete_id or public.mio_atleta(athlete_id));

-- Invariate, di proposito:
--   notifications       già «solo le mie» (auth.uid() = user_id)
--   push_subscriptions  la policy aperta serve all'upsert per `endpoint` quando
--                       un telefono cambia account (pushToken.js, Settings.jsx):
--                       chiuderla richiede prima una funzione lato server.
--                       Espone token, non dati degli atleti. BACKLOG.
--   tv_sessions         la TV gira senza login. BACKLOG.

commit;


-- ── 6. Verifica, DOPO il commit ────────────────────────────────────────────
-- Si fa finta di essere un utente dentro una transazione che si annulla.
-- Sostituire gli id. Ogni select deve dare il numero scritto accanto.
--
-- begin;
--   set local role authenticated;
--   -- come federico_leo (coach): tutti i 16 atleti meno le schede dello staff
--   set local request.jwt.claims = '{"sub":"a482726f-ca85-4220-a2fc-786b4fee0689","email":"federico_leo@hotmail.it","role":"authenticated"}';
--   select count(*) from public.athletes;          -- i suoi + la sua scheda
--   select count(*) from public.workouts;          -- 214
--   -- come un coach NUOVO senza atleti (aggiungerlo prima a staff, poi toglierlo)
--   set local request.jwt.claims = '{"sub":"<id coach nuovo>","email":"<email>","role":"authenticated"}';
--   select count(*) from public.athletes;          -- 1 (la sua scheda) o 0
--   select count(*) from public.athlete_workouts;  -- 0
--   select count(*) from public.personal_records;  -- 0
--   select count(*) from public.messaggi_coach;    -- 0
--   -- come un atleta
--   set local request.jwt.claims = '{"sub":"<id atleta>","email":"<email>","role":"authenticated"}';
--   select count(*) from public.athletes;          -- 1
--   select count(*) from public.coach_atleti;      -- 1
--   select count(*) from public.messaggi_coach;    -- solo del suo coach + 'tutti' degli admin
-- rollback;
--
-- select tablename, policyname, cmd from pg_policies
--  where schemaname in ('public','storage') order by 1, 2;


-- ── 7. Facoltativo, DA DECIDERE a parte (non è dentro la transazione) ──────
-- Su storage.objects due policy per `public` con `true` permettono a CHIUNQUE,
-- anche senza account, di modificare e cancellare QUALUNQUE file di qualunque
-- bucket (foto profilo, vocali). Con più coach diventa più grave: un coach può
-- cancellare i vocali di un altro. Prima di toglierle va controllato che
-- nessun flusso dell'app ci si appoggi (foto profilo dell'atleta: upsert?).
-- drop policy "consenti delete a tutti" on storage.objects;
-- drop policy "consenti update a tutti" on storage.objects;


-- ── Rollback (riporta le policy di prima; i dati di staff/coach_atleti si perdono) ──
-- begin;
--   drop trigger athletes_assegna_coach on public.athletes;
--   -- ricreare le policy di prima: sono in rls_snapshot_2026-08-25.sql, più
--   -- come_stai_2026-10-13.sql, note_estratte_2026-10-09.sql,
--   -- messaggi_coach_2026-10-15.sql (stesso testo, stessi nomi)
--   …le drop delle policy nuove, poi:
--   drop function public.elenco_staff(), public.vedo_workout(uuid), public.e_mio_coach(uuid), public.utente_admin(uuid), public.mio_atleta(uuid),
--     public.puo_scrivere_messaggi(), public.e_staff(), public.e_admin(),
--     public.email_corrente(), public.assegna_coach();
--   alter table public.workouts drop column creato_da;
--   alter table public.messaggi_coach drop column destinatari;
--   drop table public.coach_atleti; drop table public.staff;
-- commit;
-- In emergenza, più rapido: ricreare le VECCHIE policy accanto alle nuove.
-- Sono permissive, quindi si sommano in OR e ridanno a tutti l'accesso di prima.
