-- ═══════════════════════════════════════════════════════════════════════════
-- Scarpe da corsa — catalogo, scarpe dell'atleta, uso per allenamento
-- Scritta il 02/11/2026 · PROPOSTA: NON APPLICATA. Serve il sì ESPLICITO del
-- committente (CLAUDE.md §0, regola 0-bis: lo schema è congelato).
-- Va applicata a mano dal SQL editor di Supabase, dopo il sì.
--
-- Migrazione ADDITIVA: tre tabelle nuove che `main` (la web app di oggi) non
-- conosce e non legge. Nessuna tabella o policy esistente cambia.
--
--  · scarpe_catalogo — i modelli di scarpa (marca, modello, tipo, drop). Li
--    legge ogni utente autenticato; li scrive solo lo staff, MENO
--    demo@fleofit.it: l'account del revisore Apple non deve cambiare il
--    catalogo di tutti (stesso criterio di messaggi_coach).
--  · scarpe_atleta — le scarpe di un atleta. Marca e modello sono COPIATI dal
--    catalogo alla scelta, così la scarpa sopravvive se il modello viene tolto
--    (catalogo_id va a null). Le scrive solo l'atleta; le legge lui e il suo coach.
--  · scarpe_uso — con quale scarpa è stato fatto un allenamento. Chiave:
--    athlete_workout_id (una scarpa per allenamento). Il with check esige che
--    scarpa E allenamento siano dello stesso atleta (come l'abbinamento di
--    garmin_attivita).
--
--  · Bucket di storage `scarpe` (foto dei modelli) con tre policy limitate a quel
--    bucket; e le caratteristiche dei 12 modelli di prova (sezione 5).
--
-- I km non si salvano: si calcolano dall'app (km_iniziali + allenamenti con
-- questa scarpa).
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. scarpe_catalogo ─────────────────────────────────────────────────────
create table public.scarpe_catalogo (
  id        uuid primary key default gen_random_uuid(),
  marca     text not null,
  modello   text not null,
  tipo      text check (tipo in ('allenamento', 'gara', 'trail', 'ammortizzata')),
  drop_mm   numeric check (drop_mm between 0 and 16),  -- facoltativo: lo compila il coach
  -- Caratteristiche (tutte facoltative: un dato mancante è «—» nell'app)
  livello         text check (livello in ('principiante','intermedio','avanzato')),
  ammortizzamento text check (ammortizzamento in ('basso','medio','alto','massimo')),
  stabilita       text check (stabilita in ('neutra','sostegno')),
  piastra         text check (piastra in ('nessuna','nylon_tpu','carbonio')),
  peso_g          integer check (peso_g between 100 and 500),
  stack_mm        numeric check (stack_mm between 10 and 60),
  uso             text[] check (uso <@ array['lento','ritmo','ripetute','gara','trail']),
  vita_km         integer check (vita_km between 200 and 2000),
  url_ufficiale   text check (url_ufficiale like 'https://%'),
  foto_url        text check (foto_url like 'https://%'),
  creato_da uuid default auth.uid(),
  creato_at timestamptz default now()
);

create unique index scarpe_catalogo_nome
  on public.scarpe_catalogo (lower(marca), lower(modello));

alter table public.scarpe_catalogo enable row level security;

create policy "scarpe_catalogo lettura" on public.scarpe_catalogo
  as permissive for select to authenticated
  using (true);

-- Lo staff cura il catalogo, MENO l'account del revisore. `email_corrente()`
-- (multi_coach) normalizza minuscole e spazi: la mail grezza del JWT no.
create policy "scarpe_catalogo staff" on public.scarpe_catalogo
  as permissive for all to authenticated
  using      (public.e_staff() and public.email_corrente() <> 'demo@fleofit.it')
  with check (public.e_staff() and public.email_corrente() <> 'demo@fleofit.it');

-- ── 1-bis. Bucket delle foto dei modelli ───────────────────────────────────
-- Pubblico in lettura (le foto sono mostrate a ogni atleta). Scrive solo lo
-- staff, MENO il revisore Apple. Le policy sono limitate al bucket 'scarpe':
-- nessuna policy permissiva deve valere per ogni bucket (vedi multi_coach, §7).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('scarpe', 'scarpe', true, 2097152, array['image/png','image/webp'])
  on conflict (id) do nothing;

-- Serve anche la SELECT: un upload con upsert:true la richiede per vedere se il
-- file c'è già (il bucket pubblico serve le foto agli anonimi, ma non basta qui).
create policy "scarpe foto lettura" on storage.objects
  for select to authenticated
  using (bucket_id = 'scarpe');
create policy "scarpe foto insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'scarpe' and public.e_staff() and public.email_corrente() <> 'demo@fleofit.it');
create policy "scarpe foto update" on storage.objects
  for update to authenticated
  using      (bucket_id = 'scarpe' and public.e_staff() and public.email_corrente() <> 'demo@fleofit.it')
  with check (bucket_id = 'scarpe' and public.e_staff() and public.email_corrente() <> 'demo@fleofit.it');
create policy "scarpe foto delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'scarpe' and public.e_staff() and public.email_corrente() <> 'demo@fleofit.it');

-- ── 2. scarpe_atleta ───────────────────────────────────────────────────────
create table public.scarpe_atleta (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references public.athletes (id) on delete cascade,
  catalogo_id uuid references public.scarpe_catalogo (id) on delete set null,
  marca       text,
  modello     text,
  km_iniziali numeric not null default 0 check (km_iniziali >= 0),
  soglia_km   numeric not null default 700 check (soglia_km > 0),
  principale  boolean not null default false,
  ritirata_at timestamptz,
  creato_at   timestamptz default now(),
  check (catalogo_id is not null or (marca is not null and modello is not null))
);

create index scarpe_atleta_atleta on public.scarpe_atleta (athlete_id);

-- Una sola principale ATTIVA per atleta.
create unique index scarpe_atleta_una_principale
  on public.scarpe_atleta (athlete_id) where principale and ritirata_at is null;

alter table public.scarpe_atleta enable row level security;

create policy "scarpe_atleta lettura" on public.scarpe_atleta
  as permissive for select to authenticated
  using (athlete_id = auth.uid() or public.mio_atleta(athlete_id));

create policy "scarpe_atleta proprie" on public.scarpe_atleta
  as permissive for all to authenticated
  using      (athlete_id = auth.uid())
  with check (athlete_id = auth.uid());

-- ── 3. scarpe_uso ──────────────────────────────────────────────────────────
create table public.scarpe_uso (
  athlete_workout_id uuid primary key references public.athlete_workouts (id) on delete cascade,
  scarpa_id          uuid not null references public.scarpe_atleta (id) on delete cascade
);

create index scarpe_uso_scarpa on public.scarpe_uso (scarpa_id);

alter table public.scarpe_uso enable row level security;

-- Si vede l'uso se si vede la scarpa (la subquery passa dalla policy di lettura
-- di scarpe_atleta: atleta stesso o suo coach).
create policy "scarpe_uso lettura" on public.scarpe_uso
  as permissive for select to authenticated
  using (exists (select 1 from public.scarpe_atleta s where s.id = scarpa_id));

-- Scrive solo l'atleta, e scarpa E allenamento devono essere suoi.
create policy "scarpe_uso proprie" on public.scarpe_uso
  as permissive for all to authenticated
  using (exists (select 1 from public.scarpe_atleta s
                 where s.id = scarpa_id and s.athlete_id = auth.uid()))
  with check (
    exists (select 1 from public.scarpe_atleta s
            where s.id = scarpa_id and s.athlete_id = auth.uid())
    and exists (select 1 from public.athlete_workouts aw
                where aw.id = athlete_workout_id and aw.athlete_id = auth.uid())
  );

-- ── 4. Seed del catalogo ───────────────────────────────────────────────────
-- Modelli attuali (linee 2024-2026). drop_mm è null ovunque: nessuna fonte verificata,
-- un dato sbagliato è peggio di un dato vuoto; i coach lo compilano dall'app.
-- Rieseguibile: on conflict do nothing.
insert into public.scarpe_catalogo (marca, modello, tipo, drop_mm) values
  ('Nike', 'Pegasus 41', 'allenamento', null),
  ('Nike', 'Invincible 3', 'ammortizzata', null),
  ('Nike', 'Vomero 17', 'ammortizzata', null),
  ('Nike', 'Structure 25', 'allenamento', null),
  ('Nike', 'Infinity Run 4', 'allenamento', null),
  ('Nike', 'Vaporfly 3', 'gara', null),
  ('Nike', 'Alphafly 3', 'gara', null),
  ('Nike', 'Zoom Fly 6', 'allenamento', null),
  ('Nike', 'Zegama 2', 'trail', null),
  ('Nike', 'Pegasus Trail 5', 'trail', null),
  ('Adidas', 'Adizero Boston 12', 'allenamento', null),
  ('Adidas', 'Adizero Adios Pro 3', 'gara', null),
  ('Adidas', 'Adizero Adios Pro 4', 'gara', null),
  ('Adidas', 'Adizero Evo SL', 'allenamento', null),
  ('Adidas', 'Adizero SL2', 'allenamento', null),
  ('Adidas', 'Adizero Takumi Sen 10', 'gara', null),
  ('Adidas', 'Ultraboost 5', 'ammortizzata', null),
  ('Adidas', 'Supernova Rise', 'allenamento', null),
  ('Adidas', 'Adistar 3', 'ammortizzata', null),
  ('Adidas', 'Terrex Agravic Speed Ultra', 'trail', null),
  ('Asics', 'Gel-Nimbus 26', 'ammortizzata', null),
  ('Asics', 'Gel-Nimbus 27', 'ammortizzata', null),
  ('Asics', 'Gel-Kayano 31', 'allenamento', null),
  ('Asics', 'Gel-Kayano 32', 'allenamento', null),
  ('Asics', 'Novablast 4', 'allenamento', null),
  ('Asics', 'Novablast 5', 'allenamento', null),
  ('Asics', 'Superblast 2', 'ammortizzata', null),
  ('Asics', 'Gel-Cumulus 27', 'allenamento', null),
  ('Asics', 'Metaspeed Sky Paris', 'gara', null),
  ('Asics', 'Metaspeed Edge Paris', 'gara', null),
  ('Asics', 'Magic Speed 4', 'allenamento', null),
  ('Asics', 'Glideride Max 3', 'ammortizzata', null),
  ('Asics', 'Gel-Trabuco 13', 'trail', null),
  ('Asics', 'Trabuco Max 3', 'trail', null),
  ('Hoka', 'Clifton 9', 'allenamento', null),
  ('Hoka', 'Clifton 10', 'allenamento', null),
  ('Hoka', 'Bondi 8', 'ammortizzata', null),
  ('Hoka', 'Bondi 9', 'ammortizzata', null),
  ('Hoka', 'Mach 6', 'allenamento', null),
  ('Hoka', 'Mach X 2', 'allenamento', null),
  ('Hoka', 'Rocket X 3', 'gara', null),
  ('Hoka', 'Cielo X1 2.0', 'gara', null),
  ('Hoka', 'Arahi 7', 'allenamento', null),
  ('Hoka', 'Gaviota 5', 'allenamento', null),
  ('Hoka', 'Speedgoat 6', 'trail', null),
  ('Hoka', 'Mafate 4', 'trail', null),
  ('Hoka', 'Tecton X 3', 'trail', null),
  ('Saucony', 'Endorphin Speed 4', 'allenamento', null),
  ('Saucony', 'Endorphin Speed 5', 'allenamento', null),
  ('Saucony', 'Endorphin Pro 4', 'gara', null),
  ('Saucony', 'Kinvara 15', 'allenamento', null),
  ('Saucony', 'Ride 17', 'allenamento', null),
  ('Saucony', 'Triumph 22', 'ammortizzata', null),
  ('Saucony', 'Guide 17', 'allenamento', null),
  ('Saucony', 'Hurricane 24', 'ammortizzata', null),
  ('Saucony', 'Xodus Ultra 3', 'trail', null),
  ('Brooks', 'Ghost 16', 'allenamento', null),
  ('Brooks', 'Ghost 17', 'allenamento', null),
  ('Brooks', 'Glycerin 21', 'ammortizzata', null),
  ('Brooks', 'Glycerin 22', 'ammortizzata', null),
  ('Brooks', 'Adrenaline GTS 24', 'allenamento', null),
  ('Brooks', 'Hyperion Max 2', 'allenamento', null),
  ('Brooks', 'Hyperion Elite 4', 'gara', null),
  ('Brooks', 'Launch 11', 'allenamento', null),
  ('Brooks', 'Caldera 7', 'trail', null),
  ('Brooks', 'Cascadia 18', 'trail', null),
  ('New Balance', 'Fresh Foam X 1080v14', 'ammortizzata', null),
  ('New Balance', 'Fresh Foam X 880v15', 'allenamento', null),
  ('New Balance', 'Fresh Foam X More v5', 'ammortizzata', null),
  ('New Balance', 'FuelCell SuperComp Elite v4', 'gara', null),
  ('New Balance', 'FuelCell SC Trainer v3', 'allenamento', null),
  ('New Balance', 'FuelCell Rebel v4', 'allenamento', null),
  ('New Balance', 'FuelCell Propel v5', 'allenamento', null),
  ('New Balance', 'Fresh Foam X Hierro v8', 'trail', null),
  ('New Balance', 'Fresh Foam X Trail More v3', 'trail', null),
  ('On', 'Cloudmonster 2', 'ammortizzata', null),
  ('On', 'Cloudsurfer 7', 'allenamento', null),
  ('On', 'Cloudsurfer Max', 'ammortizzata', null),
  ('On', 'Cloudrunner 2', 'allenamento', null),
  ('On', 'Cloudeclipse', 'ammortizzata', null),
  ('On', 'Cloudboom Echo 3', 'gara', null),
  ('On', 'Cloudboom Strike', 'gara', null),
  ('On', 'Cloudflow 4', 'allenamento', null),
  ('On', 'Cloudultra 2', 'trail', null),
  ('Puma', 'Deviate Nitro 3', 'allenamento', null),
  ('Puma', 'Deviate Nitro Elite 3', 'gara', null),
  ('Puma', 'Fast-R Nitro Elite 3', 'gara', null),
  ('Puma', 'Velocity Nitro 3', 'allenamento', null),
  ('Puma', 'Magnify Nitro 2', 'ammortizzata', null),
  ('Puma', 'ForeverRun Nitro', 'allenamento', null),
  ('Mizuno', 'Wave Rider 28', 'allenamento', null),
  ('Mizuno', 'Wave Rider 29', 'allenamento', null),
  ('Mizuno', 'Wave Sky 8', 'ammortizzata', null),
  ('Mizuno', 'Wave Inspire 20', 'allenamento', null),
  ('Mizuno', 'Wave Rebellion Pro 2', 'gara', null),
  ('Mizuno', 'Wave Rebellion Flash 2', 'allenamento', null),
  ('Mizuno', 'Wave Daichi 8', 'trail', null),
  ('Altra', 'Torin 7', 'ammortizzata', null),
  ('Altra', 'Escalante 4', 'allenamento', null),
  ('Altra', 'Rivera 4', 'allenamento', null),
  ('Altra', 'Experience Flow', 'allenamento', null),
  ('Altra', 'Vanish Carbon', 'gara', null),
  ('Altra', 'Provision 8', 'allenamento', null),
  ('Altra', 'Lone Peak 8', 'trail', null),
  ('Altra', 'Olympus 6', 'trail', null),
  ('Salomon', 'Aero Glide 3', 'allenamento', null),
  ('Salomon', 'Aero Blaze 2', 'allenamento', null),
  ('Salomon', 'S/Lab Phantasm 2', 'gara', null),
  ('Salomon', 'Sonic 6', 'allenamento', null),
  ('Salomon', 'Glide Max', 'ammortizzata', null),
  ('Salomon', 'Speedcross 6', 'trail', null),
  ('Salomon', 'Sense Ride 5', 'trail', null),
  ('Salomon', 'Ultra Glide 3', 'trail', null),
  ('Salomon', 'S/Lab Ultra 3', 'trail', null)
on conflict do nothing;

-- ── 5. Caratteristiche dei 12 modelli di prova ─────────────────────────────
-- Da tools/scarpe/schede.json (pagine ufficiali dei marchi; i campi non dati
-- restano vuoti). ⚠️ Da ricontrollare: vedi tools/scarpe/LEGGIMI.md.
-- fonte: https://www.nike.com/t/pegasus-41-mens-road-running-shoes-LMhfRGdO/FD2722-102
update public.scarpe_catalogo set
  livello = 'intermedio',
  stabilita = 'neutra',
  drop_mm = 10,
  peso_g = 297,
  uso = array['lento', 'ritmo'],
  url_ufficiale = 'https://www.nike.com/t/pegasus-41-mens-road-running-shoes-LMhfRGdO/FD2722-102'
 where lower(marca) = 'nike' and lower(modello) = 'pegasus 41';
-- fonte: https://www.nike.com/ph/t/vaporfly-3-road-racing-shoes-xsDgvM/DV4129-006
update public.scarpe_catalogo set
  livello = 'avanzato',
  stabilita = 'neutra',
  piastra = 'carbonio',
  drop_mm = 8,
  peso_g = 200,
  uso = array['gara', 'ripetute'],
  url_ufficiale = 'https://www.nike.com/ph/t/vaporfly-3-road-racing-shoes-xsDgvM/DV4129-006'
 where lower(marca) = 'nike' and lower(modello) = 'vaporfly 3';
-- fonte: https://www.adidas.com/us/adizero-boston-12-running-shoes/ID4234.html
update public.scarpe_catalogo set
  livello = 'intermedio',
  stabilita = 'neutra',
  drop_mm = 7,
  uso = array['lento', 'ritmo'],
  url_ufficiale = 'https://www.adidas.com/us/adizero-boston-12-running-shoes/ID4234.html'
 where lower(marca) = 'adidas' and lower(modello) = 'adizero boston 12';
-- fonte: https://www.asics.com/us/en-us/novablast-4/c/aa50123894/men/shoes/
update public.scarpe_catalogo set
  livello = 'intermedio',
  stabilita = 'neutra',
  drop_mm = 8,
  peso_g = 260,
  uso = array['lento', 'ritmo'],
  url_ufficiale = 'https://www.asics.com/us/en-us/novablast-4/c/aa50123894/men/shoes/'
 where lower(marca) = 'asics' and lower(modello) = 'novablast 4';
-- fonte: https://www.asics.com/us/en-us/gel-nimbus-26/p/ANA_1011B794-401.html
update public.scarpe_catalogo set
  livello = 'intermedio',
  ammortizzamento = 'alto',
  stabilita = 'neutra',
  drop_mm = 8,
  peso_g = 304,
  uso = array['lento'],
  url_ufficiale = 'https://www.asics.com/us/en-us/gel-nimbus-26/p/ANA_1011B794-401.html'
 where lower(marca) = 'asics' and lower(modello) = 'gel-nimbus 26';
-- fonte: https://www.hoka.com/en/hr/men-road/clifton-10/1162030.html
update public.scarpe_catalogo set
  livello = 'principiante',
  ammortizzamento = 'massimo',
  stabilita = 'neutra',
  drop_mm = 8,
  peso_g = 278,
  stack_mm = 42,
  uso = array['lento', 'ritmo'],
  url_ufficiale = 'https://www.hoka.com/en/hr/men-road/clifton-10/1162030.html'
 where lower(marca) = 'hoka' and lower(modello) = 'clifton 10';
-- fonte: https://www.hoka.com/en/us/mens-trail/speedgoat-6/1147791.html
update public.scarpe_catalogo set
  livello = 'intermedio',
  stabilita = 'neutra',
  drop_mm = 5,
  peso_g = 278,
  uso = array['trail'],
  url_ufficiale = 'https://www.hoka.com/en/us/mens-trail/speedgoat-6/1147791.html'
 where lower(marca) = 'hoka' and lower(modello) = 'speedgoat 6';
-- fonte: https://www.saucony.com/EE/en_EE/endorphin-speed-4/58852M.html
update public.scarpe_catalogo set
  livello = 'intermedio',
  stabilita = 'neutra',
  piastra = 'nylon_tpu',
  drop_mm = 8,
  peso_g = 233,
  uso = array['ritmo', 'ripetute'],
  url_ufficiale = 'https://www.saucony.com/EE/en_EE/endorphin-speed-4/58852M.html'
 where lower(marca) = 'saucony' and lower(modello) = 'endorphin speed 4';
-- fonte: https://www.brooksrunning.com/en_us/mens/shoes/road-running-shoes/ghost-17/1104422E090.095.html
update public.scarpe_catalogo set
  livello = 'intermedio',
  stabilita = 'neutra',
  drop_mm = 10,
  peso_g = 286,
  uso = array['lento', 'ritmo'],
  url_ufficiale = 'https://www.brooksrunning.com/en_us/mens/shoes/road-running-shoes/ghost-17/1104422E090.095.html'
 where lower(marca) = 'brooks' and lower(modello) = 'ghost 17';
-- fonte: https://www.newbalance.com/pd/fresh-foam-x-1080v14/M1080V14-47512-PMG-NA.html
update public.scarpe_catalogo set
  livello = 'intermedio',
  ammortizzamento = 'alto',
  stabilita = 'neutra',
  peso_g = 298,
  uso = array['lento'],
  url_ufficiale = 'https://www.newbalance.com/pd/fresh-foam-x-1080v14/M1080V14-47512-PMG-NA.html'
 where lower(marca) = 'new balance' and lower(modello) = 'fresh foam x 1080v14';
-- fonte: https://www.on.com/en-gr/products/cloudmonster-2-m-3me1012
update public.scarpe_catalogo set
  livello = 'intermedio',
  ammortizzamento = 'alto',
  stabilita = 'neutra',
  piastra = 'nylon_tpu',
  drop_mm = 6,
  peso_g = 300,
  uso = array['lento'],
  url_ufficiale = 'https://www.on.com/en-gr/products/cloudmonster-2-m-3me1012'
 where lower(marca) = 'on' and lower(modello) = 'cloudmonster 2';
-- fonte: https://us.puma.com/us/en/pd/deviate-nitro-3-mens-road-running-shoes/309707
update public.scarpe_catalogo set
  livello = 'avanzato',
  ammortizzamento = 'alto',
  stabilita = 'neutra',
  piastra = 'carbonio',
  drop_mm = 10,
  peso_g = 250,
  stack_mm = 39,
  uso = array['lento', 'ritmo'],
  url_ufficiale = 'https://us.puma.com/us/en/pd/deviate-nitro-3-mens-road-running-shoes/309707'
 where lower(marca) = 'puma' and lower(modello) = 'deviate nitro 3';

commit;

-- Dopo, per verificare (deve stampare SEI policy sulle tabelle: 2 + 2 + 2):
-- select tablename, policyname, cmd from pg_policies
--  where tablename in ('scarpe_catalogo', 'scarpe_atleta', 'scarpe_uso') order by 1, 2;
-- e il seed: select count(*) from public.scarpe_catalogo;  -- 114
-- Le caratteristiche: select count(*) from public.scarpe_catalogo where livello is not null;  -- 12
--
-- Storage (sola lettura): devono comparire le quattro policy «scarpe foto …»
-- (lettura, insert, update, delete), e nessuna policy permissiva deve valere per ogni bucket (senza bucket_id nella
-- condizione), o annullerebbe le restrizioni:
-- select policyname, cmd, qual, with_check from pg_policies
--  where schemaname = 'storage' and tablename = 'objects';
-- ⚠️ Le due policy globali note (multi_coach_2026-10-15.sql §7), per `public` con
-- `true`, su QUALUNQUE bucket: «consenti update a tutti» e «consenti delete a
-- tutti». Se la query le elenca ancora, rendono inutili le restrizioni di
-- `scarpe` (le permissive si sommano in OR): vanno risolte PRIMA del sì.
-- Il bucket: select id, public from storage.buckets where id = 'scarpe';

-- Rollback (cancella tutte le scarpe e gli usi, e le foto):
-- DROP TABLE public.scarpe_uso, public.scarpe_atleta, public.scarpe_catalogo;
-- DROP POLICY "scarpe foto lettura" ON storage.objects;
-- DROP POLICY "scarpe foto insert" ON storage.objects;
-- DROP POLICY "scarpe foto update" ON storage.objects;
-- DROP POLICY "scarpe foto delete" ON storage.objects;
-- delete from storage.objects where bucket_id = 'scarpe';
-- delete from storage.buckets where id = 'scarpe';
