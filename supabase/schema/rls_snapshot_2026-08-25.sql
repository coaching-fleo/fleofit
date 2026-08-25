-- =============================================================================
-- FOTOGRAFIA DELLE POLICY RLS — public — 25 agosto 2026
--
-- ⚠️ NON È UNA MIGRAZIONE. Non eseguire questo file su un database esistente.
--    È una ricostruzione leggibile dall'output di pg_policies, per avere le
--    policy sotto controllo di versione: prima di oggi il database non aveva
--    nessuna rappresentazione nel repository, quindi non era né revisionabile
--    né ricostruibile in caso di perdita.
--
-- Stato: RLS attiva su tutte e 10 le tabelle di `public`.
-- I buchi noti sono annotati qui sotto e in CLAUDE.md §4-bis. Le correzioni non
-- additive sono rinviate all'approvazione App Store (congelamento, regola 0-bis).
-- =============================================================================

-- La lista admin è ripetuta in 6 policy. È la TERZA copia nel sistema, dopo
-- src/App.jsx e le due Edge Function. Il fix strutturale — un'unica funzione
-- public.is_admin() richiamata da tutte — è rinviato: cambia le policy, quindi
-- è soggetto al congelamento.
--   ['coaching@federicoleo.it','alessandro.patrone@hotmail.it',
--    'federico_leo@hotmail.it','federico.leo88@gmail.com','demo@fleofit.it']


-- ── athletes ─────────────────────────────────────────────────────── ✅ ok ──
-- USING e WITH CHECK allineati a 5 email (demo@fleofit.it aggiunta il 25/08).
create policy "Gestione completa atleti" on public.athletes
  as permissive for all to authenticated
  using      ((auth.uid() = id) or ((auth.jwt() ->> 'email') = any (array['coaching@federicoleo.it','alessandro.patrone@hotmail.it','federico_leo@hotmail.it','federico.leo88@gmail.com','demo@fleofit.it'])))
  with check ((auth.uid() = id) or ((auth.jwt() ->> 'email') = any (array['coaching@federicoleo.it','alessandro.patrone@hotmail.it','federico_leo@hotmail.it','federico.leo88@gmail.com','demo@fleofit.it'])));

-- ── athlete_workouts ─────────────────────────────────────────────── ✅ ok ──
create policy "Accesso controllato ad athlete_workouts" on public.athlete_workouts
  as permissive for all to authenticated
  using      ((auth.uid() = athlete_id) or ((auth.jwt() ->> 'email') = any (array['coaching@federicoleo.it','alessandro.patrone@hotmail.it','federico_leo@hotmail.it','federico.leo88@gmail.com','demo@fleofit.it'])))
  with check ((auth.uid() = athlete_id) or ((auth.jwt() ->> 'email') = any (array['coaching@federicoleo.it','alessandro.patrone@hotmail.it','federico_leo@hotmail.it','federico.leo88@gmail.com','demo@fleofit.it'])));

-- ── notifications ────────────────────────────────────────────────── ✅ ok ──
create policy "Users can view and update their own notifications" on public.notifications
  as permissive for all to public
  using (auth.uid() = user_id);

-- ── workout_logs ──────────────────────────── ⚠️ tabella legacy, non usata ──
-- Ferma a 4 email: demo@fleofit.it non è stata aggiunta. Irrilevante finché il
-- client non la referenzia (0 occorrenze in src/ e supabase/).
create policy "Accesso controllato a workout_logs" on public.workout_logs
  as permissive for all to authenticated
  using      ((auth.uid() = athlete_id) or ((auth.jwt() ->> 'email') = any (array['coaching@federicoleo.it','alessandro.patrone@hotmail.it','federico_leo@hotmail.it','federico.leo88@gmail.com'])))
  with check ((auth.uid() = athlete_id) or ((auth.jwt() ->> 'email') = any (array['coaching@federicoleo.it','alessandro.patrone@hotmail.it','federico_leo@hotmail.it','federico.leo88@gmail.com'])));

-- ── workouts ──────────────────────────────────────────────────── 🟠 misto ──
create policy "Solo gli admin possono modificare i workout" on public.workouts
  as permissive for all to public
  using ((auth.jwt() ->> 'email') = any (array['coaching@federicoleo.it','alessandro.patrone@hotmail.it','federico_leo@hotmail.it','federico.leo88@gmail.com','demo@fleofit.it']));
  -- senza WITH CHECK: eredita USING. Corretto.

-- ✅ Scritta bene: un utente qualsiasi può inserire un workout SOLO se marcato
--    autonomo, quindi non può inserirsi programmazione arbitraria.
create policy "Permetti creazione workout autonomi" on public.workouts
  as permissive for insert to authenticated
  with check (((sections ->> 'isAutonomous'))::boolean = true);

-- 🟠 BUCO: chiunque abbia la anon key — che è in chiaro nel bundle JS pubblico —
--    scarica l'INTERA programmazione senza avere un account. Serve alla TV
--    Dashboard, che gira senza login, ma dovrebbe essere limitata al workout
--    referenziato da una tv_sessions attiva. Non additivo → dopo l'approvazione.
create policy "Permetti alla TV di leggere i workout" on public.workouts
  as permissive for select to public
  using (true);

create policy "Tutti gli utenti loggati possono leggere i workout" on public.workouts
  as permissive for select to public
  using (auth.role() = 'authenticated');

-- ── invitation_codes ───────────────────────────────────────────── 🔴 buco ──
create policy "Admins can view all invitation codes" on public.invitation_codes
  as permissive for select to authenticated
  using ((auth.jwt() ->> 'email') = any (array['coaching@federicoleo.it','alessandro.patrone@hotmail.it','federico_leo@hotmail.it','federico.leo88@gmail.com','demo@fleofit.it']));

create policy "Admins can delete invitation codes" on public.invitation_codes
  as permissive for delete to authenticated
  using ((auth.jwt() ->> 'email') = any (array['coaching@federicoleo.it','alessandro.patrone@hotmail.it','federico_leo@hotmail.it','federico.leo88@gmail.com','demo@fleofit.it']));

-- ✅ Scritta bene: created_by = auth.uid() impedisce di falsificare l'autore.
create policy "Admins can create invitation codes" on public.invitation_codes
  as permissive for insert to authenticated
  with check (((auth.jwt() ->> 'email') = any (array['coaching@federicoleo.it','alessandro.patrone@hotmail.it','federico_leo@hotmail.it','federico.leo88@gmail.com','demo@fleofit.it'])) and (created_by = auth.uid()));

-- 🔴 BUCO: LA REGISTRAZIONE CHIUSA NON È CHIUSA.
--    Un anonimo con la anon key enumera tutti i codici validi e si registra.
--    Il signOut() di App.jsx:219 è cosmetico: la porta è già aperta a monte.
--    Forma corretta: una funzione security definer che risponde sì/no senza mai
--    esporre la tabella. Non additivo → dopo l'approvazione App Store.
create policy "Anonymous users can validate a code" on public.invitation_codes
  as permissive for select to anon
  using ((is_active = true) and (used_by is null));

create policy "Authenticated users can select codes" on public.invitation_codes
  as permissive for select to authenticated
  using (((is_active = true) and (used_by is null)) or (used_by = auth.uid()));

create policy "Authenticated users can claim an invitation code" on public.invitation_codes
  as permissive for update to authenticated
  using      ((is_active = true) and (used_by is null))
  with check (used_by = auth.uid());

-- ── personal_records ───────────────────────────────────────────── 🔴 buco ──
-- 🔴 IL PEGGIORE DEL SISTEMA: qualunque utente loggato legge, modifica, inserisce
--    e CANCELLA i record personali di TUTTI gli atleti. Ed è il dato meno
--    ricostruibile che esista: un allenamento perso si riscrive, un PR di sei
--    mesi fa no. Fino al 25/08/2026 non era nemmeno nel backup notturno.
--    Forma corretta: (auth.uid() = athlete_id) or is_admin().
--    Restrittivo → dopo l'approvazione App Store.
create policy "Permetti tutto agli utenti autenticati" on public.personal_records
  as permissive for all to authenticated
  using (true) with check (true);

-- ── push_subscriptions ─────────────────────────────────────────── 🟠 buco ──
-- Le due policy corrette qui sotto sono ANNULLATE da quella permissiva: in
-- Postgres le policy permissive si sommano in OR. Qualunque atleta legge tutti
-- i token push. Rimuovere la terza è restrittivo → dopo l'approvazione.
create policy "Users can manage their own subscriptions" on public.push_subscriptions
  as permissive for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Policy morta: il client tocca solo le proprie righe (12 chiamate su 12 con
-- .eq('user_id', <proprio id>)), e send-reminders usa la service role key, che
-- bypassa la RLS. Ferma a 4 email, ma non viene mai esercitata.
create policy "Admins can view all subscriptions" on public.push_subscriptions
  as permissive for select to authenticated
  using ((auth.jwt() ->> 'email') = any (array['coaching@federicoleo.it','alessandro.patrone@hotmail.it','federico_leo@hotmail.it','federico.leo88@gmail.com']));

create policy "Enable all operations for authenticated users" on public.push_subscriptions
  as permissive for all to authenticated
  using (true) with check (true);   -- 🟠 è questa che apre tutto

-- ── tv_sessions ────────────────────────────────────────────────── 🟡 buco ──
-- Chiunque, anche senza account, può leggere e SOVRASCRIVERE una sessione TV,
-- quindi dirottare un cast. Serve l'accesso anonimo perché la TV gira senza
-- login, ma la scrittura andrebbe limitata. Restrittivo → dopo l'approvazione.
create policy "Permetti accesso globale a tv_sessions" on public.tv_sessions
  as permissive for all to public
  using (true) with check (true);

-- ── athlete_photos ───────────────────────── 🟡 tabella legacy, non usata ──
create policy "Accesso agli utenti autenticati" on public.athlete_photos
  as permissive for all to authenticated
  using (true) with check (true);
