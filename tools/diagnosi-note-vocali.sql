-- Perché una nota vocale si registra ma non si riproduce.
-- Solo letture. Eseguire nell'SQL Editor di Supabase.

-- ─────────────────────────────────────────────────────────────────────────
-- A. I file davvero presenti nel bucket, con DIMENSIONE e tipo dichiarato.
--
--    È la domanda che decide tutto:
--    · size = 0 o pochi byte  → la registrazione non ha catturato niente,
--                               il problema è nel plugin nativo;
--    · size plausibile (decine di KB per pochi secondi)
--                             → il file c'è, e il problema è che il browser
--                               non sa decodificarlo: estensione o
--                               content-type sbagliati rispetto al contenuto.
-- ─────────────────────────────────────────────────────────────────────────
select
  name,
  (metadata->>'size')::bigint            as byte,
  metadata->>'mimetype'                  as tipo_dichiarato,
  created_at
from storage.objects
where bucket_id = 'voice-notes'
order by created_at desc
limit 10;

-- ─────────────────────────────────────────────────────────────────────────
-- B. L'URL salvato sull'assegnazione, per aprirlo a mano dal browser.
--    Se scaricandolo si sente, il file è buono e il problema è il player.
-- ─────────────────────────────────────────────────────────────────────────
select id, athlete_id, completed_date, voice_note_url
from public.athlete_workouts
where voice_note_url is not null
  and voice_note_url not like '%#deleted=%'
order by completed_date desc
limit 5;
