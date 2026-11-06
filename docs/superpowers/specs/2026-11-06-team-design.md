# Team di atleti e sfida interna — design

> Data: 06/11/2026. Stato: **spec da rivedere**. Nessuna migrazione applicata, nessun
> codice scritto. Lo schema è congelato (CLAUDE.md, regola 0-bis): la migrazione di questo
> lavoro è la **decima eccezione** e richiede un sì esplicito del committente.

## 1. Obiettivo

Il coach crea uno o più **team** scegliendo fra i suoi atleti. Un team può essere legato a una
gara (Hyrox, una doppia) oppure essere solo un gruppo che si allena spesso insieme. Gli
allenamenti del team si fanno insieme e, in base ai risultati, c'è una **sfida interna** che
mostra chi ha fatto meglio. I criteri di una classifica generale si decideranno in un secondo
momento (fase C, §11).

### Decisioni del committente (06/11/2026)
1. **Consenso dell'atleta:** il coach non può mai aggiungere un atleta a un team. Parte un
   invito, con notifica, e l'atleta accetta o rifiuta.
2. **Visibilità:** il coach sceglie per ogni team se la classifica è visibile agli atleti
   (`classifica_visibile`); chi accetta lo vede prima.
3. **Prima versione:** confronto allenamento per allenamento. La classifica cumulativa
   arriva dopo, sugli stessi dati.
4. **Risultato:** lo inserisce l'atleta a mano. Quando Garmin sarà attivo per tutti, lo stesso
   campo si compila da solo dall'orologio (`fonte = 'garmin'`).
5. **Più team per coach**, e un atleta può stare in più team.
6. **Reinvito dopo un rifiuto:** non prima di **3 giorni**.

## 2. Fuori dalla prima versione
Chat del team · immagine/avatar del team · classifica a punti e cumulativa (fase C) ·
versioni Rx/scaled per livello o sesso · risultato preso da Garmin (previsto, non costruito) ·
versione desktop dedicata (le schermate coach seguono il layout desktop esistente).

## 3. Modello dati (tutte tabelle nuove, additive)

| Tabella | Colonne |
|---|---|
| `team` | `id`, `nome`, `coach_id`, `evento_id` (null; il workout `Event`), `classifica_visibile` bool, `creato_il`, `chiuso_il` (null = attivo). Unico `(coach_id, nome)` |
| `team_membri` | PK `(team_id, atleta_id)`, `stato` in `invitato`/`dentro`/`rifiutato`/`uscito`, `invitato_il`, `risposto_il` |
| `team_sfide` | `id`, `team_id`, `workout_id`, `metrica` in `tempo`/`ripetizioni`/`kg`/`distanza`, `verso` in `minore`/`maggiore` (derivato dalla metrica), `data`, `chiusa_il` (null = aperta) |
| `team_risultati` | PK `(sfida_id, atleta_id)`, `valore` numerico (secondi per il tempo), `fonte` in `manuale`/`garmin`, `inserito_il` |

- Nessuna tabella esistente viene modificata. I workout del team sono normali `workouts` e
  `athlete_workouts`, collegati da `team_sfide`.
- `valore` validato dal database (positivo, tetto per metrica).
- Le quattro tabelle entrano nel backup notturno.
- Interruttore in `funzioni_app` (come le Scarpe): la funzione parte **spenta**.

## 4. Permessi (RLS, non interfaccia)

- **Coach (staff):** crea, modifica e chiude i **propri** team; invita solo atleti del proprio
  elenco (`coach_atleti`); crea le sfide; legge tutto del proprio team. Un admin vede tutti i
  team. `demo@fleofit.it` non scrive (come «Messaggio a tutti»).
- **Il coach non può mai scrivere `stato = 'dentro'`.** Può scrivere solo `invitato`.
- **Atleta:** porta la **propria** riga di `team_membri` a `dentro`, `rifiutato`, `uscito`
  (mai a `invitato`); scrive solo il **proprio** risultato, e solo finché la sfida è aperta.
- **Lettura atleta:** da `invitato` vede nome del team, coach, evento, invitati e se la
  classifica è visibile; da `dentro` vede l'elenco dei compagni dentro. I risultati dei
  compagni li legge solo se `classifica_visibile` e solo se è `dentro`. I propri li legge sempre.
- Un atleta non in un team non compare in nessuna lettura di quel team.
- Dopo `uscito` l'atleta perde l'accesso ai dati del team.

## 5. Invito e notifica

1. Il coach tocca «Invita», vede solo i suoi atleti (quelli già dentro o invitati sono segnati).
2. Per ogni scelto nasce una riga `invitato`. Non si invitano atleti in pausa o eliminati.
3. L'atleta riceve una riga in `notifications` e una **push**, da una nuova modalità di
   `send-reminders` (stesso canale dei messaggi del coach, filtrato per coach con
   `_shared/staff.ts`). La `route` porta alla schermata dell'invito.
4. **Schermata dell'invito:** nome, coach, evento, altri invitati, e una frase su cosa si
   condivide (dipende da `classifica_visibile`). Due bottoni, Accetta e Rifiuta, di pari peso.
5. **Accetta** → `dentro`. **Rifiuta** → `rifiutato`: il coach vede «non ha accettato», senza
   motivo e senza avvisare gli altri. Reinvito consentito dopo **3 giorni**.
6. **Nessuna risposta:** l'invito resta in attesa, non scade e non ha un secondo promemoria.
7. **Uscita:** in qualsiasi momento, con conferma → `uscito`.
8. **Casi limite:** atleta messo in pausa → nessun invito nuovo; atleta eliminato → l'invito
   sparisce; atleta spostato a un altro coach → i suoi inviti pendenti del coach vecchio si
   annullano.
9. **Risultati di chi esce:** restano nelle sfide passate come «ex membro» senza nome;
   l'atleta può chiedere la cancellazione completa.

## 6. Schermate

**Coach**
- Voce «Team» nella pagina Atleti e un collegamento nella scheda atleta (che mostra i team a
  cui appartiene). La tab bar non cambia.
- `/team`: lista dei propri team (nome, evento, membri dentro, inviti in attesa, «Nuovo team»).
- `/team/:id`: **Membri** (con stato, «Invita»), **Sfide** (per data, vincitore o «in corso»),
  **Impostazioni** (nome, evento, `classifica_visibile`, chiudi team).
- **Nuova sfida:** workout esistente o nuovo, data, metrica. Alla conferma il workout è
  assegnato a tutti i membri `dentro` con le normali `athlete_workouts`.
- **Dettaglio sfida:** ordine della seduta, valore di ognuno, distacco dal primo, «—» per chi
  non ha inserito. Chiusura della sfida.

**Atleta**
- Invito aperto dalla notifica.
- «I miei team» in Profilo, con classifica se visibile.
- Risultato: il recap di un workout di sfida chiede un solo campo col tipo giusto
  (`mm:ss` o numero); si può saltare e inserire dopo dalla scheda del team.
- Uscita dal team con conferma.

## 7. Calcolo della sfida (`src/lib/sfidaTeam.js`, pura)

- Ordina per `verso`; **pari valore = pari posto**.
- Senza risultato: fuori dall'ordine, mostrato «—», mai come zero.
- Distacco dal primo nell'unità della metrica.
- Sfida aperta fino alla chiusura del coach; dopo, i valori sono fissi. Il coach non modifica
  mai il valore di un atleta.
- **Andamento:** contatore di vittorie per atleta nelle sfide chiuse e serie dei piazzamenti.
  Nei team da **due**, vista **testa a testa** («3–2», chi ha vinto ogni seduta e di quanto).
- Il risultato è **dichiarato**, non verificato: va scritto nell'interfaccia dove serve.
- Limite noto: si confrontano i numeri, non la difficoltà.

## 8. Regole del progetto da rispettare
Colori dai token · aptica dai sei verbi · niente `alert()` nativi · modali in portal ·
`.catch` sui plugin non su tutte le piattaforme · pagine team in lazy, `index` non deve
crescere (§2 di CLAUDE.md) · la settimana comincia di lunedì · «—» e mai zero per un dato che
non c'è · le differenze di piattaforma dietro `Capacitor.getPlatform()` · web app su `main`:
non conosce le tabelle, la funzione resta spenta finché non si pubblica.

## 9. Test

- `sfidaTeam.test.js`: ordine per ogni metrica, ex aequo, mancanti, distacchi, vittorie. Ogni
  test si vede prima **fallire** rompendo apposta il codice.
- Script SQL in `tools/` (come `verifica-revisore.sql`): il coach non scrive `dentro`; un
  atleta non legge i risultati con la classifica spenta; non si legge un team non proprio; un
  atleta non scrive il risultato altrui né a sfida chiusa.
- Pagine con il finto Supabase: invito (accetta, rifiuta, esci), lista team, risultato.
- Ambiente di prova (`demo`, `demo:atleta`): un team con invito pendente e una sfida chiusa.
- Provare su iOS e su Android ogni cosa che tocca notifiche o deep link (regola del progetto:
  le prove sul dispositivo le fa il committente).

## 10. Consegna a fasi (ognuna rilasciabile da sola, funzione spenta)

1. **Schema e permessi** + script di verifica. *Richiede il sì sulla migrazione.*
2. **Team, inviti, risposta, notifica.**
3. **Sfide, risultato, testa a testa.**

## 11. Fasi successive (non in questa spec)
- **C:** classifica cumulativa; parametri (punti per posizione, costanza, miglioramento) da
  decidere con il committente; il contatore di vittorie ne sarà un ingrediente.
- **B:** compilazione automatica del risultato dall'orologio Garmin, quando sarà attivo per
  tutti (`fonte = 'garmin'`).

## 12. Decisioni rimandate al piano di implementazione
- Atleti con l'app vecchia sugli Store non vedono l'invito: decidere se mostrare al coach
  l'indicazione «in attesa, app non aggiornata» o richiedere una versione minima per invitare.
- Valori massimi per metrica nel vincolo del database.
- Nome esatto e posizione della voce «Team» in Atleti e in Profilo.
