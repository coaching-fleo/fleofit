-- ═══════════════════════════════════════════════════════════════════════════
-- Team: il coach toglie un atleta che è DENTRO
-- Scritta il 16/11/2026 · sì ESPLICITO del committente in sessione, lo stesso
-- giorno («Sì, prepara la migrazione»): TREDICESIMA eccezione alla regola 0-bis
-- di CLAUDE.md §0. Va applicata A MANO dal SQL editor di Supabase, e subito dopo
-- va eseguito tools/verifica-team.sql (casi 11 e 12).
--
-- Cosa cambia: UNA policy. Prima il coach poteva cancellare la riga di
-- team_membri solo per un invito in attesa («Annulla invito»); ora anche per chi
-- è DENTRO. Nessuna tabella, colonna o trigger cambia; `main` non usa i team.
--
-- Perché cancellare e non scrivere «uscito»: il trigger team_membri_regole lascia
-- `dentro → uscito` solo all'atleta, e «uscito» blocca il reinvito per 3 giorni
-- (pensato per rispettare chi se n'è andato da solo). Un atleta tolto dal coach,
-- magari per sbaglio, si deve poter reinvitare subito: senza riga si può.
--   · I risultati che ha già inserito RESTANO (team_risultati non dipende dalla
--     riga) e la scheda del team li mostra come «Ex membro» (nomeDa).
--   · L'atleta non vede più il team né le sue sfide (membro_team: serve «dentro»).
--   · Le righe «rifiutato» e «uscito» NON si cancellano: cancellarle e
--     reinvitare scavalcherebbe i 3 giorni, cioè il consenso dell'atleta.
--
-- Per tornare indietro:
--   drop policy "team_membri togli" on public.team_membri;
--   create policy "team_membri annulla invito" on public.team_membri
--     as permissive for delete to authenticated
--     using (public.team_mio(team_id) and public.puo_scrivere_messaggi() and stato = 'invitato');
-- ═══════════════════════════════════════════════════════════════════════════

begin;

drop policy "team_membri annulla invito" on public.team_membri;

create policy "team_membri togli" on public.team_membri
  as permissive for delete to authenticated
  using (public.team_mio(team_id) and public.puo_scrivere_messaggi()
         and stato in ('invitato', 'dentro'));

commit;

-- Dopo, per verificare (deve stampare QUATTRO policy su team_membri, fra cui
-- «team_membri togli» e non più «team_membri annulla invito»):
--   select policyname, cmd from pg_policies where tablename = 'team_membri' order by policyname;
-- Poi eseguire tools/verifica-team.sql.
