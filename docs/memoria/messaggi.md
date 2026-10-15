# Messaggio a tutti — la bacheca «Dal coach»

> Nata il 15/10/2026. Spec: `docs/superpowers/specs/2026-10-15-messaggio-a-tutti-design.md`.
> Chat col singolo atleta: **ancora aperta**, non è questa funzione.

## Stato
- ✅ **Tabella `messaggi_coach` applicata il 15/10/2026**, dopo il sì esplicito del committente in
  sessione (CLAUDE.md §0, regola 0-bis), con `supabase db query --linked -f
  supabase/schema/messaggi_coach_2026-10-15.sql`. Verificata: due policy (SELECT e ALL) e i
  default delle colonne.
- ✅ **`send-reminders` col modo `broadcast` pubblicata il 15/10/2026** (versione 54). Prova a vuoto:
  una richiesta `broadcast` con la chiave anonima risponde 403 «Non autorizzato». Da controllare la
  mattina dopo nei log che il promemoria `morning` sia andato come sempre.
- Il backup notturno ha `messaggi_coach` in `TABLES`: la salva davvero dal primo `app:main` (il workflow attivo è quello di `main`).
- 🔴 **Cancello di rilascio.** Finché la tabella non è applicata **e** `send-reminders` col modo
  `broadcast` non è pubblicata: **niente `git push origin app:main`** e **nessun archive della 1.2.2**.
  Le entrate del coach (megafono in testata della Home telefono, bottone sul desktop, voce «Messaggi» della barra
  laterale) sono **sempre visibili**: pubblicate prima, mostrerebbero una funzione rotta (la bacheca
  non carica, Invia fallisce). L'ordine è: sì del committente → tabella → deploy della funzione →
  solo allora `app:main` e archive. E il deploy della funzione non va anticipato alla tabella:
  il modo `broadcast` legge `messaggi_coach`.

## Dove sta cosa
| File | Cosa fa |
|---|---|
| `src/lib/messaggiCoach.js` | logica pura: `visibiliPer`, `ordina`, `daMostrareInHome`, `testoValido`, `CHIAVE_BOZZA`, `CHIAVE_VISTO` (riesporta `anteprima`, `routeMessaggio`, `puoInviareBroadcast` da `broadcast.ts`) |
| `src/components/MessaggiUI.jsx` | sola presentazione della bacheca |
| `src/pages/NuovoMessaggio.jsx` | rotta `/messaggi/nuovo`: la pagina dove il coach scrive, prova su di sé, invia; `?modifica=<id>` corregge |
| `src/components/FoglioMessaggio.jsx` | solo il menu «…» di un messaggio (Fissa · Modifica · Manda la notifica · Elimina) |
| `src/pages/Messaggi.jsx` | rotta `/messaggi`; `?m=<id>` evidenzia un messaggio (deep link dalla notifica), `?scrivi=1` (le entrate di prima) porta a `/messaggi/nuovo`; «+ Nuovo» in testata (solo coach) |
| `supabase/functions/send-reminders/broadcast.ts` | invio: controllo permesso, notifiche in `notifications`, push |
| Entrate | Home atleta (card «Dal coach», **anche al giorno 1**), **megafono in testata** della Home coach (`BottoneVetro` in `Home.jsx`, accanto a campanella e impostazioni), bottone «Messaggi» nell'intestazione di `HomeCoachDesktop`, voce «Messaggi» in `BarraLaterale` |

Chiavi localStorage: `fleofit_messaggio_bozza` (bozza della pagina di scrittura), `fleofit_messaggi_visto_fino`
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

## Il testo intero sta anche in `notifications.message` — ma la 1.2.1 ne mostra l'inizio
La notifica porta il **testo intero** in `notifications.message`, così il centro notifiche ha
qualcosa da mostrare anche nelle versioni che non conoscono la bacheca.
⚠️ **Non vuol dire che dalla 1.2.1 si legga tutto.** Nella 1.2.1 il centro notifiche di `Home.jsx`
taglia ogni messaggio a **due righe** (`line-clamp-2`) e `/messaggi` non esiste (la rotta `*` porta
in Home): l'atleta con la 1.2.1 legge solo **l'inizio** di un messaggio lungo. L'uso vero comincia
quando la **1.2.2** è nei negozi (sul web, al primo `app:main`). Il taglio di Home non si tocca per
questo: nella 1.2.2 il messaggio intero si legge in bacheca, e la notifica ci porta.
Conseguenza del testo intero: un messaggio **eliminato** dalla bacheca resta nei centri notifiche
già consegnati. È accettato; non si cancellano le notifiche.

## Invio
- **È una pagina, non un foglio** (`/messaggi/nuovo`, 15/10/2026, dopo la prima prova su iPhone del
  committente). Il foglio dal basso arrivava in ritardo rispetto alla tastiera, e «Fissa in cima»
  al primo tocco chiudeva la tastiera senza cambiare (il layout si spostava sotto il dito). Ora la
  pagina è `fixed inset-0 z-[60]`: con `Keyboard.resize` 'native' la webview si accorcia e la barra
  in fondo (Prova su di me · Invia a N) resta incollata sopra la tastiera. La pillola «Fissa in
  cima» e i bottoni della barra fermano `pointerdown`/`mousedown`: il campo non perde il fuoco, la
  tastiera resta su, il tocco conta. Riuscito l'invio si torna a `/messaggi?m=<id>`.
- Nuovo tentativo (retry) senza doppioni: la funzione deduplica con `notifications.route`
  (`routeMessaggio`, `/messaggi?m=<id>`).
- Il tasto **Invia è disabilitato mentre la chiamata è in corso**: due chiamate concorrenti
  duplicherebbero le notifiche.
- L'insert salva `testo.trim()`.
- Esito: `{ success, sent, saltati }`.
- **Destinatari**: atleti non eliminati, senza l'account nascosto, senza il mittente, senza chi
  l'ha già ricevuto e **senza gli account admin** (`trovaIdAdmin`, passati come `escludi` a
  `destinatariBroadcast`): un coach con una riga `athletes` non riceve il messaggio a tutti. Se
  `listUsers` fallisce si invia **senza** quel filtro, con `console.error` — la stessa scelta dei
  promemoria del mattino. Per questo «N atleti» nella pagina di scrittura può **superare** i destinatari
  veri: il client non legge la lista admin.
- **«Manda la notifica»** nel menu di un messaggio: rifà il passo 2 (`send-reminders`, stesso
  `record_id`) quando la push non era partita e dalla pagina si è usciti senza «Riprova». Sicuro grazie al dedup:
  chi l'ha già ricevuta viene saltato, e l'esito dice a quanti è partita (o che l'avevano tutti).
  Spenta nel demo e mentre una chiamata è in volo.
- **«Prova su di me»** (15/10/2026, chiesta dal committente per provare senza disturbare gli
  atleti): bottone secondario sotto Invia. Chiama `send-reminders` con `mode: 'broadcast_prova'`
  e il `testo`, **senza** insert in `messaggi_coach`: nessun atleta vede niente, né in bacheca né
  in Home. Il server prende l'id del chiamante dal token (`sub`), scrive UNA riga in
  `notifications` per lui (titolo «Messaggio dal coach (prova)», route `/messaggi`, senza `?m=`
  perché il messaggio non esiste) e manda la push ai SUOI dispositivi. Prova push, tocco, centro
  notifiche e badge; non prova l'evidenza del messaggio nuovo. La pagina resta aperta con la
  bozza. Esito: «Prova mandata ai tuoi dispositivi (N)», oppure «Nessun tuo dispositivo ha le
  notifiche attive» se `sent` è 0. Spento nel demo (stessa regola di `broadcast`) e a testo
  vuoto. Il server rifà il controllo del testo con `testoAccettabile` (la prova non passa dal
  check della tabella).

- **La prova dice la verità** (15/10/2026). La prima versione rispondeva «Prova mandata» contando
  i dispositivi iscritti, e sul telefono non arrivava niente: il committente provava dalla build
  **Debug** lanciata da Xcode (`it.federicoleo.fleofit.dev`), per cui Firebase risponde
  `THIRD_PARTY_AUTH_ERROR` (`database.md`, «Le push NON funzionano su una build Debug»). Ora
  `sendPush` torna `{ ok, motivo }`, `broadcast_prova` risponde `{ sent, consegnate, motivi }` e
  `esitoProva` (messaggiCoach.js) dice «mandata» solo se FCM l'ha accettata; con
  `THIRD_PARTY_AUTH_ERROR` spiega che dalla build di sviluppo le push non arrivano.
  🔴 **Per provare la push su iPhone serve la build Release** (Xcode → Product → Scheme → Edit
  Scheme → Run → Build Configuration: Release), oppure TestFlight. ⚠️ La Release ha lo stesso
  bundle id dell'app di App Store e la **sostituisce** sul telefono.

- **Dopo «Prova su di me» si torna alla bacheca** (15/10/2026, richiesta del committente) con la
  bozza svuotata: premendo «Nuovo» la pagina riparte vuota. L'esito arriva come avviso
  (`mostraSuccesso` / `mostraErrore`). Solo se la chiamata non parte affatto si resta sulla pagina
  con il testo.
- ⏳ **TEMPORANEO — le prove in bacheca.** Il committente vuole vedere anche le prove in bacheca
  (fissato compreso) per verificare la funzione; **poi si toglie**. Vivono solo sul telefono del
  coach, in `fleofit_messaggi_prova` (`CHIAVE_PROVE`, `nuovaProva`, `proveValide` in
  messaggiCoach.js): nessun atleta le vede, il database non le conosce. Etichetta «Prova · la vedi
  solo tu»; menu ridotto a Fissa ed Elimina, che lavorano sul telefono. La notifica di prova porta
  a `/messaggi?m=prova-…` (`routeProva` in broadcast.ts, `prova_id` nel body). Per toglierle:
  `grep -rn "TEMPORANEO" src supabase/functions/send-reminders`.
- **La barra in fondo sale con la tastiera** (iOS). Con `Keyboard.resize` 'native' restava giù e
  poi «si teletrasportava» sopra la tastiera: la webview si accorcia solo a tastiera arrivata. La
  pagina usa `useTastieraIOS` (useTastiera.js): `setResizeMode('none')` finché è aperta, l'altezza
  da `keyboardWillShow` come `padding-bottom` della barra, transizione di 250 ms sulla curva di
  iOS, e `'native'` di nuovo all'uscita. Su Android `useTastieraCheCopre`.

## La pagina
- **Freccia indietro** in testata (`useIndietro('/')`, `aria-label="Torna indietro"`, come l'Archivio):
  aperta da una notifica è la prima pagina della sessione, e senza ripiego la freccia non farebbe niente.
- **`?m=` cambiato a pagina aperta** (una notifica toccata mentre si è già in bacheca) verso un
  messaggio che la lista caricata non ha: la bacheca si **rilegge una volta** per quell'id
  (`lettaPer`, un ref), poi lo evidenzia. Il `?m=` con cui la pagina si apre non provoca una seconda
  lettura: lo copre già la prima. Se nemmeno la seconda lo trova, ci si ferma — niente giri.

## Ambiente di prova
`semi()` ha quattro messaggi (uno fissato, uno di 30 giorni fa); l'utente demo risulta iscritto da 20
giorni, quindi l'avviso vecchio resta nascosto. `functions.invoke('send-reminders', mode 'broadcast')`
torna `{ success: true, sent: <atleti>, saltati: 0 }`. Test: `src/__tests__/demoMessaggi.test.js`.
Versione dei semi 11.

## Da fare
- Il sì del committente, applicare la tabella, pubblicare `send-reminders` (BACKLOG).
- Prove sul telefono: push vera su iOS e Android, tocco → messaggio evidenziato, badge a zero
  aprendo la bacheca, pagina di scrittura chiusa col tasto indietro su Android.
- **Conferme di lettura**: rimandate di proposito.
- **Chat con il singolo atleta**: ancora aperta.
