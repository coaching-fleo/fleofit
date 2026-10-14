# Consenso privacy all'iscrizione e avviso automatico dei cambi di policy

> Progetto del 14/10/2026. Decisioni del committente prese in sessione lo stesso giorno.

## Perché

1. **Apple, linea guida 5.1.2(i)** (aggiornata a novembre 2025): se dati personali vanno a
   un'IA di terze parti, l'app lo deve dire chiaramente e chiedere un permesso esplicito
   **prima**. In FLEOFIT succede con «Dalle note» (`estrai-note`, Groq) e con la ricerca del
   coach (`ricerca-coach`, Groq con riserva Gemini).
2. **GDPR**: FLEOFIT tratta **dati relativi alla salute** (RPE, sensazioni, dolori, peso,
   «Come stai oggi», note), che per l'art. 9 richiedono un **consenso esplicito**; il
   consenso va **dimostrabile** (art. 7.1) e **revocabile** facilmente (art. 7.3);
   l'informativa deve essere chiara e in una lingua che l'interessato capisce (art. 12-13).
3. Oggi l'app non registra nessun consenso: sotto i bottoni d'accesso c'è solo il testo
   «Continuando accetti i Termini e la Privacy», senza collegamento (BACKLOG #47), e la
   policy pubblicata è un modello generico in inglese che non parla di salute, Supabase, IA
   o note vocali.

## Decisioni del committente

- **Il consenso è obbligatorio per entrare.** Chi non accetta non si iscrive (e chi è già
  iscritto e non accetta esce). Niente consenso facoltativo all'IA.
- **I cambi di policy si comunicano per mail, automatica**, non in app. Non la manda il
  coach a mano.
- **Finché siamo in prova la mail arriva solo al coach**; a tutti gli atleti solo quando il
  committente lo dice.
- Titolare del trattamento: **Federico Leo**, Via Altaguardia 3 (⚠️ città e CAP da
  completare), P. IVA **12721740962**, email per le richieste privacy
  **coaching@federicoleo.it**.

### La scelta sul consenso obbligatorio, e il suo limite
Un consenso posto come condizione del servizio è valido se il trattamento è **necessario**
a quel servizio (art. 7.4). Qui il servizio è il coaching: i dati di allenamento e salute
sono il servizio stesso, e l'analisi con l'IA è uno strumento del coach per seguirlo. La
policy lo deve dire in questi termini. Per Apple basta che il permesso sia esplicito e
anteriore all'invio. ⚠️ Testo da far rileggere a un professionista.

## Cosa si costruisce

### 1. La schermata del consenso (`Consenso.jsx` + `src/lib/consenso.js`)
- Compare **dopo l'accesso** (Apple, Google, email) e **dopo** il riscatto del codice
  invito, **prima** dell'onboarding. Sta in `ProtectedRoute` di `src/App.jsx`, sul ramo
  non-admin: un nuovo stato `needsConsenso`, valutato prima di `needsOnboarding`.
- **Due caselle, vuote all'apertura, entrambe obbligatorie**:
  1. «Ho letto l'informativa privacy» — con il link alla policy;
  2. «Acconsento al trattamento dei miei dati sull'allenamento e sulla salute (RPE,
     sensazioni, dolori, peso, note scritte e vocali) per il servizio di coaching, anche con
     strumenti di intelligenza artificiale di terze parti (Groq, Google Gemini)».
- «Accetto ed entra» si abilita solo con le due spunte. «Non accetto» → `signOut()` e
  ritorno al login.
- **Gli admin non la vedono** (`ADMIN_EMAILS`): il coach è il titolare, non un interessato.
  ⚠️ L'admin con `adminRoleOverride = 'athlete'` resta admin anche qui.
- Grafica: schermata intera come l'onboarding (sfondo `#0B0B0B`, card `#1e1e1e`, CTA
  `bg-brand`), `.page-transition` come login e onboarding.

### 2. Dove si registra: i metadati dell'utente (nessuna modifica allo schema)
- Accettando: `supabase.auth.updateUser({ data: { consenso: { versione, il } } })`, con
  `versione` = `VERSIONE_CONSENSO` di `src/lib/consenso.js` e `il` = data e ora ISO.
- Perché qui e non in una tabella: con il consenso obbligatorio **ogni atleta nell'app l'ha
  dato**, quindi nessuno deve leggerlo per escludere qualcuno; serve solo a dimostrarlo e a
  sapere quando richiederlo. Lo schema del database resta congelato (regola 0-bis).
- `consenso.js` espone funzioni pure e testate: `serveConsenso(user, isAdmin)` →
  `true` se manca o la versione è diversa da `VERSIONE_CONSENSO`.

### 3. Due versioni, non una
- **`VERSIONE_CONSENSO`** (in `consenso.js`): cambia **solo** se cambia il testo delle
  spunte, cioè quello che l'atleta accetta (un nuovo scopo, un nuovo dato sulla salute, un
  nuovo fornitore IA). Alzarla fa ricomparire la schermata a tutti alla prossima apertura.
- **Versione della policy** (in testa a `public/privacy-policy.html`, in un
  `<meta name="versione-policy">` più una riga «Cosa è cambiato»): cambia a ogni modifica
  della policy, e fa partire **solo la mail**. In app non succede niente.

### 4. Gli atleti già iscritti
Alla prossima apertura dopo l'aggiornamento non hanno `consenso` nei metadati: vedono la
stessa schermata, una volta. Chi rifiuta esce; può rientrare e accettare quando vuole.

### 5. Impostazioni → «Privacy e consenso»
Nuova riga nella sezione dell'account (`Settings.jsx`, `ImpostazioniUI`), solo atleti:
- mostra la data del consenso;
- «Leggi l'informativa» (link);
- «Ritira il consenso»: conferma con `CustomConfirm` («Senza consenso non puoi usare
  FLEOFIT. I tuoi dati restano finché non elimini l'account»), poi azzera `consenso` nei
  metadati ed esce. Al prossimo accesso la schermata ricompare.
- La cancellazione dei dati resta «Elimina il mio account», che esiste già.

### 6. La policy nuova, in italiano (`public/privacy-policy.html`)
- Si sposta da radice a `public/`: così entra in `dist` ed è servita da Vercel a
  `https://fleofit.vercel.app/privacy-policy.html` (Vercel serve i file statici prima della
  riscrittura SPA di `vercel.json`). La copia in radice si toglie.
- Contenuto: titolare e contatti; quali dati (account, profilo, peso/altezza/data di
  nascita, allenamenti, RPE, gradimento, «Come stai oggi», note scritte e vocali, foto
  profilo, gare e risultati HYROX, segnalazioni, token delle notifiche); per cosa e con quale
  base giuridica (contratto art. 6.1.b; consenso esplicito art. 9.2.a per la salute);
  **fornitori** (Supabase — database e file; Vercel — sito; Google Firebase — notifiche;
  Groq e Google Gemini — IA; Resend — email; Apple e Google — accesso); trasferimenti
  fuori UE e garanzie; conservazione (finché c'è l'account; cancellazione definitiva 7 giorni
  dopo l'eliminazione; backup); diritti (accesso, rettifica, cancellazione, portabilità,
  revoca, reclamo al **Garante**); nessuna profilazione pubblicitaria, nessun tracciamento;
  come vengono comunicati i cambiamenti (la mail).
- Il vecchio indirizzo su GitHub Pages (`coaching-fleo.github.io/fleofit/privacy-policy.html`,
  branch `ios-version`) diventa un rimando al nuovo, così il link oggi dichiarato su App
  Store Connect continua a funzionare.
- Il benvenuto del login: «Continuando accetti i Termini e la Privacy» diventa
  «Informativa privacy» con il link vero. «Termini» si toglie: i Termini non esistono, e
  promettere un documento che non c'è è peggio (chiude BACKLOG #47).
- Link aperti con `@capacitor/browser` sul nativo, `window.open` sul web.

### 7. La mail automatica (`avviso-policy` + workflow)
- **Workflow GitHub** `.github/workflows/avviso-policy.yml`: `on: push` su `main` con
  `paths: public/privacy-policy.html`. Confronta la `versione-policy` del file prima
  (`github.event.before`) e dopo il push: **parte solo se la versione è cambiata**, così
  correzioni di virgole senza cambio di versione non mandano niente. Le modifiche su `app`
  non mandano mai niente: conta solo quello che viene pubblicato sul sito.
- **Edge Function `avviso-policy`**: chiamata dal workflow con la service key (rifiuta ogni
  altra chiamata: controlla il ruolo `service_role` del token). Riceve versione e «cosa è
  cambiato», manda la mail via **Resend** (come `segnalazione`).
- **L'interruttore**, secret `AVVISO_POLICY_DESTINATARI`:
  - `prova` (predefinito, anche se il secret manca) → solo `coaching@federicoleo.it`;
  - `tutti` → tutti gli atleti con account attivo (`athletes.deleted_at` nullo), **atleti in
    pausa compresi**: sono iscritti e i loro dati ci sono. Gli indirizzi si leggono con
    `auth.admin` dalla service key; gli admin sono esclusi.
  Passare a `tutti` è un `supabase secrets set`, senza toccare il codice.
- Mail: oggetto «FLEOFIT — abbiamo aggiornato l'informativa privacy», il riassunto delle
  modifiche, il link, data di efficacia. Una mail per destinatario (nessun indirizzo
  visibile agli altri).
- ⚠️ **Prima di passare a `tutti`** servono due cose fuori dal codice:
  1. il **dominio verificato su Resend** (`federicoleo.it`): col mittente
     `onboarding@resend.dev` Resend consegna solo all'indirizzo del proprietario
     dell'account — in modalità `prova` basta, per tutti no;
  2. il dominio mittente registrato in **Apple Developer → Sign in with Apple for Email
     Communication**: chi è entrato con Apple e ha nascosto l'email ha un indirizzo
     `@privaterelay.appleid.com`, che rifiuta le mail da mittenti non registrati.

## Cosa resta fuori
- Termini di servizio (documento a parte, da scrivere se servono).
- Consensi facoltativi o granulari, registro storico dei consensi in una tabella.
- Avviso in app del cambio di policy (deciso: solo mail).

## Aperto, da decidere col committente
- **La riserva Gemini della ricerca** (BACKLOG #62): sul piano gratuito Google può usare i
  dati che riceve, e la ricerca può mandargli estratti delle note. Con questo progetto la
  cosa diventa dichiarata, ma resta debole per il GDPR (sul piano gratuito Google non è un
  semplice responsabile del trattamento). Due strade: piano Gemini a pagamento, oppure
  togliere la riserva Gemini da `ricerca-coach` quando ci sono dati degli atleti. Non blocca
  questo progetto.

## Prove
- `consenso.test.js`: `serveConsenso` per utente senza consenso, con versione vecchia, con
  versione giusta, admin.
- Test della schermata: «Accetto» disabilitato con zero o una spunta; abilitato con due;
  accettando chiama `updateUser` con versione e data; «Non accetto» chiama `signOut`.
- Test di `ProtectedRoute`: atleta senza consenso vede la schermata e non la Home; admin
  passa diretto.
- Test di Impostazioni: la riga c'è per l'atleta e non per l'admin; «Ritira» azzera e esce.
- Edge Function: le regole pure (`destinatari(modalita, utenti, atleti)`, testo della mail)
  in `regole.ts` con test, come le altre funzioni; in `prova` ritorna solo l'indirizzo del
  coach anche se la lista atleti è piena.
- Ogni test nuovo visto fallire rompendo apposta il codice (CLAUDE.md §9).

## Dopo il codice, a mano
1. `supabase functions deploy avviso-policy` (solo nuova: non tocca le altre).
2. Push `app:main` quando il committente lo chiede: pubblica la policy e attiva il workflow.
3. App Store Connect → **URL della privacy policy** → il nuovo indirizzo.
4. Etichette privacy: già coerenti (salute, fitness, contenuti, email, nome dichiarati); da
   aggiungere *Assistenza clienti* e *Altri dati diagnostici* come già annotato.
