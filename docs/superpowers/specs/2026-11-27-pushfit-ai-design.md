# PUSHFIT AI — coach-led + IA per chi si iscrive dallo Store — design

Data: 27/11/2026 · stato: **in revisione dal committente** · branch: `pushfit-ai` (da `app`, `95a3772`)
Nessun codice e nessuna migrazione in produzione: lo schema è congelato (CLAUDE.md §0, 0-bis).
Ogni tabella del §11 richiede un sì esplicito, e si prova **prima su un database di staging** (§12).

> Questo design **sostituisce** l'impostazione di `2026-10-26-programmazione-ia-design.md`
> (coach che approva ogni settimana) e ne **riusa** i pezzi tecnici: validatore, riassunto
> dei feedback fatto dal codice, banco di prova, rilascio a interruttore. Dove qui non si
> dice diversamente, vale quella spec.

---

## 1. Intento

PUSHFIT cambia direzione: da strumento del coach per i suoi atleti a **app in abbonamento
per chiunque la trovi sullo Store**, che riceve un piano Hyrox personale scritto dall'IA
**sulla base del lavoro di un team di coach PUSHFIT**, e che si riaggiusta dopo ogni
allenamento.

«Coach-led + IA» vuol dire: **ogni seduta che l'utente riceve nasce da materiale scritto da
un coach** (un programma, un workout, una regola); l'IA lo sceglie, lo adatta alla persona
e lo ricalibra. Non inventa da zero se non quando nessun programma del team si avvicina, e
anche allora dentro le regole del team.

**Riuscito quando:**
- un utente nuovo, in meno di 5 minuti dall'iscrizione, ha il piano della prima settimana;
- dopo ogni seduta vede che il piano ha tenuto conto di com'è andata («RPE 9 dove ne
  aspettavamo 7: la seduta di giovedì è più leggera»);
- ogni 4 settimane vede un progresso misurato (il test);
- il costo dell'IA resta sotto il **10% del ricavo netto** per utente pagante (§9).

## 2. Decisioni del committente (27/11/2026)

| # | Decisione |
|---|---|
| D1 | Chi si iscrive è **uno sconosciuto dallo Store che paga un abbonamento** |
| D2 | I coach sono un **team PUSHFIT interno**, non pagati, **dietro le quinte**: l'utente vede PUSHFIT, non il coach |
| D3 | Il team scrive **workout, programmi di più settimane e metodo/regole**; l'IA impara da tutti e tre |
| D4 | Al lancio **solo Hyrox**, con corsa e palestra come parti del piano Hyrox. Altri sport dopo |
| D5 | Questionario come al §4 (11 domande), approvato così |
| D6 | Senza gara: **cicli di 8 settimane**, poi l'app propone una gara |
| D7 | Dopo l'allenamento l'utente compila il **minimo (opzione A)**: RPE e nota. Più un tocco sui carichi, i dati automatici e un test ogni 4 settimane (§6.2) |
| D8 | Il prezzo lo propone questo design, con i margini (§10) |
| D9 | Motore: **programmi del team adattati dall'IA (1)**, con lo **scheletro + regole (2) come rete di sicurezza** (§5) |
| D10 | Lo sviluppo si fa sul branch `pushfit-ai` |
| D11 | Modelli: **Claude Sonnet 5.5** per piano, revisione e rete di sicurezza; **Claude Haiku 5.5** per l'analisi dopo la seduta. Il modello di ogni compito è una configurazione (secret `PIANO_IA_MODELLO_<COMPITO>`), cambiabile senza aggiornare l'app, dopo una prova sul banco (§8.4) |

Scelte fatte in questo design (correggibili, segnate «proposta»): registrazione aperta,
nessuna approvazione umana del singolo piano, admin che approva le regole del team,
libreria IA scelta a mano, modelli e prezzo.

## 3. Obiettivi, non obiettivi, anti-obiettivi

**Obiettivi**
- Iscrizione libera, prova gratuita, abbonamento dagli Store.
- Questionario → piano personale → adattamento dopo ogni seduta e ogni settimana.
- Strumenti per il team: segnare i workout buoni, scrivere programmi base, scrivere regole.
- Costi dell'IA misurati per utente, con tetti.

**Non obiettivi (adesso)**
- Altri sport (corsa da sola, palestra da sola, ciclismo…): il formato li prevede, non li costruisce.
- Chat libera con l'IA («coach virtuale» che risponde a tutto).
- Addestrare un modello nostro (fine-tuning): §8.3.
- Il coach umano che segue un singolo utente a pagamento (possibile «premium» futuro).

**Anti-obiettivi** — sarebbe un fallimento anche se funziona tecnicamente:
- un piano che fa male a qualcuno: progressioni eccessive, ignorare un dolore dichiarato;
- un'IA che scrive sedute che nessun coach del team firmerebbe (lo stile PUSHFIT si perde);
- un costo per utente che cresce con l'uso fino a mangiarsi l'abbonamento;
- rompere l'app di oggi: atleti e coach attuali, web e Store, devono continuare a funzionare.

## 4. Il questionario (D5)

Circa 3 minuti, subito dopo l'iscrizione e prima del paywall (il piano si genera durante la
prova gratuita: l'utente vede cosa compra). Si può rifare da Profilo → «Cambia obiettivo».

| # | Domanda | Cosa cambia nel piano |
|---|---|---|
| 1 | **Obiettivo**: prima Hyrox da finire · migliorare il tempo · allenarmi stile Hyrox senza gara | tipo di progressione, famiglia di programma |
| 2 | **Gara**: dal calendario Hyrox (`gare-hyrox`, già nell'app) oppure «non ancora» | durata del piano, scarico e tapering |
| 3 | **Categoria**: Open/Pro · singolo/doppio/staffetta · uomo/donna | pesi delle stazioni |
| 4 | **Tempo obiettivo** (facoltativo) · **ultimo tempo Hyrox** se ne ha fatta una | intensità e ritmi |
| 5 | **Corsa**: tempo recente sui 5 km, oppure «non so» | zone di passo (con «non so» si parte prudenti e si tara al primo test) |
| 6 | **Esperienza**: da quanto si allena, cosa fa oggi | volume iniziale |
| 7 | **Stazioni deboli**: scelta multipla fra le 8 | dove insistere |
| 8 | **Disponibilità**: sedute/settimana (2–6), giorni possibili, minuti per seduta | struttura della settimana |
| 9 | **Attrezzatura**: palestra Hyrox completa · palestra normale · casa; spunte SkiErg, Rower, slitta, wall ball | sostituzioni degli esercizi |
| 10 | **Dati fisici**: età, sesso, peso | carichi prudenti |
| 11 | **Dolori o infortuni** ⚠️ (solo con consenso salute separato) | esercizi esclusi, oppure stop |

Regole:
1. **Età minima 18 anni** (proposta): sotto, niente piano.
2. **Domande di sicurezza** prima della 11 (proposta, stile PAR-Q): dolore al petto, svenimenti,
   problemi cardiaci noti, gravidanza, intervento recente. Un sì → niente piano automatico,
   messaggio «parlane con il medico prima di iniziare», possibilità di riprendere dopo.
3. **Senza consenso salute la domanda 11 non c'è**: l'utente può comunque escludere esercizi
   a mano («non posso fare: salti, corsa…»), che non è un dato sanitario.
4. **Un campo mancante non si inventa** (CLAUDE.md §9): è «non dichiarato» e vale il valore prudente.
5. All'IA il profilo arriva **pseudonimizzato** (niente nome, email, id; età in fascia).

## 5. Il motore del piano (D9)

### 5.1 Il materiale del team

| Strato | Cosa | Chi lo scrive | Dove |
|---|---|---|---|
| **Workout della libreria IA** | workout di oggi, nel formato `sections` (§5 di CLAUDE.md), con etichette: livello (principiante/intermedio/avanzato), fase (base/costruzione/specifico/scarico/gara), focus (corsa, stazioni, forza, motore), attrezzatura minima | coach del team | flag + etichette su un workout esistente |
| **Programmi base** | sequenza di settimane × sedute, ogni seduta = un workout della libreria (o un «posto» con focus e durata), con fase e minuti per settimana | coach del team | tabella `programmi_base` |
| **Regole del metodo** | frasi brevi e, dove possibile, numeri: «scarico ogni 4 settimane al −30%», «mai due sedute dure di fila», «progressione max +10% minuti/settimana», «tapering 10 giorni» | coach del team, **attive solo dopo l'ok di un admin** (proposta) | tabella `regole_metodo` |

**Partire dall'archivio di oggi** (richiesta del committente, «non tutti»): niente entra in
automatico. Una schermata coach «Libreria IA» elenca i workout dell'archivio con filtri e
un interruttore «Includi» + etichette. I workout di test restano fuori perché nessuno li
include. Aiuto (proposta): l'app **suggerisce** le etichette (categoria, durata da
`stimaWorkout`, blocchi) e nasconde in fondo i candidati probabili a test (titolo con
«test»/«prova», mai assegnati, autore `demo@fleofit.it`).

**Programmi base al lancio** (proposta, da confermare col team): 6–8, per esempio
- Prima Hyrox · 12 settimane · 3 sedute e 4 sedute
- Migliorare il tempo · 12 settimane · 4 e 5 sedute
- Ciclo senza gara · 8 settimane · 3 e 4 sedute
- Scarico/ripresa dopo la gara · 2 settimane

### 5.2 Il flusso (approccio 1)

```
Questionario ─► SCELTA DEL PROGRAMMA (codice)
                 famiglia (obiettivo) · sedute/settimana · livello · settimane alla gara
                 punteggio di somiglianza ── sotto soglia ──► rete di sicurezza (5.3)
                          │
                          ▼
                 ADATTAMENTO (IA, modello forte)
                 date e giorni · carichi per categoria/sesso · sostituzioni per attrezzatura
                 · volume per esperienza · più lavoro sulle stazioni deboli
                 · settimane tolte o ripetute per far tornare la gara
                          │
                          ▼
                 VALIDATORE (codice) ─ errore ─► 1 rifacimento ─ errore ─► seduta originale del team
                          │
                          ▼
                 workout veri + athlete_workouts assegnati all'utente (calendario di oggi)
```

- **Il codice sceglie, l'IA adatta.** Lo stesso programma non va riscritto: l'IA restituisce
  le **differenze** rispetto alla seduta del team (esercizio sostituito, numeri cambiati,
  seduta spostata), non la seduta intera. Meno token, meno errori, stile del coach intatto.
- **Le settimane si generano due alla volta** (quella in corso + la prossima). Il resto del
  piano è lo scheletro del programma: visibile all'utente come percorso, scritto più tardi.
- Le sedute sono **workout normali assegnati**: scheda, timer, TV, PDF, Garmin e app vecchie
  funzionano senza modifiche.

### 5.3 La rete di sicurezza (approccio 2)

Quando nessun programma supera la soglia (es. 6 sedute a settimana con solo 30 minuti,
gara fra 5 settimane): l'IA propone uno **scheletro** (fasi, minuti per settimana) dentro le
regole del metodo, il codice lo verifica, e ogni seduta viene **scritta prendendo come esempi
i workout più vicini della libreria IA** (stesso focus, fase, livello). È più cara (§9) e la
si misura: se più del ~20% degli utenti ci finisce, mancano programmi base, e lo si dice al team.

### 5.4 Il validatore (codice, non IA)

Riusa quello che c'è e la lezione di «Dalle note» (`validaEstrazione`):
- formato: `preparaBlocchiIA` / `preparaFasiIA` di `src/lib/blocchiIA.js`, nomi del picker
  (`src/lib/esercizi.js`), gym con `src/lib/gym.js`;
- durata entro ±15% dei minuti previsti (`durataBlocco`/`stimaWorkout`, uno stimatore solo);
- regole numeriche del metodo: progressione, scarichi, giorni duri non consecutivi;
- attrezzatura dichiarata, esercizi esclusi, vincoli di salute: **100%, mai deroghe**.

Una seduta che fallisce due volte torna alla **versione del team senza adattamento**: sempre
qualcosa di firmato da un coach, mai un buco nel calendario.

## 6. L'adattamento

### 6.1 Tre ritmi

| Quando | Cosa | Modello | Cosa può cambiare |
|---|---|---|---|
| **Dopo ogni seduta** | analisi leggera | economico (§8) | solo le 1–2 sedute successive: volume ±, una sostituzione, scambio di giorno. Una riga all'utente sul perché |
| **Ogni settimana** (domenica notte, in batch) | revisione della settimana dopo, guardando 2–4 settimane | forte, in batch | la settimana intera dentro lo scheletro |
| **Cambio di obiettivo / gara / infortunio** | piano rifatto dalla settimana dopo | forte | lo scheletro; le settimane passate non si toccano |

### 6.2 I dati che entrano (D7)

Li riassume **il codice**, all'IA arrivano numeri e frasi brevi (meno token, meno dati personali):
- fatto / saltato / spostato; aderenza a 7 e 28 giorni;
- **RPE dichiarato contro RPE previsto** (`rpeDichiarato`, **mai** `parseNotesAndRpe`);
- gradimento (`gradimento.js`), «Come stai oggi» (`come_stai`);
- **un tocco sui carichi**: «Hai usato i chili indicati? Sì · Meno · Di più» (nuovo, un secondo);
- automatici: corsa da Garmin (`garmin_attivita`) se collegato, durata reale dei For Time dal timer guidato;
- **test ogni 4 settimane** già nel piano (es. 1 km di corsa + 1000 m SkiErg): l'unica seduta
  che chiede un numero. Ricalibra zone e ritmi e dà all'utente il progresso;
- la nota scritta: passa all'IA solo nell'analisi della seduta, accorciata, senza nomi.

Senza `workout_results` (BACKLOG #25) i tempi del test stanno in una tabella piccola nuova
(`test_utente`, §11): non nelle note.

### 6.3 Allarmi (codice)

Come nella spec di ottobre (§6.4), ma senza coach: «Come stai» molto basso 2 giorni, due
sedute saltate, RPE ≥ 9 dove atteso ≤ 7, parole di dolore nella nota. Allora: la prossima
seduta diventa più leggera o di recupero, e con parole di dolore l'app **chiede**
(«Hai dolore? Dove?») e, se sì, toglie gli esercizi che lo caricano e suggerisce di fermarsi
e sentire un medico se persiste. Mai una diagnosi.

## 7. L'utente e l'app

### 7.1 Iscrizione e ruoli
- **Registrazione aperta** (proposta): Sign in with Apple, Google, email. Il codice d'invito
  resta per gli atleti dei coach di oggi.
- Nuovo tipo di utente: **iscritto PUSHFIT**. Tecnicamente è un `athlete` collegato a un
  coach di sistema «PUSHFIT» (riga in `staff` + `coach_atleti`), così RLS, `vedo_workout`,
  calendario e scheda funzionano come oggi. I workout generati hanno `creato_da` = il coach
  di sistema.
- Gli atleti di Federico e degli altri coach **restano come sono**: il piano IA si accende
  solo per gli iscritti PUSHFIT (interruttore `funzioni_app`, riga `piano_ia`).

### 7.2 Le schermate nuove (solo lato utente, mobile)
1. Questionario (11 passi, uno per schermo).
2. «Il tuo piano»: percorso a settimane (fasi, gara, test), la settimana in corso.
3. Dopo il completamento: la riga «cosa cambia» e il tocco sui carichi.
4. Paywall e gestione abbonamento.
5. Profilo → «Cambia obiettivo».

Le schermate di oggi (Home atleta, calendario, scheda, timer) si usano così come sono.

### 7.3 Strumenti del team (coach, anche desktop)
1. «Libreria IA» (§5.1): includi/escludi, etichette.
2. «Programmi base»: settimane × sedute, trascinando workout della libreria.
3. «Regole del metodo»: proposta del coach → ok dell'admin.
4. «Qualità» (admin): costo IA per utente, quota rete di sicurezza, sedute tornate alla
   versione del team, test medi, abbandoni.

### 7.4 Abbonamento
- Acquisti in-app **Apple e Google** (obbligatori per un servizio digitale, App Store 3.1.1).
  Proposta: **RevenueCat** (gratis fino a 2.500 $/mese di ricavi, poi 1%) per non scrivere due
  integrazioni e avere lo stato dell'abbonamento in un posto; in alternativa StoreKit 2 +
  Play Billing a mano con una Edge Function che verifica le ricevute.
- Web: per ora **niente vendita dal sito** (proposta): il sito resta la web app di oggi.

## 8. Quali IA

### 8.1 Il compito di ciascuna

| Compito | Frequenza | Requisito | Modello proposto | Riserva |
|---|---|---|---|---|
| Adattamento del programma all'iscrizione | 1 per utente + cambi obiettivo | qualità alta, l'utente aspetta (≤ 60 s) | **Claude Sonnet 5.5** | Claude Opus 5.5 su rifiuto/errore; Gemini Flash a pagamento se Anthropic non risponde |
| Rete di sicurezza (scheletro + sedute) | ~20% degli utenti | qualità alta | **Claude Sonnet 5.5** | come sopra |
| Revisione settimanale | 1 per utente a settimana | qualità alta, nessuna fretta | **Claude Sonnet 5.5 in Batch** (−50%) | Sonnet senza batch |
| Analisi dopo la seduta | ~4 per utente a settimana | veloce, economica, formato rigido | **Claude Haiku 5.5** | Groq `gpt-oss-120b` (già in uso, Zero Data Retention) |
| Lettura della nota (dolore, umore) | dentro l'analisi | — | Haiku 5.5, stessa chiamata | — |

Perché questa scelta (prezzi Anthropic di listino, novembre 2026, per milione di token):

| Modello | Ingresso | Uscita | Lettura dalla cache |
|---|---|---|---|
| Claude Haiku 5.5 | 0,10 $ | 0,50 $ | — |
| Claude Sonnet 5.5 | 2 $ | 10 $ | 0,10 $ |
| Claude Opus 5.5 | 4 $ | 20 $ | 0,20 $ |
| Batch | −50% su tutto | | |

- **Haiku 5.5** costa quanto o meno di Groq ed è dello stesso fornitore del modello forte: un
  solo contratto, una sola informativa privacy, un solo formato di risposta strutturata.
- **Sonnet 5.5** basta per adattare un programma già scritto; **Opus** costa il doppio ed è
  la riserva, non la norma.
- **Gemini gratuito mai**: usa i dati e ha 20 richieste al giorno. Oggi `ai-workout` lo usa
  come prima scelta: per il piano IA si usa una **Edge Function nuova** (`piano-ia`), e
  `ai-workout` non cambia.
- I prezzi di Gemini e Groq si riverificano nella fase 0; quelli della spec di ottobre
  (Gemini 3.x Flash raddoppiato da gennaio 2027) vanno considerati scaduti.
- **La scelta definitiva la fa il banco di prova** (§8.2), non questa tabella: vince il più
  economico che supera la soglia, compito per compito.

Accorgimenti di costo che valgono comunque:
- **cache del prompt**: regole del metodo e istruzioni di formato in testa, identiche per tutti
  gli utenti → lette dalla cache a un decimo del prezzo;
- **risposte a differenze** (§5.2), non sedute intere;
- **risposta strutturata** (JSON con schema) per tutto: niente rifacimenti per formato rotto;
- **tetti per utente al mese** (proposta): 3 rifacimenti del piano, analisi solo per sedute
  completate, oltre il tetto l'analisi passa a sole regole di codice.

### 8.2 Banco di prova (fase 0)
Come `tools/prova-estrai-note/`: **30 utenti inventati** (mai dati veri), che coprono i
programmi base, la rete di sicurezza, «non so il mio 5 km», attrezzatura da casa, gara fra
5 settimane, un dolore dichiarato, feedback «troppo duro» e «troppo facile» per 3 settimane.
Per ogni modello candidato:
- controlli automatici del validatore (salute **100%**, il resto ≥ 95%);
- giudizio alla cieca di 2 coach del team: «la firmerei / con piccole correzioni / la rifarei»
  — soglia ≥ 80% senza «la rifarei»;
- token e tempo misurati → i costi veri del §9 sostituiscono le stime.

### 8.4 Cambiare modello un giorno
- **Dentro Anthropic** (es. Haiku → un Haiku nuovo, Sonnet → Opus per la revisione): si cambia il secret `PIANO_IA_MODELLO_<COMPITO>` della Edge Function. Minuti, nessun aggiornamento dell'app sugli Store.
- **Un altro fornitore** (OpenAI, Mistral, Google): si aggiunge la sua funzione di richiesta accanto a quella di Claude (le istruzioni e lo schema delle differenze restano gli stessi) e un ramo in `fornitoreDi`. Circa un giorno di lavoro.
- **Prima di ogni cambio**: giro del banco di prova sul modello nuovo (stesse soglie del §8.2, costo pochi dollari) e confronto con quello attuale.
- **Poi gradualmente**: una quota di utenti sul modello nuovo, confrontando in `uso_ia` e `piano_sedute.modello` costo, sedute tornate alla versione del team e allarmi. Tornare indietro = rimettere il secret di prima.
- Si salva sempre **quale modello** ha scritto ogni seduta, così ogni confronto si fa sui dati.

### 8.3 Fine-tuning: no
Le regole del team devono valere subito; un coach scrive decine di workout, non migliaia;
legherebbe a un fornitore. Si riconsidera con migliaia di settimane completate e buone.

## 9. Chiamate e costi

### 9.1 Ipotesi per utente pagante (da confermare in fase 0)
- 4 sedute a settimana → **~17 sedute al mese**;
- adattamento all'iscrizione: ~30k token in ingresso (20k in cache), ~12k in uscita (ragionamento compreso);
- revisione settimanale: ~25k in ingresso (15k in cache), ~8k in uscita, ×4,3 al mese, +20% rifacimenti;
- analisi dopo la seduta: ~6k in ingresso, ~1,5k in uscita (Haiku);
- piano rifatto ogni ~2 mesi (cambio obiettivo, fine ciclo);
- rete di sicurezza per il 20% degli utenti: sedute scritte da zero, ~2,5× i token della revisione.

### 9.2 Costo IA per utente al mese

| Voce | Calcolo (arrotondato) | $/mese |
|---|---|---|
| Adattamento all'iscrizione / rifacimento (1 ogni 2 mesi) | (10k×2 + 20k×0,1 + 12k×10)/1M ≈ 0,14 $ ÷ 2 | 0,07 |
| Revisione settimanale, batch | (10k×2 + 15k×0,1 + 8k×10)/1M ≈ 0,10 $ × 50% × 4,3 × 1,2 | 0,26 |
| Rete di sicurezza (20% degli utenti, ×2,5 sulla revisione) | 0,26 × 1,5 × 20% | 0,08 |
| Analisi dopo la seduta, Haiku | (6k×0,1 + 1,5k×0,5)/1M ≈ 0,0014 $ × 17 | 0,02 |
| **Totale previsto** | | **≈ 0,45 $ ≈ 0,42 €** |
| Caso peggiore (niente batch, niente cache, tutti in rete di sicurezza, tetti al massimo) | | ≈ 2 $ ≈ 1,85 € |

Più il costo di chi **prova e non paga**: un adattamento iniziale e due settimane ≈ 0,15 $
per prova. Con 1 pagante ogni 4 prove: ≈ 0,60 $ per pagante acquisito, una volta sola.

### 9.3 Chiamate al giorno

| | 100 abbonati | 1.000 abbonati | 10.000 abbonati |
|---|---|---|---|
| Analisi dopo la seduta (Haiku) | ~60 | ~570 | ~5.700 |
| Revisioni settimanali (Sonnet batch, tutte la domenica notte) | ~100 a settimana | ~1.000 a settimana | ~10.000 a settimana |
| Iscrizioni e rifacimenti (Sonnet) | ~3 | ~25 | ~250 |
| **Totale medio** | **~80/giorno** | **~750/giorno** | **~7.500/giorno** |
| Punta | — | ~50/ora la sera | ~500/ora la sera (18–22) |
| Costo IA al mese (previsto) | ~45 $ | ~450 $ | ~4.500 $ |
| Costo IA al mese (peggiore) | ~200 $ | ~2.000 $ | ~20.000 $ |

Note di scala:
- a 10.000 abbonati la punta serale di analisi (~500/ora, ~8 al minuto) è ben dentro i limiti
  di un account Anthropic di livello medio; le revisioni in batch non pesano sui limiti;
- le Edge Function Supabase reggono questi numeri; il collo di bottiglia probabile è il
  database alla domenica notte (10.000 settimane scritte): si distribuisce la scrittura
  sulla notte;
- un modello locale (Mac Studio o GPU in affitto, spec di ottobre §7.2) inizia a convenire solo
  oltre ~5.000–10.000 abbonati e solo per il batch: non è una scelta del lancio.

## 10. Prezzo e margini (D8)

### 10.1 Proposta
- **14,99 €/mese** o **99,99 €/anno** (≈ 8,33 €/mese, −44%), **7 giorni di prova gratuita**.
- Riferimenti di mercato: le app di piani personalizzati per la corsa e il fitness stanno fra
  10 e 20 €/mese, con l'annuale fra 60 e 120 €. Hyrox è una nicchia con gente disposta a pagare
  (iscrizione a una gara 100–150 €): 14,99 sta nel mezzo, sotto un coach umano (60–150 €/mese).

### 10.2 Dal prezzo al netto
- IVA italiana 22% già dentro il prezzo: 14,99 → 12,29 €; 99,99 → 81,96 €.
- Commissione Store **15%** (programmi Small Business di Apple e Google, sotto 1 M$/anno; sugli
  abbonamenti, dopo il primo anno, 15% comunque) → **10,44 €/mese** dal mensile,
  **5,81 €/mese** dall'annuale.
- Mix ipotizzato 60% mensile / 40% annuale → **ricavo netto medio ≈ 8,59 € per abbonato al mese**.
- RevenueCat: 1% oltre 2.500 $/mese (trascurabile, incluso sotto).

### 10.3 Margine sui costi variabili e fissi

| | 100 abbonati | 1.000 abbonati | 10.000 abbonati |
|---|---|---|---|
| Ricavo netto/mese | 859 € | 8.590 € | 85.900 € |
| IA prevista (0,42 €) | 42 € | 420 € | 4.200 € |
| Prove non convertite (0,55 € per pagante acquisito, ~10% nuovi al mese) | 6 € | 55 € | 550 € |
| Supabase (Pro + compute) · Vercel · RevenueCat · email | ~60 € | ~250 € | ~1.800 € |
| Account sviluppatore Apple/Google (ripartiti) | ~10 € | ~10 € | ~10 € |
| **Margine** | **~741 € (86%)** | **~7.855 € (91%)** | **~79.340 € (92%)** |
| Margine con IA al caso peggiore (1,85 €) | ~70% | ~75% | ~76% |

Esclusi: marketing e acquisizione (il costo vero di un'app B2C), assistenza, il tempo del
team, tasse sul reddito. **L'IA non è il problema del margine**: lo sono l'acquisizione e la
conversione dalla prova. Il contatore `uso_ia` (§11) serve a vederlo subito se cambia.

## 11. Migrazioni proposte (NON applicate)

Tutte **additive**; ognuna con un sì esplicito, prima su staging (§12). RLS sulle funzioni del
multi-coach (`e_admin()`, `e_staff()`, `mio_atleta()`).

| Tabella / modifica | Cosa | RLS (proposta) |
|---|---|---|
| `libreria_ia` | `workout_id`, `incluso`, `livello`, `fase`, `focus[]`, `attrezzatura_min`, `incluso_da`, `incluso_at` | staff legge e scrive; utenti no |
| `programmi_base` | `id`, `nome`, `famiglia` (prima_gara/migliorare/senza_gara/ripresa), `settimane`, `sedute_settimana`, `livello`, `struttura` jsonb (settimane × sedute → `workout_id` o posto), `stato` (bozza/attivo), `autore` | staff |
| `regole_metodo` | `id`, `testo`, `parametri` jsonb (i numeri che legge il validatore), `stato` (proposta/attiva/scartata), `autore`, `approvata_da` | staff legge; scrive l'autore; attiva solo admin |
| `questionario_utente` | `athlete_id`, `versione`, `risposte` jsonb, `creato_at` | l'utente le sue; staff legge |
| `salute_utente` | `athlete_id`, `testo`, `esclusioni`, `consenso_id`, `aggiornato_at` (separata per cancellarla da sola) | l'utente; staff legge solo se serve (proposta: solo admin) |
| `piani` | `id`, `athlete_id`, `programma_id` (null = rete di sicurezza), `gara`, `inizio`, `fine`, `scheletro` jsonb, `versione_questionario`, `stato` | l'utente legge il suo; staff legge |
| `piano_sedute` | `piano_id`, `settimana`, `giorno`, `workout_id`, `origine` (team/adattata/rete/ripiego), `perche`, `modello` | come `piani` |
| `analisi_sedute` | `athlete_workout_id`, `carichi` (si/meno/piu), `riassunto`, `modifiche` jsonb, `modello`, `creato_at` | l'utente legge la sua; staff |
| `test_utente` | `athlete_id`, `data`, `prova` (es. `1km_corsa`, `1000m_skierg`), `tempo_s` | l'utente; staff |
| `abbonamenti` | `athlete_id`, `stato`, `prodotto`, `scade_at`, `store`, `aggiornato_at` — la scrive solo il webhook | l'utente legge il suo; admin |
| `uso_ia` | `athlete_id`, `quando`, `funzione`, `modello`, `token_in`, `token_in_cache`, `token_out`, `costo_stimato` | solo admin; scrive la Edge Function |
| `funzioni_app` | riga `piano_ia` (spenta) | esistente |
| `staff` / `coach_atleti` | il coach di sistema «PUSHFIT» | esistente |

Fuori dallo schema, da approvare insieme: Edge Function `piano-ia` (iscrizione, settimana,
analisi) e `abbonamento-webhook`; due cron (revisione della domenica, allarmi del mattino);
consenso salute e **informativa privacy aggiornata** (la voce «Privacy in stand-by» del
BACKLOG si sblocca qui: è bloccante per la domanda 11); le tabelle nel backup notturno.

## 12. Dove si sviluppa e come si prova

- **Codice**: branch `pushfit-ai`. Non va su `app` né su `main` finché il committente non lo
  decide. ⚠️ Un push di `pushfit-ai` crea una preview Vercel: deve puntare allo **staging**,
  mai alla produzione.
- **Database**: un **secondo progetto Supabase di staging** (decisione del committente, piano
  gratuito: due progetti), con schema copiato dalla produzione (sola lettura) e **dati
  inventati**. Il database di produzione è uno solo e serve web, iOS e Android di oggi: qui
  non si prova niente.
- **Ambiente di prova** (`npm run demo:atleta`): le schermate nuove con risposte dell'IA già
  pronte nei semi, che passano dallo **stesso validatore**.
- **Test** (`npm test`): validatore, scelta del programma, riassunto dei feedback, allarmi,
  conti di `uso_ia` sono logica pura in `src/lib/`. Un test guardiano come `iaCategorie.test.js`:
  ogni sport futuro porta con sé le sue istruzioni di piano.
- **Store**: build di prova (TestFlight interno, Play test interno) contro lo staging; un
  controllo pre-archivio in più: l'URL dello staging non deve stare nel bundle di produzione.

## 13. Fasi

| Fase | Cosa | Esito |
|---|---|---|
| 0 | Staging · banco di prova (30 casi) · gara fra modelli · costi veri | modelli e costi confermati |
| 1 | Strumenti del team: Libreria IA, Programmi base, Regole · il team scrive i 6–8 programmi | materiale pronto |
| 2 | Iscrizione aperta · questionario · consenso salute · scelta + adattamento · validatore · «Il tuo piano» | il primo piano su staging |
| 3 | Analisi dopo la seduta · tocco sui carichi · test ogni 4 settimane · revisione settimanale in batch · allarmi | il ciclo che si riaggiusta |
| 4 | Abbonamento (RevenueCat), paywall, prova gratuita · «Qualità» per l'admin · tetti | si può vendere |
| 5 | Beta chiusa (TestFlight, 20–50 persone) · poi rilascio con l'interruttore | lancio |

## 14. Rischi noti

- **App Store**: un'app che dà piani di allenamento con dati di salute viene guardata con
  attenzione (1.4.1 sicurezza fisica, 5.1.1 privacy, 3.1.1 acquisti). Servono avvertenze
  chiare («non sostituisce il parere medico»), l'informativa, l'eliminazione dell'account (c'è).
- **Nome nello Store** «PUSHFIT: Training»: niente «Hyrox» nel nome (marchio registrato),
  come già deciso. Anche nei testi del paywall si parla di «gare di fitness racing / Hyrox»
  con prudenza.
- **Il team non è pagato**: il materiale dei programmi base è la dipendenza principale del
  lancio (fase 1). Senza almeno 6 programmi, quasi tutti finiscono nella rete di sicurezza.
- **Coesistenza**: la stessa app servirà atleti dei coach di oggi e iscritti PUSHFIT. La
  Home atleta va divisa fra i due casi senza romperne nessuno.

## 15. Lasciato a chi costruisce

- I nomi esatti delle colonne e la forma di `struttura` jsonb dei programmi base.
- Il punteggio di somiglianza e la sua soglia (si tara sul banco di prova).
- Le istruzioni di sistema per ogni compito, divise per sport come `CATEGORIE_IA`.
- L'interfaccia delle schermate nuove, nella grafica di oggi (DESIGN.md, palette invariata).
