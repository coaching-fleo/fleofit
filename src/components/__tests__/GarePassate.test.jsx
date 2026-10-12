import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Perché questi test esistono
// ────────────────────────────
// «Le tue gare HYROX» scrive nella storia dell'atleta (calendario e record)
// gare di mesi o anni fa. Il sito dei risultati NON dà la data: il giorno lo
// sceglie l'atleta, e senza giorno non si salva niente. È la cosa che conta:
// una data inventata finirebbe nel calendario come vera.

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    athletes: [{ name: 'Alessandro', surname: 'Rossi' }],
    personal_records: [],
    workouts: [{ id: 'w-nuovo' }],
  }))
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const GarePassate = (await import('../GarePassate')).default

const GARE = [
  { gruppo: '2026 Turin', stagione: 8, etichetta: '25/26', anno: '2026', citta: 'Turin' },
  { gruppo: '2023 Milan', stagione: 6, etichetta: '23/24', anno: '2023', citta: 'Milan' },
]
const RIGA = { idp: 'x1', evento: 'HPRO_X', corrispondenza: 2, nome: 'Rossi, Alessandro (ITA)', divisione: 'HYROX PRO - Friday', categoriaEta: '30-34', tempo: '01:12:38' }
const DETTAGLIO = { ...RIGA, posizione: '79', posizioneCategoria: '31', run: [], stazioni: [], url: 'u' }

beforeEach(() => {
  finto.chiamate.length = 0
  localStorage.clear()
  finto.supabase.functions.invoke.mockReset()
  finto.supabase.functions.invoke.mockImplementation((_, { body }) => Promise.resolve(
    body.azione === 'gare' ? { data: { gare: GARE }, error: null }
      : body.azione === 'dettaglio' ? { data: { stato: 'trovato', dettaglio: DETTAGLIO }, error: null }
        : { data: { stato: 'trovato', stagione: body.stagione, gruppo: body.gruppo, candidati: [RIGA] }, error: null },
  ))
})

describe('GarePassate', () => {
  it('elenca le gare per stagione e cerca il nome nella gara scelta', async () => {
    render(<GarePassate athleteId="u1" />)
    expect(await screen.findByText('Stagione 2025/26')).toBeInTheDocument()
    expect(screen.getByText('Stagione 2023/24')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Turin 2026' }))
    expect(await screen.findByText('Rossi, Alessandro (ITA)')).toBeInTheDocument()
    expect(finto.supabase.functions.invoke).toHaveBeenCalledWith('risultato-hyrox', {
      body: { gruppo: '2026 Turin', stagione: 8, cognome: 'Rossi', nome: 'Alessandro' },
    })
  })

  it('dopo la conferma chiede il giorno, e senza giorno non salva', async () => {
    const onSalvato = vi.fn()
    render(<GarePassate athleteId="u1" onSalvato={onSalvato} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Turin 2026' }))
    await userEvent.click(await screen.findByRole('button', { name: /Rossi, Alessandro/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Sì, sono io' }))

    expect(await screen.findByText('In che giorno era?')).toBeInTheDocument()
    expect(screen.getByText(/Hai corso di venerdì/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salva la gara' })).toBeDisabled()
    expect(finto.chiamateA('workouts', 'insert')).toHaveLength(0)
    expect(onSalvato).not.toHaveBeenCalled()
  })
})
