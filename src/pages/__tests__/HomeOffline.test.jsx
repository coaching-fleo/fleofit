import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { montaPagina, oggi } from '../../test/montaPagina'
import { CHIAVE_CODA, chiaveCacheWorkout } from '../../lib/offlineQueue'

// Perché questi test esistono
// ────────────────────────────
// BACKLOG #19. La coda offline è l'unico punto dell'app dove un guasto costa
// DATI: un workout completato senza rete vive solo in localStorage finché la
// linea non torna. Il 25-26/08/2026 ci sono stati trovati quattro difetti, tutti
// invisibili (CLAUDE.md §9-quater). I test unitari coprono src/lib/offlineQueue,
// ma il PERCORSO — completo un workout, non c'è rete, l'azione finisce in coda,
// la modale si chiude — non era coperto da niente.
//
// Il montaggio di Home è diventato possibile il 26/08, quando si è scoperto che
// il blocco non erano i finti supabase e router ma un localStorage rotto in
// jsdom, e che serviva anche registerPlugin nel finto @capacitor/core.

const ctrl = await vi.hoisted(async () => ({ connesso: { valore: true }, fetchFallisce: { valore: false }, stato: { valore: 'pending' } }))
const rete = ctrl

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  const giorno = new Date().toISOString().split('T')[0]
  return fintoSupabase(
    () => ({
      athlete_workouts: [{
        id: 'aw1', completed_date: giorno, status: ctrl.stato.valore,
        notes: ctrl.stato.valore === 'completed' ? '[RPE: 7/10]\nGambe pesanti' : null,
        workouts: { id: 'w1', title: 'Hyrox Forza', sections: { category: 'Hyrox', blocks: [] } },
      }],
    }),
    { erroreSu: () => (ctrl.fetchFallisce.valore ? ['athlete_workouts'] : []) },
  )
})

vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))
vi.mock('@capacitor/network', () => ({
  Network: {
    getStatus: vi.fn(() => Promise.resolve({ connected: rete.connesso.valore })),
    addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
  },
}))

const Home = (await import('../Home')).default

const attendiCaricamento = () => waitFor(() => expect(screen.getByText('Hyrox Forza')).toBeInTheDocument())
const coda = () => JSON.parse(window.localStorage.getItem(CHIAVE_CODA) || 'null')

beforeEach(() => {
  rete.connesso.valore = true
  ctrl.fetchFallisce.valore = false
  ctrl.stato.valore = 'pending'
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('Home mostra il workout di oggi', () => {
  it('lo elenca e lo conta come da fare', async () => {
    montaPagina(<Home />)
    await attendiCaricamento()
    expect(screen.getByText('0 / 1 completati')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Segna come completato/ })).toBeInTheDocument()
  })

  it('senza rete avvisa che si può comunque salvare', async () => {
    rete.connesso.valore = false
    montaPagina(<Home />)
    await waitFor(() => expect(screen.getByText('Modalità Offline')).toBeInTheDocument())
  })
})

describe('completare un workout senza rete', () => {
  it('accoda l azione con l RPE dentro le note', async () => {
    rete.connesso.valore = false
    montaPagina(<Home />)
    await attendiCaricamento()

    await userEvent.click(screen.getByRole('button', { name: /Segna come completato/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Fatto!/ }))

    await waitFor(() => expect(coda()).toHaveLength(1))
    const azione = coda()[0]
    expect(azione.type).toBe('UPDATE_WORKOUT')
    expect(azione.payload.id).toBe('aw1')
    expect(azione.payload.status).toBe('completed')
    // L'RPE vive dentro notes come "[RPE: n/10]": è il formato che la web app
    // su main non conosce e che va preservato (CLAUDE.md §1.1).
    expect(azione.payload.notes).toMatch(/^\[RPE: \d+\/10\]/)
  })

  it('aggiorna anche la cache locale, così ricaricando resta completato', async () => {
    rete.connesso.valore = false
    window.localStorage.setItem(chiaveCacheWorkout('u1'), JSON.stringify([
      { id: 'aw1', completed_date: oggi(), status: 'pending', notes: null,
        workouts: { id: 'w1', title: 'Hyrox Forza', sections: { category: 'Hyrox' } } },
    ]))
    montaPagina(<Home />)
    await attendiCaricamento()

    await userEvent.click(screen.getByRole('button', { name: /Segna come completato/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Fatto!/ }))

    await waitFor(() => {
      const cache = JSON.parse(window.localStorage.getItem(chiaveCacheWorkout('u1')))
      expect(cache[0].status).toBe('completed')
    })
  })
})

describe('la cache corrotta non blocca più niente', () => {
  // 🔴 Questo è il guasto del 25/08 (CLAUDE.md §9-quater punto 4).
  // handleRpeSubmitHome faceva JSON.parse nudo sulla cache. Con un valore
  // illeggibile l'eccezione partiva DOPO setSavingRpe(true) e PRIMA di
  // setSavingRpe(false): la modale restava a girare per sempre e il
  // completamento appena inserito spariva. Sul ramo offline, cioè proprio
  // quando l'atleta non ha modo di capire cos'è successo.
  // ⚠️ La sequenza conta. Se il fetch RIESCE, scriviJson sovrascrive subito la
  // cache con dati validi e il valore corrotto non esiste più al momento del
  // clic: il test passerebbe per il motivo sbagliato, senza esercitare niente.
  // (Verificato il 26/08/2026 con una mutazione: la prima versione di questi
  // test non rilevava il bug che dicevano di coprire.)
  // Lo scenario vero è: l'app carica ONLINE e scrive la cache, qualcosa la
  // corrompe, POI cade la rete, POI l'atleta completa.
  it('la modale RPE si chiude invece di restare a girare', async () => {
    montaPagina(<Home />)
    await attendiCaricamento()

    window.localStorage.setItem(chiaveCacheWorkout('u1'), 'non-è-json{{{')
    rete.connesso.valore = false

    await userEvent.click(screen.getByRole('button', { name: /Segna come completato/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Fatto!/ }))

    // Prima della correzione l'eccezione partiva DOPO setSavingRpe(true) e
    // PRIMA di setSavingRpe(false): la modale restava a girare per sempre.
    await waitFor(() => expect(screen.queryByRole('button', { name: /Fatto!/ })).not.toBeInTheDocument())
  })

  it('e il completamento finisce comunque in coda, invece di sparire', async () => {
    montaPagina(<Home />)
    await attendiCaricamento()

    window.localStorage.setItem(chiaveCacheWorkout('u1'), 'non-è-json{{{')
    rete.connesso.valore = false

    await userEvent.click(screen.getByRole('button', { name: /Segna come completato/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Fatto!/ }))

    await waitFor(() => expect(coda()).toHaveLength(1))
    expect(coda()[0].payload.status).toBe('completed')
  })

  it('il valore illeggibile viene rimosso, non lasciato lì per sempre', async () => {
    // Qui il fetch DEVE fallire, o scriviJson sovrascriverebbe la cache con
    // dati validi e il ramo di riparazione non verrebbe mai eseguito.
    ctrl.fetchFallisce.valore = true
    window.localStorage.setItem(chiaveCacheWorkout('u1'), '{rotto')
    montaPagina(<Home />)

    // Senza rimozione, ogni caricamento successivo ritroverebbe lo stesso
    // valore rotto: la modalità offline non ripartirebbe mai più.
    await waitFor(() => expect(window.localStorage.getItem(chiaveCacheWorkout('u1'))).toBeNull())
  })
})

describe('scompletare un workout senza rete', () => {
  // annullaCompletamento ha lo stesso JSON.parse nudo che bloccava la modale
  // RPE, e lo stesso ramo offline. Senza questo test la correzione lì non era
  // coperta da niente (verificato per mutazione il 26/08/2026).
  it('accoda il ritorno a "da fare" anche con la cache corrotta', async () => {
    ctrl.stato.valore = 'completed'
    montaPagina(<Home />)
    await attendiCaricamento()

    window.localStorage.setItem(chiaveCacheWorkout('u1'), 'non-è-json{{{')
    rete.connesso.valore = false

    await userEvent.click(screen.getByRole('button', { name: /^Fatto$/ }))
    // Scompletare non è più un tap singolo e silenzioso: chiede conferma,
    // perché un tocco storto scompletava senza spiegazioni.
    await userEvent.click(await screen.findByRole('button', { name: /Conferma|Sì|Annulla completamento/i }))

    await waitFor(() => expect(coda()).toHaveLength(1))
    expect(coda()[0].payload.status).toBe('pending')
  })
})
