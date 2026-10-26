import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation, Link } from 'react-router-dom'
import { MESSAGGIO_SENZA_RETE } from '../../lib/modelliBloccoDb'

// Perché questi test esistono
// ────────────────────────────
// La «modalità modello» (16/10/2026) riusa il builder dei workout per UN
// blocco. Tre cose si romperebbero in silenzio: la bozza del workout
// (`fleofit_workout_draft`) cancellata o sovrascritta aprendo un modello — il
// coach perderebbe il workout lasciato a metà —; un modello in modifica salvato
// come uno nuovo (un doppione invece di una correzione); e un id che non c'è
// più, che lascerebbe un builder vuoto senza dire perché.

const stato = await vi.hoisted(async () => ({ chiamate: [], modelli: [], erroreScrittura: false, letturaSospesa: null }))

vi.mock('../../supabaseClient', () => {
  const generica = {
    select: () => generica,
    eq: () => generica,
    order: () => generica,
    limit: () => Promise.resolve({ data: [], error: null }),
    single: () => Promise.resolve({ data: null, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
  }
  const modelli = () => {
    const filtri = {}
    let scritto = null
    const errore = () => (stato.erroreScrittura && scritto ? { data: null, error: { message: 'rete assente' } } : null)
    const c = {
      select: () => c,
      eq: (col, v) => { filtri[col] = v; return c },
      insert: (r) => { scritto = r; stato.chiamate.push({ metodo: 'insert', args: [r] }); return c },
      update: (r) => { scritto = r; stato.chiamate.push({ metodo: 'update', args: [r] }); return c },
      single: () => Promise.resolve(errore() ?? { data: { id: 'nuovo-id', ...scritto }, error: null }),
      maybeSingle: () => (stato.letturaSospesa ?? Promise.resolve())
        .then(() => ({ data: stato.modelli.find(m => m.id === filtri.id) ?? null, error: null })),
      then: (ok, ko) => Promise.resolve({ data: stato.modelli, error: null }).then(ok, ko),
    }
    return c
  }
  return {
    supabase: {
      from: (t) => (t === 'modelli_blocco' ? modelli() : generica),
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) },
      functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    },
  }
})
vi.mock('../../lib/alert', () => ({ mostraErrore: vi.fn(), mostraSuccesso: vi.fn() }))

const alert = await import('../../lib/alert')
const { AuthContext } = await import('../../App')
const CreateWorkout = (await import('../CreateWorkout')).default

function Posizione() {
  const l = useLocation()
  return <p data-testid="posizione">{l.pathname + l.search}</p>
}

const monta = (percorso) => render(
  <AuthContext.Provider value={{ user: { id: 'u1' }, role: 'admin' }}>
    <MemoryRouter initialEntries={[percorso]}>
      <Routes>
        <Route path="/create" element={<CreateWorkout />} />
        <Route path="*" element={<Posizione />} />
      </Routes>
    </MemoryRouter>
  </AuthContext.Provider>
)

/** Sceglie un tipo nel foglio dei blocchi e lo conferma col suo «Aggiungi blocco». */
async function scegliBlocco(tipo) {
  await userEvent.click(screen.getByRole('button', { name: 'Scegli il blocco' }))
  await userEvent.click(screen.getByText(tipo))
  const nelFoglio = () => screen.queryAllByRole('button', { name: 'Aggiungi blocco' }).filter(b => b.closest('[role="dialog"]'))
  await userEvent.click(nelFoglio()[0])
  await waitFor(() => expect(nelFoglio()).toHaveLength(0))
}

const scritture = (metodo) => stato.chiamate.filter(c => c.metodo === metodo)

const CORSA = {
  id: 'm1', coach: 'u1', categoria: 'Running', nome: 'Ripetute del martedì',
  creato_at: '2026-10-10T10:00:00Z', modificato_at: null,
  contenuto: { type: 'run', duration: '5 km', pace: 'Z2', intensity: '5', notes: '' },
}

beforeEach(() => {
  stato.chiamate.length = 0
  stato.modelli = [CORSA]
  stato.erroreScrittura = false
  stato.letturaSospesa = null
  alert.mostraErrore.mockClear()
  localStorage.clear()
})

describe('il builder in modalità modello', () => {
  it('un modello Hyrox nuovo: niente del workout, un blocco solo, salva con il nome proposto', async () => {
    monta('/create?modello=nuovo&categoria=Hyrox')
    expect(await screen.findByRole('button', { name: 'Scegli il blocco' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Salva workout/ })).toBeNull()
    expect(screen.queryByText('Genera con IA')).toBeNull()
    expect(screen.queryByText('Note coach')).toBeNull()
    expect(screen.queryByText('Intensità dichiarata')).toBeNull()
    expect(screen.queryByRole('button', { name: /Costruisci l'allenamento/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Salva modello' })).toBeDisabled()

    await scegliBlocco('EMOM')
    expect(screen.queryByRole('button', { name: 'Scegli il blocco' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Aggiungi blocco/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Duplica il blocco' })).toBeNull()

    const campo = screen.getByLabelText('Nome del modello')
    const proposto = campo.value
    expect(proposto).toMatch(/^EMOM/)
    await userEvent.click(screen.getByRole('button', { name: 'Salva modello' }))
    await waitFor(() => expect(scritture('insert')).toHaveLength(1))
    expect(scritture('insert')[0].args[0]).toMatchObject({ coach: 'u1', categoria: 'Hyrox', nome: proposto, contenuto: { type: 'EMOM' } })
    expect(scritture('update')).toHaveLength(0)
    expect(await screen.findByTestId('posizione')).toHaveTextContent('/modelli?categoria=Hyrox')
  })

  it('la bozza del workout resta identica', async () => {
    const bozza = JSON.stringify({
      sourceId: null, modo: 'nuovo', title: 'Workout lasciato a metà', date: '2026-10-26', workoutIntensity: '7',
      category: 'Hyrox', blocks: [{ id: 0.5, type: 'AMRAP', params: { duration: '12:00' }, exercises: [] }],
      runningSteps: [], gymGroups: [], coachNotes: 'non toccare',
    })
    localStorage.setItem('fleofit_workout_draft', bozza)
    monta('/create?modello=nuovo&categoria=Hyrox')
    expect(screen.queryByRole('dialog', { name: 'Bozza Trovata' })).toBeNull()
    await scegliBlocco('EMOM')
    expect(localStorage.getItem('fleofit_workout_draft')).toBe(bozza)
    await userEvent.click(screen.getByRole('button', { name: 'Salva modello' }))
    await screen.findByTestId('posizione')
    expect(localStorage.getItem('fleofit_workout_draft')).toBe(bozza)
  })

  it('un modello esistente si apre con la sua fase e il suo nome, e si aggiorna', async () => {
    monta('/create?modello=m1')
    expect(await screen.findByLabelText('Nome del modello')).toHaveValue('Ripetute del martedì')
    expect(screen.getByText('5 km')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Aggiungi fase/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Aggiungi una fase di corsa' })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Salva modello' }))
    await waitFor(() => expect(scritture('update')).toHaveLength(1))
    expect(scritture('update')[0].args[0]).toMatchObject({ nome: 'Ripetute del martedì', contenuto: { type: 'run', duration: '5 km' } })
    expect(scritture('update')[0].args[0].contenuto.id).toBeUndefined()
    expect(scritture('insert')).toHaveLength(0)
    expect(await screen.findByTestId('posizione')).toHaveTextContent('/modelli?categoria=Running')
  })

  it('se il salvataggio non riesce si resta e lo dice', async () => {
    stato.erroreScrittura = true
    monta('/create?modello=m1')
    await screen.findByLabelText('Nome del modello')
    await userEvent.click(screen.getByRole('button', { name: 'Salva modello' }))
    await waitFor(() => expect(alert.mostraErrore).toHaveBeenCalledWith(MESSAGGIO_SENZA_RETE))
    expect(screen.queryByTestId('posizione')).toBeNull()
    // Si può riprovare: il bottone non resta in attesa.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salva modello' })).not.toBeDisabled())
  })

  it('un modello Gym nuovo: «Scegli gli esercizi» crea un gruppo solo', async () => {
    monta('/create?modello=nuovo&categoria=Gym')
    await userEvent.click(await screen.findByRole('button', { name: 'Scegli gli esercizi' }))
    const foglio = await screen.findByRole('dialog', { name: 'Scegli gli esercizi' })
    await userEvent.click(within(foglio).getByText('Panca piana con bilanciere'))
    await userEvent.click(within(foglio).getByText('Trazioni alla sbarra'))
    await userEvent.click(within(foglio).getByRole('button', { name: /Aggiungi 2 esercizi/ }))
    await waitFor(() => expect(document.querySelectorAll('[data-gruppo-gym]')).toHaveLength(1))
    expect(screen.queryByRole('button', { name: 'Scegli gli esercizi' })).toBeNull()
    // Un gruppo con tutti e due: il nome proposto li nomina insieme (una superserie).
    expect(screen.getByLabelText('Nome del modello').value).toMatch(/^Panca piana con bilanciere \+ Trazioni alla sbarra/)
  })

  it('un modello che non c\'è più: avviso e ritorno ai modelli', async () => {
    monta('/create?modello=sparito')
    expect(await screen.findByTestId('posizione')).toHaveTextContent(/^\/modelli$/)
    expect(alert.mostraErrore).toHaveBeenCalledWith('Questo modello non c\'è più.')
  })

  it('una categoria che non ha modelli riporta ai modelli', async () => {
    monta('/create?modello=nuovo&categoria=Custom')
    expect(await screen.findByTestId('posizione')).toHaveTextContent(/^\/modelli$/)
  })

  it('passando dal modello al builder dei workout la schermata riparte, e la bozza non si tocca', async () => {
    // È la stessa rotta (/create): senza ripartire, il blocco del modello restava
    // lì come un workout, e al primo ritocco sovrascriveva la bozza a metà.
    const bozza = JSON.stringify({
      sourceId: null, modo: 'nuovo', title: 'Workout lasciato a metà', date: '2026-10-26', workoutIntensity: '7',
      category: 'Hyrox', blocks: [{ id: 0.5, type: 'AMRAP', params: { duration: '12:00' }, exercises: [] }],
      runningSteps: [], gymGroups: [], coachNotes: '',
    })
    localStorage.setItem('fleofit_workout_draft', bozza)
    render(
      <AuthContext.Provider value={{ user: { id: 'u1' }, role: 'admin' }}>
        <MemoryRouter initialEntries={['/create?modello=m1']}>
          <Link to="/create">Workout</Link>
          <Routes><Route path="/create" element={<CreateWorkout />} /></Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )
    await screen.findByLabelText('Nome del modello')
    await userEvent.click(screen.getByRole('link', { name: 'Workout' }))
    // Il builder dei workout, da capo: propone la bozza, e del modello non resta niente.
    expect(await screen.findByRole('dialog', { name: 'Bozza Trovata' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Nome del modello')).toBeNull()
    expect(screen.queryByText('5 km')).toBeNull()
    expect(localStorage.getItem('fleofit_workout_draft')).toBe(bozza)
  })

  it('finché il modello non arriva non mostra un builder vuoto da riempire', async () => {
    let sblocca
    stato.letturaSospesa = new Promise(r => { sblocca = r })
    monta('/create?modello=m1')
    await screen.findByText('Modifica modello')
    // Prima mostrava il builder Hyrox vuoto: «Scegli il blocco», per un modello di corsa.
    expect(screen.queryByRole('button', { name: 'Scegli il blocco' })).toBeNull()
    expect(screen.queryByLabelText('Nome del modello')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Salva modello' })).toBeNull()
    sblocca()
    expect(await screen.findByLabelText('Nome del modello')).toHaveValue('Ripetute del martedì')
  })
})

