# Prossimi passi PUSHFIT — piano

> **Per chi esegue:** sotto-skill richiesta: superpowers:executing-plans (la maggior parte dei
> passi è a mano, nei pannelli esterni; i pochi task di codice sono piccoli). Passi con le
> caselle (`- [ ]`). **Chi fa cosa** è scritto su ogni task: 👤 = il committente, 🤖 = Claude.

**Obiettivo:** chiudere il passaggio da FLEOFIT a PUSHFIT: mail che arrivano da `@pushfit.it`,
`pushfit.it` sito principale ovunque, versione **1.2.5** sull'App Store col nome nuovo, e solo
dopo lo spegnimento graduale di `fleofit.vercel.app` e di `fleofit://`.

**Architettura:** prima i servizi esterni che non richiedono un'app nuova (A), poi il codice che
va nella 1.2.5 (B), la 1.2.5 stessa (C), e per ultimo ciò che si può fare solo quando quasi tutti
hanno aggiornato (D). Android ha un piano suo (E).

**Stato al 18/11/2026 (fatto):** nome, logo, icone, giallo `#f1c517`, chiavi `pushfit_*`, schema
tempo 1, landing come pagina principale, pagina `/conferma` + modelli mail (provati), dominio
`pushfit.it` collegato a Vercel e usato dal codice (inviti, privacy, TV, Garmin, applinks),
Garmin aperto a tutti, bug di «Visualizza come atleta». Piano di partenza:
`docs/superpowers/plans/2026-11-17-rinomina-pushfit.md`.

## Global Constraints
- Si lavora su `app`; `app:main` solo su richiesta esplicita (CLAUDE.md §0, regola 0).
- Schema del database congelato: nessun passo qui richiede migrazioni (§0-bis).
- Bundle id `it.federicoleo.fleofit` invariato; `demo@fleofit.it` invariato.
- `fleofit.vercel.app` e `fleofit://` restano funzionanti finché non lo dice il task D.
- Nel nome sullo Store **niente «Hyrox»** (marchio registrato); «PushFit» da solo è già preso.
- Le prove sul telefono le fa il committente; Claude non lancia `npm run ios`.
- Ogni test nuovo si vede fallire rompendo il codice apposta.

## Decisioni del committente ancora aperte
1. **Nome sullo Store** (prima di C3): es. «PUSHFIT: Hybrid Training», «PUSHFIT Coach».
2. **Indirizzo mittente** (prima di A3): proposta `noreply@pushfit.it`, nome «PUSHFIT».
3. **Quando togliere `GARMIN_MINUTI_MINIMI`** (A6): a fine prove.

## Review Focus
- **Utenti sul vecchio dominio:** passando a `pushfit.it` come principale, chi usa il sito su
  `fleofit.vercel.app` NON perde l'accesso finché non c'è il rimando (D2); dopo il rimando deve
  rientrare (la sessione è per dominio). Va detto agli atleti web prima di D2.
- **SMTP sbagliato = nessuno si iscrive:** dopo A3 la prova d'iscrizione si fa subito; se
  fallisce, si spegne «Custom SMTP» in Supabase (torna il servizio di prima).
- **Mail chieste dalla 1.2.4:** reset e conferme partite dall'app vecchia portano `torna=fleofit://…`:
  `/conferma` le accetta (provato da test, `confermaLink.test.js`). Non toccare `SCHEMI`.
- **Link d'invito vecchi** (`fleofit.vercel.app/invito/…`) nelle chat: devono aprire l'app anche
  dopo la 1.2.5 → C1 lo prova esplicitamente.
- **Installazione sopra la 1.2.4:** il trasloco delle chiavi deve tenere accesso, bozza e coda
  offline → C1 lo prova esplicitamente.

---

## A. Servizi esterni, senza app nuova

### A1 · Vercel: `pushfit.it` principale 👤 — ✅ 18/11/2026
- [x] Domains → `pushfit.it` **Production**; `www.pushfit.it` **Redirect 308 → pushfit.it**.
- [x] 🤖 Controllo: `curl -sI https://www.pushfit.it/conferma` → `308`, `location: https://pushfit.it/conferma`;
  `https://pushfit.it/.well-known/apple-app-site-association` → `200 application/json`.

### A2 · Supabase: indirizzi 👤 — ✅ 18/11/2026
- [x] Authentication → URL Configuration → **Site URL** = `https://pushfit.it` (dopo A1).
- [x] **Redirect URLs**: tenere quelle di `fleofit.vercel.app` e `fleofit://login-callback`;
  aggiungere `pushfit://login-callback` e `pushfit://**` (prepara D1, oggi non usato).
- [x] Prova: reset password dal sito su `pushfit.it` → si torna su `pushfit.it`.

### A3 · Mail vere da `@pushfit.it` (Resend) 👤 + 🤖 ✅ (18/11/2026, manca solo la prova di «Segnala un problema»)
- [x] 👤 Resend → Domains → Add `pushfit.it` (regione EU).
- [x] 👤 Aruba → DNS di `pushfit.it`: i record che Resend mostra (TXT DKIM `resend._domainkey`,
  MX + TXT SPF sul sottodominio `send`), più `_dmarc` TXT `v=DMARC1; p=none;`. Attendere «Verified».
- [x] 👤 Resend → API Keys → chiave nuova **solo invio**, nome «supabase-smtp» (mai scriverla in un file).
- [x] 👤 Supabase → Authentication → SMTP Settings → Enable Custom SMTP: host `smtp.resend.com`,
  porta `465`, utente `resend`, password = la chiave, mittente = decisione 2, nome `PUSHFIT`.
  Poi Rate Limits → «emails per hour» a 30.
- [x] 👤 Prova: iscrizione con una Gmail nuova → la mail arriva in Posta in arrivo, dal mittente nuovo.
- [x] 👤 «Segnala un problema»: il mittente è un secret, nessun codice da cambiare.
  `npx supabase secrets set SEGNALAZIONI_MITTENTE="PUSHFIT <noreply@pushfit.it>" --project-ref riyqtcssllupakjtoehj`
  (era `onboarding@resend.dev`, che consegna solo al proprietario dell'account Resend). Secret impostato il 18/11.
- [x] 👤 Prova: Impostazioni → Segnala un problema → la mail arriva. ✅ 18/11, confermato dal committente.
- [x] 🤖 Memoria: `docs/memoria/accesso.md` (SMTP) e `privacy-in-stand-by` (sbloccata la mail dei
  cambi di policy, voce in cima al BACKLOG).

### A4 · Google Cloud: «Accedi con Google» 👤 ✅ (18/11/2026: Search Console verificato, Branding salvato, app passata da **Test** a **In produzione** — prima entravano con Google solo gli utenti di prova —, verifica del branding inviata: si aspetta la mail di Google)
- [x] OAuth consent screen / Branding: nome `PUSHFIT`, logo (`src/assets/marchio/pushfit-icona.png`,
  120×120), home `https://pushfit.it`, privacy `https://pushfit.it/privacy`, domini autorizzati
  `pushfit.it` (tenere `vercel.app` e `supabase.co`). Inviare la verifica del marchio.
- [x] Per la verifica Google chiede la proprietà di `pushfit.it` in Search Console (record TXT su Aruba).

### A5 · Garmin portal 👤 ✅ (18/11/2026)
- [x] Icona `https://pushfit.it/web-app-manifest-192x192.png`, sito e privacy su `pushfit.it`.
  **Non** toccare redirect URI e webhook (sono di Supabase).

### A6 · Garmin: fine prove 👤
- [ ] `npx supabase secrets unset GARMIN_MINUTI_MINIMI --project-ref riyqtcssllupakjtoehj`
- [ ] 🤖 Togliere la riga ⏳ in cima a `docs/memoria/garmin.md`.

---

## B. Codice per la 1.2.5 🤖

### B1 · Nomi rimasti ✅ (18/11/2026)
**Files:** `CLAUDE.md` §1 (deploy web → `https://pushfit.it`, `fleofit.vercel.app` come alias),
`DESIGN.md`, `PRODUCT.md`, `README.md`, `src/demoSemi.js` (codici `FLEO-2026-*` → `PUSH-2026-*`,
solo dati finti).
- [x] `grep -rn "FLEOFIT\|Fleofit" DESIGN.md PRODUCT.md README.md` → sostituire dove è il nome
  dell'app (non nei riferimenti storici datati).
- [x] `npx vitest run src/lib/__tests__/marchio.test.js` e i test della demo → PASS.
- [x] Commit per nome.

### B2 · Versione e novità ✅ (18/11/2026: 1.2.5 in quattro configurazioni, novità in DEVLOG)
**Files:** `ios/App/App.xcodeproj/project.pbxproj` (`MARKETING_VERSION = 1.2.5` nelle tre
configurazioni, `CURRENT_PROJECT_VERSION = 1`), `DEVLOG.md` (novità contate dalla 1.2.4).
Android (`versionName "1.0"`) si allinea nel piano E.
- [x] Novità in italiano, al massimo 5 righe: nome e aspetto nuovi PUSHFIT; collegamento Garmin
  per tutti; il link d'invito apre l'app; le mail di conferma portano a una pagina PUSHFIT;
  correzioni («Visualizza come atleta»).
- [x] Commit per nome.

---

## C. La 1.2.5 sull'App Store

### C1 · Prova sul telefono 👤 (dopo `npm run ios`, sopra la 1.2.4 già installata)
- [ ] Nome sotto l'icona «PUSHFIT», icona e splash nuovi.
- [ ] Si resta dentro senza rifare l'accesso; una bozza di workout e un allenamento salvato offline ci sono ancora.
- [ ] Da WhatsApp: `https://pushfit.it/invito/<codice>` **e** un vecchio `https://fleofit.vercel.app/invito/<codice>` aprono l'app sulla card dell'invito.
- [ ] Reset password chiesto dall'app → mail → `/conferma` → l'app si riapre sulla password nuova.
- [ ] Atleta: Profilo → Dispositivi → Collega Garmin → si torna nell'app collegati.
- [ ] Timer con Live Activity: testi PUSHFIT, giallo nuovo.

### C2 · Controlli prima dell'archive 🤖
- [ ] I tre `grep` di CLAUDE.md §9 (demo presente in `dist`, niente ambiente di prova né HealthKit in `ios/App/App/public`).
- [x] `ios/App/App/App.entitlements` ha i tre `applinks:` (`pushfit.it`, `www.pushfit.it`, `fleofit.vercel.app`).
- [ ] 👤 Archive da Xcode, export, poi `tools/verifica-ipa.sh <file.ipa>` → nessun errore.
- [ ] Stato della versione su App Store Connect come da `docs/memoria/app-store.md`.

### C3 · App Store Connect 👤
- [ ] Informazioni app: **Nome** = decisione 1, sottotitolo (≤30 caratteri, niente «Hyrox»),
  **URL privacy** `https://pushfit.it/privacy`; URL di supporto/marketing su `pushfit.it`.
- [ ] Versione 1.2.5: screenshot nuovi col logo PUSHFIT (quelli con FLEOFIT vanno tolti), novità di B2, parole chiave.
- [ ] Note per la revisione: cambio di nome dello stesso titolare; account `demo@fleofit.it`
  invariato. ⚠️ Corretto il 18/11: dopo «il coach si allena» `demo@fleofit.it` (admin **con** riga
  `athletes`) **vede** la riga Garmin in Impostazioni, e Garmin è nelle novità: la nota deve dire che
  serve un orologio Garmin e un account Garmin Connect, e che senza l'orologio la funzione non si prova.
  ✅ 18/11: Scarpe e Team **spenti** per l'invio (`funzioni_app.stato = 'spenta'`, prima `admin`):
  il revisore non li vede. ⚠️ Spenti anche per gli admin veri finché non si riaccendono.
- [ ] 🤖 All'approvazione della 1.2.5 riaccendere: `update funzioni_app set stato='admin' where nome in ('scarpe','team')`.
- [ ] Inviare. 🤖 All'esito: registrarlo in `docs/memoria/app-store.md` e in CLAUDE.md «Stato».

---

## D. Dopo che quasi tutti hanno la 1.2.5

### D1 · Schema tempo 2: si scrive `pushfit://` 🤖 (esce con la 1.2.6)
Prerequisito: A2 fatto (Supabase accetta `pushfit://login-callback`).
**Files:** `src/lib/schema.js` (`SCHEMA = 'pushfit'`, `SCHEMI` invariato),
`supabase/functions/_shared/garminRegole.ts` (ritorno nativo `pushfit://garmin`),
test `schema.test.js`, `garminServer.test.js`.
- [ ] Test che fallisce: `SCHEMA === 'pushfit'`; il ritorno `app` di Garmin inizia con `pushfit://garmin`.
- [ ] Implementare; test → PASS; `npm run build`.
- [ ] ⚠️ Le app fino alla 1.2.4 non registrano `pushfit://`: `garmin-auth` col ritorno nuovo e il
  `app:main` di questo task si pubblicano **solo quando** quasi tutti hanno almeno la 1.2.5.
- [ ] ⚠️ Il QR della TV è web: cambia al primo `app:main` dopo questo task → farlo quando la 1.2.5 è diffusa.

### D2 · Rimando `fleofit.vercel.app` → `pushfit.it` 👤
Prerequisito: App Store Connect → Analisi mostra quasi solo 1.2.5+; avviso agli atleti web
che dovranno rientrare. Fino ad allora **no** (universal link: Apple non segue i rimandi).
- [ ] Vercel → Domains → `fleofit.vercel.app` → Redirect 308 → `pushfit.it`.
- [ ] 🤖 Controllo con `curl` e aggiornare `docs/memoria/app-store.md` (togliere l'avviso 🔴).

---

## E. Android sul Play Store
Piano a parte (`docs/memoria/android.md` §A.4): tastiera, push ad app chiusa, icona delle
notifiche, scheda del Play Store col nome PUSHFIT (stessa decisione 1), poi
`PLAY_STORE_PUBBLICATO = true` in `src/lib/linkInvito.js`. Da scrivere con brainstorming → spec →
piano quando il committente lo apre.

## Ordine consigliato
A1 → A2 → A3 → A5 → A6 (quando finite le prove) · A4 in parallelo (Google ci mette giorni) ·
B1 + B2 → C1 → C2 → C3 · poi D1 → D2 a distanza di settimane · E quando deciso.
