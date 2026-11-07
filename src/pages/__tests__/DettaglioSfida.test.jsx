import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { montaPagina } from '../../test/montaPagina'

// Perché questi test esistono
// ────────────────────────────
// La classifica di una seduta (spec §4-§5). Gli errori che non si vedono: uno
// zero al posto di chi non ha ancora inserito il risultato, il distacco del
// primo scritto «+0:00», i valori dei compagni mostrati a un atleta quando il
// coach ha tenuto la classifica per sé, il nome di chi è uscito ancora lì, un
// valore che si corregge a sfida chiusa.

const dati = await vi.hoisted(async () => ({ scheda: null, sfide: [] }))
const naviga = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async (originale) => ({ ...(await originale()), useNavigate: () => naviga }))
vi.mock('../../lib/teamDb', () => ({
  leggiScheda: vi.fn(async () => ({ disponibile: true, scheda: dati.scheda })),
  leggiSfide: vi.fn(async () => ({ disponibile: true, sfide: dati.sfide })),
  chiudiSfida: vi.fn(async () => {}),
  salvaRisultato: vi.fn(async () => {}),
}))
vi.mock('../../lib/alert', () => ({ mostraErrore: vi.fn(), mostraSuccesso: vi.fn(), mostraAlert: vi.fn() }))
vi.mock('../../supabaseClient', () => ({ supabase: {} }))

const db = await import('../../lib/teamDb')
const DettaglioSfida = (await import('../DettaglioSfida')).default

const coach = { id: 'coach1', email: 'coach@fleofit.it' }
const luca = { id: 'b', email: 'luca@x.it' }
const apri = (role = 'coach', user = coach) =>
  montaPagina(<DettaglioSfida />, { role, user, percorso: '/team/t1/sfida/s1', rotta: '/team/:id/sfida/:sfidaId' })

const membro = (atleta_id, nome, stato = 'dentro') => ({ atleta_id, nome, cognome: 'X', stato })

beforeEach(() => {
  vi.clearAllMocks()
  dati.scheda = {
    team: { id: 't1', nome: 'Doppia', classifica_visibile: true, chiuso_il: null },
    coach: { nome: 'Coach' },
    membri: [membro('a', 'Sara'), membro('b', 'Luca'), membro('c', 'Giulia')],
  }
  dati.sfide = [{
    id: 's1', metrica: 'tempo', data: '2026-11-06', chiusa_il: null, titolo: 'Hyrox completo',
    risultati: [{ atleta_id: 'a', valore: 247 }, { atleta_id: 'b', valore: 267 }],
  }]
})

const righe = async () => {
  const lista = await screen.findByRole('list', { name: 'Classifica' })
  return within(lista).getAllByRole('listitem')
}

describe('/team/:id/sfida/:sfidaId', () => {
  it('ordine, distacchi e chi manca: il primo «—», il secondo «+0:20», il terzo senza valore', async () => {
    apri()
    const [primo, secondo, terzo] = await righe()
    expect(within(primo).getByText('Sara X')).toBeInTheDocument()
    expect(within(primo).getByText('4:07')).toBeInTheDocument()
    expect(within(primo).getByText('—')).toBeInTheDocument()
    expect(within(secondo).getByText('4:27')).toBeInTheDocument()
    expect(within(secondo).getByText('+0:20')).toBeInTheDocument()
    expect(within(terzo).getByText('Giulia X')).toBeInTheDocument()
    expect(within(terzo).queryByText('0:00')).toBeNull()
    expect(within(terzo).getAllByText('—').length).toBeGreaterThan(0)
  })

  it('chi è uscito resta in classifica come «Ex membro», senza nome', async () => {
    dati.scheda.membri = [membro('b', 'Luca'), membro('c', 'Giulia'), membro('a', 'Sara', 'uscito')]
    apri()
    const [primo] = await righe()
    expect(within(primo).getByText('Ex membro')).toBeInTheDocument()
    expect(screen.queryByText('Sara X')).toBeNull()
  })

  it('coach: «Chiudi sfida» chiede conferma prima di chiudere', async () => {
    const u = userEvent.setup()
    apri()
    await u.click(await screen.findByRole('button', { name: 'Chiudi sfida' }))
    expect(db.chiudiSfida).not.toHaveBeenCalled()
    const dialogo = await screen.findByRole('dialog')
    await u.click(within(dialogo).getByRole('button', { name: 'Chiudi sfida' }))
    await waitFor(() => expect(db.chiudiSfida).toHaveBeenCalledWith('s1'))
  })

  it('atleta con la classifica nascosta: vede solo il proprio valore', async () => {
    dati.scheda.team.classifica_visibile = false
    apri('athlete', luca)
    expect(await screen.findByDisplayValue('4:27')).toBeInTheDocument()
    expect(screen.queryByText('4:07')).toBeNull()
    expect(screen.queryByText('Sara X')).toBeNull()
    expect(screen.queryByRole('list', { name: 'Classifica' })).toBeNull()
  })

  it('atleta: corregge il proprio valore finché la sfida è aperta', async () => {
    const u = userEvent.setup()
    apri('athlete', luca)
    const campo = await screen.findByDisplayValue('4:27')
    await u.clear(campo)
    await u.type(campo, '4:10')
    await u.click(screen.getByRole('button', { name: 'Salva' }))
    await waitFor(() => expect(db.salvaRisultato).toHaveBeenCalledWith('s1', 'b', 250))
  })

  it('atleta: a sfida chiusa il valore non si corregge più', async () => {
    dati.sfide[0].chiusa_il = '2026-11-06T20:00:00Z'
    apri('athlete', luca)
    await righe()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Salva' })).toBeNull()
  })
})
