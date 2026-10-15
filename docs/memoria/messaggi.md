# Messaggio a tutti — la bacheca «Dal coach»

> Nata il 15/10/2026. Spec: `docs/superpowers/specs/2026-10-15-messaggio-a-tutti-design.md`.
> Chat col singolo atleta: **ancora aperta**, non è questa funzione.

## Stato
- ⏳ **Tabella `messaggi_coach` NON ancora applicata**: manca il sì esplicito del committente
  (CLAUDE.md §0, regola 0-bis: ogni migrazione ne richiede uno). File pronto:
  `supabase/schema/messaggi_coach_2026-10-15.sql`. Finché non è applicata, la bacheca non può
  leggere né scrivere sul database vero.
- ⏳ **`send-reminders` col modo `broadcast` NON ancora pubblicata** (`supabase/functions/send-reminders/broadcast.ts`
  e il ramo in `index.ts`). Un deploy colpisce anche la web app su `main`: va fatto dopo la migrazione.
- Il backup notturno ha già `messaggi_coach` in `TABLES`; finché la tabella non esiste il job la salta con un avviso.

## Dove sta cosa
| File | Cosa fa |
|---|---|
| `src/lib/messaggiCoach.js` | logica pura: `visibiliPer`, `ordina`, `daMostrareInHome`, `testoValido`, `CHIAVE_BOZZA`, `CHIAVE_VISTO` (riesporta `anteprima`, `routeMessaggio`, `puoInviareBroadcast` da `broadcast.ts`) |
| `src/components/MessaggiUI.jsx` | sola presentazione della bacheca |
| `src/components/FoglioMessaggio.jsx` | il foglio dove il coach scrive/corregge |
| `src/pages/Messaggi.jsx` | rotta `/messaggi`; `?m=<id>` evidenzia un messaggio (deep link dalla notifica), `?scrivi=1` apre il foglio |
| `supabase/functions/send-reminders/broadcast.ts` | invio: controllo permesso, notifiche in `notifications`, push |
| Entrate | Home atleta (card «Dal coach», **anche al giorno 1**), riga in `HomeCoachTelefono`, bottone nell'intestazione di `HomeCoachDesktop`, voce «Messaggi» in `BarraLaterale` |

Chiavi localStorage: `fleofit_messaggio_bozza` (bozza del foglio), `fleofit_messaggi_visto_fino`
(l'ultima volta che l'atleta ha guardato la bacheca: spegne la card in Home).

## Perché una bacheca e non solo una notifica
Una push sparisce: l'atleta che l'ha persa, o si è iscritto dopo, non la ritrova. La bacheca è lo
storico leggibile; la notifica è solo il campanello. Un solo messaggio per tutti, senza titolo:
l'anteprima è l'inizio del testo. Il coach può fissarne uno (la puntina) e correggerlo.

## La regola dell'iscrizione: è ORDINE, non SEGRETEZZA
L'atleta vede i messaggi **fissati** e quelli scritti **da quando è iscritto** (`created_at` dell'utente
auth): chi arriva oggi non trova trenta avvisi di mesi fa. Ma la policy RLS di lettura è `using (true)`:
chi legge la REST API vede tutto. È voluto — sono avvisi a tutti, non dati personali. Non va venduta
come privacy. Le date si confrontano come istanti (`getTime`), mai come stringhe.

## Il demo può guardare, non scrivere
`demo@fleofit.it` è l'account del revisore App Store e non deve poter mandare messaggi agli atleti
veri. Tre difese: la **policy di scrittura** non ha il demo in lista (è l'unica tabella in cui la lista
differisce dalle altre), la **funzione risponde 403**, e la **UI è disabilitata** — compresi
Fissa, Modifica ed Elimina. Perché anche quelli: con RLS, un `UPDATE`/`DELETE` non permesso tocca
**0 righe senza errore**, quindi il client chiede `.select('id')` e controlla che sia tornata una riga.
Senza quel controllo il bottone «funzionerebbe» senza fare niente.

## Il testo intero sta anche in `notifications.message`
Le versioni vecchie dell'app non conoscono la bacheca: leggono solo il centro notifiche. Per questo
la notifica porta il **testo intero**. Conseguenza: un messaggio **eliminato** dalla bacheca resta
leggibile nei centri notifiche già consegnati. È accettato; non si cancellano le notifiche.

## Invio
- Nuovo tentativo (retry) senza doppioni: la funzione deduplica con `notifications.route`
  (`routeMessaggio`, `/messaggi?m=<id>`).
- Il tasto **Invia è disabilitato mentre la chiamata è in corso**: due chiamate concorrenti
  duplicherebbero le notifiche.
- L'insert salva `testo.trim()`.
- Esito: `{ success, sent, saltati }`.

## Ambiente di prova
`semi()` ha quattro messaggi (uno fissato, uno di 30 giorni fa); l'utente demo risulta iscritto da 20
giorni, quindi l'avviso vecchio resta nascosto. `functions.invoke('send-reminders', mode 'broadcast')`
torna `{ success: true, sent: <atleti>, saltati: 0 }`. Test: `src/__tests__/demoMessaggi.test.js`.
Versione dei semi 11.

## Da fare
- Il sì del committente, applicare la tabella, pubblicare `send-reminders` (BACKLOG).
- Prove sul telefono: push vera su iOS e Android, tocco → messaggio evidenziato, badge a zero
  aprendo la bacheca, foglio chiuso col tasto indietro su Android.
- **Conferme di lettura**: rimandate di proposito.
- **Chat con il singolo atleta**: ancora aperta.
