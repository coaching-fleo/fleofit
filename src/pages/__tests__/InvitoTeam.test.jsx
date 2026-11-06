import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { montaPagina, UTENTE } from '../../test/montaPagina'

// Perché questi test esistono
// ────────────────────────────
// L'invito in un team (spec §5): il consenso è dell'atleta. Gli errori che non
// si vedono: un doppio tocco che manda due risposte, un errore di rete che fa
// sparire i bottoni come se avesse accettato, la frase sbagliata su chi vedrà
// i risultati, e uno schermo bianco quando la push arriva prima che la
// funzione esista (migrazione non applicata) o dopo che il team non è più suo.

const dati = await vi.hoisted(async () => ({
  scheda: { disponibile: true, scheda: null },
  team: { disponibile: true, team: [] },
  rispondi: null,
}))
const naviga = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async (originale) => ({ ...(await originale()), useNavigate: () => naviga }))
vi.mock('../../lib/teamDb', () => ({
  leggiScheda: vi.fn(async () => dati.scheda),
  leggiTeamAtleta: vi.fn(async () => dati.team),
  rispondi: vi.fn(async (...a) => dati.rispondi?.(...a)),
}))
vi.mock('../../lib/alert', () => ({ mostraErrore: vi.fn(), mostraSuccesso: vi.fn(), mostraAlert: vi.fn() }))

const db = await import('../../lib/teamDb')
const alert = await import('../../lib/alert')
const InvitoTeam = (await import('../InvitoTeam')).default
const MieiTeam = (await import('../MieiTeam')).default

const scheda = (classifica_visibile) => ({
  team: { id: 't1', nome: 'Doppia Hyrox', classifica_visibile, evento: { titolo: 'Hyrox Milano', data: '2026-12-06' } },
  coach: { nome: 'Federico Leo' },
  membri: [
    { atleta_id: UTENTE.id, nome: 'Marco', cognome: 'Rossi', stato: 'invitato' },
    { atleta_id: 'b', nome: 'Luca', cognome: 'Bianchi', stato: 'dentro' },
  ],
})
const apri = () => montaPagina(<InvitoTeam />, { percorso: '/team/invito/t1', rotta: '/team/invito/:id' })

beforeEach(() => {
  vi.clearAllMocks()
  dati.scheda = { disponibile: true, scheda: scheda(true) }
  dati.team = { disponibile: true, team: [] }
  dati.rispondi = null
})

describe('/team/invito/:id', () => {
  it('mostra team, coach, compagni e che i risultati saranno visibili', async () => {
    apri()
    expect(await screen.findByRole('heading', { name: 'Doppia Hyrox' })).toBeInTheDocument()
    expect(screen.getByText(/Federico Leo/)).toBeInTheDocument()
    expect(screen.getByText(/Hyrox Milano/)).toBeInTheDocument()
    expect(screen.getByText('Luca Bianchi')).toBeInTheDocument()
    expect(screen.getByText('I tuoi risultati saranno visibili ai compagni.')).toBeInTheDocument()
  })

  it('con la classifica spenta dice che solo il coach li vedrà', async () => {
    dati.scheda = { disponibile: true, scheda: scheda(false) }
    apri()
    expect(await screen.findByText('Solo il coach vedrà i tuoi risultati.')).toBeInTheDocument()
  })

  it('«Accetta» risponde una volta sola anche con due tocchi', async () => {
    let finisci
    dati.rispondi = () => new Promise((r) => { finisci = r })
    apri()
    const accetta = await screen.findByRole('button', { name: 'Accetta' })
    await userEvent.click(accetta)
    await userEvent.click(accetta)
    finisci()
    await waitFor(() => expect(naviga).toHaveBeenCalledWith('/team/t1', { replace: true }))
    expect(db.rispondi).toHaveBeenCalledTimes(1)
    expect(db.rispondi).toHaveBeenCalledWith('t1', UTENTE.id, 'dentro')
  })

  it('«Rifiuta» risponde rifiutato', async () => {
    apri()
    await userEvent.click(await screen.findByRole('button', { name: 'Rifiuta' }))
    await waitFor(() => expect(db.rispondi).toHaveBeenCalledWith('t1', UTENTE.id, 'rifiutato'))
  })

  it('se la risposta fallisce compare l\'errore e i bottoni restano', async () => {
    dati.rispondi = () => { throw new Error('rete') }
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    apri()
    await userEvent.click(await screen.findByRole('button', { name: 'Accetta' }))
    await waitFor(() => expect(alert.mostraErrore).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'Accetta' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Rifiuta' })).toBeEnabled()
    expect(naviga).not.toHaveBeenCalled()
  })

  it('funzione assente: torna alla Home, niente schermo bianco', async () => {
    dati.scheda = { disponibile: false, scheda: null }
    apri()
    await waitFor(() => expect(naviga).toHaveBeenCalledWith('/', { replace: true }))
  })

  it('team non più visibile: torna alla Home', async () => {
    dati.scheda = { disponibile: true, scheda: null }
    apri()
    await waitFor(() => expect(naviga).toHaveBeenCalledWith('/', { replace: true }))
  })

  it('già dentro: va alla scheda del team', async () => {
    const s = scheda(true)
    s.membri[0].stato = 'dentro'
    dati.scheda = { disponibile: true, scheda: s }
    apri()
    await waitFor(() => expect(naviga).toHaveBeenCalledWith('/team/t1', { replace: true }))
  })
})

describe('/team per l\'atleta', () => {
  it('separa gli inviti dai team in cui è dentro', async () => {
    dati.team = { disponibile: true, team: [
      { id: 't1', nome: 'Doppia Hyrox', stato: 'invitato' },
      { id: 't2', nome: 'Corsa del martedì', stato: 'dentro' },
    ] }
    montaPagina(<MieiTeam />)
    const inviti = await screen.findByRole('region', { name: 'Inviti' })
    await userEvent.click(within(inviti).getByRole('button', { name: /Doppia Hyrox/ }))
    expect(naviga).toHaveBeenCalledWith('/team/invito/t1')
    const miei = screen.getByRole('region', { name: 'I tuoi team' })
    await userEvent.click(within(miei).getByRole('button', { name: /Corsa del martedì/ }))
    expect(naviga).toHaveBeenCalledWith('/team/t2')
  })

  it('senza team: lo stato vuoto, non un errore', async () => {
    montaPagina(<MieiTeam />)
    expect(await screen.findByText(/Non sei ancora in un team/)).toBeInTheDocument()
  })
})
