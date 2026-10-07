# Le novità che aprivano CLAUDE.md fino al 07/10/2026

> Spostato da `CLAUDE.md` il 07/10/2026, **senza cambiare il testo**. I rimandi
> «§9-…» puntano a sezioni che ora stanno in altri file di questa cartella:
> si trovano con `grep -rn '^## 9-<nome>' docs/memoria`. L'indice è in `CLAUDE.md`.

# CLAUDE.md — Memoria globale progetto FLEOFIT · app iOS + Android

> 🧩 **DAL 02/10/2026 L'APP NATIVA È UN BRANCH SOLO: `app`**, cartella
> `Z:\FedericoLeo\FLEOFIT\branches\fleofit-app`. Dentro ci sono **`ios/` e `android/`
> insieme**, sullo stesso codice React: una modifica si scrive **una volta** e finisce in
> tutte e due le app. Le differenze fra piattaforme stanno **nel codice**, dietro
> `Capacitor.getPlatform()` (il tasto indietro di sistema solo su Android, Sign in with Apple
> solo su iOS, l'album della galleria solo su Android) — mai in due copie dello stesso file.
> - **iOS**: sul Mac, `npm run ios` e poi Xcode (§2).
> - **Android**: su Windows, `npm run android` e poi Gradle (§A.1).
> - `ios-version` e `android-version` sono **superati**: restano su GitHub come storia, non ci si
>   lavora più. Dove questo documento dice «`ios-version`», per il presente si legga `app`.
> - Tutto ciò che è **specifico di Android** sta al **§A**; tutto il resto vale per entrambe.
>

> Documento di memoria persistente per Claude. Leggere **sempre** questo file prima di
> toccare il codice o proporre modifiche grafiche.
> Ultimo aggiornamento: **5 ottobre 2026**.
> **Due prodotti, due branch**: `main` = web app in produzione · `app` = le app native iOS e
> Android (§1.1 — rifare sempre `git fetch` prima di parlare dei branch).
> 🧩 **Il branch `app` è su GitHub dal 05/10/2026** (`origin/app`, prima esisteva solo in
> locale). Gli ultimi commit portano l'**archivio che riprende dov'era** tornando da un
> workout (§9-sedecies) dopo l'unificazione iOS + Android (§A). ⚠️ **L'hash non si scrive più qui dentro**: era
> autoreferenziale — la riga descrive il commit che la contiene — e in questo file è già stato
> sbagliato **tre volte**, con due commit esistenti solo per correggerlo. Si legge con
> `git log -1`, che non può mentire.
> `npm test` → **1087 test**, `npm run lint` → **42 problemi** (erano 164 la mattina del 25/08).
> ⭐ **Il 24/09 l'app ha preso un LINGUAGGIO APTICO** (§9-duoquadragies): sei verbi in
> `src/lib/aptica.js`, e una regola — vibra ciò che l'occhio può perdersi o che non si
> disfa, mai la navigazione. 🔴 Due trappole trovate: `selectionChanged()` è muto senza
> `selectionStart()`, e `navigator.vibrate` su iPhone non esiste — il drag&drop e le
> reazioni della Live Coach Cam **non avevano mai vibrato**.
> ⭐ **Il 24/09 il recap chiede «ti è piaciuto?»** (§9-unquadragies): una scheda
> con 👍/👎 e «Salta», e la risposta finisce nella nota dell'assegnazione come
> `[GRADIMENTO: si|no|nessuna]` dopo l'RPE — **nessuna colonna**, lo schema è
> congelato. Il coach la vede sulla scheda del workout; l'atleta mai.
> ⭐ **Il 22/09 è nato il RECAP POST-ALLENAMENTO** (§9-quadragies): chiudere un
> allenamento non è più un niente — quattro schede in stile storie con la seduta
> appena fatta, la settimana, l'andamento a otto settimane e il prossimo passo.
> 🔴 Tre trappole trovate MISURANDO: il **verdetto sul volume non compariva mai**
> (confronta otto settimane chiuse, e il grafico ne disegna sette), una **lettura
> fallita annunciava «il primo è fatto»** a chi ne ha cento, e il recap montato da
> tre pagine portava **32 KB nel chunk d'ingresso** — ora sta dietro un confine
> pigro. ⚠️ E ha reso visibile un difetto che non era suo: la Home dichiarava
> **4876 minuti** dove il recap ne diceva 105 — una quarta copia dello stimatore
> di durata che leggeva «800m» come 800 minuti. ✅ **Chiuso il 23/09**: i minuti
> della settimana vengono da `minutiSettimana`, e con la copia sono uscite le
> uniche due cose che la tenevano in vita — `weeklyStats.distance` e `.reps`,
> che non leggeva nessuno.
> ⭐ **Il 22/09 è nata l'APERTURA dell'app** (§9-duodequadragies): l'area scura si ritira
> dietro un arco e scopre la Home. 🔴 Registrando l'avvio vero è saltato fuori un difetto
> che nessuno aveva mai misurato e che non c'entrava con la richiesta: **380ms di BIANCO
> PIENO** fra lo schermo di lancio e l'app — la webview che dipinge il proprio fondo prima
> che il foglio di stile arrivi. ⚠️ E lo **schermo di lancio nativo è nero SENZA logo**:
> quello che si vede è sempre stato il logo web. Resta aperto, ed è l'ultimo stacco
> dell'avvio.
> ⭐ **Il 21-22/09 l'app ha preso un linguaggio di movimento** (§9-septtricies), da un
> riferimento indicato dal committente. ⚠️ Il video non era guardabile: i numeri sono stati
> **contati fotogramma per fotogramma a 30fps** con ffmpeg, ed è l'unica ragione per cui
> non sono inventati. Quattro cose, in ordine di quanto si vedono: la **cascata** (i figli
> di un contenitore entrano sfasati di 75ms, nove schermate), i **numeri che salgono**, la
> **CTA che si contrae** in pillola, e il **passo del builder** che entra da destra.
> 🔴 Tre trappole trovate MISURANDO e non leggendo il codice, tutte invisibili ai test:
> una **sfocatura sotto un'animazione di opacità cambia colore** quando il layer GPU viene
> liberato (Y 48,08 → 52,31 *dopo* la fine del movimento — sei aloni convertiti in
> `radial-gradient`); **`max-width` non interpola da `none`**, quindi la CTA saltava invece
> di contrarsi; e la **curva storica del progetto** (`.16,1,.3,1`) è un ease-out
> esponenziale che su un'entrata legge come uno scatto, non come morbidezza.
> 🔴 **Il 20/09 App Store ha respinto la 1.0 (5) con TRE rilievi insieme** (§9-quatertricies),
> e **uno solo è codice**: la **2.5.1** — HealthKit linkato al binario senza una funzione
> che lo giustifichi — chiusa il 21/09 togliendo Apple Health da tutte e cinque le porte
> da cui entra (codice, bottone, `Info.plist`, entitlement, **plugin npm**). Gli altri due
> sono caselle sbagliate su **App Store Connect** e nel repository non c'è niente da
> correggere: la **5.1.2(i)** — le etichette privacy dichiarano *tracking* su email e nome,
> e l'app **non traccia** (verificato: nessun SDK pubblicitario, nessun IDFA, Firebase solo
> come Messaging) — e la **2.3.6** — l'age rating dichiara *In-App Controls* che non
> esistono. ⚠️ Aggiungere l'ATT sarebbe la correzione **sbagliata**.
> ⭐ **Il 09/09 gli stimatori di durata sono diventati UNO** (§9-undetricies, BACKLOG #40
> chiuso): lo stesso allenamento diceva **58 minuti nella Home e 24 nella scheda**, e il
> difetto è saltato fuori mettendo due screenshot del simulatore uno accanto all'altro.
> Vince il **58**, per decisione del committente: sommare gli esercizi misura il tempo in
> cui l'atleta si sta muovendo, non quello che passa nel box. ⚠️ Con la durata sono saliti
> i **carichi** del modello predittivo (≈211 → ≈516 sullo stesso workout): i rapporti non
> si spostano, il numero assoluto sì.
> ⭐ **Il 15/09 «Salva workout» è sceso in fondo alla pagina** (§9-tertricies):
> la barra era `sticky`, quindi occupava una riga di schermo per tutto il tempo in
> cui si compone il workout — proprio mentre servono i blocchi — e il suo bordo
> disegnava uno stacco netto sopra la capsula della tab bar. ⚠️ `BarraAzioni`
> serve **tre** pagine: la prop `ancorata` resta `true` dove l'azione è la
> RAGIONE per cui si è aperta la pagina (scheda workout, scheda atleta), e
> diventa `false` dove è la CONCLUSIONE di un lavoro (il builder). Con la stessa
> passata, **aprire un blocco ne tiene il titolo davanti**: chiudeva quello aperto
> prima, la pagina si accorciava sopra la testa e il blocco toccato scivolava
> fuori schermo verso l'alto — misurato, da **−351 px a +12**.
> ⭐ **Il 09/09 la Home atleta ha guadagnato GLI STATI SENZA STORICO** (§9-duodetricies):
> giorno 1, prima settimana e giorno di riposo. La regola che ne esce vale per tutta
> l'app ed è entrata in DESIGN.md: **nessuna cella mostra uno zero — al posto di un dato
> che non esiste ancora va la cosa che lo farà esistere.** Chi installava l'app apriva su
> quattro zeri perfettamente corretti (anello 0/0, «Serie: 0 giorni», «0 min», «In arrivo»
> vuoto), cioè quattro numeri veri che gli dicevano di essere già indietro. ⚠️ Il
> `{weeklyStatus.length > 0 && …}` che sembrava proteggere il bento **non proteggeva da
> niente**: `weeklyStatus` nasce già con sette giorni — è lo stesso difetto della Home
> coach del 28/08, sullo stesso identico stato.
> 🔴 **Il 02/09 App Store ha respinto la 1.1.0 (3) sulla linea guida 4.8 — Login Services**,
> e il 03/09 è nato **Sign in with Apple** (§9-sexvicies). Non è il rifiuto di maggio che
> torna: quello (2.3.1(a)) resta chiuso. La 4.8 **non vieta Google**, che infatti resta
> dov'era — chiede che accanto ci sia un accesso che permetta di **tenere nascosta la
> propria email**, cosa che né Google né email+password fanno. ⚠️ Sul **nativo** non
> servono né Services ID né chiave `.p8`, quindi nemmeno il client secret che scade ogni
> 6 mesi: è la mezza giornata che quasi tutte le guide fanno perdere.
> ⭐ **Il 01/09 la scheda ha guadagnato la GRAFICA DA STORIA** (§9-unetvicies): un PNG
> **trasparente** con l'elenco degli esercizi e tre numeri grandi, da appoggiare sopra
> la propria storia come fa Strava con il percorso. È la prima cosa dell'app che finisce
> sotto gli occhi di chi non ce l'ha — e la prima stesura ci aveva messo un grafico,
> tolto dal committente lo stesso giorno perché era carino e non si leggeva.
> ⭐ **Il 01/09 è nato il primo schermo riservato al coach: il REPORT SETTIMANALE**
> (§9-vicies, BACKLOG #27), e lo stesso giorno il **report del SINGOLO ATLETA**
> (`/report/:id`, §9-vicies-bis), che è quello su cui si scrive l'allenamento
> successivo: le sedute una per una, i **movimenti con i carichi usati** — che
> nell'app non esistevano da nessuna parte — e indicazioni su cosa fare, ognuna
> con accanto il numero da cui esce. Tutto su tabelle esistenti, senza una
> colonna nuova.
> ⭐ **Il 02/09 è nato anche l'AMBIENTE DI PROVA** (§9-quinvicies): `npm run demo`
> fa girare l'app intera su un Supabase finto in memoria. È la prima volta che si
> può usare FLEOFIT senza toccare il database di produzione.
> ⭐ **Il 02/09 è nato il MODELLO PREDITTIVO DEL CARICO** (§9-quatervicies,
> `src/lib/previsione.js`): il builder dice quanto **pesa** la seduta che si sta
> scrivendo, e il foglio di assegnazione dice — atleta per atleta — cosa succede al
> suo carico se gliela si dà. 🔴 Ci convivono **due scale**, ed è la prima cosa da
> leggere: i due stimatori di durata del progetto differiscono dell'**89%** su un
> «For Time», quindi ogni carico va confrontato solo con un paragone misurato allo
> stesso modo.
> ⭐ **Il 02/09 il tasto «indietro» è diventato uno solo** (§9-tervicies, `src/useIndietro.js`):
> tre pagine avevano una **destinazione fissa** che ignorava da dove si veniva — si apriva un
> atleta dai feedback della Home coach e si finiva nella rubrica — e i `navigate(-1)` non
> facevano niente quando la pagina era la prima della sessione (notifica push, deep link).
> Insieme: la **tab bar non impila più** (`replace`) e la scheda che navigava a sé stessa
> cambiando `athlete_id` non lascia più una voce di history a ogni atleta guardato.
> ⭐ **Il 01/09 anche le IMPOSTAZIONI sono state rifatte** (§9-duoetvicies): l'eroe è
> l'account con lo stato del dispositivo, gli acceso/spento sono interruttori con
> `aria-checked`, i codici invito scendono a una riga con il numero, e il banner giallo
> «Operazione in corso» lascia il posto allo stato dentro la riga che l'ha causato.
> ⭐ **Il 04/09 è stato rifatto l'ACCESSO** (§9-septvicies, artboard `Login.dc.html` 1b): il
> bivio «Accedi / Nuovo Utente» è sparito — chiedeva all'utente una cosa che l'utente non sa —
> e al suo posto c'è una colonna sola di modi per entrare. Il codice invito non è più una porta
> davanti alla casa: è la domanda del passo 2, e la si fa solo a chi serve. 🔴 Il vicolo cieco
> vero stava in `App.jsx`: chi entrava con Apple o Google senza profilo — il caso NORMALE di un
> nuovo invitato — riceveva «Accesso Negato» e il codice non gli veniva mai chiesto.
> > Dieci schermate rifatte su design di Claude Design (la **Home atleta** due volte: il
> 26/08 la pagina, il 09/09 i suoi stati vuoti): **Home atleta** il 26/08 (§9-octies),
> **Home coach** il 27/08 (§9-nonies) con la **pausa atleta** (§9-decies), **Crea Workout**
> il 27/08 (§9-undecies), la **scheda del workout** (§9-duodecies) e la **scheda atleta**
> (§9-terdecies) il 28/08, l'**archivio** (§9-sedecies), la **rubrica atleti**
> (§9-septdecies) e il **calendario** (§9-octodecies) il 31/08, le **impostazioni**
> (§9-duoetvicies) il 01/09. Il 28/08 anche il
> foglio **«Genera con IA»** (§9-quindecies),
> che è dove l'entrata mancante di BACKLOG #34 si è vista per la seconda volta.
> Il 31/08 anche l'**attesa fra una pagina e l'altra** (§9-noviesdecies): la scheda
> workout scende da 480 a **68 KB** (**82 KB** dal 01/09 con la grafica da storia), e lì
> sta la spiegazione del perché fra due pagine NON lampeggia niente — la pagina vecchia
> resta immobile — che leggendo il codice si sbaglia in due modi diversi.
> Build **1.1.0 (3)** in revisione su App Store Connect dal 24/08/2026, dopo il rifiuto di
> maggio. ✅ **Il 26/08 la causa di quel rifiuto è stata chiusa e verificata dai due lati**:
> `aps-environment = production` e le 5 email admin nell'`.ipa` spedito, e `demo@fleofit.it`
> che assegna davvero un workout dall'app. Dettagli in §9-ter.

---
