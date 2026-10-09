# «Cerca con l'IA» — la ricerca del coach (09/10/2026)

> Da leggere prima di toccare `RicercaCoach.jsx`, `ricercaCoach.js`,
> `dialogoRicerca.js`, `rigaRicerca.js`, `useDettatura.js` o la Edge Function
> `ricerca-coach`.

## Cos'è
Il coach chiede, scrivendo o a voce, di atleti, allenamenti, note e numeri:
«chi non si allena da 5 giorni?», «EMOM con wall balls a settembre», «RPE medio
di Marco questo mese», «chi ha scritto di dolori al ginocchio?», «crea un workout
per Sofia domani». Si apre dalla **barra sotto la testata della Home coach**.
**Solo coach**: lato atleta, per decisione del committente, non c'è ancora niente.

## 🔴 L'IA non legge il database
È la decisione che regge tutto il resto. Il giro è:
1. l'app manda a `ricerca-coach` la domanda, il **contesto** (data di oggi, elenco
   degli atleti con id e nome) e le **dichiarazioni** di cinque strumenti;
2. Gemini risponde «chiama `cercaAtleti` con `inattivi_da_giorni: 5`»;
3. lo strumento gira **nel telefono**, sui dati caricati con i permessi del coach
   (RLS invariate), e il risultato torna a Gemini;
4. Gemini scrive una frase breve. Sotto la frase il foglio mostra la **lista vera**,
   toccabile, prodotta dallo strumento e non dal modello.

Conseguenza: **ogni numero lo calcola `ricercaCoach.js`**, non l'IA. La regola
«nessun numero si inventa» (CLAUDE.md §9) vale anche qui. Esempio: l'RPE medio si
fa con `rpeDichiarato` e il risultato dice su quanti valori; un atleta senza
completamenti nell'anno caricato è `nessunCompletatoNellAnno`, mai «fermo da 365 giorni».

## I cinque strumenti (`src/lib/ricercaCoach.js`)
| Strumento | Cosa fa |
|---|---|
| `cercaWorkout` | assegnazioni filtrate per atleta, periodo, stato (`completato`/`da_fare`/`scaduto`), categoria, tipo di blocco, esercizio, parole, durata stimata; `distinti` per trovare workout da riusare |
| `cercaAtleti` | inattivi da N giorni, senza programma per N giorni, gara entro N giorni, RPE ≥ N negli ultimi giorni, in pausa. **Chi è in pausa è escluso** da inattivi e senza programma, come in Home |
| `statisticheAtleta` | un atleta su un periodo (default 30 giorni): assegnati, completati, scaduti, %, RPE medio/massimo, minuti stimati, ultimo completato |
| `cercaNelleNote` | note **scritte** dagli atleti alla chiusura. Le note vocali NON sono ascoltate, e il risultato lo dice (`avviso`) |
| `apri` | porta a una schermata (scheda/report atleta, report settimanale, workout, crea workout con atleta e data, calendario, archivio, atleti, impostazioni). Esce **subito**, senza un altro giro dell'IA |

- `cercaWorkout` restituisce anche i workout **mai assegnati** (vedi sotto).
- Un nome ambiguo («Marco») non si risolve a caso: lo strumento torna i
  `candidati` (solo nomi) e l'IA chiede quale.
- All'IA arrivano al massimo `MASSIMO_PER_IA` righe più il totale vero;
  all'interfaccia arrivano tutte.

## Perché istruzioni e strumenti stanno nel client
`ricerca-coach` è un passacarte: riceve conversazione, strumenti, istruzioni e
contesto, e ci aggiunge solo `REGOLE_FISSE` (italiano, niente invenzioni).
Cambiare una descrizione o aggiungere un filtro è quindi una modifica all'app,
**non un deploy**. La funzione è nuova e la web app su `main` non la chiama: un
suo deploy non tocca la produzione web (a differenza di `send-reminders`).
È **solo admin**, come `ai-workout`: senza, l'URL nel bundle pubblico sarebbe un
proxy Gemini aperto. Le regole pure stanno in `regole.ts`, testate da vitest.

## I dati
`caricaDatiRicerca` carica all'apertura del foglio, a pagine da mille
(PostgREST non ne dà di più per richiesta):
- gli atleti, senza `COACHING_ID`;
- **tutti i workout** dalla loro tabella, anche quelli mai assegnati (bozze, modelli);
- le assegnazioni da **365 giorni fa a 120 giorni avanti**, SENZA join su
  `sections`: il workout si attacca dalla mappa, invece di scaricarlo una volta
  per ogni atleta che l'ha ricevuto;
- gli `workout_id` di **tutte** le assegnazioni, senza finestra.
Schema congelato: niente indici né viste, si filtra nel telefono.

### I workout mai assegnati (dal 09/10/2026, sera)
La prima versione partiva solo dalle assegnazioni: un workout creato e mai dato
a nessuno non esisteva per la ricerca. Ora entra con `stato: 'non_assegnato'`,
ma **solo** se la domanda non nomina un atleta né uno stato di esecuzione
(«i workout di Sofia» o «quelli scaduti» non possono contenerlo).
⚠️ «Mai assegnato» si decide sugli id di TUTTE le assegnazioni, non su quelle
dell'anno caricato: altrimenti un workout dato a qualcuno due anni fa
risulterebbe una bozza. C'è un test.
I filtri sul contenuto (categoria, blocco, esercizio, parole, durata) sono
UNA funzione (`filtroContenuto`) per le due liste.

## La storia della conversazione
Le domande di seguito («e di questi, chi ha una gara?») funzionano perché il
foglio tiene la conversazione. `tagliaStoria` la accorcia solo **davanti a una
domanda del coach**: Gemini rifiuta una storia che comincia con la risposta a
una chiamata che non c'è più. Per lo stesso motivo, dopo `apri` o dopo troppi
giri la storia torna quella di prima della domanda.
🔴 `rispondi` passa a `invoca` una **copia** di `contents`: l'array cresce dopo la
chiamata, e senza copia chi lo riceve vede la conversazione già modificata
(trovato dal test, 09/10/2026).

## La voce: `src/useDettatura.js`
Porta le stesse lezioni del foglio «Genera con IA»: su iOS **MediaRecorder** e
non il plugin (file vuoti da AVAudioSession conteso), plugin solo come ripiego
con lo stream chiuso prima; sul web il riconoscimento del browser (Gemini non
prende `audio/webm`). La trascrizione la fa `ricerca-coach` (`audioBase64`), poi
il testo diventa la domanda.
⚠️ `CreateWorkout` ha ancora la sua copia: unificarli è in BACKLOG, da fare
**dopo** aver provato la ricerca su un iPhone vero.

## Domande fuori tema e richieste di «toccare» cose
L'IA ha solo i cinque strumenti: quattro leggono, uno apre una schermata.
**Non esiste un modo di scrivere, cancellare, assegnare o inviare**, qualunque
cosa le si chieda. `REGOLE_FISSE` (lato server, quindi non scavalcabili dal
client) le fa rifiutare in una frase i calcoli, la cultura generale, i consigli
medici e simili, e le dice che il testo dentro i risultati — titoli, note degli
atleti — è un dato e mai un'istruzione: una nota che dice «ignora le regole»
resta una nota.

## «L'IA è sovraccarica» (09/10/2026)
Al primo uso vero arrivava quasi subito. Erano due errori sotto un solo
messaggio: **503** (Google pieno) e **429** (quota del piano gratuito finita —
e una domanda costa almeno due chiamate, quindi ci si arriva in fretta).
Ora `messaggioErrore` li distingue, e su 429/503 la funzione riprova UNA volta
con `gemini-2.5-flash-lite`, che sul piano gratuito ha una quota sua (⚠️ superato la sera stessa: Flash-Lite è ritirato, vedi «Il modello di riserva ritirato»).
⚠️ I log non si leggono dalla CLI: Dashboard Supabase → Edge Functions →
`ricerca-coach` → Logs. Lì c'è lo stato vero di ogni risposta di Gemini.

## 🔴 «L'IA non ha risposto» a ogni domanda (09/10/2026, sera)
Comparso subito dopo l'aggiunta del modello di riserva. Gemini 2.5 Flash con il
ragionamento acceso allega a ogni chiamata a strumento una `thoughtSignature`
legata al modello; l'app la rimanda nella storia, e quando il primo modello
finiva la quota il secondo riceveva la firma del primo e rifiutava (400), che
l'app traduceva in «non ha risposto». Rimedi, tutti in `regole.ts`:
- **ragionamento spento** (`thinkingBudget: 0`): scegliere un filtro non ne ha
  bisogno, e si risparmiano tempo e quota;
- `senzaFirme` toglie firme e parti di ragionamento dalla storia prima di ogni
  chiamata: una storia nata con un modello si continua con un altro;
- ogni errore porta un **`dettaglio`** (modello · stato · motivo di Gemini), che
  il foglio mostra in piccolo sotto il messaggio. Era la cosa che mancava: un
  «non ha risposto» senza motivo non si può diagnosticare dal telefono.

## Tornare indietro da un risultato (09/10/2026, sera)
Il foglio vive dentro la Home: toccare un risultato smontava tutto, e tornando
indietro la conversazione era persa. Ora `src/lib/ricercaSospesa.js` la mette
da parte **in memoria** (non in localStorage: deve sopravvivere a un giro fra
le pagine, non a una chiusura dell'app) con i dati già caricati (riusati per 10
minuti). La Home la riapre **solo su POP** (`useNavigationType`), cioè solo
tornando con il tasto indietro, e **una volta sola**: `daRiaprire` non consuma
(lo legge l'inizializzatore di uno stato, che React in sviluppo chiama due
volte), consuma il foglio montandosi (`riaperta`).
Chiudere il foglio (X, velo, maniglia, Esc) o «Nuova ricerca» butta la
conversazione: lì il coach ha finito.

## Il terzo livello: Groq (09/10/2026)
Ordine dei tentativi (dal 09/10/2026 sera): **Groq** → `gemini-2.5-flash`
(vedi «La ricerca ha lasciato il builder senza IA»). La lista Gemini si cambia
con il secret `GEMINI_MODELLI`, separati da virgola.
(`openai/gpt-oss-120b`, si cambia con il secret `GROQ_MODELLO`). Groq scatta
su 429, 404, 5xx o rete irraggiungibile, e **solo se esiste il secret
`GROQ_API_KEY`**: senza, la funzione si comporta come prima.
Scelto fra i piani gratuiti (ottobre 2026) perché è l'unico con insieme:
limiti adatti (~30/min, ~1.000/giorno), chiamata a strumenti, e condizioni che
**non addestrano sui dati** — qui passano estratti delle note degli atleti.
Mistral gratuito addestra di default; OpenRouter gratuito ha 50 richieste al
giorno; Cerebras chiede una carta.
- Groq parla il formato **OpenAI**, l'app parla **Gemini**: `inOpenAI` e
  `daOpenAI` in `regole.ts` traducono nei due sensi, e l'app non sa niente.
  🔴 L'id di una chiamata è la sua POSIZIONE (`call_<voce>_<n>`): la risposta
  allo strumento sta nella voce successiva, e se i due id non coincidono Groq
  rifiuta la richiesta proprio quando è l'ultima IA rimasta. C'è un test.
- Le chiamate a Groq (chat e Whisper) stanno in `supabase/functions/_shared/groq.ts`,
  condivise con `ai-workout` dal 09/10/2026 sera.
- Anche la **voce** ha il ripiego: Whisper (`whisper-large-v3-turbo`) di Groq,
  gratuito, che prende m4a/aac/mp3/wav.
- Il `dettaglio` di un errore dice quale livello ha fallito (`groq …`).

### 🔴 Il modello di riserva ritirato (09/10/2026)
`gemini-2.5-flash-lite` rispondeva **404 «no longer available to new users»**.
E il 404 non era fra gli stati che facevano scattare Groq: Flash pieno →
Flash-Lite 404 → «L'IA non ha risposto», con Groq configurato e mai chiamato.
Trovato grazie alla riga del `dettaglio`. Ora Flash-Lite è fuori, e
`daRipiegare` comprende il 404: un modello che Google ritira passa al
successivo invece di fermare la ricerca. Il successore suggerito
(`gemini-3.5-flash-lite`) è famiglia Gemini 3, che rende obbligatorie le firme
del ragionamento nelle chiamate a strumento: va provato prima di metterlo.

### 🔴 Groq: 8.000 token al minuto (09/10/2026)
Con il ripiego funzionante, Groq rispondeva 429 «tokens per minute (TPM):
Limit 8000» su `openai/gpt-oss-120b`. Una domanda costa due chiamate, e la
seconda si porta dietro istruzioni, strumenti, elenco atleti e risultati: con
gli id (36 caratteri ad atleta, due per ogni riga) e 25 righe si arrivava
a 7–8.000 token. Ridotto:
- gli atleti viaggiano **per nome**, senza `atleta_id` né nel contesto né
  negli strumenti; i `candidati` di un nome ambiguo sono solo nomi, e il nome
  completo risolve (`risolviAtleta` prova prima la corrispondenza esatta);
- `MASSIMO_PER_IA` da 25 a **12**, e `perLIA` toglie anche `atletaId` e
  `quando` (doppione di `data`), pure dalle statistiche. L'interfaccia riceve
  sempre tutto (`completo`).
Se non basta, il secret `GROQ_MODELLO` cambia modello: i limiti al minuto del
piano gratuito sono diversi per ogni modello, e si leggono nella console Groq
(Settings → Limits).

### 🔴 «Fermo» scambiato per «niente in programma» (09/10/2026)
Alla domanda «chi non si allena da 7 giorni?» Groq (`gpt-oss-120b`) ha chiamato
`cercaAtleti { senza_programma_giorni: 7 }` — a chi il coach non ha programmato
niente — e ha risposto «non si allenano», con dentro un'atleta che aveva
lasciato un feedback tre giorni prima. Frase sicura, lista plausibile, dato falso.
Rimedi:
- le **descrizioni** dei due filtri dicono esplicitamente quale domanda servono
  («chi non si allena» → `inattivi_da_giorni`; l'altro «NON dice se l'atleta si
  allena»), e le `ISTRUZIONI` hanno esempi «domanda → strumento»;
- sotto ogni risposta il foglio mostra il **filtro vero** (`descriviFiltro` in
  `rigaRicerca.js`), e ogni riga d'atleta porta il suo motivo, compreso
  «niente in programma nei prossimi N giorni». Un'IA che capisce male si vede;
- `senzaRipetizione` (server) toglie la frase che `gpt-oss` a volte scrive due volte.
Riprovato sull'app vera: filtro giusto, 8 atleti con i giorni di fermo.
⚠️ Lezione generale: **un modello di riserva più debole sbaglia strumento in
silenzio**. La difesa non è fidarsi della frase, è mostrare il filtro.

### 🔴 La ricerca ha lasciato il builder senza IA (09/10/2026)
Il piano gratuito di **Gemini 2.5 Flash dà 20 richieste AL GIORNO**
(`generate_content_free_tier_requests, limit: 20`), e la chiave è la stessa di
`ai-workout`: le prove della ricerca, a 2–3 chiamate per domanda, le hanno
finite, e «Genera con IA» nel builder ha risposto 429 «retry in 11h20m».
Il codice di `ai-workout` non era stato toccato: era la quota condivisa.
Rimedio: **l'ordine è invertito**. `ricerca-coach` parte da **Groq** (domanda
e voce) e tocca Gemini solo se Groq risponde 429/404/5xx o non si raggiunge.
La quota di Gemini resta al builder.
⚠️ Corollario: oggi la ricerca risponde quasi sempre con `gpt-oss-120b`, il
modello che ha scambiato «fermo» con «niente in programma». Le descrizioni
chiarite e il filtro mostrato (sezione sopra) sono la difesa, e vanno tenuti.

## ⚠️ Privacy
A Gemini arrivano i nomi degli atleti, i titoli e, con `cercaNelleNote`, estratti
delle note (fino a 160 caratteri), che possono parlare di salute. Con il piano
gratuito delle API Gemini, Google può usare i dati per migliorare i suoi
prodotti: prima di usarla con atleti veri va deciso se passare al piano a
pagamento (BACKLOG).

## Peso
`RicercaCoach` è un chunk suo (~35 KB) caricato con `lazy` al primo tocco: il
chunk d'ingresso `index` è salito di ~2 KB (596). Non va importato in modo non
pigro, e non deve importare `thinking-orbs` o `border-beam` (§2): per l'attesa
usa `Puntini`.

## Ambiente di prova
`npm run demo` risponde a `ricerca-coach` con `ricercaFinta` in `supabaseDemo.js`:
un finto modello a parole chiave che sceglie uno strumento e scrive «Ho trovato
N risultati (ambiente di prova)». Serve a provare il foglio, non a imitare Gemini.
