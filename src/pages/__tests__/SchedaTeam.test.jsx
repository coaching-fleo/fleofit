import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { montaPagina } from '../../test/montaPagina'

// Perché questi test esistono
// ────────────────────────────
// Il lato coach del Team (spec §5-§6). Gli errori che non si vedono: un
// reinvito permesso prima dei 3 giorni (il database lo rifiuterebbe, e il coach
// vedrebbe solo un errore), un atleta in pausa o già dentro proposto
// nell'invito, una sfida che dice «a 3 atleti» quando va a 2, un nome doppio
// che arriva come errore tecnico.

const giorniFa = (n) => new Date(Date.now() - n * 86400000).toISOString()
const dati = await vi.hoisted(async () => ({ scheda: null, sfide: [], team: [], creaErrore: null }))
const naviga = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async (originale) => ({ ...(await originale()), useNavigate: () => naviga }))
vi.mock('../../lib/teamDb', () => ({
  leggiScheda: vi.fn(async () => ({ disponibile: true, scheda: dati.scheda })),
  leggiSfide: vi.fn(async () => ({ disponibile: true, sfide: dati.sfide })),
  leggiMieiTeam: vi.fn(async () => ({ disponibile: true, team: dati.team })),
  creaTeam: vi.fn(async () => { if (dati.creaErrore) throw dati.creaErrore; return { id: 'nuovo' } }),
  invita: vi.fn(async (_t, ids) => ({ invitati: ids })),
  annullaInvito: vi.fn(async () => {}),
  aggiornaTeam: vi.fn(async () => {}),
  chiudiTeam: vi.fn(async () => {}),
  creaSfida: vi.fn(async () => ({ id: 's9', assegnati: ['b', 'c'] })),
  assegnaInsieme: vi.fn(async () => ({ assegnati: ['b', 'c'] })),
  rispondi: vi.fn(async () => {}),
  cancellaMieiRisultati: vi.fn(async () => {}),
}))
vi.mock('../../lib/alert', () => ({ mostraErrore: vi.fn(), mostraSuccesso: vi.fn(), mostraAlert: vi.fn() }))

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  const fra = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
  return fintoSupabase({
    athletes: [
      { id: 'b', name: 'Luca', surname: 'Bianchi', notes: '', deleted_at: null },
      { id: 'c', name: 'Giulia', surname: 'Neri', notes: '', deleted_at: null },
      { id: 'n', name: 'Nora', surname: 'Nuova', notes: '', deleted_at: null },
      { id: 'p', name: 'Pietro', surname: 'Pausa', notes: '[PAUSA: 2026-11-01]\nvacanze', deleted_at: null },
      // Un admin vede anche gli atleti di altri coach: nel team vanno solo i suoi.
      { id: 'x', name: 'Xeno', surname: 'Altrui', notes: '', deleted_at: null },
    ],
    // Il finto client non filtra: qui solo le righe del coach del team (Xeno no).
    coach_atleti: ['b', 'c', 'n', 'p'].map(athlete_id => ({ athlete_id, coach_id: 'coach1' })),
    workouts: [
      { id: 'w1', title: 'Hyrox completo', date: fra(-3), sections: { category: 'Hyrox' } },
      { id: 'w-gara', title: 'Hyrox Milano', date: fra(20), sections: { category: 'Event', isEvent: true } },
      { id: 'w-gara-vecchia', title: 'Gara passata', date: fra(-20), sections: { category: 'Event', isEvent: true } },
    ],
  })
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const db = await import('../../lib/teamDb')
const SchedaTeam = (await import('../SchedaTeam')).default
const Team = (await import('../Team')).default

const coach = { id: 'coach1', email: 'coach@fleofit.it' }
const apriScheda = () => montaPagina(<SchedaTeam />, { role: 'coach', user: coach, percorso: '/team/t1', rotta: '/team/:id' })

beforeEach(() => {
  vi.clearAllMocks()
  dati.scheda = {
    team: { id: 't1', nome: 'Doppia Hyrox', classifica_visibile: false, chiuso_il: null, evento: null },
    coach: { nome: 'Coach' },
    membri: [
      { atleta_id: 'b', nome: 'Luca', cognome: 'Bianchi', stato: 'dentro', invitato_il: giorniFa(10), risposto_il: giorniFa(9) },
      { atleta_id: 'c', nome: 'Giulia', cognome: 'Neri', stato: 'dentro', invitato_il: giorniFa(10), risposto_il: giorniFa(9) },
      { atleta_id: 'i', nome: 'Ivo', cognome: 'Invitato', stato: 'invitato', invitato_il: giorniFa(4), risposto_il: null },
      { atleta_id: 'r', nome: 'Rita', cognome: 'Rifiuto', stato: 'rifiutato', invitato_il: giorniFa(5), risposto_il: giorniFa(2) },
      { atleta_id: 'u', nome: 'Ugo', cognome: 'Uscito', stato: 'uscito', invitato_il: giorniFa(20), risposto_il: giorniFa(4) },
    ],
  }
  dati.sfide = []
  dati.team = []
  dati.creaErrore = null
})

describe('/team/:id — coach', () => {
  it('lo stato di ogni membro, in parole', async () => {
    apriScheda()
    const membri = await screen.findByRole('region', { name: 'Membri' })
    const riga = (nome) => within(membri).getByText(nome).closest('li')
    expect(within(riga('Luca Bianchi')).getByText('Dentro')).toBeInTheDocument()
    expect(within(riga('Ivo Invitato')).getByText('In attesa da 4 giorni')).toBeInTheDocument()
    expect(within(riga('Rita Rifiuto')).getByText('Non ha accettato')).toBeInTheDocument()
    expect(within(riga('Ugo Uscito')).getByText('È uscito')).toBeInTheDocument()
  })

  it('«Reinvita» resta spento prima dei 3 giorni, acceso dopo', async () => {
    apriScheda()
    const membri = await screen.findByRole('region', { name: 'Membri' })
    const rita = within(membri).getByText('Rita Rifiuto').closest('li')
    expect(within(rita).getByRole('button', { name: /Fra 1 giorno/ })).toBeDisabled()
    const ugo = within(membri).getByText('Ugo Uscito').closest('li')
    const reinvita = within(ugo).getByRole('button', { name: 'Reinvita' })
    expect(reinvita).toBeEnabled()
    await userEvent.click(reinvita)
    await waitFor(() => expect(db.invita).toHaveBeenCalledWith('t1', ['u']))
  })

  it('l\'invito propone solo i suoi atleti non già dentro né in pausa', async () => {
    apriScheda()
    await userEvent.click(await screen.findByRole('button', { name: 'Invita' }))
    const foglio = await screen.findByRole('dialog', { name: 'Invita nel team' })
    expect(within(foglio).getByText('Nora Nuova')).toBeInTheDocument()
    expect(within(foglio).queryByText('Luca Bianchi')).not.toBeInTheDocument()
    expect(within(foglio).queryByText('Giulia Neri')).not.toBeInTheDocument()
    expect(within(foglio).queryByText('Pietro Pausa')).not.toBeInTheDocument()
    expect(within(foglio).queryByText('Xeno Altrui')).not.toBeInTheDocument()
    await userEvent.click(within(foglio).getByRole('checkbox', { name: 'Nora Nuova' }))
    await userEvent.click(within(foglio).getByRole('button', { name: 'Invita 1 atleta' }))
    await waitFor(() => expect(db.invita).toHaveBeenCalledWith('t1', ['n']))
  })

  // 09/11/2026: dallo stesso foglio il coach sceglie se l'allenamento è una
  // sfida (con la classifica) o soltanto da fare insieme.
  it('«Insieme» assegna a chi è dentro senza creare una sfida né chiedere cosa si misura', async () => {
    apriScheda()
    await userEvent.click(await screen.findByRole('button', { name: 'Assegna' }))
    const foglio = await screen.findByRole('dialog', { name: 'Allenamento del team' })
    expect(within(foglio).getByRole('radio', { name: 'Insieme' })).toBeChecked()
    expect(within(foglio).queryByRole('group', { name: 'Cosa si misura' })).toBeNull()
    await userEvent.click(within(foglio).getByRole('button', { name: /Hyrox completo/ }))
    await userEvent.click(within(foglio).getByRole('button', { name: 'Assegna a 2 atleti' }))
    await waitFor(() => expect(db.assegnaInsieme).toHaveBeenCalledWith(expect.objectContaining({ teamId: 't1', workoutId: 'w1' })))
    expect(db.creaSfida).not.toHaveBeenCalled()
  })

  it('la nuova sfida dice a quanti atleti va: solo i dentro', async () => {
    apriScheda()
    await userEvent.click(await screen.findByRole('button', { name: 'Assegna' }))
    const foglio = await screen.findByRole('dialog', { name: 'Allenamento del team' })
    await userEvent.click(within(foglio).getByRole('radio', { name: 'Sfida' }))
    await userEvent.click(within(foglio).getByRole('button', { name: /Hyrox completo/ }))
    await userEvent.click(within(foglio).getByRole('button', { name: 'Tempo' }))
    await userEvent.click(within(foglio).getByRole('button', { name: 'Assegna a 2 atleti' }))
    await waitFor(() => expect(db.creaSfida).toHaveBeenCalledWith(expect.objectContaining({ teamId: 't1', workoutId: 'w1', metrica: 'tempo' })))
    expect(db.assegnaInsieme).not.toHaveBeenCalled()
  })

  it('accendere la classifica con membri dentro chiede conferma', async () => {
    apriScheda()
    await userEvent.click(await screen.findByRole('switch', { name: 'Classifica visibile agli atleti' }))
    const conferma = await screen.findByRole('dialog', { name: 'Rendere visibile la classifica?' })
    expect(db.aggiornaTeam).not.toHaveBeenCalled()
    await userEvent.click(within(conferma).getByRole('button', { name: 'Rendi visibile' }))
    await waitFor(() => expect(db.aggiornaTeam).toHaveBeenCalledWith('t1', { classifica_visibile: true }))
  })
})

describe('/team — coach', () => {
  it('un nome già usato dà un messaggio chiaro', async () => {
    dati.creaErrore = { code: '23505', message: 'duplicate key' }
    montaPagina(<Team />, { role: 'coach', user: coach })
    await userEvent.click(await screen.findByRole('button', { name: 'Nuovo team' }))
    const foglio = await screen.findByRole('dialog', { name: 'Nuovo team' })
    await userEvent.type(within(foglio).getByLabelText('Nome del team'), 'Doppia Hyrox')
    await userEvent.click(within(foglio).getByRole('button', { name: 'Crea' }))
    expect(await within(foglio).findByText('Hai già un team con questo nome.')).toBeInTheDocument()
  })

  it('come obiettivo propone solo le gare future, ed è facoltativo', async () => {
    montaPagina(<Team />, { role: 'coach', user: coach })
    await userEvent.click(await screen.findByRole('button', { name: 'Nuovo team' }))
    const foglio = await screen.findByRole('dialog', { name: 'Nuovo team' })
    const scelta = within(foglio).getByLabelText('Gara (facoltativa)')
    expect(within(scelta).getByRole('option', { name: /Hyrox Milano/ })).toBeInTheDocument()
    expect(within(scelta).queryByRole('option', { name: /Gara passata/ })).not.toBeInTheDocument()
    await userEvent.type(within(foglio).getByLabelText('Nome del team'), 'Corsa')
    await userEvent.click(within(foglio).getByRole('button', { name: 'Crea' }))
    await waitFor(() => expect(db.creaTeam).toHaveBeenCalledWith({ nome: 'Corsa', evento_id: null, classifica_visibile: false }))
    expect(naviga).toHaveBeenCalledWith('/team/nuovo')
  })
})

// La faccia dell'atleta (spec §5-§6): il testa a testa quando sono in due, le
// vittorie quando sono di più, solo se il coach ha reso visibile la classifica;
// e «Esci dal team», che può portarsi via i propri risultati. L'ordine conta:
// prima si cancellano i risultati, poi si esce (dopo, la RLS li nasconde).
describe('/team/:id — atleta', () => {
  const luca = { id: 'b', email: 'luca@x.it' }
  const apriDaAtleta = () => montaPagina(<SchedaTeam />, { role: 'athlete', user: luca, percorso: '/team/t1', rotta: '/team/:id' })
  const chiusa = (id, data, risultati) => ({ id, metrica: 'tempo', data, chiusa_il: `${data}T20:00:00Z`, titolo: 'Hyrox', risultati })

  beforeEach(() => {
    dati.scheda.membri = dati.scheda.membri.filter(m => m.atleta_id !== 'i')
    dati.sfide = [
      chiusa('s1', '2026-11-01', [{ atleta_id: 'b', valore: 240 }, { atleta_id: 'c', valore: 250 }]),
      chiusa('s2', '2026-11-03', [{ atleta_id: 'b', valore: 260 }, { atleta_id: 'c', valore: 255 }]),
    ]
  })

  it('in due, con la classifica visibile: il testa a testa', async () => {
    dati.scheda.team.classifica_visibile = true
    apriDaAtleta()
    const blocco = await screen.findByRole('region', { name: 'Testa a testa' })
    expect(within(blocco).getByText('1–1')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Vittorie' })).toBeNull()
  })

  it('in tre: le vittorie, non il testa a testa', async () => {
    dati.scheda.team.classifica_visibile = true
    dati.scheda.membri.push({ atleta_id: 'd', nome: 'Dario', cognome: 'Terzo', stato: 'dentro', invitato_il: giorniFa(3), risposto_il: giorniFa(3) })
    apriDaAtleta()
    expect(await screen.findByRole('region', { name: 'Vittorie' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Testa a testa' })).toBeNull()
  })

  it('con la classifica nascosta: né testa a testa né vittorie', async () => {
    apriDaAtleta()
    await screen.findByRole('region', { name: 'Membri' })
    expect(screen.queryByRole('region', { name: 'Testa a testa' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Vittorie' })).toBeNull()
  })

  it('«Esci dal team» con la cancellazione: prima cancella i risultati, poi esce', async () => {
    const u = userEvent.setup()
    apriDaAtleta()
    await u.click(await screen.findByRole('button', { name: 'Esci dal team' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Esci dal team' })
    await u.click(within(dialogo).getByRole('checkbox', { name: 'Cancella anche i miei risultati' }))
    await u.click(within(dialogo).getByRole('button', { name: 'Esci' }))
    await waitFor(() => expect(db.rispondi).toHaveBeenCalledWith('t1', 'b', 'uscito'))
    expect(db.cancellaMieiRisultati).toHaveBeenCalledWith('t1', 'b')
    expect(db.cancellaMieiRisultati.mock.invocationCallOrder[0]).toBeLessThan(db.rispondi.mock.invocationCallOrder[0])
    expect(naviga).toHaveBeenCalledWith('/team', { replace: true })
  })

  it('«Esci dal team» senza la scelta: i risultati restano', async () => {
    const u = userEvent.setup()
    apriDaAtleta()
    await u.click(await screen.findByRole('button', { name: 'Esci dal team' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Esci dal team' })
    await u.click(within(dialogo).getByRole('button', { name: 'Esci' }))
    await waitFor(() => expect(db.rispondi).toHaveBeenCalledWith('t1', 'b', 'uscito'))
    expect(db.cancellaMieiRisultati).not.toHaveBeenCalled()
  })
})
