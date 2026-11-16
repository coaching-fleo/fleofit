import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent, within } from '@testing-library/react'
import { montaPagina } from '../../test/montaPagina'

// Perché questi test esistono
// ────────────────────────────
// «Team e gruppi» dalla scheda di un atleta (16/11/2026). Gli errori che a
// schermo non danno errore: la sezione Team visibile con l'interruttore spento
// (gli atleti vedrebbero inviti a una funzione che non c'è), una voce di menu
// che apre un foglio vuoto quando le tabelle mancano, un gruppo salvato senza
// gli altri atleti, un «togli» senza conferma, o un «togli» che con la
// migrazione non ancora applicata (la RLS non cancella niente, senza errore)
// sembra riuscito.

const dati = await vi.hoisted(async () => ({
  gruppi: { disponibile: true, gruppi: [] },
  mieiTeam: { disponibile: true, team: [] },
  righe: { disponibile: true, righe: [] },
  nonTolto: false,
}))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    athletes: [{ id: 'a5', name: 'Andrea', surname: 'Vitali', photo_url: null, weight: 74, height: 181, birth_date: '1992-04-03', instagram_url: null, strava_url: null, notes: null }],
    athlete_workouts: [], personal_records: [],
    coach_atleti: [{ athlete_id: 'a5', coach_id: 'coach' }],
  }))
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))
vi.mock('../../lib/gruppiAtletiDb', async (originale) => ({
  ...(await originale()),
  elencoGruppi: vi.fn(async () => dati.gruppi),
  aggiornaGruppo: vi.fn(async () => ({})),
  creaGruppo: vi.fn(async () => ({})),
}))
vi.mock('../../lib/teamDb', async (originale) => ({
  ...(await originale()),
  leggiTeamAtleta: vi.fn(async () => ({ disponibile: dati.mieiTeam.disponibile, team: [] })),
  leggiMieiTeam: vi.fn(async () => dati.mieiTeam),
  leggiMembriAtleta: vi.fn(async () => dati.righe),
  invita: vi.fn(async () => ({ invitati: ['a5'] })),
  annullaInvito: vi.fn(async () => {}),
  togliDalTeam: vi.fn(async () => { if (dati.nonTolto) throw Object.assign(new Error('no'), { code: 'NON_TOLTO' }) }),
}))

const AthleteDetail = (await import('../AthleteDetail')).default
const gdb = await import('../../lib/gruppiAtletiDb')
const tdb = await import('../../lib/teamDb')

const monta = () => montaPagina(<AthleteDetail />, { role: 'coach', user: { id: 'coach', email: 'c@f.it' }, percorso: '/athletes/a5', rotta: '/athletes/:id' })
const attendiScheda = () => waitFor(() => expect(screen.getByRole('heading', { name: /Andrea Vitali/ })).toBeInTheDocument())
const apriMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Altre azioni' }))
const apriFoglio = async () => {
  apriMenu()
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Team e gruppi' }))
  return screen.findByRole('dialog', { name: /Team e gruppi/ })
}
const T = (id, extra) => ({ id, nome: `Team ${id}`, coach_id: 'coach', chiuso_il: null, ...extra })

beforeEach(() => {
  dati.gruppi = { disponibile: true, gruppi: [] }
  dati.mieiTeam = { disponibile: true, team: [] }
  dati.righe = { disponibile: true, righe: [] }
  dati.nonTolto = false
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('Team e gruppi nella scheda atleta (coach)', () => {
  it('la riga «Gruppi:» elenca i gruppi in cui è l’atleta', async () => {
    dati.gruppi = { disponibile: true, gruppi: [{ id: 'g1', nome: 'Hyrox martedì', atleti: ['a5'] }, { id: 'g2', nome: 'Corsa', atleti: ['x'] }] }
    monta(); await attendiScheda()
    expect(await screen.findByText('Gruppi: Hyrox martedì')).toBeInTheDocument()
  })

  it('toccare un gruppo ci mette l’atleta, tenendo gli altri', async () => {
    dati.gruppi = { disponibile: true, gruppi: [{ id: 'g2', nome: 'Corsa', atleti: ['x'] }] }
    monta(); await attendiScheda()
    const foglio = await apriFoglio()
    fireEvent.click(within(foglio).getByRole('button', { name: /Corsa/ }))
    await waitFor(() => expect(gdb.aggiornaGruppo).toHaveBeenCalledWith('g2', { nome: 'Corsa', atleti: ['x', 'a5'] }, expect.any(Array)))
  })

  it('un gruppo nuovo nasce con dentro questo atleta', async () => {
    monta(); await attendiScheda()
    const foglio = await apriFoglio()
    fireEvent.click(within(foglio).getByRole('button', { name: /Nuovo gruppo/ }))
    fireEvent.change(within(foglio).getByLabelText('Nome del gruppo'), { target: { value: 'Mattina' } })
    fireEvent.click(within(foglio).getByRole('button', { name: 'Crea gruppo' }))
    await waitFor(() => expect(gdb.creaGruppo).toHaveBeenCalledWith({ coach: 'coach', nome: 'Mattina', atleti: ['a5'] }, []))
  })

  it('invita in un team aperto', async () => {
    dati.mieiTeam = { disponibile: true, team: [T('t1')] }
    monta(); await attendiScheda()
    const foglio = await apriFoglio()
    fireEvent.click(await within(foglio).findByRole('button', { name: 'Invita in Team t1' }))
    await waitFor(() => expect(tdb.invita).toHaveBeenCalledWith('t1', ['a5']))
  })

  it('chi è dentro si toglie, ma solo dopo la conferma', async () => {
    dati.mieiTeam = { disponibile: true, team: [T('t1')] }
    dati.righe = { disponibile: true, righe: [{ team_id: 't1', stato: 'dentro' }] }
    monta(); await attendiScheda()
    const foglio = await apriFoglio()
    fireEvent.click(await within(foglio).findByRole('button', { name: 'Togli da Team t1' }))
    expect(tdb.togliDalTeam).not.toHaveBeenCalled()
    const dialogo = await screen.findByText(/Togli Andrea da «Team t1»/)
    fireEvent.click(within(dialogo.closest('[role="dialog"]') || document.body).getByRole('button', { name: 'Togli' }))
    await waitFor(() => expect(tdb.togliDalTeam).toHaveBeenCalledWith('t1', 'a5'))
  })

  it('migrazione non applicata: dice che non è attivo, non finge di esserci riuscito', async () => {
    dati.nonTolto = true
    dati.mieiTeam = { disponibile: true, team: [T('t1')] }
    dati.righe = { disponibile: true, righe: [{ team_id: 't1', stato: 'dentro' }] }
    monta(); await attendiScheda()
    const foglio = await apriFoglio()
    fireEvent.click(await within(foglio).findByRole('button', { name: 'Togli da Team t1' }))
    const dialogo = await screen.findByText(/Togli Andrea da «Team t1»/)
    fireEvent.click(within(dialogo.closest('[role="dialog"]') || document.body).getByRole('button', { name: 'Togli' }))
    expect(await within(foglio).findByRole('alert')).toHaveTextContent(/non è ancora attivo/)
  })

  it('con l’interruttore team spento la sezione Team non c’è', async () => {
    globalThis.funzioniSpente = ['team']
    dati.mieiTeam = { disponibile: true, team: [T('t1')] }
    monta(); await attendiScheda()
    const foglio = await apriFoglio()
    expect(within(foglio).getByText('Gruppi')).toBeInTheDocument()
    expect(within(foglio).queryByText('Team')).not.toBeInTheDocument()
    expect(tdb.leggiMieiTeam).not.toHaveBeenCalled()
  })

  it('tabella dei gruppi assente e team spento: nessuna voce di menu', async () => {
    globalThis.funzioniSpente = ['team']
    dati.gruppi = { disponibile: false, gruppi: [] }
    monta(); await attendiScheda()
    await waitFor(() => expect(gdb.elencoGruppi).toHaveBeenCalled())
    apriMenu()
    await screen.findByRole('menuitem', { name: 'Esporta dati' })
    expect(screen.queryByRole('menuitem', { name: 'Team e gruppi' })).not.toBeInTheDocument()
  })

  it('tabelle dei team assenti: niente sezione Team anche ad interruttore acceso', async () => {
    dati.mieiTeam = { disponibile: false, team: [] }
    monta(); await attendiScheda()
    await waitFor(() => expect(tdb.leggiTeamAtleta).toHaveBeenCalled())
    const foglio = await apriFoglio()
    expect(within(foglio).queryByText('Team')).not.toBeInTheDocument()
  })
})
