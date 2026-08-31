import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { montaPagina } from '../../test/montaPagina'

// Perché questi test esistono
// ────────────────────────────
// Il rework del calendario non tocca un solo campo di Supabase: cambia cosa
// ogni cella dichiara di sé e quali numeri la pagina si sente autorizzata a
// dire. È il tipo di cambiamento che si rompe restando verde, perché il
// risultato sbagliato è sempre PLAUSIBILE:
//  · un «Completati» mostrato al coach, la cui query non ha nessuno stato e
//    che leggerebbe quindi 0 su 18 per sempre;
//  · un volume che misura il programmato mentre la cella accanto conta il
//    fatto — due orizzonti sotto un'intestazione sola, e nessuno dei due
//    numeri sbagliato preso da solo;
//  · un «RPE 5» che non è l'RPE di nessuno, ma il ripiego di parseNotesAndRpe;
//  · una legenda che spiega un colore che nel mese non compare.

const dati = await vi.hoisted(async () => ({ workouts: [], assegnazioni: [] }))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    workouts: dati.workouts,
    athlete_workouts: dati.assegnazioni,
  }))
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const Calendar = (await import('../Calendar')).default

// Il 22 agosto 2026 è un sabato, e agosto 2026 comincia di sabato: due fatti
// su cui i test si appoggiano, quindi l'orologio va fermato.
const OGGI = new Date(2026, 7, 22, 10, 0, 0)

const EMOM = {
  id: 1, type: 'EMOM', params: { interval: '1:00', rounds: '20' },
  exercises: [{ name: 'Wall Balls', reps: '15', intensity: '8' }],
}

const hyrox = (id, title, date) => ({
  id, title, date, sections: { category: 'Hyrox', blocks: [EMOM] },
})
const corsa = (id, title, date) => ({
  id, title, date, sections: { category: 'Running', steps: [{ type: 'run', duration: '40 min' }] },
})
const gara = (id, title, date) => ({
  id, title, date, sections: { category: 'Event', isEvent: true, isAutonomous: true },
})

/** Una riga di `athlete_workouts` come la query dell'atleta la riceve. */
const assegnata = (workout, { status = 'pending', notes = null } = {}) => ({
  id: `aw-${workout.id}`, completed_date: workout.date, status, notes, workouts: workout,
})

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(OGGI)
  finto.chiamate.length = 0
  dati.workouts = []
  dati.assegnazioni = []
})
afterEach(() => vi.useRealTimers())

const utente = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
const montaCoach = () => montaPagina(<Calendar />, { role: 'admin' })
const montaAtleta = () => montaPagina(<Calendar />, { role: 'athlete' })

// ⚠️ La fascia, la legenda e le righe usano le STESSE parole — «Gara»,
// «Running», «Fatto» — e i numeri della fascia coincidono con i numeri dei
// giorni nella griglia. Senza queste due lenti un `getByText('2')` prenderebbe
// il 2 agosto, e un test che verifica la fascia verificherebbe la griglia.
const fascia = () => within(screen.getByRole('group', { name: 'Riepilogo del mese' }))
const legenda = () => screen.queryByRole('group', { name: 'Legenda del mese' })
/** La cella della fascia con quell'etichetta: il valore è il fratello sotto. */
const cellaFascia = (etichetta) => fascia().getByText(etichetta).parentElement

// ── La fascia di sintesi ──────────────────────────────────────────────────

describe('Calendario — la fascia di sintesi', () => {
  it('all\'atleta dice quanti ne ha chiusi sul totale del mese', async () => {
    dati.assegnazioni = [
      assegnata(hyrox(1, 'A', '2026-08-03'), { status: 'completed' }),
      assegnata(hyrox(2, 'B', '2026-08-05'), { status: 'completed' }),
      assegnata(hyrox(3, 'C', '2026-08-07')),
    ]
    montaAtleta()
    await screen.findByRole('group', { name: 'Riepilogo del mese' })
    const cella = cellaFascia('Completati')
    expect(within(cella).getByText('2')).toBeInTheDocument()
    expect(within(cella).getByText('/3')).toBeInTheDocument()
  })

  // 🔴 La query del coach legge `workouts`, che NON ha una colonna di stato:
  // un «Completati» per lui leggerebbe 0 su 18 per sempre, e sarebbe un numero
  // che sembra un dato. Deve dire cosa sa davvero, cioè il programmato.
  it('al coach dice il programmato, mai un «completati» che sarebbe sempre zero', async () => {
    dati.workouts = [hyrox(1, 'A', '2026-08-03'), hyrox(2, 'B', '2026-08-05')]
    montaCoach()
    await screen.findByRole('group', { name: 'Riepilogo del mese' })
    expect(fascia().getByText('Programmati')).toBeInTheDocument()
    expect(fascia().queryByText('Completati')).not.toBeInTheDocument()
  })

  // 🔴 Il test che conta di più della fascia. Le due celle devono misurare lo
  // STESSO insieme: due EMOM chiusi da 20′ fanno 40′, e il terzo — programmato
  // e non fatto — non deve entrarci. Con «1 h» accanto a «2/3» nessuno dei due
  // numeri sarebbe sbagliato preso da solo, ed è per questo che il difetto
  // sarebbe invisibile.
  it('il volume dell\'atleta misura i completati, non tutto il programmato', async () => {
    dati.assegnazioni = [
      assegnata(hyrox(1, 'A', '2026-08-03'), { status: 'completed' }),
      assegnata(hyrox(2, 'B', '2026-08-05'), { status: 'completed' }),
      assegnata(hyrox(3, 'C', '2026-08-07')),
    ]
    montaAtleta()
    await screen.findByRole('group', { name: 'Riepilogo del mese' })
    // 40′, cioè i due EMOM chiusi. Non «1 h», che sarebbe il totale dei tre.
    expect(within(cellaFascia('Volume')).getByText('40')).toBeInTheDocument()
  })

  // ⚠️ Una gara non ha blocchi da stimare: entra nel totale delle sessioni ma
  // non nelle ore. Il `≈` è l'unico modo di dirlo in una cella larga quanto un
  // numero — senza, la somma parziale si legge come completa.
  it('segna il volume come parziale quando una sessione non è stimabile', async () => {
    dati.workouts = [hyrox(1, 'A', '2026-08-03'), gara(2, 'Hyrox Milano', '2026-08-15')]
    montaCoach()
    await screen.findByRole('group', { name: 'Riepilogo del mese' })
    expect(within(cellaFascia('Volume')).getByText('≈20')).toBeInTheDocument()
  })

  it('mostra il giorno della gara del mese, e un trattino quando non ce n\'è', async () => {
    dati.workouts = [gara(2, 'Hyrox Milano', '2026-08-15')]
    const { unmount } = montaCoach()
    await screen.findByRole('group', { name: 'Riepilogo del mese' })
    expect(within(cellaFascia('Gara')).getByText('15 ago')).toBeInTheDocument()
    unmount()

    dati.workouts = [hyrox(1, 'A', '2026-08-03')]
    montaCoach()
    await screen.findByRole('group', { name: 'Riepilogo del mese' })
    expect(within(cellaFascia('Gara')).getByText('—')).toBeInTheDocument()
  })
})

// ── La griglia ────────────────────────────────────────────────────────────

describe('Calendario — la griglia del mese', () => {
  // ⚠️ La barra si ferma a tre segmenti, ma il numero VERO deve restare
  // leggibile: senza, un giorno da cinque e uno da tre sono la stessa cella
  // anche per chi la barra non la vede affatto.
  it('la cella dichiara il numero vero di allenamenti, oltre il tetto dei segmenti', async () => {
    dati.workouts = Array.from({ length: 5 }, (_, i) => hyrox(i + 1, `W${i}`, '2026-08-10'))
    montaCoach()
    expect(await screen.findByLabelText('10 agosto, 5 allenamenti')).toBeInTheDocument()
  })

  it('la cella dice anche quanti ne sono stati chiusi', async () => {
    dati.assegnazioni = [
      assegnata(hyrox(1, 'A', '2026-08-10'), { status: 'completed' }),
      assegnata(hyrox(2, 'B', '2026-08-10')),
    ]
    montaAtleta()
    expect(await screen.findByLabelText('10 agosto, 2 allenamenti, 1 completato')).toBeInTheDocument()
  })

  // 🔴 «Oggi» e «selezionato» sono due stati distinti: nel calendario di prima
  // erano quasi lo stesso, e all'apertura il giorno corrente spariva sotto la
  // selezione. Qui la cella di oggi resta `aria-current` anche mentre un altro
  // giorno è premuto.
  it('oggi e il giorno selezionato restano due stati distinti', async () => {
    dati.workouts = []
    montaCoach()
    const oggi = await screen.findByLabelText(/^22 agosto/)
    expect(oggi).toHaveAttribute('aria-current', 'date')
    expect(oggi).toHaveAttribute('aria-pressed', 'true')

    await utente().click(screen.getByLabelText(/^25 agosto/))
    expect(screen.getByLabelText(/^25 agosto/)).toHaveAttribute('aria-pressed', 'true')
    expect(oggi).toHaveAttribute('aria-current', 'date')
    expect(oggi).toHaveAttribute('aria-pressed', 'false')
  })

  it('scegliere un giorno cambia la lista sotto la griglia', async () => {
    dati.workouts = [hyrox(1, 'Full Body', '2026-08-22'), corsa(2, 'Lungo', '2026-08-25')]
    montaCoach()
    expect(await screen.findByText('Full Body')).toBeInTheDocument()

    await utente().click(screen.getByLabelText(/^25 agosto/))
    expect(screen.getByText('Lungo')).toBeInTheDocument()
    expect(screen.queryByText('Full Body')).not.toBeInTheDocument()
  })
})

// ── La legenda ────────────────────────────────────────────────────────────

describe('Calendario — la legenda', () => {
  // 🔴 Stessa regola dei chip dell'archivio: si deriva dai dati. Una voce
  // «Gara» in un mese senza gare è la chiave di lettura di un colore che non
  // compare in nessuna cella.
  it('nomina solo le corsie che nel mese ci sono davvero', async () => {
    dati.workouts = [hyrox(1, 'A', '2026-08-03'), corsa(2, 'B', '2026-08-05')]
    montaCoach()
    await waitFor(() => expect(legenda()).toBeInTheDocument())
    expect(within(legenda()).getByText('Hyrox')).toBeInTheDocument()
    expect(within(legenda()).getByText('Running')).toBeInTheDocument()
    expect(within(legenda()).queryByText('Gara')).not.toBeInTheDocument()
  })

  it('non compare affatto quando il mese ha un colore solo', async () => {
    dati.workouts = [hyrox(1, 'A', '2026-08-03'), hyrox(2, 'B', '2026-08-05')]
    montaCoach()
    await screen.findByRole('group', { name: 'Riepilogo del mese' })
    expect(legenda()).not.toBeInTheDocument()
  })

  // ⚠️ La regola è sui DATI, non sul ruolo: la voce compare se qualcosa è
  // chiuso davvero. Il coach la vede sparire non perché sia il coach, ma
  // perché la sua query legge `workouts`, che non ha nessuna colonna di stato
  // — e il caso del coach è la dimostrazione, non la regola.
  it('aggiunge «Fatto» solo dove qualcosa è chiuso davvero', async () => {
    dati.assegnazioni = [
      assegnata(hyrox(1, 'A', '2026-08-03'), { status: 'completed' }),
      assegnata(corsa(2, 'B', '2026-08-05')),
    ]
    const { unmount } = montaAtleta()
    await waitFor(() => expect(legenda()).toBeInTheDocument())
    expect(within(legenda()).getByText('Fatto')).toBeInTheDocument()
    unmount()

    dati.workouts = [hyrox(1, 'A', '2026-08-03'), corsa(2, 'B', '2026-08-05')]
    montaCoach()
    await waitFor(() => expect(legenda()).toBeInTheDocument())
    expect(within(legenda()).queryByText('Fatto')).not.toBeInTheDocument()
  })
})

// ── Le righe del giorno ───────────────────────────────────────────────────

describe('Calendario — la riga di una sessione', () => {
  // 🔴 `parseNotesAndRpe` torna 5 quando il marcatore non c'è. Su un
  // allenamento chiuso senza RPE dichiarato la riga scriverebbe «RPE 5», che
  // non è l'RPE di nessuno — ed è esattamente il tipo di numero che chi legge
  // prende per un dato.
  it('scrive l\'RPE solo quando l\'atleta l\'ha dichiarato davvero', async () => {
    dati.assegnazioni = [
      assegnata(hyrox(1, 'Con RPE', '2026-08-22'), { status: 'completed', notes: '[RPE: 8/10]\nbene' }),
      assegnata(hyrox(2, 'Senza RPE', '2026-08-22'), { status: 'completed', notes: 'nessun marcatore' }),
    ]
    montaAtleta()
    expect(await screen.findByText(/RPE 8/)).toBeInTheDocument()
    expect(screen.queryByText(/RPE 5/)).not.toBeInTheDocument()
  })

  // ⚠️ Ogni riga sta già sotto l'intestazione della propria data: ripeterla lì
  // dentro toglie larghezza — su 393px — proprio ai blocchi e ai minuti, che
  // sono l'unica cosa per cui si guarda quella riga.
  it('la riga non ripete la data che l\'intestazione sopra dice già', async () => {
    dati.workouts = [hyrox(1, 'Full Body', '2026-08-22')]
    montaCoach()
    expect(await screen.findByText('1 blocco · 20′')).toBeInTheDocument()
    expect(screen.getByText('Sabato 22 agosto')).toBeInTheDocument()
  })

  it('nomina il blocco di lavoro di un Hyrox, e la corsia sulle altre categorie', async () => {
    dati.workouts = [hyrox(1, 'Full Body', '2026-08-22'), corsa(2, 'Lungo', '2026-08-22')]
    montaCoach()
    const riga = await screen.findByRole('button', { name: /Lungo/ })
    expect(screen.getByRole('button', { name: /EMOM/ })).toBeInTheDocument()
    expect(within(riga).getByText('Running')).toBeInTheDocument()
  })

  // Lo stato esiste solo dove il dato esiste. Per il coach non c'è nessun «da
  // fare» da mostrare, e inventarlo sarebbe peggio che tacerlo.
  it('mostra lo stato all\'atleta e mai al coach', async () => {
    dati.assegnazioni = [
      assegnata(hyrox(1, 'Sessione chiusa', '2026-08-22'), { status: 'completed' }),
      assegnata(hyrox(2, 'Sessione aperta', '2026-08-22')),
    ]
    const { unmount } = montaAtleta()
    const chiusa = await screen.findByRole('button', { name: /Sessione chiusa/ })
    expect(within(chiusa).getByText('Fatto')).toBeInTheDocument()
    const aperta = screen.getByRole('button', { name: /Sessione aperta/ })
    expect(within(aperta).getByText('Da fare')).toBeInTheDocument()
    unmount()

    dati.workouts = [hyrox(1, 'Full Body', '2026-08-22')]
    montaCoach()
    await waitFor(() => expect(screen.getByText('Full Body')).toBeInTheDocument())
    expect(screen.queryByText('Da fare')).not.toBeInTheDocument()
  })

  // 🔴 Trovato guardando la pagina a 393px, non leggendo il codice — e poi
  // leggendo lo stile CALCOLATO, che è l'unico posto in cui il difetto vero si
  // vedeva. Due cose insieme:
  //  · il bordo ambra vuol dire «da fare»: legato al semplice «non è chiuso»,
  //    la lista del coach diventava tutta ambra, corsa compresa;
  //  · e non era nemmeno ambra. `CARTA_RIGA` porta già `border-white/[.07]`, e
  //    `border-brand/20` accanto NON vince: stessa specificità, decide
  //    l'ordine nel foglio di stile. Ecco perché qui si verifica che la riga
  //    NON porti il bordo neutro, e non solo che porti quello ambra: la sola
  //    presenza della classe è esattamente ciò che era verde e falso.
  it('il bordo ambra marca il «da fare», e non convive con quello neutro', async () => {
    dati.assegnazioni = [assegnata(hyrox(1, 'Da chiudere', '2026-08-22'))]
    const { unmount } = montaAtleta()
    const daFare = await screen.findByRole('button', { name: /Da chiudere/ })
    expect(daFare).toHaveClass('border-brand/25')
    expect(daFare).not.toHaveClass('border-white/[.07]')
    unmount()

    dati.workouts = [corsa(2, 'Lungo del coach', '2026-08-22')]
    montaCoach()
    const riga = await screen.findByRole('button', { name: /Lungo del coach/ })
    expect(riga).not.toHaveClass('border-brand/25')
    expect(riga).toHaveClass('border-white/[.07]')
  })

  it('regge un titolo nullo invece di portarsi via la pagina', async () => {
    dati.workouts = [{ ...hyrox(1, null, '2026-08-22'), title: null }]
    montaCoach()
    expect(await screen.findByText('Senza titolo')).toBeInTheDocument()
  })
})

// ── I comandi ─────────────────────────────────────────────────────────────

describe('Calendario — i comandi', () => {
  // ⚠️ «Oggi» compare solo quando serve: sul mese corrente sarebbe un bottone
  // che non fa niente, e a tre mesi di distanza è l'unico modo di tornare
  // indietro in un tocco invece che in tre.
  it('«Oggi» compare solo quando il mese mostrato non è quello corrente', async () => {
    dati.workouts = []
    montaCoach()
    await waitFor(() => expect(screen.getByText('Agosto')).toBeInTheDocument())
    expect(screen.queryByText('Oggi')).not.toBeInTheDocument()

    await utente().click(screen.getByLabelText('Mese successivo'))
    expect(screen.getByText('Settembre')).toBeInTheDocument()
    expect(screen.getByText('Oggi')).toBeInTheDocument()

    await utente().click(screen.getByText('Oggi'))
    expect(screen.getByText('Agosto')).toBeInTheDocument()
    expect(screen.queryByText('Oggi')).not.toBeInTheDocument()
  })

  // L'aggiunta di un allenamento è un gesto del coach: l'atleta non ha da
  // questa pagina nessun flusso per crearne uno, e un bottone che porta a una
  // schermata vietata è peggio di nessun bottone.
  it('la riga di aggiunta è del coach, non dell\'atleta', async () => {
    dati.workouts = []
    const { unmount } = montaCoach()
    expect(await screen.findByText('Aggiungi al 22 agosto')).toBeInTheDocument()
    unmount()

    dati.assegnazioni = []
    montaAtleta()
    await waitFor(() => expect(screen.getByText('Nessun allenamento')).toBeInTheDocument())
    expect(screen.queryByText(/Aggiungi al/)).not.toBeInTheDocument()
  })

  // 🔴 Senza `notes` nella select, `rpeDichiarato` non ha niente da leggere e
  // l'RPE della riga non può esistere — e non lo direbbe nessun errore: la
  // riga si limiterebbe a non mostrarlo mai.
  it('la query dell\'atleta carica le note, che è dove sta l\'RPE', async () => {
    dati.assegnazioni = []
    montaAtleta()
    await waitFor(() => expect(finto.chiamateA('athlete_workouts', 'select').length).toBeGreaterThan(0))
    const select = finto.chiamateA('athlete_workouts', 'select')[0]
    expect(select.args[0]).toContain('notes')
    expect(select.args[0]).toContain('status')
  })
})
