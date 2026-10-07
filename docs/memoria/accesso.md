# L'accesso: login, codice invito, Sign in with Apple

> Spostato da `CLAUDE.md` il 07/10/2026, **senza cambiare il testo**. I rimandi
> «§9-…» puntano a sezioni che ora stanno in altri file di questa cartella:
> si trovano con `grep -rn '^## 9-<nome>' docs/memoria`. L'indice è in `CLAUDE.md`.

## 9-sexvicies. Sign in with Apple (03/09/2026)

Rifiuto di App Store del **02/09/2026** sulla build 1.1.0 (3), **linea guida 4.8 —
Design: Login Services**. ⚠️ Non è il rifiuto di maggio che torna: il 2.3.1(a)
resta chiuso (§9-ter). Questo è nuovo, e riguarda un pezzo che c'era da sempre.

### Il rilievo si capisce al contrario di come sembra
La 4.8 **non vieta i login di terze parti**. Dice che se ne offri uno devi offrire
*anche* un'alternativa che rispetti tre condizioni, di cui una sola morde: deve
permettere di **tenere nascosta la propria email a tutti**, te compreso. Google
non lo fa. E non lo fa nemmeno **email+password**, che è la ragione per cui «ma
c'è già l'accesso con email» non è una risposta valida: un account creato con il
proprio indirizzo non tiene quell'indirizzo privato da nessuno.

Quindi il lavoro è **additivo**. Google resta esattamente dov'era (decisione del
committente, 03/09/2026), e accanto è nato Sign in with Apple.

### 🔴 SUL NATIVO NON SERVONO NÉ UN SERVICES ID NÉ UNA CHIAVE `.p8`
È il contrario di quello che dicono quasi tutte le guide, e vale mezza giornata
più un carico di manutenzione permanente. Il Services ID e la chiave servono al
flusso **OAuth via browser**, cioè al web, dove Supabase scambia un authorization
code. Il flusso nativo non passa di lì: l'app riceve l'ID token **direttamente da
Apple** e lo consegna a Supabase, che ne verifica la firma con le chiavi pubbliche
di Apple e controlla che l'`aud` sia un bundle id autorizzato.
Con loro sparisce anche il **client secret che scade ogni 6 mesi** — che sarebbe
stato il costo peggiore dell'operazione, perché alla scadenza il login smette di
funzionare senza preavviso e senza un errore in app.

Resta quindi soltanto:
- Apple Developer → App ID → capability **Sign In with Apple**, ⚠️ su
  `it.federicoleo.fleofit` **e su `it.federicoleo.fleofit.dev`**: in Debug da
  Xcode l'app gira col secondo. È la stessa trappola dei due bundle id delle push
  (§4), ripresentata identica su un'altra funzione.
- Supabase → Authentication → Providers → Apple → **Client IDs** con **entrambi**
  i bundle id separati da virgola, e **Secret Key vuoto**. 🔴 Con il solo Services
  ID il login web funzionerebbe e quello sull'iPhone no: sul nativo il
  destinatario del token è il **bundle id**.
- `com.apple.developer.applesignin` in `ios/App/App/App.entitlements`, più la
  capability aggiunta in Xcode su Debug **e** Release (serve a rigenerare il
  provisioning profile).

### 🔴 IL PLUGIN È FERMO A CAPACITOR 7, E IL SINTOMO NON DICE NIENTE
Successo il 03/09/2026, sul dispositivo: **«SignInWithApple plugin is not
implemented on ios»**. Quel messaggio si legge come «manca il plugin» e porta a
reinstallarlo, a rifare `cap sync`, a ripulire Xcode. Non è niente di tutto ciò.

`@capacitor-community/apple-sign-in@7.1.0` — che è **l'ultima versione
pubblicata**, non una vecchia — dichiara `capacitor-swift-pm` con
`from: "7.0.0"`, che in SPM vuol dire `>= 7.0.0 < 8.0.0`. Ogni altro plugin del
progetto dichiara `from: "8.0.0"` e l'app blocca la versione a `exact: "8.3.4"`.
Il grafo dei pacchetti quindi **non si risolve affatto**:

```
xcodebuild: error: Could not resolve package dependencies:
  'apple-sign-in' depends on 'capacitor-swift-pm' 7.0.0..<8.0.0 and
  'capacitor-voice-recorder' depends on 'capacitor-swift-pm' 8.0.0..<9.0.0.
```

E qui sta la parte che inganna: **Xcode compila lo stesso**, riusando il grafo
precedente, e il build **riesce**. Il ponte JS del plugin arriva comunque, perché
lo porta `npx cap sync ios` insieme al bundle. Quindi in mano si ha un'app che
sembra costruita bene, con il bottone al suo posto, e un'implementazione nativa
che non è mai stata compilata.

Come si verifica, invece di dedurlo:
```bash
cd ios/App && xcodebuild -resolvePackageDependencies -project App.xcodeproj -scheme App
```

**La correzione** è una riga, ed è bloccata nel repo: `patches/` +
`patch-package` chiamato dal `postinstall` di `package.json`. Non è stata scelta
per pigrizia rispetto a vendorizzare i 60 righi di Swift dentro `ios/App/App/`:
quel progetto Xcode **non usa i gruppi sincronizzati col filesystem**, quindi un
file nuovo va aggiunto al target a mano — e sbagliare quel passo produce
**esattamente questo stesso errore**, in silenzio. La patch invece fallisce
rumorosamente: senza, il build non risolve e lo dice.
⚠️ Se un giorno esce una `7.1.1`, `patch-package` avvisa che la patch non si
applica più. È il comportamento giusto: quel controllo non va disattivato.

### 🔴 E UN BUILD NORMALE NON BASTA: SERVE IL CLEAN
Corretto il vincolo, `-resolvePackageDependencies` riesce e `Package.resolved`
elenca il pacchetto — ma **il build incrementale continua a non compilarlo**,
perché il grafo dei bersagli in `DerivedData/.../XCBuildData` è ancora quello di
prima. Il build riesce, e l'app dà lo stesso errore di runtime. Verificato: la
cartella `Build/Intermediates.noindex/CapacitorCommunityAppleSignIn.build` non
esisteva, mentre c'erano tutti gli altri diciotto plugin.
Serve **Product → Clean Build Folder** (o `xcodebuild clean build`). Dopo, si
controlla sul prodotto e non sul log:
```bash
strings <App.app>/App.debug.dylib | grep -c SignInWithApple   # 0 = non c'è
```

### 🔴 IL NONCE VA HASHATO DA UN LATO SOLO
È il punto in cui questa integrazione fallisce senza dire perché, ed è
verificabile leggendo le due metà:
- il plugin fa `request.nonce = call.getString("nonce")`: scrive nel token **la
  stringa che gli diamo**, non il suo hash;
- `@supabase/auth-js` documenta l'opposto — «If the ID token contains a `nonce`
  claim, then **the hash of this value** is compared to the value in the ID
  token».

Quindi **hash al plugin, valore in chiaro a Supabase**. Lo stesso valore ai due
lati dà un 400 che sembra un problema di configurazione su Apple Developer, e ci
si perdono ore a rifare una configurazione che era già giusta. Sta in
`src/lib/appleLogin.js`, e c'è un test che monta la pagina e verifica che uno sia
lo SHA-256 dell'altro.

⚠️ `generaNonce` torna **`null`** quando la WebView non espone `crypto.subtle`, e
non lancia: senza nonce il token non porta il claim, Supabase non ha niente da
confrontare, e il login entra lo stesso. Si perde la protezione dal riutilizzo di
un token già speso — il compromesso che accettano gli esempi nativi di Supabase —
e si guadagna che un contesto non sicuro non chiuda fuori tutti.

### 🔴 IL NOME ARRIVA UNA VOLTA SOLA, E POI MAI PIÙ
Apple manda `givenName`/`familyName` **solo alla primissima autorizzazione**, e
non sono nel token: da lì in poi tornano `null`. Se non si scrivono subito in
`user_metadata` sono persi per sempre, e il sintomo non è un errore — è
l'onboarding coi campi vuoti e la Home che saluta `email.split('@')[0]`, che con
«Nascondi la mia email» è una stringa di caratteri casuali.
⚠️ Per la stessa ragione `nomeDaApple` torna `null` invece di un oggetto con due
stringhe vuote: scriverlo cancellerebbe il nome salvato la prima volta.

### ⚠️ Le quattro conseguenze da conoscere prima di dire che è un bug
1. 🔴 **Chi si allena già NON deve entrare con Apple.** Supabase unisce due
   identità solo se l'email combacia, e con «Nascondi la mia email» l'indirizzo è
   un `@privaterelay.appleid.com` che non combacia mai. Quell'atleta ottiene un
   utente **nuovo**, senza riga `athletes` e senza codice invito, e
   `ProtectedRoute` lo caccia su `/login?error=unauthorized`. Sign in with Apple è
   di fatto la porta dei **nuovi inviti**, non un secondo ingresso per chi c'è già.
2. 🔴 **Un account con email nascosta non può essere coach.** Le tre liste admin
   sono per indirizzo (§4-bis), e un relay non è in nessuna delle tre. Il coach
   continua a entrare con `coaching@federicoleo.it` e password.
3. ⚠️ **Il recupero password non arriva a un indirizzo relay** se il dominio
   mittente non è registrato nel servizio di inoltro di Apple. Non blocca niente —
   chi entra con Apple non usa la password — ma non è un percorso da promettere.
4. **Il bottone è bianco e sta SOPRA quello Google**, e non è gusto: la 4.8 chiede
   che l'alternativa non sia «meno in vista» delle altre, ed è la prima cosa che
   il revisore guarda dopo un rilievo su quella linea guida. Su fondo scuro le
   linee guida di Apple prescrivono il bottone bianco, quindi un bottone nero su
   `#1e1e1e` sarebbe conforme al marchio e fuori norma rispetto alla 4.8.

### Il bottone si mostra solo sul NATIVO
Sul web servirebbe il Services ID che il progetto non ha — la web app è fuori da
questo lavoro, per decisione del committente. Un bottone che non può funzionare è
peggio che non averlo: stessa regola del badge sulla navbar (§9-quaterdecies) e
del pannello filtri dell'archivio (§9-sedecies). C'è un test che lo verifica dai
due lati. ⚠️ Quel ramo lo toccano **solo** questo file e `useTastiera`:
`src/test/setup.js` finge sempre «web», quindi va acceso a mano con
`window.Capacitor` — e `Login.jsx` legge il **globale**, non il modulo
`@capacitor/core`.

### I file nuovi
`src/lib/appleLogin.js` (logica pura, 8 test) e
`src/pages/__tests__/LoginApple.test.jsx` (8 test su `Login` montata). Sei
mutazioni provate sulla pagina, sei prese. Plugin
`@capacitor-community/apple-sign-in@7.1.0` (dichiara `@capacitor/core >= 7`, ed è
compatibile con SPM: `npx cap sync ios` lo elenca fra i 19).

---

## 9-septvicies. Il rework dell'accesso (04/09/2026)

Stesso progetto Claude Design degli altri nove schermi
(`4a238081-a3ee-4f59-ae34-100f29d55601`), artboard `Login.dc.html`, opzione
**1b**. È l'unico dei dieci che cambia anche il **flusso**, non solo il JSX:
la schermata di accesso è l'unico posto in cui la forma *è* il flusso.

### Il problema, in una riga
Il benvenuto chiedeva «Accedi» o «Nuovo Utente», cioè una cosa **che l'utente
non sa**: chi sbagliava il bivio finiva contro il muro del codice invito, che
non spiegava né cos'era il codice, né chi lo dà, né cosa fare senza. E la CTA
gialla — l'unico tratto forte della pagina — stava sul percorso che riguarda
una persona al mese, mentre chi torna ogni giorno prendeva il bottone grigio.

### Cosa c'è ora
1. **Il benvenuto** è una colonna sola di modi per entrare — Apple, Google,
   email — identica per chi ha un profilo e per chi non ce l'ha. Sotto, la nota
   ambra che dice **cos'è** il codice e **quando** verrà chiesto.
2. **Il passo 2** chiede il codice a chi serve: otto caselle, maiuscolo
   automatico, «Incolla dagli appunti», e la verifica che parte da sola
   all'ottavo carattere.
3. **L'invito accettato** è una card verde che resta a schermo finché il
   profilo non esiste, con dentro il codice: prima veniva messo da parte e non
   si vedeva più in nessuna schermata.
4. **«Non ho un codice»** è un foglio con tre risposte, dove prima c'era un
   vicolo cieco.

### 🔴 IL VICOLO CIECO ERA IN `App.jsx`, NON NEL LOGIN
È la parte che si perde leggendo solo la pagina. Chi entra con Apple o Google
**prima** di avere un profilo — cioè il caso normale di un nuovo invitato —
non passava mai dal login: passava da `ProtectedRoute`, che faceva `signOut()`
e mandava a `/login?error=unauthorized`, cioè a un alert «Accesso Negato»
senza nessuna via d'uscita se non chiudere l'app. Il codice non gli veniva
**mai** chiesto.

Ora quel ramo scrive `fleofit_invito_atteso` (email + provider) ed esce su
`/login?serve=invito`, che è il passo 2. Il `signOut()` resta: senza un
profilo non si entra, e quello è ancora il punto che lo decide — la RLS e il
riscatto del codice non sono stati toccati di una riga.

⚠️ Conseguenza voluta: dopo il codice, chi è entrato con Apple o Google deve
**ritoccare lo stesso bottone** (la card verde glielo ripropone). Non è un
passaggio dimenticato: il codice si riscatta con una sessione, e la sessione
l'abbiamo appena chiusa. Un tocco su un provider che ha già autorizzato è un
Face ID, contro un'app da chiudere e riaprire senza sapere perché.

### ⚠️ Le sei cose da sapere prima di rimetterci mano

1. 🔴 **Il nome del coach NON si può leggere, e l'artboard lo mette.**
   `invitation_codes.created_by` è un id di `auth.users`, e chi non è ancora
   dentro non ha nessuna query che lo risolva in un nome: `athletes` si legge
   solo per la propria riga o da admin. Servirebbe una policy nuova o una
   funzione `security definer`, cioè una migrazione, e lo schema è congelato
   (regola 0-bis). La card dice quindi «Il tuo coach ti ha invitato» e mostra
   **il codice**, che è vero — scrivere un nome a mano sarebbe un dato
   inventato sulla schermata che deve dimostrare di sapere chi sei.
2. 🔴 **«Non esiste» e «già usato» non sono distinguibili**, e nemmeno questo
   è una scelta di copy: la policy che serve chi non è dentro filtra
   `is_active = true and used_by is null`, quindi un codice riscattato torna
   come risposta **vuota** esattamente come uno mai esistito. Il messaggio
   porta perciò entrambi i rimedi in una frase sola. Indovinarne uno manda
   metà delle persone a rifare una cosa già fatta.
3. 🔴 **`maybeSingle()` e non `single()`.** Con `single()` «nessuna riga»
   arriva come **errore**, indistinguibile da un guasto di rete — e i due
   rimedi sono opposti («chiedine uno nuovo» contro «riprova fra un momento»).
   C'è un test che cade solo su quella confusione.
4. 🔴 **`normalizzaCodice` riconosce anche il LINK**, ed è il caso più
   frequente: Impostazioni offre «Copia codice» **e** «Copia link», e il link è
   quello che si manda su WhatsApp. Senza quel ramo, chi lo incolla ottiene
   otto caratteri presi dall'indirizzo — un codice sbagliato lungo come quello
   giusto, e un errore che non spiega niente.
5. **Le otto caselle sono UN campo solo**, disegnato in otto. Con otto input
   l'incolla riempirebbe la prima e basta, la correzione diventa un labirinto,
   e VoiceOver leggerebbe otto campi senza nome invece di uno chiamato «Codice
   invito».
6. **Il passo 1 email non indovina il ramo, e non può.** Supabase non dice se
   un account esiste (è la difesa contro l'enumerazione degli indirizzi):
   password sbagliata e profilo inesistente tornano lo stesso «Invalid login
   credentials». Quindi lì si offrono **le due uscite** — «Password
   dimenticata» e «Ho un codice invito» — invece di sceglierne una a caso. Con
   Apple e Google il ramo si sa davvero, ed è il motivo per cui quei due
   percorsi sono più corti.

### 🔴 Il difetto che solo la pagina a 393px ha mostrato
La riga «Non ho un codice» era ancorata in fondo, e a tastiera chiusa lasciava
**mezzo schermo di vuoto** fra sé e le caselle. L'artboard la disegna subito
sotto il bottone «Incolla», con la tastiera aperta a occupare il resto — che è
lo stato in cui questa schermata si guarda davvero. Nessun test lo avrebbe
preso: è lo stesso genere di difetto del conto alla rovescia del cestino
(§9-septdecies punto 7) e delle quattro celle del builder (§9-quatervicies).

### Cosa NON è stato fatto, e perché
- **Il passo 1 email non è ridisegnato.** L'artboard copre il benvenuto e il
  codice, e il suo `dv-next` dà il form email fra i prossimi pezzi di design:
  prende la cornice condivisa e niente di più. Stessa scelta dello step 2 della
  corsa nel builder (§9-undecies) e del pannello filtri dell'archivio.
- **«Termini» e «Privacy» sono testo, non collegamenti.** `privacy-policy.html`
  sta in radice, fuori da `public/`, e la riscrittura di `vercel.json` non lo
  serve: non esiste una URL che funzioni. Un link a un 404 sulla schermata di
  accesso è peggio di una riga che non promette una destinazione — voce in
  BACKLOG.
- **L'onboarding non è toccato.** Dopo il codice il percorso è quello di
  sempre: sessione → `ProtectedRoute` riscatta il codice → `Onboarding`.

### I file nuovi
`src/lib/codiceInvito.js` (logica pura, 8 test) e
`src/components/LoginUI.jsx` (sola presentazione).
`src/pages/__tests__/LoginInvito.test.jsx` porta 14 test, tutti verificati per
mutazione: sette mutazioni provate, sette prese.

---
