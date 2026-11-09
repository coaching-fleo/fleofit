# Team di atleti

> Scritto il 09/11/2026. Spec: `docs/superpowers/specs/2026-11-06-team-design.md`, piano:
> `docs/superpowers/plans/2026-11-06-team.md`. Lavoro fatto su `app`, da `343669d`.

## Stato
- ✅ **Migrazione applicata il 09/11/2026** dal committente, a mano dal SQL editor:
  `supabase/schema/team_2026-11-06.sql` (**decima eccezione**, CLAUDE.md §0-bis). Il primo
  tentativo si è fermato su un errore di sintassi (trappole, sotto) e il `begin … commit` ha
  annullato tutto; il secondo è andato. `tools/verifica-team.sql`: **pulita** lo stesso giorno.
  L'interruttore `team` è **spento**. Quattro tabelle (`team`, `team_membri`,
  `team_sfide`, `team_risultati`), 14 policy, due trigger, la RPC `team_scheda`, e la riga `team`
  di `funzioni_app` che parte **spenta**.
- Il codice sta su `app` prima del sì: senza tabelle `assente(error)` di `teamDb.js` fa sparire
  tutto, senza alert. Con l'interruttore spento le rotte `/team…` stanno dietro `SoloSeAccesa` e le
  righe in Impostazioni, Atleti e scheda atleta non si vedono.
- ✅ `send-reminders` con la modalità **`team_invito`** **pubblicata il 09/11/2026 (versione 72)**,
  dopo la migrazione. Prova a vuoto: senza accesso risponde 403. La versione di prima (71, 30/10
  ore 10:25) era precedente al testo dei complimenti Garmin (`testi.ts`, 30/10 ore 11:46): con
  la 72 è partito anche quello.
- Nessuna prova sul telefono: la fa il committente.

## Cosa fa
Un coach (o un admin) forma un **team** con alcuni dei suoi atleti: per una gara (Hyrox, una
doppia; `evento_id` facoltativo verso un Event futuro) o perché si allenano insieme. Un coach può
avere più team.
- **Consenso**: il coach invita, l'atleta riceve una notifica (`/team/invito/:id`) e **accetta o
  rifiuta**. Il coach non può forzarlo. Dopo un rifiuto o un'uscita, reinvito solo dopo
  **3 giorni** (`GIORNI_REINVITO`, ripetuto nel trigger).
- **Sfida**: il coach sceglie un workout, un giorno e una metrica (`tempo` vince il minore;
  `ripetizioni`, `kg`, `distanza` il maggiore). L'allenamento viene assegnato a chi è dentro (salta
  chi l'ha già quel giorno). L'atleta inserisce il risultato **a mano** dal foglio RPE o dal
  dettaglio sfida; con Garmin attivo per tutti verrà dall'orologio (fase B).
- **Classifica**: per ogni team il coach sceglie se è **visibile agli atleti**. Spenta: l'atleta
  vede solo il proprio valore. Accenderla con membri dentro chiede conferma.
- **Confronto**: per seduta (dettaglio sfida), più **testa a testa** quando i dentro sono due e
  **vittorie** quando sono di più, solo sulle sfide chiuse. La classifica cumulativa è la fase C.
- **Uscita**: l'atleta esce quando vuole; i suoi risultati restano come «Ex membro», senza nome,
  oppure li cancella con la casella «Cancella anche i miei risultati».

## Dove sta
| Pezzo | File |
|---|---|
| Calcolo puro (metriche, tetti, ordine, pari, distacchi, vittorie, testa a testa) | `src/lib/sfidaTeam.js` |
| Parole e regole della scheda (stato in parole, invitabili, «Ex membro», esito) | `src/lib/membriTeam.js` |
| Accesso ai dati | `src/lib/teamDb.js` |
| Risultato al completamento | `src/useSfidaCompletamento.js` (solo stati) + `src/lib/sfidaCompletamento.js` (pigro) + `src/components/RigaRisultatoSfida.jsx` (pigra, in `RpeModal`) |
| Pagine | `Team.jsx` (coach) / `MieiTeam.jsx` (atleta) su `/team`, `SchedaTeam.jsx`, `InvitoTeam.jsx`, `DettaglioSfida.jsx` |
| Presentazione e fogli | `TeamUI.jsx`, `FoglioNuovoTeam`, `FoglioInvitaTeam`, `FoglioNuovaSfida` |
| Notifica dell'invito | `supabase/functions/send-reminders/team.ts` + blocco `team_invito` in `index.ts` |
| Verifica del database | `tools/verifica-team.sql` (10 casi, nessun `FALLITO`) |

Rotte: `/team`, `/team/invito/:id`, `/team/:id`, `/team/:id/sfida/:sfidaId`, tutte dietro
`<SoloSeAccesa nome="team">`.

## Trappole
- 🔴 **I nomi dei compagni passano SOLO da `team_scheda`**: l'atleta legge solo la propria riga di
  `athletes`. Una pagina che legge `athletes` per mostrare i compagni, da atleta, vede vuoto.
- 🔴 **Le transizioni di stato le decide il trigger `team_membri_regole`**, non l'interfaccia:
  l'atleta può solo invitato→dentro/rifiutato e dentro→uscito; il coach solo inserire `invitato` e
  reinvitare dopo 3 giorni. Il trigger scrive anche `risposto_il`. Senza `auth.uid()` (SQL editor,
  Edge Function) lascia passare.
- 🔴 **`cancellaMieiRisultati` va chiamata PRIMA di uscire**: dopo, la RLS nasconde le sfide.
- Il trigger `team_risultati_regole` rifiuta scritture a sfida chiusa e valori oltre i tetti
  (tempo 86400 s, ripetizioni 10000, kg 100000, distanza 1000000 m), gli stessi di `TETTI`.
- 🔴 **Nel team entra solo chi segue il coach del team in `coach_atleti`, ANCHE se il coach è un
  admin** (`atleta_del_coach_del_team`, `membro_team`). L'admin vede tutti gli atleti, ma il foglio
  «Invita» propone solo i suoi. Un atleta spostato a un altro coach perde inviti e team, e
  «Nuova sfida» lo salta. (Revisione del 09/11/2026: prima un admin bastava, e un atleta spostato
  restava nei team di Federico.)
- **La push dell'invito parte solo con l'interruttore `team` su `tutti`** (`invitiAccesi`): su
  `admin` l'atleta non vede i Team e la notifica lo porterebbe alla Home. Gli inviti fatti su `admin`
  restano validi ma **muti**: accendere `tutti` prima di invitare atleti veri.
- Un invito, una notifica: il dedup vale per **l'invito corrente** (notifiche dopo `invitato_il`),
  così il reinvito dopo un rifiuto arriva anche se la notifica vecchia è ancora lì.
- Il tempo si scrive anche `4.07` o `4,07` (il tastierino di iPhone non ha «:»). Sole cifre =
  secondi, e sotto il campo compare come vengono lette («= 6:47»).
- «Nuova sfida» legge chi l'ha già **prima** di creare la sfida, e la cancella se le assegnazioni
  falliscono: mai una sfida orfana.
- Il risultato dal foglio RPE si scrive **solo online**, come la scarpa; offline si inserisce dal
  dettaglio sfida. Un errore dà un avviso e non tocca il completamento.
- A sfida **chiusa** la classifica elenca solo chi ha un risultato (chi è entrato dopo non c'era);
  a sfida aperta anche chi non ha ancora inserito («—», mai uno zero).
- **Peso di `index`**: in Home c'è solo `useSfidaCompletamento` (gli stati). Logica, riga e pagine
  sono chunk propri. Il Team ha portato `index` da 621,80 a 624,44 KB (09/11/2026).
- **Ambiente di prova**: per il lato atleta serve `adminRoleOverride=athlete` oltre a
  `VITE_DEMO_ATLETA` (la sessione resta admin). Giulia (`at-giulia`) ha l'invito, Sara (`at-sara`)
  è dentro con la sfida aperta di oggi da fare. La demo **non** esegue i trigger (`risposto_il`
  resta null). Le relazioni annidate del Team sono in `RELAZIONI` di `supabaseDemo.js`.

- 🔴 **In plpgsql la condizione di un `if` finisce al primo `then`**: un `case … when … then`
  dentro la condizione la tronca («syntax error at end of input»). Il primo tentativo di applicare
  la migrazione (09/11/2026) si è fermato lì, e il `begin … commit` ha annullato tutto. Le SQL
  nuove si controllano prima con il parser vero di Postgres (`@libpg-query/parser`,
  `parseSync` + `parsePlPgSQLSync`), che quell'errore lo trova.

## Dopo il sì, in ordine (col committente)
1. Applicare `team_2026-11-06.sql` dal SQL editor.
2. Eseguire `tools/verifica-team.sql`: nessuna riga `FALLITO`.
3. Pubblicare `send-reminders` (porta `team_invito`).
4. Accendere `team` su `admin` in `funzioni_app` (⚠️ `demo@fleofit.it` è admin) e provare il lato
   coach. ⚠️ Su `admin` gli inviti non mandano push e l'atleta non vede i Team.
5. Poi `tutti`, e prove su iPhone e Android dal lato atleta: push dell'invito ad app chiusa, deep link
   `/team/invito/:id`, tasto indietro, il campo del tempo col tastierino.
