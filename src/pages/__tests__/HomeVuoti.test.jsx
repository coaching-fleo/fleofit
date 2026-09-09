import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { montaPagina } from '../../test/montaPagina'

// Perché questi test esistono
// ────────────────────────────
// Gli stati senza storico (CLAUDE.md §9-duodetricies) non aggiungono numeri:
// tolgono quelli che non esistono. È una categoria di regressione che non dà
// nessun errore — rimettere il bento sotto il giorno 1, o legare la prima
// settimana al conteggio delle RIGHE invece che dei completati, restituisce
// una pagina che si monta, si legge, e dice all'atleta appena arrivato che è
// già indietro.
//
// ⚠️ Tempo congelato a mercoledì 9 settembre 2026: settimana lunedì 7 →
// domenica 13, precedente lunedì 31 ago → domenica 6 set. Senza congelarlo,
// «un allenamento chiuso ieri, dentro la settimana» è vero sei giorni su sette
// e falso il lunedì: il test passerebbe o no a seconda del giorno in cui gira.
const OGGI = new Date('2026-09-09T10:00:00')

const ctrl = vi.hoisted(() => ({ righe: [] }))

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    athlete_workouts: ctrl.righe,
    notifications: [],
  }))
})

vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))
vi.mock('@capacitor/network', () => ({
  Network: {
    getStatus: vi.fn(() => Promise.resolve({ connected: true })),
    addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
  },
}))

const Home = (await import('../Home')).default

/** Una riga di athlete_workouts con una durata dichiarata in minuti. */
const seduta = (data, { minuti = 40, stato = 'completed', rpe = null, titolo = 'Hyrox Forza', id = null } = {}) => ({
  id: id || `aw-${data}-${stato}`,
  completed_date: data,
  status: stato,
  notes: rpe != null ? `[RPE: ${rpe}/10]\nAndata bene` : null,
  workouts: {
    id: `w-${data}`,
    title: titolo,
    sections: { category: 'Hyrox', intensity: '7', blocks: [{ type: 'AMRAP', params: { duration: `${minuti} min` } }] },
  },
})

const monta = (righe) => {
  ctrl.righe = righe
  montaPagina(<Home />, { role: 'athlete' })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(OGGI)
  window.localStorage.clear()
  ctrl.righe = []
})
afterEach(() => { vi.useRealTimers() })

// ─────────────────────────────────────────────────────────────────────────
describe('2a · Il giorno 1', () => {
  it('mostra il benvenuto del coach al posto dei numeri', async () => {
    monta([])
    expect(await screen.findByText(/ti segue da oggi/i)).toBeInTheDocument()
    expect(screen.getByText('Federico Leo', { exact: false })).toBeInTheDocument()
    expect(screen.getByLabelText('Completa il tuo profilo')).toBeInTheDocument()
    expect(screen.getByText('Hai una gara in programma?')).toBeInTheDocument()
    expect(screen.getByLabelText('Registra il primo allenamento')).toBeInTheDocument()
    expect(screen.getByText('Come funziona')).toBeInTheDocument()
  })

  // 🔴 Il test che vale più di tutti gli altri di questo file, ed è la ragione
  // per cui il ramo del giorno 1 CHIUDE la pagina invece di essere una card in
  // più sopra l'albero esistente. Ognuno di questi quattro elementi mostrava
  // uno zero perfettamente corretto — anello 0/0, «Serie: 0 giorni», «0 min»,
  // «In arrivo» vuoto — cioè quattro numeri veri che dicono a chi ha appena
  // installato l'app che è già indietro.
  // ⚠️ `weeklyStatus.length > 0` NON proteggeva da niente: nasce con sette
  // giorni, quindi era sempre vero (stesso difetto della Home coach, §9-nonies).
  it('NON mostra anello, serie, volume né «In arrivo»', async () => {
    monta([])
    await screen.findByText(/ti segue da oggi/i)
    expect(screen.queryByLabelText(/allenamenti completati su/)).not.toBeInTheDocument()
    expect(screen.queryByText('Serie')).not.toBeInTheDocument()
    expect(screen.queryByText('Volume · RPE')).not.toBeInTheDocument()
    expect(screen.queryByText('In arrivo')).not.toBeInTheDocument()
  })

  // Al giorno 1 la domanda sull'obiettivo la fa già `CampoObiettivo`: farla di
  // nuovo con il banner sarebbe la stessa domanda due volte nella stessa
  // schermata, cioè un'insistenza.
  it('chiede l\'obiettivo UNA volta sola', async () => {
    monta([])
    await screen.findByText(/ti segue da oggi/i)
    expect(screen.queryByLabelText('Fissa il tuo obiettivo')).not.toBeInTheDocument()
  })

  // 🔴 Il caso che `senzaStorico` esiste per prendere, e qui si verifica sulla
  // PAGINA: un atleta senza niente in settimana ma con un allenamento fra dieci
  // giorni ha già un programma. Mostrargli «il tuo coach sta preparando la tua
  // prima settimana» vorrebbe dire nascondergli la settimana che è già pronta.
  it('NON è il giorno 1 se c\'è un assegnato fuori dalla settimana', async () => {
    monta([seduta('2026-09-19', { stato: 'pending', titolo: 'Hyrox Lungo' })])
    // ⚠️ `getAllByText`: il titolo compare due volte di proposito — nella card
    // «In arrivo» del riposo e nella lista dei prossimi giorni.
    expect((await screen.findAllByText('Hyrox Lungo')).length).toBeGreaterThan(0)
    expect(screen.queryByText(/ti segue da oggi/i)).not.toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('2b · La prima settimana', () => {
  // 🔴 «Primo dato» porta i minuti di QUELL'allenamento, non il totale della
  // settimana. Qui il primo completato è della settimana SCORSA, quindi
  // `weeklyStats.time` vale 0: una cella che leggesse il totale settimanale
  // scriverebbe «0 min» sotto una data e un RPE veri. È l'unica configurazione
  // in cui le due letture si separano — con un solo completato dentro la
  // settimana coincidono, e la mutazione non cadrebbe.
  // ⚠️ DUE completati, non uno, ed è quello che rende il test capace di cadere:
  // `storicoAtleta` arriva in ordine ASCENDENTE, quindi «il primo dato» è
  // `completati[0]`. Con un solo completato `[0]` e `.at(-1)` coincidono, e la
  // mutazione sull'ordine passerebbe inosservata finché un atleta non ne ha due.
  it('mostra il PRIMO allenamento come dato: minuti suoi, giorno e RPE', async () => {
    monta([
      seduta('2026-09-02', { minuti: 55, rpe: 8, id: 'primo' }),
      seduta('2026-09-08', { minuti: 35, rpe: 6, id: 'secondo' }),
      seduta('2026-09-09', { stato: 'pending', titolo: 'Hyrox Oggi' }),
    ])
    const cella = (await screen.findByText('Primo dato')).closest('div')
    expect(cella).toHaveTextContent('55')
    expect(cella).toHaveTextContent('mer 2')
    expect(cella).toHaveTextContent('RPE 8')
    // 35 è insieme il secondo allenamento E il totale della settimana in corso:
    // una cella che leggesse `weeklyStats.time`, o l'ultimo invece del primo,
    // scriverebbe quel numero. Nessuna delle due darebbe un errore.
    expect(cella).not.toHaveTextContent('35')
  })

  // ⚠️ `rpeDichiarato` e non `parseNotesAndRpe`: il secondo torna 5 quando il
  // marcatore manca, e quel 5 comparirebbe come la PRIMA misura della vita
  // dell'atleta — un numero inventato nel punto in cui pesa di più.
  it('senza RPE dichiarato la voce sparisce, non diventa 5', async () => {
    monta([
      seduta('2026-09-02', { minuti: 55 }),
      seduta('2026-09-09', { stato: 'pending', titolo: 'Hyrox Oggi' }),
    ])
    const cella = (await screen.findByText('Primo dato')).closest('div')
    expect(cella).toHaveTextContent('55')
    expect(cella).not.toHaveTextContent('RPE')
  })

  it('la media RPE è una cella bloccata che dichiara la soglia e il progresso', async () => {
    monta([
      seduta('2026-09-08', { minuti: 40, rpe: 7 }),
      seduta('2026-09-09', { stato: 'pending', titolo: 'Hyrox Oggi' }),
    ])
    expect(await screen.findByText('Media RPE')).toBeInTheDocument()
    expect(screen.getByText('1/3')).toBeInTheDocument()
    expect(screen.queryByText('Volume · RPE')).not.toBeInTheDocument()
    expect(screen.queryByText('Serie')).not.toBeInTheDocument()
  })

  it('l\'anello si chiama «Settimana 1 · iniziata», non «completati»', async () => {
    monta([
      seduta('2026-09-08', { rpe: 7 }),
      seduta('2026-09-09', { stato: 'pending', titolo: 'Hyrox Oggi' }),
    ])
    expect(await screen.findByText('Settimana 1')).toBeInTheDocument()
    expect(screen.getByText('iniziata')).toBeInTheDocument()
    expect(screen.queryByText('completati')).not.toBeInTheDocument()
  })

  // 🔴 Il caso che il conteggio delle RIGHE lascia passare. Cinque allenamenti
  // assegnati e nessuno completato: `storicoAtleta.length` vale 5, quindi con
  // quel criterio la prima settimana sarebbe finita e l'atleta leggerebbe
  // «Serie: 0 giorni» e «0 min» — proprio gli zeri che questo rework toglie.
  // Sono i completati a decidere.
  it('con soli assegnati e nessun completato resta la prima settimana', async () => {
    monta([
      seduta('2026-09-08', { stato: 'pending' }),
      seduta('2026-09-09', { stato: 'pending', titolo: 'Hyrox Oggi' }),
      seduta('2026-09-10', { stato: 'pending' }),
      seduta('2026-09-11', { stato: 'pending' }),
      seduta('2026-09-12', { stato: 'pending' }),
    ])
    expect(await screen.findByText('Primo dato')).toBeInTheDocument()
    expect(screen.queryByText('Serie')).not.toBeInTheDocument()
    expect(screen.queryByText('Volume · RPE')).not.toBeInTheDocument()
    // ⚠️ E la cella «Primo dato» qui NON ha la barra: «0/1» sarebbe di nuovo
    // uno zero, ed è il motivo per cui `soglia` è facoltativa.
    expect(screen.queryByText('0/1')).not.toBeInTheDocument()
  })

  it('l\'obiettivo non fissato prende il posto del countdown', async () => {
    monta([
      seduta('2026-09-08', { rpe: 7 }),
      seduta('2026-09-09', { stato: 'pending', titolo: 'Hyrox Oggi' }),
    ])
    expect(await screen.findByLabelText('Fissa il tuo obiettivo')).toBeInTheDocument()
  })

  it('dal terzo allenamento tornano serie e volume', async () => {
    monta([
      seduta('2026-09-07', { rpe: 7, id: 'a' }),
      seduta('2026-09-08', { rpe: 8, id: 'b' }),
      seduta('2026-09-09', { rpe: 6, id: 'c' }),
    ])
    expect(await screen.findByText('Serie')).toBeInTheDocument()
    expect(screen.getByText('Volume · RPE')).toBeInTheDocument()
    expect(screen.getByText('completati')).toBeInTheDocument()
    expect(screen.queryByText('Primo dato')).not.toBeInTheDocument()
    expect(screen.queryByText('Media RPE')).not.toBeInTheDocument()
    // Con lo storico in pagina, chiedere di nuovo l'obiettivo è rumore.
    expect(screen.queryByLabelText('Fissa il tuo obiettivo')).not.toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('2c · Il giorno di riposo', () => {
  const settimanaConRiposo = [
    seduta('2026-09-07', { minuti: 50, rpe: 7, id: 'a' }),
    seduta('2026-09-08', { minuti: 40, rpe: 8, id: 'b' }),
    seduta('2026-09-10', { stato: 'pending', titolo: 'Hyrox Domani', id: 'c' }),
  ]

  it('è una schermata piena, non il tratteggio «Recupera le energie»', async () => {
    monta(settimanaConRiposo)
    expect(await screen.findByText(/Oggi non ti alleni/)).toBeInTheDocument()
    expect(screen.getByText(/Hai chiuso 90 minuti in 2 giorni/)).toBeInTheDocument()
    expect(screen.getByLabelText('Rivedi la settimana')).toBeInTheDocument()
    expect(screen.getByLabelText('Registra un allenamento fatto oggi')).toBeInTheDocument()
    expect(screen.queryByText('Recupera le energie per il prossimo allenamento.')).not.toBeInTheDocument()
  })

  it('porta il carico della settimana con la frazione', async () => {
    monta(settimanaConRiposo)
    await screen.findByText(/Oggi non ti alleni/)
    // ⚠️ «Settimana» senza numero è la card del carico: l'anello qui si chiama
    // «Settimana 1», perché con due completati siamo ancora nella prima.
    expect(screen.getByText('Settimana')).toBeInTheDocument()
    expect(screen.getByText('90')).toBeInTheDocument()
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })

  // 🔴 «+90 min sulla scorsa» su una settimana in cui l'atleta non esisteva è
  // un dato finto: lo scarto torna `null` e la riga sparisce.
  it('NON dichiara uno scarto se la settimana precedente è vuota', async () => {
    monta(settimanaConRiposo)
    await screen.findByText(/Oggi non ti alleni/)
    expect(screen.queryByText(/sulla scorsa/)).not.toBeInTheDocument()
  })

  it('lo dichiara quando c\'è davvero qualcosa con cui confrontarsi', async () => {
    monta([seduta('2026-09-02', { minuti: 60, rpe: 7, id: 'z' }), ...settimanaConRiposo])
    await screen.findByText(/Oggi non ti alleni/)
    expect(await screen.findByText(/\+30 min/)).toBeInTheDocument()
  })

  it('dice cosa arriva domani, con blocchi e minuti', async () => {
    monta(settimanaConRiposo)
    expect(await screen.findByText('Domani')).toBeInTheDocument()
    // ⚠️ `getAllByLabelText`: lo stesso allenamento è anche il punto di
    // giovedì nell'anello della settimana, che è a sua volta un bottone
    // «Apri …» — è la lista dei prossimi giorni della Home, non un duplicato.
    expect(screen.getAllByLabelText('Apri Hyrox Domani').length).toBeGreaterThan(0)
    expect(screen.getByText(/1 blocco · 40′/)).toBeInTheDocument()
  })

  // ⚠️ La card mostra il PRIMO in arrivo, che non è per forza domani: se il
  // prossimo assegnato è fra tre giorni, l'etichetta «Domani» è una riga che
  // mente, e nessun errore la segnala.
  it('quando il prossimo non è domani si chiama «In arrivo»', async () => {
    monta([
      seduta('2026-09-07', { minuti: 50, rpe: 7, id: 'a' }),
      seduta('2026-09-12', { stato: 'pending', titolo: 'Hyrox Sabato', id: 'c' }),
    ])
    expect(await screen.findByText('In arrivo', { selector: 'span' })).toBeInTheDocument()
    expect(screen.queryByText('Domani')).not.toBeInTheDocument()
  })

  it('con un allenamento oggi il riposo non compare affatto', async () => {
    monta([seduta('2026-09-09', { stato: 'pending', titolo: 'Hyrox Oggi' })])
    expect(await screen.findByText('Hyrox Oggi')).toBeInTheDocument()
    expect(screen.queryByText(/Oggi non ti alleni/)).not.toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('Una lettura fallita non si legge come «non hai niente»', () => {
  // La cache è l'unica difesa che l'app ha già: se la rete cade, la Home si
  // dipinge con l'ultima risposta buona (§9-noviesdecies) invece di mostrare
  // il benvenuto del giorno 1 a chi si allena da mesi.
  it('con la cache in localStorage non mostra il benvenuto del giorno 1', async () => {
    const { chiaveCacheWorkout } = await import('../../lib/offlineQueue')
    window.localStorage.setItem(chiaveCacheWorkout('u1'),
      JSON.stringify([seduta('2026-09-09', { stato: 'pending', titolo: 'Dalla cache' })]))
    monta([])
    expect(screen.getByText('Dalla cache')).toBeInTheDocument()
    expect(screen.queryByText(/ti segue da oggi/i)).not.toBeInTheDocument()
    // E quando la rete (vuota) risponde, comanda lei: è il comportamento
    // esistente, e va detto perché è l'unico caso in cui il giorno 1 arriva
    // dopo qualcos'altro.
    await waitFor(() => expect(screen.getByText(/ti segue da oggi/i)).toBeInTheDocument())
  })
})
