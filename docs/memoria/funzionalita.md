# Le funzionalità principali, per orientarsi

> Spostato da `CLAUDE.md` il 07/10/2026, **senza cambiare il testo**. I rimandi
> «§9-…» puntano a sezioni che ora stanno in altri file di questa cartella:
> si trovano con `grep -rn '^## 9-<nome>' docs/memoria`. L'indice è in `CLAUDE.md`.

## 7. Funzionalità principali (mappa per orientarsi)

### Atleta
- **Home**: saluto orario + frase motivazionale del giorno (persistita in localStorage con
  anti-ripetizione sulle ultime 10), banner countdown prossimo evento, **slider a 2 pagine**
  (settimana a pallini colorati per categoria/stato ↔ statistiche settimanali: tempo, completati,
  RPE medio), workout di oggi, prossimi allenamenti, scorciatoie, archivio.
- **Completamento workout** → apre la **modale RPE**: slider 1-10 draggabile + note.
  ⚠️ Il pulsante **🍏 Apple Health** è sparito il 21/09/2026 con tutto HealthKit: era il
  rilievo **2.5.1** di Apple, e rimetterlo respinge la build (§9-quatertricies).
- **Allenamento libero**: l'atleta crea un workout Custom autonomo con titolo, data e note.
- **Modalità Offline**: `@capacitor/network` rileva l'assenza di rete → banner arancione,
  le azioni finiscono in `localStorage.fleofit_offline_queue` e vengono sincronizzate al ritorno
  della linea. Cache read in `fleofit_cache_workouts_<uid>`, `fleofit_cache_w_<id>`, ecc.
- **Profilo** (`/profile` → `AthleteDetail`): tab Workout / PR / Statistiche, vista lista o
  calendario, link Instagram/Strava.

### Coach (admin)
- **Workout Builder** (`/create`), 2 step: (1) titolo+data+categoria → (2) composizione.
  - Blocchi Hyrox riordinabili con **drag&drop desktop + `useTouchDrag` su mobile**, duplicabili,
    con scroll-picker in stile iOS per tempi/rounds/kg/metri.
  - Builder Running con fasi warmup/run/recover/cooldown/**repeat** e range di passo "da–a".
  - **Genera con IA**: dettatura vocale o testo → Gemini → blocchi precompilati.
  - **Autosalvataggio bozza** in `localStorage.fleofit_workout_draft` + intercettazione
    dell'uscita di pagina (beforeunload, click sui link, blocco pull-to-refresh).
  - Salvando un workout esistente si può scegliere "sovrascrivi" o "salva come nuovo".
- **Gestione atleti**: rubrica, scheda con storico, nota per l'atleta, PR, statistiche (carico
  settimanale = tempo × RPE su 4 settimane, tasso di completamento a 30 giorni, distribuzione RPE).
- **Assegnazione**: multi-atleta con data, dall'archivio o dalla scheda workout → notifica push immediata.
- **Live Coach Cam**: Supabase **Presence** sul canale `global_live_workouts`; quando un atleta
  avvia il timer il coach lo vede in Home, può aprire lo spettatore (timer live via broadcast),
  mandare **reazioni emoji** (🔥💪🚀👏💀) e messaggi audio **walkie-talkie** (upload su
  `voice-notes`, broadcast dell'URL, auto-delete dopo 60s).
- **Settings**: notifiche push, backup/restore JSON, generazione codici invito + link
  `?invite=CODICE`, cambio password, simula atleta.
  ⚠️ La **fascia cardio BLE** è uscita il 21/09/2026 con tutto il Bluetooth (§9-quintricies).

### Workout Detail (il file più denso)
- Rendering della scheda per categoria, note atleta con RPE, note vocali bidirezionali
  (registrazione nativa iOS + web MediaRecorder, player custom con waveform).
- **Timer guidato** (⚠️ **non per gli allenamenti di corsa**, dal 26/08/2026 — decisione del
  committente: le fasi si seguono con l'orologio. La regola sta in `haTimerGuidato()`, un punto
  solo, e vale anche per gli Eventi/gare. Conseguenze volute: la Live Coach Cam non vede gli
  atleti che corrono, perché la presenza è tracciata dentro `WorkoutTimer`; il cast su TV mostra
  il piano statico): `buildTimerSequence()` linearizza il workout in una sequenza di step
  (`prep` → step → `done`) con beep WAV generati in-memory (600Hz corto / 1200Hz lungo),
  vibrazione, mute, minimizzabile, `KeepAwake`.
- **Export PDF** (jsPDF, sfondo scuro, logo, intensità colorata con emoji 💪).
- **Story Instagram**: card 420px renderizzata con `html-to-image` → salvataggio in galleria
  (`@capacitor-community/media`) o `Share`.
- **Cast su TV**: codice a 4 cifre generato da `/tv`; il telefono aggiorna `tv_sessions` e
  trasmette lo stato del timer via broadcast Realtime sul canale `tv_<code>`.

---
