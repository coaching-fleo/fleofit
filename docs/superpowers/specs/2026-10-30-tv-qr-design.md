# Collegare la TV con il QR — design

Data: 30/10/2026 · Approvato in sessione: approccio 1 (plugin dell'app).

## Cosa vuole il committente

- Sulla pagina `/tv` si può **inquadrare un codice QR**, non solo scrivere il codice.
- Nell'app, il tasto TV offre **due strade**: «Inquadra il QR» (fotocamera, permessi secondo le
  linee guida Apple) oppure «Inserisci il codice».
- Correggere il difetto: scritto il codice, toccando fuori dalla tastiera a volte «non parte».
- Dopo il collegamento, **con il QR o con il codice, il telecomando TV si apre da solo**.

Deciso con il committente: il QR serve **solo nell'app** (iPhone e Android). Sul sito
(`fleofit.vercel.app` dal browser del telefono) la finestra resta con il solo codice.

## Il difetto della tastiera (causa trovata)

La finestra «Trasmetti in TV» (`WorkoutDetail.jsx`, `tvModalOpen`) sale di 128px quando il campo ha
il fuoco (`-translate-y-32` su `isTvInputFocused`). Toccando fuori, il campo perde il fuoco, la
tastiera si chiude e la finestra **riscende sotto il dito**: il tocco su «Trasmetti ora» cade dove il
bottone non c'è più. La correzione è togliere il bisogno di quel tocco (sotto).

## 1. La finestra nell'app

Un foglio dal basso (`FoglioCollegaTV`, componente nuovo, montato con `createPortal`) al posto della
finestra centrata di oggi.

- **Scelta** (solo nell'app nativa): due bottoni grandi, «Inquadra il QR» (icona fotocamera) e
  «Inserisci il codice». Sul web si apre direttamente il codice.
- **Codice**: quattro cifre; **alla quarta cifra si collega da solo**, senza «Trasmetti ora». Durante
  il collegamento il campo mostra lo stato; in caso di errore («Codice TV non trovato o scaduto.») il
  campo si svuota e resta il messaggio sotto, senza alert.
- **QR**: chiama il plugin (sotto). Letto un QR valido: `vibraSuccesso`, collegamento, apertura del
  telecomando. QR non di FLEOFIT: messaggio «Questo non è il codice della TV FLEOFIT» e si può
  riprovare o passare al codice.
- **Permesso negato** (iPhone): messaggio chiaro con «Apri Impostazioni» e il passaggio al codice.
  L'app non chiede mai il permesso da sola: solo al primo tocco su «Inquadra il QR».
- **Dopo il collegamento**: niente più alert «Connesso!». Il foglio si chiude e si apre il telecomando
  con `apriTimer()` (che la prima volta su iPhone fa ancora la domanda della Live Activity).
- Tasto indietro Android: il foglio ha la X con `aria-label="Chiudi"`.

## 2. Il plugin `LettoreQR` (nativo, dell'app)

Stesso schema di `LettoreTesto`: codice dell'app, nessuna libreria nuova in `package.json`.
JS in `src/lib/lettoreQR.js`: `leggiQR()` → `{ valore }` | `{ annullato: true }` |
errore `permesso` / `non_disponibile`. Sul web risponde `non_disponibile` (e la scelta non compare).

- **iPhone** (`ios/App/App/LettoreQR.swift`, registrato in `FleoBridgeViewController`):
  `AVCaptureSession` + `AVCaptureMetadataOutput` (tipo `.qr`), in un view controller a tutto schermo
  presentato sopra l'app: anteprima, riquadro al centro, scritta «Inquadra il QR sulla TV», bottone
  «Annulla». Funziona da iOS 15. Permesso con `AVCaptureDevice.requestAccess`; se è negato risponde
  `permesso`.
- **Android** (`LettoreQRPlugin.java`, registrato in `MainActivity`): Google Code Scanner
  (`com.google.android.gms:play-services-code-scanner`, `GmsBarcodeScanning`, solo `FORMAT_QR_CODE`).
  La fotocamera la usa Google Play services: **nessun permesso CAMERA** nel manifest.
- 🔴 Plugin assente (app vecchia, web): chiamato con `.catch`, la scelta del QR non compare.

## 3. Il QR sulla TV

- Sotto le quattro cifre di `AttesaTV` (`TVDashboardUI.jsx`): il QR, bianco su nero nel linguaggio
  della pagina, con «oppure inquadralo con l'app FLEOFIT».
- Contenuto: `fleofit://tv/<codice>`. `codiceDaQR(testo)` (`src/lib/codiceTV.js`, puro, con test)
  accetta questo formato e restituisce le quattro cifre, o `null` per ogni altro QR.
- Inquadrato con la fotocamera di sistema di iPhone, il link propone di aprire FLEOFIT: l'app si apre e
  basta (non sa quale workout trasmettere). Il ramo del deep link non va toccato.
- Il disegno del QR: libreria `qrcode` (MIT), importata **solo** da `TVDashboard` (chunk suo, mai da
  un file condiviso: CLAUDE.md §9).

## Permessi e testi

- `NSCameraUsageDescription` in `Info.plist`: si aggiunge «e per inquadrare il codice QR della TV».
- Android: nessun permesso nuovo.

## Prove

- Test: `codiceDaQR` (formati validi, QR estranei, codici di lunghezza sbagliata); il collegamento
  automatico alla quarta cifra e l'apertura del telecomando con il foglio montato nei test di pagina.
- Ambiente di prova: il QR sulla pagina TV, il flusso del codice e l'apertura automatica del telecomando.
- 🔴 La fotocamera **non si prova qui**: niente simulatore (memoria del committente). La prova su
  iPhone e Android la fa il committente; serve `npm run ios` / `npm run android`.

## Uscita

- Il QR sulla TV e il codice automatico arrivano sul sito con `app:main`.
- Fotocamera e foglio nuovo nell'app arrivano con la prossima versione sugli Store (codice nativo).
- `docs/memoria/scheda-workout.md` e `app-store.md` (permesso) si aggiornano a lavoro finito.
