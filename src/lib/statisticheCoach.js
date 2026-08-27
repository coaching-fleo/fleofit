// I numeri della Home coach.
//
// Perché esistono: la Home del coach non conteneva un solo dato — era un menù
// (logo, CTA, lista di ieri, due card verso destinazioni già in navbar). L'unica
// informazione presente, chi ha fatto cosa ieri, è la meno utile la mattina
// perché guarda indietro. Quello che il coach non vede è chi sta per sparire.
//
// Sono funzioni PURE su array già caricati: nessun fetch, nessuna data implicita
// (`oggi` si passa sempre, altrimenti i test dipendono dal calendario di chi li
// esegue). Chi calcola qui non disegna, chi disegna in HomeCoachUI.jsx non calcola.

import { format, parseISO, differenceInCalendarDays, startOfDay } from 'date-fns'
import { it } from 'date-fns/locale'
import { rpeDichiarato } from './rpe'
import { isVoiceNoteValid } from './notaVocale'
import { categoriaDi } from './categorie'
import { inPausa } from './pausa'

/** Da quanti giorni senza allenamenti completati un atleta "richiede attenzione". */
export const GIORNI_FERMO = 5
/** Su quanti giorni si misura la copertura della programmazione. */
export const GIORNI_COPERTURA = 3
/** Quanto indietro guarda la Home coach. Oltre, un atleta è semplicemente "fermo da tanto". */
export const FINESTRA_STORICO = 45
/** Da quanti giorni indietro si raccoglie il feedback non ancora letto. */
export const FINESTRA_FEEDBACK = 14

/**
 * Gli atleti che il coach sta effettivamente seguendo: la rubrica meno chi è
 * in pausa (CLAUDE.md §9-decies).
 *
 * ⚠️ `atletiFermi` e `copertura` la applicano DA SÉ, invece di aspettarsi una
 * lista già filtrata dal chiamante. È voluto: sono le due funzioni che
 * producono un allarme e un totale, e un chiamante che si dimentica il filtro
 * non ottiene un errore — ottiene una telefonata a chi aveva chiesto di non
 * essere chiamato, che è il difetto esatto che questa funzione esiste per
 * evitare.
 */
export const atletiSeguiti = (atleti = []) => atleti.filter(a => a && !inPausa(a))

/** Quanti atleti della rubrica sono attualmente in pausa. */
export const contaInPausa = (atleti = []) => atleti.filter(a => a && inPausa(a)).length

const giorno = (data) => format(data, 'yyyy-MM-dd')

/** Quanti giorni fa cade una data 'yyyy-MM-dd'. Negativo = nel futuro. */
const giorniFa = (data, oggi) => differenceInCalendarDays(startOfDay(oggi), parseISO(data))

/** «13 ago» — la forma breve con cui una data compare in Home. */
const etichettaData = (data) => format(parseISO(data), 'd MMM', { locale: it })

/**
 * «oggi», «ieri», oppure la data breve.
 *
 * Sta qui e non nei componenti perché è una lettura del dato, non una scelta
 * di stile: HomeCoachUI.jsx non conosce né `date-fns` né quale sia il giorno.
 */
const quandoEtichetta = (eta, data) => (eta === 0 ? 'oggi' : eta === 1 ? 'ieri' : etichettaData(data))

/** Il nome composto di una riga `athletes`, con ripiego. */
const nomeCompleto = (a) => [a?.name, a?.surname].filter(Boolean).join(' ').trim() || 'Atleta'

/**
 * Gli atleti che stanno sparendo: nessun allenamento COMPLETATO da `soglia`
 * giorni o più, **esclusi quelli in pausa**.
 *
 * Una condizione sola, di proposito. È l'unico allarme della Home coach perché
 * è l'unico a cui la risposta è sempre la stessa — una telefonata — e perché
 * mescolarlo con il lavoro da smaltire (gli allenamenti scaduti) confonde due
 * problemi di segno opposto: uno è una persona che si allontana, l'altro è una
 * casella da chiudere.
 *
 * ⚠️ `oltre` distingue "fermo da 9 giorni" da "mai, in tutta la finestra che
 * abbiamo caricato". Senza, un atleta che non si allena da sei mesi verrebbe
 * mostrato come fermo da 45 giorni: un numero preciso e falso.
 */
export function atletiFermi(atleti = [], assegnazioni = [], { soglia = GIORNI_FERMO, finestra = FINESTRA_STORICO, oggi = new Date() } = {}) {
  const oggiStr = giorno(oggi)
  const ultimoCompletato = new Map()
  for (const a of assegnazioni) {
    if (a?.status !== 'completed' || !a.completed_date || !a.athlete_id) continue
    // Un completamento datato domani non dice niente su oggi: si ignora.
    if (a.completed_date > oggiStr) continue
    const precedente = ultimoCompletato.get(a.athlete_id)
    if (!precedente || a.completed_date > precedente) ultimoCompletato.set(a.athlete_id, a.completed_date)
  }

  const fermi = []
  for (const atleta of atletiSeguiti(atleti)) {
    if (!atleta?.id) continue
    const ultimo = ultimoCompletato.get(atleta.id)
    const giorni = ultimo ? giorniFa(ultimo, oggi) : finestra
    if (giorni < soglia) continue
    fermi.push({
      id: atleta.id,
      nome: [atleta.name, atleta.surname].filter(Boolean).join(' ').trim() || 'Atleta',
      foto: atleta.photo_url || null,
      giorni,
      oltre: !ultimo,
      ultimo: ultimo || null,
      // ⚠️ `oltre` significa «nessun completamento in tutta la finestra», non
      // «45 giorni esatti»: l'etichetta deve dirlo, altrimenti la riga mostra
      // una data precisa che non esiste.
      ultimoEtichetta: ultimo ? etichettaData(ultimo) : null,
    })
  }
  // Il più fermo per primo: è quello per cui la telefonata è più urgente.
  return fermi.sort((a, b) => b.giorni - a.giorni || a.nome.localeCompare(b.nome))
}

/**
 * Gli allenamenti assegnati e mai completati con data ormai passata.
 *
 * È lavoro da smaltire, non un allarme: sta sotto la CTA, in forma di lista.
 * Il più recente per primo — uno scaduto ieri si recupera, uno di un mese fa
 * è archeologia.
 *
 * ⚠️ Prende `atleti` come primo argomento, come `atletiFermi`, e per la stessa
 * ragione: un allenamento scaduto di chi è **in pausa** non è lavoro da
 * smaltire — è la conseguenza attesa della pausa, e continuare a mostrarlo
 * rimette in Home proprio l'atleta che si era chiesto di togliere. Resta
 * visibile nella sua scheda, dov'è il posto giusto.
 * Fuori restano anche le assegnazioni di chi non è in rubrica (l'account del
 * coach), che non sono lavoro di nessuno.
 */
export function allenamentiScaduti(atleti = [], assegnazioni = [], { finestra = FINESTRA_STORICO, limite = 5, oggi = new Date() } = {}) {
  const oggiStr = giorno(oggi)
  const idSeguiti = new Set(atletiSeguiti(atleti).map(a => a?.id).filter(Boolean))
  return assegnazioni
    .filter(a => idSeguiti.has(a?.athlete_id)
      && a?.status !== 'completed' && a?.completed_date && a.completed_date < oggiStr && giorniFa(a.completed_date, oggi) <= finestra)
    .sort((a, b) => b.completed_date.localeCompare(a.completed_date))
    .slice(0, limite)
    .map(a => ({
      id: a.id,
      workoutId: a.workouts?.id,
      atletaId: a.athletes?.id || a.athlete_id,
      nome: [a.athletes?.name, a.athletes?.surname].filter(Boolean).join(' ').trim() || 'Atleta',
      titolo: a.workouts?.title || 'Allenamento',
      data: a.completed_date,
      giorni: giorniFa(a.completed_date, oggi),
      categoria: categoriaDi(a.workouts?.sections),
    }))
}

/**
 * Quanti atleti hanno almeno un allenamento assegnato nei prossimi `giorni`
 * (oggi incluso). Chi è in pausa esce anche dal **totale**: contarlo fra i
 * «senza allenamento» significherebbe chiedere al coach di programmare per chi
 * ha chiesto di fermarsi.
 *
 * Non è una metrica di vanità: è la lista di lavoro del coach, l'unico numero
 * della Home che dice «devi programmare adesso». `senza` è il complemento, ed
 * è il numero che si guarda davvero.
 */
export function copertura(atleti = [], assegnazioni = [], { giorni = GIORNI_COPERTURA, oggi = new Date() } = {}) {
  const da = giorno(oggi)
  const a = giorno(new Date(startOfDay(oggi).getTime() + (giorni - 1) * 86400000))
  const idAtleti = new Set(atletiSeguiti(atleti).map(x => x?.id).filter(Boolean))
  const coperti = new Set()
  for (const ass of assegnazioni) {
    const d = ass?.completed_date
    if (!d || d < da || d > a) continue
    if (!idAtleti.has(ass.athlete_id)) continue
    coperti.add(ass.athlete_id)
  }
  const totale = idAtleti.size
  return { coperti: coperti.size, totale, senza: Math.max(0, totale - coperti.size) }
}

/**
 * Il feedback in entrata: note vocali e note con RPE lasciate dagli atleti e
 * non ancora lette dal coach.
 *
 * È l'unica voce «in entrata» della Home: se resta lì, l'atleta ha parlato e
 * nessuno ha risposto.
 *
 * ⚠️ Due limiti dei dati, entrambi voluti e non aggirabili senza toccare lo
 * schema (congelato, CLAUDE.md regola 0-bis):
 * 1. `athlete_workouts` non ha `created_at`, quindi "nuovo" non può voler dire
 *    "arrivato dopo il tuo ultimo accesso". Significa "che non hai ancora
 *    aperto": `visti` è l'elenco degli id già letti, tenuto in localStorage.
 * 2. `voice_note_url` è UNA colonna per una comunicazione bidirezionale: non
 *    esiste un modo di sapere se l'ha registrata l'atleta o il coach. Si contano
 *    solo le assegnazioni COMPLETATE, dove la nota accompagna il completamento.
 */
export function feedbackNuovi(assegnazioni = [], visti = [], { finestra = FINESTRA_FEEDBACK, oggi = new Date() } = {}) {
  const giaVisti = new Set(visti)
  const elementi = []
  let vocali = 0
  let note = 0

  for (const a of assegnazioni) {
    if (a?.status !== 'completed' || !a.completed_date) continue
    const eta = giorniFa(a.completed_date, oggi)
    if (eta < 0 || eta > finestra) continue

    const haVocale = isVoiceNoteValid(a.voice_note_url)
    const rpe = rpeDichiarato(a.notes)
    // Una nota che contiene SOLO il marcatore RPE è comunque un dato che
    // l'atleta ha inserito a mano: conta. Una nota vuota no.
    const testo = String(a.notes || '').replace(/^\[RPE:\s*\d+\/10\]\s*/, '').trim()
    const haNota = rpe != null || testo.length > 0
    if (!haVocale && !haNota) continue
    if (giaVisti.has(a.id)) continue

    if (haVocale) vocali++
    if (haNota) note++
    elementi.push({
      id: a.id,
      workoutId: a.workouts?.id,
      atletaId: a.athletes?.id || a.athlete_id,
      nome: nomeCompleto(a.athletes),
      foto: a.athletes?.photo_url || null,
      titolo: a.workouts?.title || 'Allenamento',
      data: a.completed_date,
      quando: quandoEtichetta(eta, a.completed_date),
      categoria: categoriaDi(a.workouts?.sections),
      haVocale,
      rpe,
      testo,
    })
  }

  elementi.sort((x, y) => y.data.localeCompare(x.data))
  return { totale: vocali + note, vocali, note, elementi }
}

/** Quanto pesa uno stato nell'ordinamento della squadra: chi non ha ancora fatto niente va in fondo. */
const rangoStato = (stato) => (stato === 'da fare' ? 1 : 0)

/**
 * La squadra di un giorno: chi aveva un allenamento assegnato, chi l'ha
 * chiuso, chi lo sta facendo adesso.
 *
 * Sostituisce `attivitaRecente`, che era una lista di righe «oggi e ieri». La
 * lista rispondeva alla domanda sbagliata: elencava gli eventi uno per uno,
 * mentre al coach serve il colpo d'occhio sulla squadra — cinque su sette, e
 * quali due mancano. Il giorno si sceglie con `scarto` (0 = oggi, -1 = ieri),
 * così la stessa card serve entrambi senza raddoppiare il codice.
 *
 * ⚠️ `inCorso` sono `athlete_id`, e arrivano dalla presenza Realtime della Live
 * Coach Cam: è l'unica fonte che sappia distinguere «non ha ancora finito» da
 * «lo sta facendo in questo momento». Senza, i due casi collassano su «da fare»
 * e il coach non vede l'unico che potrebbe guardare dal vivo.
 */
export function squadraDelGiorno(atleti = [], assegnazioni = [], { scarto = 0, inCorso = [], oggi = new Date() } = {}) {
  const data = giorno(new Date(startOfDay(oggi).getTime() + scarto * 86400000))
  const vivi = new Set(inCorso)

  const perAtleta = new Map()
  for (const a of assegnazioni) {
    if (a?.completed_date !== data || !a.athlete_id) continue
    const precedente = perAtleta.get(a.athlete_id)
    // Con due assegnazioni nello stesso giorno vince quella completata: il
    // pallino verde dice «ha fatto la sua parte», e una seconda riga rimasta
    // aperta non la annulla.
    if (!precedente || (a.status === 'completed' && precedente.status !== 'completed')) perAtleta.set(a.athlete_id, a)
  }

  const righe = []
  const rpe = []
  let completati = 0
  for (const atleta of atletiSeguiti(atleti)) {
    const ass = perAtleta.get(atleta?.id)
    if (!ass) continue
    const completato = ass.status === 'completed'
    if (completato) completati++
    const valore = completato ? rpeDichiarato(ass.notes) : null
    if (valore != null) rpe.push(valore)
    righe.push({
      id: atleta.id,
      workoutId: ass.workouts?.id,
      // Il nome proprio, non il nome completo: è un'etichetta sotto un volto,
      // larga 54px. Un cognome lì diventa puntini di sospensione.
      nome: (atleta.name || '').trim() || nomeCompleto(atleta),
      foto: atleta.photo_url || null,
      titolo: ass.workouts?.title || 'Allenamento',
      categoria: categoriaDi(ass.workouts?.sections),
      stato: completato ? 'completato' : vivi.has(atleta.id) ? 'in corso' : 'da fare',
      rpe: valore,
    })
  }
  righe.sort((a, b) => rangoStato(a.stato) - rangoStato(b.stato) || a.nome.localeCompare(b.nome))

  return {
    righe,
    assegnati: righe.length,
    completati,
    inCorso: righe.filter(r => r.stato === 'in corso').length,
    // ⚠️ Media dei soli RPE DICHIARATI. `rpeDichiarato` torna null dove il
    // marcatore non c'è: contare il ripiego 5 come misura darebbe un numero
    // plausibile e falso, che è il difetto già corretto in `mediaRpeCategoria`
    // (CLAUDE.md §9-octies).
    rpeMedio: rpe.length ? Math.round((rpe.reduce((somma, v) => somma + v, 0) / rpe.length) * 10) / 10 : null,
  }
}
