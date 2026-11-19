-- ═══════════════════════════════════════════════════════════════════════════
-- Cestino dei workout: gli ADMIN vedono e ripristinano il cestino di TUTTI.
-- 19/11/2026, sì esplicito del committente in sessione («Sì, prepara la modifica»).
-- Da applicare a mano nell'SQL editor DOPO cestino_workout_2026-11-19.sql.
--
-- Prima: il cestino di un coach lo vedeva solo quel coach; gli admin vedevano
-- solo i loro, quelli senza autore e quelli di un ex coach.
-- Dopo: un coach vede ancora solo i suoi; un admin vede tutto.
--
-- Cambia SOLO la funzione cestino_mio (nessuna tabella, nessuna policy nuova):
-- la usano la policy di lettura, cestino_voci e ripristina_workout, quindi
-- l'admin vede la riga, apre le voci e ripristina con un solo cambio.
-- `create or replace` tiene i permessi già dati (execute ad authenticated).
--
-- ⚠️ Anche demo@fleofit.it è admin: il revisore di App Store vede e può
-- ripristinare i workout eliminati di tutti i coach (rischio accettato).
--
-- Per tornare indietro: rieseguire la definizione di cestino_mio che sta in
-- cestino_workout_2026-11-19.sql (con `create or replace`).
-- Verifica: tools/verifica-cestino.sql, caso 13.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create or replace function public.cestino_mio(creato uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.e_admin()
      or (creato is not null and public.cestino_staff(creato)
          and creato = auth.uid() and public.e_staff())
$$;

commit;
