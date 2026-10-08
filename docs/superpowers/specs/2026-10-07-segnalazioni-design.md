# Segnala un problema — design

Data: 07/10/2026 · Branch: `app` · Stato: approvato in chat dal committente

## Obiettivo
Chi usa l'app (soprattutto gli atleti, anche il coach) segnala un problema da un
modulo **dentro l'app**, senza aprire la posta. Al coach arriva una **email**
utilizzabile: cosa, dove, su quale telefono e versione, con eventuali screenshot,
e «Rispondi» scrive direttamente a chi ha segnalato.

## Vincoli
- 🔒 Schema del database congelato (regola 0-bis): **nessuna tabella, nessuna policy**.
- La email la spedisce il server: una **Edge Function nuova `segnalazione`** che
  chiama l'API di **Resend**. Non tocca `send-reminders` né la web app in produzione.
- L'identità di chi scrive la ricava il server dal JWT con `auth.getUser(token)`
  (verificato, non la sola lettura dei claim): l'app non la dichiara.
- Fase 2 (link «Segnala» dentro gli avvisi d'errore) **fuori da questo lavoro**.

## Dove
Impostazioni → nuova `Sezione etichetta="Aiuto"` con `RigaAzione` «Segnala un
problema», fra le righe del coach e «Elimina il mio account». Visibile a tutti i ruoli.

## Il flusso (tre passi)

> **Cambiato il 08/10/2026 dal committente**: modale a schermo intero invece del
> bottom sheet; «Annulla» sempre presente, con conferma; dati tecnici non mostrati;
> la mail senza `reply_to`. Il dettaglio aggiornato è in `docs/memoria/impostazioni.md`.
1. **Tipo** — sei scelte: `bug` Qualcosa non funziona · `lenta` Si blocca o è lenta ·
   `notifiche` Notifiche · `timer` Timer e allenamento · `accesso` Accesso e account ·
   `idea` Un'idea.
2. **Dettagli** — 0–3 domande a scelta singola, diverse per tipo (`idea` non ne ha);
   descrizione libera obbligatoria (min 10, max 4.000 caratteri); fino a 3 immagini
   dalla galleria, ridotte nel client a JPEG lato lungo 1280px, qualità 0,7.
   Per `notifiche`, se le notifiche su questo dispositivo sono spente compare un
   aiuto con il bottone «Attivale», che chiama lo stesso `toggleNotifiche` della pagina.
3. **Riepilogo** — mostra tipo, risposte, descrizione, numero di immagini e i dati
   tecnici che partono; bottone «Invia». Esito: `vibraSuccesso` + schermata
   «Grazie per il feedback» (nessun nome, nessuna promessa di risposta — 08/10), oppure `vibraErrore` + messaggio + «Riprova».

Navigazione: «Indietro» fra i passi (la parola esatta, così il tasto indietro di
Android la trova — `indietroAndroid.js`); al passo 1 il bottone si chiama «Chiudi».

## Dati tecnici (allegati in automatico, visibili prima dell'invio)
versione e build (`App.getInfo`, solo nativo) · piattaforma (`Capacitor.getPlatform()`)
· user agent · ruolo (con «anteprima atleta» se attiva) · online/offline
(`navigator.onLine`) · azioni nella coda offline (`leggiCoda().length`) · data e ora
locali · lingua e fuso orario.

## Bozza
Stato del modulo (tipo, risposte, descrizione; **non** le immagini) salvato in
`fleofit_segnalazione_bozza` con `scriviJson`, ripreso alla riapertura, cancellato
dopo un invio riuscito. Niente coda offline: offline il bottone dice
«Sei offline — la bozza resta qui».

## Edge Function `segnalazione`
Input `POST { tipo, risposte: [{domanda, risposta}], descrizione, tecnici: {…},
immagini: [{ nome, base64 }] }`.
1. `OPTIONS` → CORS. Senza token valido → 401.
2. Validazione: `tipo` fra i sei, descrizione 10–4.000, ≤ 3 immagini, ognuna ≤ 1,5 MB
   decodificata, tecnici ≤ 2 KB serializzati → altrimenti 400.
3. Limite best-effort in memoria: 5 invii/ora per utente (si azzera quando l'istanza
   si ricicla; dichiarato nei commenti) → 429.
4. Nome da `athletes.name/surname` (service role), ripiego sull'email.
5. Resend: `from` = `FLEOFIT <onboarding@resend.dev>` finché il dominio non è
   verificato (secret opzionale `SEGNALAZIONI_MITTENTE` per cambiarlo), `to`
   `coaching@federicoleo.it` (secret opzionale `SEGNALAZIONI_DESTINATARIO`),
   `reply_to` = email di chi scrive, oggetto `[FLEOFIT] <Tipo> · <Nome>`, corpo
   testo + HTML con l'escape, immagini come `attachments`.
6. Risposta `{ ok: true }` o `{ error }` con lo status corretto.
Secret richiesto: `RESEND_API_KEY`.

## Ambiente di prova
`supabaseDemo.functions.invoke` risponde già `{ ok: true }`: il flusso si prova
senza spedire niente.

## Test
- `src/lib/__tests__/segnalazione.test.js`: catalogo tipi/domande, validazione,
  `datiTecnici`, `testoSegnalazione` (oggetto e corpo), bozza vuota/ripresa.
- `src/pages/__tests__/Segnalazione.test.jsx`: riga presente per atleta e coach;
  flusso completo → `functions.invoke('segnalazione', …)` con il corpo atteso;
  errore → messaggio e «Riprova», bozza conservata; aiuto notifiche solo se spente.
- Ogni test nuovo va visto fallire rompendo apposta il codice (regola del §9).

## Fuori dallo scopo
Fase 2 (avvisi d'errore) · storico delle segnalazioni nell'app · tabella dedicata
(dopo l'approvazione App Store, se servirà).
