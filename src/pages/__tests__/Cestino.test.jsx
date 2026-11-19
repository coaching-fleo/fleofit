import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router-dom'
import { montaPagina } from '../../test/montaPagina'

// Il cestino dei workout (19/11/2026): la lista, il foglio a spunte, il
// ripristino che riporta SOLO quello che il coach ha lasciato spuntato.

const d = await vi.hoisted(async () => ({
  elenco: { disponibile: true, righe: [] }, voci: [], ripristina: null, errori: [],
}))
vi.mock('../../lib/cestinoDb', () => ({
  elencoCestino: vi.fn(() => Promise.resolve(d.elenco)),
  vociCestino: vi.fn(() => Promise.resolve(d.voci)),
  ripristinaWorkout: vi.fn((...a) => d.ripristina(...a)),
}))
vi.mock('../../lib/alert', () => ({ mostraErrore: vi.fn((m) => d.errori.push(m)) }))

const { ripristinaWorkout } = await import('../../lib/cestinoDb')
const Cestino = (await import('../Cestino')).default

const RIGA = {
  id: 'c1', workout_id: 'w1', titolo: 'SkiErg Tempo · FT+FT 155′ @6', data_workout: '2026-11-16',
  eliminato_il: new Date(Date.now() - 18 * 3600_000).toISOString(), eliminato_da_nome: 'Federico',
}
const VOCI = [
  { tipo: 'assegnazione', id: 'aw1', atleta: 'Vittoria', stato: 'pending', notes: null, nota_vocale: false, ripristinabile: true, motivo: null },
  { tipo: 'assegnazione', id: 'aw2', atleta: 'Lara', stato: 'completed', notes: '[RPE: 7/10]', nota_vocale: true, ripristinabile: true, motivo: null },
  { tipo: 'assegnazione', id: 'aw3', atleta: 'Lorenzo', stato: 'pending', notes: null, nota_vocale: false, ripristinabile: false, motivo: 'non è più tra i tuoi atleti' },
]

const monta = (role = 'coach') => montaPagina(
  <Routes>
    <Route path="/cestino" element={<Cestino />} />
    <Route path="/workout/:id" element={<p>scheda workout</p>} />
    <Route path="/" element={<p>home</p>} />
  </Routes>,
  { role, percorso: '/cestino', rotta: '*' },
)

async function apriFoglio() {
  monta()
  await userEvent.click(await screen.findByRole('button', { name: /SkiErg Tempo/ }))
  return screen.findByRole('dialog', { name: 'Ripristina «SkiErg Tempo»' })
}

describe('Cestino', () => {
  beforeEach(() => {
    d.elenco = { disponibile: true, righe: [RIGA] }
    d.voci = VOCI
    d.ripristina = () => Promise.resolve('w1')
    d.errori = []
    ripristinaWorkout.mockClear()
  })

  it('la riga: titolo, chi l\'ha eliminato, quanto manca', async () => {
    monta()
    expect(await screen.findByText('SkiErg Tempo')).toBeInTheDocument()
    expect(screen.getByText(/eliminato da Federico il/)).toBeInTheDocument()
    expect(screen.getByText('si cancella tra 13 giorni')).toBeInTheDocument()
  })

  it('il foglio: spuntate le voci ripristinabili, spenta quella che non lo è', async () => {
    const foglio = await apriFoglio()
    expect(within(foglio).getByRole('checkbox', { name: /Vittoria/ })).toBeChecked()
    expect(within(foglio).getByRole('checkbox', { name: /Lara/ })).toBeChecked()
    expect(within(foglio).getByText('completato, RPE 7, nota vocale')).toBeInTheDocument()
    expect(within(foglio).queryByRole('checkbox', { name: /Lorenzo/ })).toBeNull()
    expect(within(foglio).getByText('non è più tra i tuoi atleti')).toBeInTheDocument()
    expect(within(foglio).getByRole('checkbox', { name: 'Seleziona tutto' })).toBeChecked()
  })

  it('senza spunte torna il solo workout', async () => {
    const foglio = await apriFoglio()
    await userEvent.click(within(foglio).getByRole('checkbox', { name: 'Seleziona tutto' }))
    await userEvent.click(within(foglio).getByRole('button', { name: 'Ripristina' }))
    expect(ripristinaWorkout).toHaveBeenCalledWith('c1', { assegnazioni: [], sfide: [] })
  })

  it('una voce tolta: si ripristinano solo le altre', async () => {
    const foglio = await apriFoglio()
    await userEvent.click(within(foglio).getByRole('checkbox', { name: /Vittoria/ }))
    expect(within(foglio).getByRole('checkbox', { name: 'Seleziona tutto' })).not.toBeChecked()
    await userEvent.click(within(foglio).getByRole('button', { name: 'Ripristina' }))
    expect(ripristinaWorkout).toHaveBeenCalledWith('c1', { assegnazioni: ['aw2'], sfide: [] })
  })

  it('a ripristino fatto si apre la scheda del workout', async () => {
    const foglio = await apriFoglio()
    await userEvent.click(within(foglio).getByRole('button', { name: 'Ripristina' }))
    expect(await screen.findByText('scheda workout')).toBeInTheDocument()
  })

  it('mentre ripristina il bottone è spento: niente doppio tocco', async () => {
    let finisci
    d.ripristina = () => new Promise(r => { finisci = r })
    const foglio = await apriFoglio()
    const bottone = within(foglio).getByRole('button', { name: 'Ripristina' })
    await userEvent.click(bottone)
    expect(bottone).toBeDisabled()
    await userEvent.click(bottone)
    expect(ripristinaWorkout).toHaveBeenCalledTimes(1)
    finisci('w1')
  })

  it('un errore si legge in italiano', async () => {
    d.ripristina = () => Promise.reject(new Error('Questo workout è già stato ripristinato o non è più nel cestino.'))
    const foglio = await apriFoglio()
    await userEvent.click(within(foglio).getByRole('button', { name: 'Ripristina' }))
    await waitFor(() => expect(d.errori).toEqual(['Questo workout è già stato ripristinato o non è più nel cestino.']))
  })

  it('cestino vuoto', async () => {
    d.elenco = { disponibile: true, righe: [] }
    monta()
    expect(await screen.findByText('Il cestino è vuoto')).toBeInTheDocument()
    expect(screen.getByText('I workout eliminati restano qui 14 giorni')).toBeInTheDocument()
  })

  it('tabella assente: lo stato vuoto, senza errori', async () => {
    d.elenco = { disponibile: false, righe: [] }
    monta()
    expect(await screen.findByText('Il cestino è vuoto')).toBeInTheDocument()
    expect(d.errori).toEqual([])
  })

  it('l\'atleta non ha il cestino: torna alla Home', () => {
    monta('athlete')
    expect(screen.getByText('home')).toBeInTheDocument()
  })
})
