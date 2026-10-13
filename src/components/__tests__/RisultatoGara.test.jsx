import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Perché questi test esistono
// ────────────────────────────
// «Com'è andata?» parte da solo e scrive nella storia dell'atleta. Le cose
// che non devono succedere: salvare un tempo senza la conferma («è tuo?»),
// proporre come suo un omonimo per prefisso, e restare senza via d'uscita
// quando il sito non trova niente.

const dati = await vi.hoisted(async () => ({ atleta: { name: 'Alessandro', surname: 'Rossi' }, nota: 'Che fatica' }))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    athletes: [dati.atleta],
    athlete_workouts: [{ notes: dati.nota }],
    personal_records: [],
  }))
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const { default: RisultatoGara, StatisticheGara } = await import('../RisultatoGara')

// Le righe come le dà la ricerca (senza split); il dettaglio arriva a parte.
const RIGA = { idp: 'x1', evento: 'HPRO_X', corrispondenza: 2, nome: 'Rossi, Alessandro (ITA)', divisione: 'HYROX PRO - Friday', categoriaEta: '30-34', tempo: '01:12:38', nazione: 'ITA' }
const OMONIMO = { idp: 'x2', evento: 'H_X', corrispondenza: 0, nome: 'Rossin, Alessandro (ITA)', divisione: 'HYROX - Saturday', categoriaEta: '40-44', tempo: '01:15:17' }
const COPPIA = { idp: 'x3', evento: 'HD_X', corrispondenza: 2, nome: 'Beatrice Schelfi, Alessandro Rossi', divisione: 'HYROX DOUBLES - Saturday', categoriaEta: '30-39', tempo: '01:11:53' }
const DETTAGLIO = {
  nome: 'Rossi, Alessandro (ITA)', divisione: 'HYROX PRO - Friday', categoriaEta: '30-34', tempo: '01:12:38',
  posizione: '79', posizioneCategoria: '31', run: [], stazioni: [], roxzone: '00:05:22', totaleCorsa: '00:32:22', url: 'https://results.hyrox.com/x',
}

/** La funzione finta: una lista per la ricerca, il dettaglio a richiesta. */
function rispondi(lista, dettaglio = DETTAGLIO) {
  finto.supabase.functions.invoke.mockImplementation((_, { body }) => Promise.resolve(
    body.azione === 'dettaglio'
      ? { data: { stato: 'trovato', dettaglio: { ...dettaglio, posizione: body.idp === 'x3' ? '12' : dettaglio.posizione } }, error: null }
      : { data: lista, error: null },
  ))
}

const PROPS = {
  awId: 'aw1', athleteId: 'u1', titolo: 'HYROX Turin', giorno: '2026-03-14',
  sections: { category: 'Event', hyrox: { id: '1', citta: 'Turin' } },
}

beforeEach(() => {
  finto.chiamate.length = 0
  finto.supabase.functions.invoke.mockReset()
  localStorage.clear()
  dati.atleta = { name: 'Alessandro', surname: 'Rossi' }
})

describe('RisultatoGara', () => {
  it('cerca il cognome, mostra la lista, e salva solo la riga scelta e confermata', async () => {
    rispondi({ stato: 'trovato', stagione: 8, candidati: [RIGA, OMONIMO] })
    const onSalvato = vi.fn()
    render(<RisultatoGara {...PROPS} onSalvato={onSalvato} />)

    expect(await screen.findByText('Ho trovato 2 risultati. Tocca il tuo.')).toBeInTheDocument()
    expect(finto.supabase.functions.invoke).toHaveBeenCalledWith('risultato-hyrox', {
      body: { citta: 'Turin', data: '2026-03-14', cognome: 'Rossi', nome: 'Alessandro' },
    })
    expect(screen.getByText('Rossin, Alessandro (ITA)')).toBeInTheDocument()
    // Niente è stato scritto: nessuno ha ancora scelto
    expect(finto.chiamateA('athlete_workouts', 'update')).toHaveLength(0)

    await userEvent.click(screen.getByRole('button', { name: /Rossi, Alessandro \(ITA\)/ }))
    expect(await screen.findByText(/79° assoluto/)).toBeInTheDocument()
    expect(finto.supabase.functions.invoke).toHaveBeenCalledWith('risultato-hyrox', {
      body: { azione: 'dettaglio', stagione: 8, idp: 'x1', evento: 'HPRO_X' },
    })
    expect(finto.chiamateA('athlete_workouts', 'update')).toHaveLength(0)

    await userEvent.click(screen.getByRole('button', { name: 'Sì, sono io' }))
    await waitFor(() => expect(onSalvato).toHaveBeenCalled())
    const [aggiornamento] = finto.chiamateA('athlete_workouts', 'update')[0].args
    expect(aggiornamento.status).toBe('completed')
    expect(aggiornamento.notes).toBe('🏁 Tempo HYROX: 1:12:38 · Pro · 79° assoluto · 31° di categoria (30-34)\n🔗 Risultato ufficiale: https://results.hyrox.com/x\nChe fatica')
    expect(finto.chiamateA('personal_records', 'insert')[0].args[0])
      .toEqual({ athlete_id: 'u1', exercise: 'HYROX Turin 2026', value: '1:12:38', date: '2026-03-14' })
  })

  // 🔴 Il caso che il committente ha chiesto: in coppia, senza scrivere niente a mano.
  it('trova anche i Doubles, e il tempo salvato dice «Doubles»', async () => {
    rispondi({ stato: 'trovato', stagione: 8, candidati: [COPPIA] },
      { ...DETTAGLIO, nome: '', divisione: 'HYROX DOUBLES - Saturday', tempo: '01:11:53', posizioneCategoria: '' })
    const onSalvato = vi.fn()
    render(<RisultatoGara {...PROPS} onSalvato={onSalvato} />)
    expect(await screen.findByText('Ho trovato un risultato. Sei tu?')).toBeInTheDocument()
    expect(screen.getByText(/Doubles · sab/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Beatrice Schelfi, Alessandro Rossi/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Sì, sono io' }))
    await waitFor(() => expect(onSalvato).toHaveBeenCalled())
    expect(finto.chiamateA('athlete_workouts', 'update')[0].args[0].notes).toMatch(/^🏁 Tempo HYROX: 1:11:53 · Doubles · 12° assoluto/)
  })

  it('se il cognome non c\'è, lo si corregge e si cerca di nuovo', async () => {
    rispondi({ stato: 'nessun-risultato', gruppo: '2026 Turin' })
    render(<RisultatoGara {...PROPS} />)
    expect(await screen.findByText(/Nessun «Rossi» fra i risultati/)).toBeInTheDocument()
    const campo = screen.getByLabelText('Cognome da cercare')
    await userEvent.clear(campo)
    await userEvent.type(campo, 'Rossi Provesi')
    await userEvent.click(screen.getByRole('button', { name: 'Cerca il cognome' }))
    await waitFor(() => expect(finto.supabase.functions.invoke).toHaveBeenLastCalledWith('risultato-hyrox', {
      body: { citta: 'Turin', data: '2026-03-14', cognome: 'Rossi Provesi', nome: 'Alessandro' },
    }))
  })

  it('il tempo si può sempre scrivere a mano', async () => {
    rispondi({ stato: 'nessun-risultato', gruppo: '2026 Turin' })
    const onSalvato = vi.fn()
    render(<RisultatoGara {...PROPS} onSalvato={onSalvato} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Scrivo il tempo a mano' }))
    await userEvent.type(screen.getByLabelText('Il tuo tempo finale'), '72:38')
    await userEvent.click(screen.getByRole('button', { name: 'Salva il tempo' }))
    await waitFor(() => expect(onSalvato).toHaveBeenCalled())
    expect(finto.chiamateA('athlete_workouts', 'update')[0].args[0].notes).toBe('🏁 Tempo HYROX: 1:12:38\nChe fatica')
  })

  it('«Non ho partecipato» non scrive niente e non chiede più', async () => {
    rispondi({ stato: 'gara-non-trovata' })
    const onSalvato = vi.fn()
    render(<RisultatoGara {...PROPS} onSalvato={onSalvato} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Non ho partecipato' }))
    expect(onSalvato).toHaveBeenCalled()
    expect(finto.chiamateA('athlete_workouts', 'update')).toHaveLength(0)
    expect(JSON.parse(localStorage.getItem('fleofit_gare_senza_risultato'))).toEqual(['aw1'])
  })

  it('senza cognome nel profilo non cerca finché non lo si scrive', async () => {
    dati.atleta = { name: 'Alessandro', surname: '' }
    rispondi({ stato: 'trovato', stagione: 8, candidati: [RIGA] })
    render(<RisultatoGara {...PROPS} />)
    expect(await screen.findByText(/Scrivi il tuo cognome/)).toBeInTheDocument()
    expect(finto.supabase.functions.invoke).not.toHaveBeenCalled()
    await userEvent.type(screen.getByLabelText('Cognome da cercare'), 'Rossi')
    await userEvent.click(screen.getByRole('button', { name: 'Cerca il cognome' }))
    expect(await screen.findByText('Ho trovato un risultato. Sei tu?')).toBeInTheDocument()
  })
})

describe('StatisticheGara', () => {
  const NOTA = '🏁 Tempo HYROX: 1:12:38 · Pro · 79° assoluto\n🔗 Risultato ufficiale: https://results.hyrox.com/season-8/?content=detail&idp=X1&event=HPRO_X&lang=EN_CAP\nChe fatica'

  it('con il link mostra le statistiche della gara, lette dal sito una volta', async () => {
    rispondi(null, {
      ...DETTAGLIO,
      run: [{ nome: 'Running 1', tempo: '00:02:56', posizione: '' }],
      stazioni: [{ nome: '1000m SkiErg', tempo: '00:04:06', posizione: '54' }, { nome: 'Wall Balls', tempo: '00:06:59', posizione: '153' }],
    })
    render(<StatisticheGara note={NOTA} />)
    expect(screen.getByText('1:12:38')).toBeInTheDocument()
    expect(await screen.findByText('La tua stazione migliore')).toBeInTheDocument()
    expect(screen.getByText('Dove hai perso di più')).toBeInTheDocument()
    expect(screen.getByText('Run 1')).toBeInTheDocument()
    expect(screen.getByText('32:22')).toBeInTheDocument()
    expect(finto.supabase.functions.invoke).toHaveBeenCalledWith('risultato-hyrox', {
      body: { azione: 'dettaglio', stagione: 8, idp: 'X1', evento: 'HPRO_X' },
    })
  })

  it('senza link mostra il tempo e offre di aggiungere le statistiche', async () => {
    const onAggiorna = vi.fn()
    render(<StatisticheGara note="🏁 Tempo HYROX: 1:12:38" onAggiorna={onAggiorna} />)
    await userEvent.click(screen.getByRole('button', { name: /Aggiungi le statistiche della gara/ }))
    expect(onAggiorna).toHaveBeenCalled()
    expect(finto.supabase.functions.invoke).not.toHaveBeenCalled()
  })
})
