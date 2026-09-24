import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { montaPagina } from '../../test/montaPagina'

// Perché questi test esistono
// ────────────────────────────
// Il recap post-allenamento (CLAUDE.md §9-quadragies) si apre da solo quando
// l'atleta chiude un allenamento, e da lì in poi non c'è nessun gesto che lo
// riporti a schermo: o compare in quell'istante, o non lo vede nessuno. La
// logica di cosa mostrare è coperta da `src/lib/__tests__/recapAllenamento`;
// qui si verifica il CABLAGGIO — che si apra, che si apra a chi si è allenato,
// e che una lettura fallita non gli faccia dire una cosa falsa.

const ctrl = await vi.hoisted(async () => ({
  stato: { valore: 'pending' },
  fetchFallisce: { valore: false },
  storico: { valore: [] },
}))

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  const giorno = new Date().toISOString().split('T')[0]
  return fintoSupabase(
    () => ({
      athlete_workouts: [
        {
          id: 'aw1', completed_date: giorno, status: ctrl.stato.valore,
          notes: ctrl.stato.valore === 'completed' ? '[RPE: 7/10]\n' : null,
          workouts: {
            id: 'w1', title: 'Hyrox Forza',
            sections: { category: 'Hyrox', intensity: '7', blocks: [{ id: 1, type: 'EMOM', params: { interval: '1:00', rounds: '20' }, exercises: [{ id: 2, name: 'Wall Balls', reps: '15' }] }] },
          },
        },
        ...ctrl.storico.valore,
      ],
      notifications: [],
    }),
    { erroreSu: () => (ctrl.fetchFallisce.valore ? ['athlete_workouts'] : []) },
  )
})

vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))
vi.mock('@capacitor/network', () => ({
  Network: {
    getStatus: vi.fn(() => Promise.resolve({ connected: true })),
    addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
  },
}))

const aptica = vi.hoisted(() => ({
  battito: vi.fn(), vibraScelta: vi.fn(), vibraPresa: vi.fn(),
  vibraSuccesso: vi.fn(), vibraErrore: vi.fn(), vibraRichiamo: vi.fn(),
}))
vi.mock('../../lib/aptica', () => aptica)

const Home = (await import('../Home')).default
const RecapAllenamento = (await import('../../components/RecapAllenamento')).default

/** Qualche seduta chiusa nelle settimane precedenti, per accendere l'andamento. */
const storicoPieno = () => {
  const righe = []
  for (let i = 1; i <= 5; i++) {
    const d = new Date(Date.now() - i * 3 * 86400000).toISOString().split('T')[0]
    righe.push({
      id: `old${i}`, completed_date: d, status: 'completed', notes: '[RPE: 7/10]\n',
      workouts: { id: `w${i}`, title: `Seduta ${i}`, sections: { category: 'Running', steps: [{ id: 1, type: 'warmup', duration: '40 min' }] } },
    })
  }
  return righe
}

const completa = async (utente) => {
  await utente.click(screen.getByRole('button', { name: /^Completa$/ }))
  await utente.click(await screen.findByRole('button', { name: /Fatto!/ }))
}

beforeEach(() => {
  ctrl.stato.valore = 'pending'
  ctrl.fetchFallisce.valore = false
  ctrl.storico.valore = []
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('il recap si apre quando l atleta chiude un allenamento', () => {
  it('chiudere l allenamento si SENTE, una volta sola', async () => {
    // È l'esito più atteso dell'app (CLAUDE.md §9-duoquadragies). ⚠️ UNA
    // volta: il salvataggio non passa da un CustomAlert, che vibrerebbe da sé,
    // e una seconda notifica per lo stesso esito si leggerebbe come un errore.
    Object.values(aptica).forEach(f => f.mockClear())
    const utente = userEvent.setup()
    montaPagina(<Home />)
    await waitFor(() => expect(screen.getByText('Hyrox Forza')).toBeInTheDocument())
    expect(aptica.vibraSuccesso).not.toHaveBeenCalled()
    await completa(utente)
    await screen.findByRole('dialog', { name: /Recap/ })
    expect(aptica.vibraSuccesso).toHaveBeenCalledTimes(1)
    expect(aptica.vibraErrore).not.toHaveBeenCalled()
  })

  it("porta il titolo e l'RPE appena dichiarato", async () => {
    const utente = userEvent.setup()
    montaPagina(<Home />)
    await waitFor(() => expect(screen.getByText('Hyrox Forza')).toBeInTheDocument())
    await completa(utente)

    const recap = await screen.findByRole('dialog', { name: /Recap/ })
    // ⚠️ Le query si restringono al dialogo: «RPE» e «7» esistono anche nella
    // Home sotto di esso, e senza `within` il test passerebbe pure con un
    // recap vuoto.
    const dentro = within(recap)
    expect(dentro.getByText('Hyrox Forza')).toBeInTheDocument()
    // 🔴 La cella porta l'RPE DICHIARATO adesso — 5, il valore su cui è nato il
    // cursore della modale — e si chiama «RPE». L'intensità scritta dal coach
    // su questo workout è 7: se la cella dicesse 7 sotto l'etichetta «RPE»,
    // starebbe presentando la previsione del coach come lo sforzo dell'atleta.
    const cella = dentro.getByText('RPE').closest('div')
    expect(cella.textContent).toContain('5')
    expect(cella.textContent).not.toContain('7')
  })

  it('con abbastanza storico ha cinque schede e si avanza fino al prossimo passo', async () => {
    ctrl.storico.valore = storicoPieno()
    const utente = userEvent.setup()
    montaPagina(<Home />)
    await waitFor(() => expect(screen.getByText('Hyrox Forza')).toBeInTheDocument())
    await completa(utente)

    await screen.findByRole('dialog', { name: /Recap/ })
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Scheda \d+ di 5/ })).toHaveLength(5))

    // ⚠️ Si avanza toccando la metà destra dello schermo, non un bottone
    // «Avanti»: dal 22/09 quei due bottoni non ci sono più (§9-quadragies).
    const avanti = () => utente.click(screen.getByRole('button', { name: 'Scheda successiva' }))
    await avanti()
    expect(screen.getByText('Ti è piaciuto questo allenamento?')).toBeInTheDocument()
    await avanti()
    expect(screen.getByText('Questa settimana')).toBeInTheDocument()
    await avanti()
    expect(screen.getByText('Come stai andando')).toBeInTheDocument()
    await avanti()
    expect(screen.getByText('Il prossimo')).toBeInTheDocument()
  })

  it('una lettura fallita si ferma alla prima scheda e NON annuncia il primo allenamento', async () => {
    // 🔴 La strada comoda era costruire il recap con uno storico vuoto: lì il
    // conteggio vale zero, e a chi ha cento allenamenti alle spalle la seconda
    // scheda direbbe «il primo è fatto». Un guasto travestito da dato.
    //
    // ⚠️ Si monta il recap da solo e non passando dalla Home: `erroreSu` vale
    // per la TABELLA, quindi dalla Home farebbe fallire anche l'UPDATE del
    // completamento — il recap non si aprirebbe affatto, e il test passerebbe
    // verificando un'altra cosa.
    ctrl.fetchFallisce.valore = true
    montaPagina(
      <RecapAllenamento
        aw={{ id: 'aw1', status: 'completed', notes: '[RPE: 7/10]\n', completed_date: new Date().toISOString().split('T')[0],
              workouts: { id: 'w1', title: 'Hyrox Forza', sections: { category: 'Hyrox', intensity: '7', blocks: [] } } }}
        atletaId="u1" onChiudi={() => {}} />
    )

    const recap = await screen.findByRole('dialog', { name: /Recap/ })
    // Due schede: «fatto» e il gradimento, che non leggono niente.
    await waitFor(() => expect(within(recap).getAllByRole('button', { name: /Scheda \d+ di 2/ })).toHaveLength(2))
    expect(within(recap).queryByText(/storia da raccontare/i)).not.toBeInTheDocument()
    expect(within(recap).queryByText('Questa settimana')).not.toBeInTheDocument()
  })

  it('si chiude, e la Home resta dov era', async () => {
    const utente = userEvent.setup()
    montaPagina(<Home />)
    await waitFor(() => expect(screen.getByText('Hyrox Forza')).toBeInTheDocument())
    await completa(utente)

    await screen.findByRole('dialog', { name: /Recap/ })
    await utente.click(screen.getByRole('button', { name: /Chiudi il recap/ }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Recap/ })).not.toBeInTheDocument())
    expect(screen.getByText('Hyrox Forza')).toBeInTheDocument()
  })

  it('al COACH non si apre: non è il suo allenamento', async () => {
    // Il ramo atleta della Home è già riservato a `role === 'athlete'`, ma la
    // guardia sul recap è sua: `adminRoleOverride` a parte, il coach che
    // spunta un allenamento vedrebbe lo storico di qualcun altro come proprio.
    const utente = userEvent.setup()
    montaPagina(<Home />, { role: 'admin' })
    await waitFor(() => expect(screen.queryByText('Caricamento...')).not.toBeInTheDocument(), { timeout: 3000 })
    expect(screen.queryByRole('button', { name: /^Completa$/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /Recap/ })).not.toBeInTheDocument()
    expect(utente).toBeTruthy()
  })
})

// Il gradimento (src/lib/gradimento.js): un parere sull'allenamento, scritto
// nella nota dell'assegnazione dopo l'RPE. Si verifica cosa finisce nel
// database, perché è l'unica cosa che il coach vedrà.
describe('il gradimento nel recap', () => {
  /** Le note scritte dal recap, cioè gli UPDATE che portano SOLO `notes`. */
  const noteScritte = () => finto.chiamateA('athlete_workouts', 'update')
    .map(c => c.args[0])
    .filter(v => v && Object.keys(v).length === 1 && 'notes' in v)
    .map(v => v.notes)

  const apriSulGradimento = async (utente) => {
    montaPagina(<Home />)
    await waitFor(() => expect(screen.getByText('Hyrox Forza')).toBeInTheDocument())
    await completa(utente)
    await screen.findByRole('dialog', { name: /Recap/ })
    await utente.click(screen.getByRole('button', { name: 'Scheda successiva' }))
    await screen.findByText('Ti è piaciuto questo allenamento?')
  }

  beforeEach(() => { finto.chiamate.length = 0 })

  it('«Mi è piaciuto» scrive il parere DOPO l RPE, senza toccare il resto', async () => {
    const utente = userEvent.setup()
    await apriSulGradimento(utente)
    await utente.click(screen.getByRole('button', { name: /Mi è piaciuto/ }))
    await waitFor(() => expect(noteScritte()).toEqual(['[RPE: 5/10]\n[GRADIMENTO: si]\n']))
  })

  it('«Salta» registra «nessuna preferenza», e il recap va avanti', async () => {
    const utente = userEvent.setup()
    await apriSulGradimento(utente)
    await utente.click(screen.getByRole('button', { name: 'Salta' }))
    await waitFor(() => expect(noteScritte()).toEqual(['[RPE: 5/10]\n[GRADIMENTO: nessuna]\n']))
    expect(screen.queryByText('Ti è piaciuto questo allenamento?')).not.toBeInTheDocument()
  })

  it('andare avanti col tocco senza scegliere vale come «Salta»', async () => {
    const utente = userEvent.setup()
    await apriSulGradimento(utente)
    await utente.click(screen.getByRole('button', { name: 'Scheda successiva' }))
    await waitFor(() => expect(noteScritte()).toEqual(['[RPE: 5/10]\n[GRADIMENTO: nessuna]\n']))
  })

  it('chiudere il recap PRIMA della domanda non registra niente', async () => {
    // Chi non ha mai visto la domanda non ha scelto «nessuna preferenza»:
    // registrarla gonfierebbe gli indifferenti con chi non è stato interpellato.
    const utente = userEvent.setup()
    montaPagina(<Home />)
    await waitFor(() => expect(screen.getByText('Hyrox Forza')).toBeInTheDocument())
    await completa(utente)
    await screen.findByRole('dialog', { name: /Recap/ })
    await utente.click(screen.getByRole('button', { name: /Chiudi il recap/ }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Recap/ })).not.toBeInTheDocument())
    expect(noteScritte()).toEqual([])
  })

  it('chiudere il recap SULLA domanda è «nessuna preferenza»', async () => {
    const utente = userEvent.setup()
    await apriSulGradimento(utente)
    await utente.click(screen.getByRole('button', { name: /Chiudi il recap/ }))
    await waitFor(() => expect(noteScritte()).toEqual(['[RPE: 5/10]\n[GRADIMENTO: nessuna]\n']))
  })
})
