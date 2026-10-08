# Le Impostazioni

> Spostato da `CLAUDE.md` il 07/10/2026, **senza cambiare il testo**. I rimandi
> «§9-…» puntano a sezioni che ora stanno in altri file di questa cartella:
> si trovano con `grep -rn '^## 9-<nome>' docs/memoria`. L'indice è in `CLAUDE.md`.

## 9-duoetvicies. Il rework delle Impostazioni (01/09/2026)

Stesso progetto Claude Design degli altri otto schermi
(`4a238081-a3ee-4f59-ae34-100f29d55601`), artboard `Impostazioni.dc.html`,
opzione **1b**. Come per gli altri: **nessun campo di Supabase cambia forma**,
e nessun percorso di quelli che funzionavano è stato riscritto — permessi
push, BLE, export/import, cambio password sono gli stessi. Cambia il JSX,
cambia l'ordine, e per la prima volta la pagina dice con quale account sei
dentro.

### Il problema, in una riga
Cinque card dello stesso peso in un ordine che non è quello dell'uso: la prima
schermata era occupata dai **codici invito**, cioè la cosa che il coach fa una
volta al mese. Ogni voce — anche un semplice acceso/spento — era un bottone
alto 76px con titolo e sottotitolo, quindi niente si leggeva come più
importante di altro. E la pagina non diceva mai la cosa che una schermata
Impostazioni deve dire per prima: **chi sei, e cosa è attivo su questo
telefono**.

### Cosa c'è ora, nell'ordine in cui sta in pagina
1. **L'eroe: account e stato del dispositivo.** Nome, email, la pillola del
   ruolo, e sotto «Su questo iPhone» i due interruttori che valgono solo qui —
   notifiche e fascia cardio. È l'unica parte della pagina che contiene
   **informazione** e non destinazioni.
2. **Account**: modifica password e anteprima come atleta.
3. **Solo coach**: codici invito, esporta database, importa backup atleta.
4. **Ripristina database totale**, fuori dal gruppo e rosso.
5. **Strumenti sviluppo**, chiuso.
6. **Esci dall'account**, e il piede con versione e email.

### ⚠️ Le sette cose da sapere prima di rimetterci mano

1. 🔴 **Un interruttore è un interruttore, e ha `aria-checked`.** Prima il
   testo del bottone cambiava da «Abilita Notifiche» a «Disabilita Notifiche»
   per dire dov'era: un comando travestito da stato, che si legge al contrario
   la metà delle volte. Senza `role="switch"` + `aria-checked`, chi usa
   VoiceOver sente «Notifiche push, pulsante» e non ha modo di sapere se le
   notifiche arrivano — che è **tutta** l'informazione della riga.
2. 🔴 **Il banner giallo «Operazione in corso, attendere prego...» è
   sparito, e non è pulizia.** Lo stato di caricamento vive nella riga che
   l'ha causato (`operazione` è una stringa, non un booleano): con nove
   comandi in pagina, una rotella in cima costringe a ricordarsi cosa si è
   appena premuto. ⚠️ Il test che lo protegge deve **tenere aperta l'attesa a
   mano** — con il finto Supabase l'export finisce dentro la stessa
   `userEvent.click`, e un `waitFor` dopo il clic troverebbe la riga già
   tornata a riposo, cioè passerebbe anche rimettendo il banner (§9-sexies,
   ancora).
3. 🔴 **Il testo sul Garmin è quello di prima, parola per parola.** È l'unica
   spiegazione dell'app su come si collega un orologio, e riassumerlo
   butterebbe via proprio la parte che dice cosa fare — è la stessa lezione
   dell'avviso sul riscaldamento (§9-duodecies). Quello che cambia è che non
   lo si rilegga a ogni apertura: sta sotto «Come si collega». Esce solo
   l'emoji 💡, che DESIGN.md dichiara anti-riferimento.
4. 🔴 **I numeri delle righe non si inventano mai.** `riassuntoCodici` torna
   `null` finché i codici non sono arrivati — «0 attivi · 0 usati» durante il
   caricamento è un dato, ed è falso — e `riassuntoBackup` fa **sparire** un
   conteggio mancante invece di scriverlo `0`: «0 atleti · 0 workout» accanto
   a «Esporta database» si legge come «non c'è niente da salvare», che è il
   messaggio peggiore possibile sulla riga di un backup. Quinta comparsa della
   regola di `rpeAtteso` (§9-octies, §9-undecies, §9-terdecies,
   §9-unetvicies).
   ⚠️ E i due conteggi sono quelli **grezzi** delle tabelle, non quelli della
   rubrica: descrivono il **file**, non la squadra. La rubrica filtra
   `deleted_at` e l'account del coach; prendere il suo numero farebbe
   promettere all'export un contenuto che non ha.
5. 🔴 **«Ultimo export» è una memoria LOCALE, non un registro dei backup.**
   `fleofit_ultimo_export` dice «l'hai esportato da questo iPhone», che è
   l'unica cosa che si possa sapere senza una colonna nuova (regola 0-bis).
   Chi cambia telefono non vede la data, e la riga non gli promette niente di
   falso — ma se un giorno si vuole «esiste un backup del 28 ago», quello è
   un'altra affermazione e richiede il database.
6. **La versione arriva da `App.getInfo()` di Capacitor, e sul web non
   compare.** `package.json` dice `0.0.0` e il numero vero vive nel `pbxproj`,
   che Xcode incrementa **da solo** a ogni archive (§9-ter): una costante
   scritta a mano qui sarebbe la quarta copia di un numero destinato a essere
   sbagliato.
7. **La fascia cardio resta di chi si allena.** L'artboard la disegna anche
   nella vista coach, ma il gate `role === 'athlete' || isSimulatingAthlete`
   è quello di prima ed è rimasto: il coach non ha allenamenti propri (il suo
   account è escluso da chi si segue), e un interruttore che non serve a
   niente è comunque un interruttore da leggere. Cambiarlo è una decisione di
   prodotto, non di design.

### I codici invito: una riga, e un foglio
Erano una card con **due accordion dentro** — un pozzetto dentro un pozzetto,
contro la Regola dei Gradini. Ora la pagina porta solo il numero («3 attivi ·
11 usati») e la lista si apre in un bottom sheet, con `src/useBottomSheet.js`
come il menu della scheda.

⚠️ **Un foglio e non una rotta nuova**: l'artboard descrive una schermata
dedicata, ma il suo `dv-next` la dà fra i **prossimi** pezzi di design. Vale la
stessa scelta del pannello filtri dell'archivio (§9-sedecies) e del foglio del
giorno del calendario (§9-octodecies): si implementa ciò che è disegnato, non
ciò che è annunciato.

⚠️ **I codici si leggono all'apertura della PAGINA, non del foglio**: il numero
della riga deve esserci prima che qualcuno la tocchi, o la riga non dice niente
più di quanto dicesse la card. La lettura è una sola per apertura, e per
l'atleta **non parte affatto** — c'è un test che conta le query, perché la
guardia sul ruolo sta in due punti e verificarne uno solo lascia passare una
versione che scarica gli inviti sul telefono di chi non deve vederli
(§9-vicies, stessa lezione).

⚠️ **`riassuntoCodici` dice «Nessun codice generato» solo sulla tabella
VUOTA**, non quando attivi e usati sono entrambi zero: un codice spento che
nessuno ha riscattato esiste, non compare in nessuna delle due liste del
foglio, e invitare a generarne uno nuovo sarebbe l'unica frase della riga che
si può smentire aprendola.

### Il codice morto che il rework ha lasciato indietro, ed è stato rimosso
`InviteCodeManager` (in `Settings.jsx`) è sparito: la sua metà visiva è
`FoglioCodici` in `ImpostazioniUI.jsx`, la sua metà di dati è salita in
`Settings` — dove serviva comunque, per il numero della riga. Nella stessa
passata i due `JSON.parse(localStorage.getItem(...))` non c'erano già più, ma
la scrittura di `fleofit_ultimo_export` passa da un `try/catch` che **non**
fa fallire l'export: il file a quel punto è già stato scritto.

### 🔴 La cancellazione dell'account è salita qui (09/09/2026)

Linea guida **5.1.1(v)**: un'app che permette di creare un account deve offrire
la cancellazione **dentro l'app**, e Apple chiede che sia «easy to find».
Esisteva già, funzionava, e nessuno l'avrebbe trovata: stava dentro la modale
«Modifica profilo» della scheda atleta, cioè dietro un menu, dentro un foglio di
modifica, in fondo a un modulo. Ora è una `RigaPericolo` **sopra «Esci
dall'account»**, che è dove la si cerca.

⚠️ **Si mostra a TUTTI i ruoli, coach compreso.** Non è una svista: nasconderla a
chi è in `ADMIN_EMAILS` vorrebbe dire nasconderla a `demo@fleofit.it`, cioè
esattamente all'account con cui entra il revisore di Apple. C'è un test.

⚠️ **Nella scheda atleta è rimasto SOLO il coach che elimina un atleta**
(`proprioProfilo` in `EditAthleteModal`), che è un gesto diverso e ha il suo
cestino in «Eliminati di recente». Due porte per lo stesso gesto sarebbero state
peggio di una sola nascosta: la seconda smette di essere aggiornata (§9 punto 1).

🔴 **Il messaggio NON promette che riaccedendo si annulla, perché è falso.**
`ProtectedRoute` non filtra `deleted_at`: si rientra e la riga resta comunque
marcata, e dopo 7 giorni `delete_expired_athletes()` la elimina in cascata con
tutto lo storico (§4). L'unica via indietro è **Atleti → «Eliminati di recente»**,
che ce l'ha il coach — ed è quello che il testo dichiara. C'è un test che cade se
qualcuno ci rimette la promessa comoda.

### ⚠️ Cosa questa cancellazione NON fa ancora
Due limiti da conoscere prima di dire che è chiusa del tutto:
1. **La riga in `auth.users` sopravvive.** Dal client non si può togliere: serve
   `supabase.auth.admin.deleteUser`, quindi la service role key, quindi una Edge
   Function nuova. Non è bloccata dalla regola 0-bis (non è schema) ma è un
   deploy, e va fatta con la stessa cautela di `send-reminders` (§1.1). Finché
   non c'è, l'identità con cui si accedeva resta viva: chi ha cancellato il
   profilo e rientra con Apple o Google finisce sul passo del codice invito.
   ⚠️ E `delete_expired_athletes()` **non è nel repository** (§4), quindi non è
   verificabile da qui se tocchi anche `auth.users`: si legge con
   `select prosrc from pg_proc where proname = 'delete_expired_athletes';`
2. **Per un indirizzo in `ADMIN_EMAILS` non cancella davvero l'accesso.** Il
   ruolo coach viene dall'elenco hardcodato, non dal database (§9-ter): un admin
   che si cancella viene disconnesso, ma rientrando è ancora coach perché
   `ProtectedRoute` per lui salta del tutto il controllo sulla riga `athletes`.
   È una proprietà dell'elenco hardcodato, non di questo gesto.

### I file nuovi
`src/lib/rigaImpostazioni.js` (logica pura, 12 test) e
`src/components/ImpostazioniUI.jsx` (sola presentazione).
`src/pages/__tests__/Impostazioni.test.jsx` porta 17 test, tutti verificati per
mutazione.

---

## 9-segnalazioni. «Segnala un problema» (07-08/10/2026)

Gruppo **«Aiuto»** fra le righe del coach e «Elimina il mio account», per
**tutti** i ruoli: i problemi li trova soprattutto l'atleta. Apre
`FoglioSegnalazione`, una modale **a schermo intero** in tre passi: tipo →
domande a scelta rapida, descrizione, fino a 3 screenshot → riepilogo → invio.
I dati tecnici partono ma **non si mostrano** (committente, 08/10/2026). Specifica
e piano: `docs/superpowers/specs/2026-10-07-segnalazioni-design.md` e
`docs/superpowers/plans/2026-10-07-segnalazioni.md`.

### ⚠️ Le otto cose da sapere prima di rimetterci mano

1. 🔴 **La mail la manda il SERVER, non il telefono.** Edge Function nuova
   `supabase/functions/segnalazione` → API di Resend. Il compositore di posta del
   telefono è stato scartato: su Android apre Gmail (si esce dall'app), richiede
   un account configurato e un secondo «Invia». Niente tabella, per la regola
   0-bis; niente riga in `notifications`, perché la policy `auth.uid() = user_id`
   non lascia scrivere a un atleta una riga del coach (ed è scritta bene).
2. 🔴 **È una funzione NUOVA apposta.** Una modalità in `send-reminders` avrebbe
   voluto dire ridistribuire la funzione condivisa con la web app in produzione.
   Questa la usa solo il foglio. Secret: `RESEND_API_KEY`; facoltativi
   `SEGNALAZIONI_MITTENTE` e `SEGNALAZIONI_DESTINATARIO`. Con il mittente
   predefinito `onboarding@resend.dev` Resend consegna **solo** all'indirizzo
   dell'account Resend: per un mittente `@federicoleo.it` serve verificare il dominio.
3. 🔴 **Chi scrive lo dice il server, con `auth.getUser(token)`.** Non la lettura
   dei claim del JWT (come `identificaChiamante` in `send-reminders`), che
   chiunque può fabbricare. Il nome e l'indirizzo stanno nel testo della mail
   (riga «Da:»), ma la mail **non ha `reply_to`**: alle segnalazioni non si
   risponde (committente, 08/10/2026). Un test su `messaggioResend` lo verifica.
4. **I limiti esistono due volte** (`src/lib/segnalazione.js` e `regole.ts`) e un
   test li confronta. `regole.ts` è puro (niente import Deno) apposta: così Vitest
   lo prova. ⚠️ Il limite di 5 invii all'ora è **in memoria dell'istanza** — un
   freno al doppio tocco, non una difesa. Una vera richiede una tabella (BACKLOG #60).
5. 🔴 **Su un non-2xx `supabase-js` non riempie `data`**: mette la Response in
   `error.context`. `inviaSegnalazione` legge il messaggio da lì, o «Troppe
   segnalazioni» (429) e gli errori di validazione non arriverebbero mai a chi
   scrive. Trovato scrivendo la funzione, dopo aver collegato il foglio.
6. 🔴 **Schermo intero, e si esce SOLO da «Annulla» (con conferma) o da «Chiudi»
   dopo l'invio** (committente, 08/10/2026; fino ad allora era un foglio dal basso
   con maniglia e velo). La conferma dice «Vuoi annullare la segnalazione?» con
   «No» / «Sì, annulla» — `CustomConfirm` ha preso per questo un `cancelLabel`
   facoltativo: un «Annulla» per dire «non annullare» sarebbe stato ambiguo — e
   confermando la bozza si butta. Il tasto indietro di Android cerca le parole nel
   **testo** dei bottoni, nell'ordine del DOM: per questo «Indietro» è scritto (non
   un'icona con `aria-label`) e sta prima di «Annulla», e la conferma vive in un
   portale **suo**, o il tasto troverebbe prima l'«Indietro» che sta sotto.
   La bozza (`fleofit_segnalazione_bozza`: tipo, risposte, descrizione, **non** le
   immagini) si cancella dopo un invio riuscito o un annullamento confermato.
7. 🔴 **Il foglio non nomina mai una persona e non promette risposte** (decisione del
   committente, 08/10/2026). Ringrazia e basta: «Grazie per il feedback». La riga
   dice «Un problema o un'idea per l'app». C'è un test che cerca «Federico» e
   «rispond» nel testo del foglio.
8. **Fra un passo e l'altro il contenuto scivola**: `passo-entra` andando avanti,
   `ritorno-entra` tornando indietro, le stesse classi del builder (già spente da
   «riduci movimento»). All'apertura niente: sale già tutta la schermata (`sheet-in`). Il
   contenitore ha `key={passo}`, quindi si rimonta e lo scorrimento torna in cima.

### I file nuovi
`src/lib/segnalazione.js` (18 test) · `src/lib/immagineRidotta.js` (3) ·
`src/components/FoglioSegnalazione.jsx` (13) · `src/pages/__tests__/Segnalazione.test.jsx` (6) ·
`supabase/functions/segnalazione/{index,regole}.ts` (`segnalazioneServer.test.js`, 14).
Ogni test nuovo è stato visto fallire rompendo apposta il codice che copre.
