-- ═══════════════════════════════════════════════════════════════════════════
-- codici_invito — nessuno legge più i codici degli altri
-- Scritta l'11/11/2026.
--
-- ⛔ NON APPLICATA. Serve il sì ESPLICITO del committente (CLAUDE.md §0,
-- regola 0-bis), e DUE sì: uno per il TEMPO 1 e uno per il TEMPO 2.
--
-- Il problema
--   Due policy di `invitation_codes` lasciano leggere i codici liberi
--   (attivi e non usati) a chi non li ha creati:
--     «Anonymous users can validate a code»    anon          → chiunque con la
--         anon key (in chiaro nel bundle) elenca tutti i codici validi e si
--         registra: la registrazione chiusa non è chiusa;
--     «Authenticated users can select codes»   authenticated → un coach vede i
--         codici liberi degli ALTRI coach (le policy permissive si sommano in
--         OR con «codici lettura staff»). Un atleta entrato con uno di quelli
--         finisce assegnato all'altro coach (trigger `assegna_coach`).
--   Servono all'atleta: la schermata del codice lo VERIFICA leggendo la
--   tabella (Login.jsx) e ProtectedRoute lo RISCATTA con un UPDATE (App.jsx).
--
-- La soluzione, in due tempi
--   TEMPO 1 (additivo): due funzioni security definer che fanno quelle due
--     cose senza mostrare la tabella. Nessuna policy cambia: le app vecchie
--     continuano a funzionare. L'app nuova (dall'11/11/2026, la prima versione dopo la 1.2.3)
--     usa le funzioni, e se non le trova torna al percorso di prima
--     (src/lib/codiceInvitoDb.js): si può pubblicare PRIMA della migrazione.
--   TEMPO 2 (restrittivo): si tolgono le tre policy aperte. ⚠️ Da quel
--     momento le app senza le funzioni (1.2.3 e precedenti, sugli Store) NON
--     possono più iscrivere atleti nuovi: il codice risulta «rifiutato».
--     Si applica quando quelle versioni non sono più in uso, o accettando
--     esplicitamente questo costo. La web app si aggiorna con app:main.
--
-- Prima di applicare: il backup (`db-backup.yml`, o un export a mano).
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 0. Controlli (letture). Da confrontare a occhio prima di ogni tempo. ────
-- Le policy che ci sono OGGI su invitation_codes. Attese sei:
--   codici lettura staff · codici cancellazione staff · codici creazione staff
--   Anonymous users can validate a code · Authenticated users can select codes
--   Authenticated users can claim an invitation code
-- Una policy in più che qui non si nomina riaprirebbe in OR quello che il
-- tempo 2 chiude: se compare, ci si ferma.
-- select policyname, cmd, roles, qual, with_check
--   from pg_policies
--  where schemaname = 'public' and tablename = 'invitation_codes'
--  order by policyname;


-- ═══ TEMPO 1 — additivo ════════════════════════════════════════════════════
begin;

-- Il codice è valido? Risponde solo sì o no: non dice di chi è, né quali
-- altri codici esistono. La chiama la schermata del codice, prima del login.
create or replace function public.codice_invito_valido(p_codice text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.invitation_codes c
     where c.code = p_codice and c.is_active = true and c.used_by is null
  );
$$;

-- Riscatta il codice per chi ha fatto login. Vero se l'ha appena preso, o se
-- era già suo (ProtectedRoute può passare di qui più di una volta). Le stesse
-- quattro colonne che scriveva l'UPDATE di App.jsx: `assegna_coach` legge
-- `used_by` e `used_at` per decidere il coach.
create or replace function public.riscatta_codice_invito(p_codice text)
returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  io uuid := auth.uid();
begin
  if io is null or p_codice is null then
    return false;
  end if;

  update public.invitation_codes
     set used_by = io,
         used_at = now(),
         is_active = false,
         used_by_email = auth.jwt() ->> 'email'
   where code = p_codice and used_by is null and is_active = true;

  if found then
    return true;
  end if;

  return exists (
    select 1 from public.invitation_codes
     where code = p_codice and used_by = io
  );
end $$;

revoke execute on function public.codice_invito_valido(text) from public;
revoke execute on function public.riscatta_codice_invito(text) from public, anon;
grant execute on function public.codice_invito_valido(text) to anon, authenticated;
grant execute on function public.riscatta_codice_invito(text) to authenticated;

commit;

-- Prova dopo il tempo 1 (SQL editor):
--   select public.codice_invito_valido('NONESISTE');   -- atteso: false
--   select public.codice_invito_valido('<un codice attivo vero>');   -- atteso: true


-- ═══ TEMPO 2 — restrittivo ═════════════════════════════════════════════════
-- ⛔ NON insieme al tempo 1. Leggere l'avvertenza in testa.
--
-- begin;
--
-- drop policy "Anonymous users can validate a code" on public.invitation_codes;
-- drop policy "Authenticated users can select codes" on public.invitation_codes;
-- drop policy "Authenticated users can claim an invitation code" on public.invitation_codes;
--
-- -- L'atleta legge solo il codice che ha usato lui: App.jsx lo cerca per
-- -- sapere se è autorizzato (`used_by = session.user.id`).
-- create policy "codici lettura riscattato" on public.invitation_codes
--   for select to authenticated
--   using (used_by = auth.uid());
--
-- commit;
--
-- Prova dopo il tempo 2, con un account coach NON admin (dall'app):
--   Impostazioni → Codici invito mostra solo i suoi; un atleta nuovo si
--   iscrive con un codice di quel coach e compare fra i SUOI atleti.
-- E con la sola anon key:
--   select * from invitation_codes   → nessuna riga.
