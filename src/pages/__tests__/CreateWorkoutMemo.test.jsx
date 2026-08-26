import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// Perché questo test esiste, e perché non basta HyroxBlockMemo.test.jsx
// ─────────────────────────────────────────────────────────────────────
// BACKLOG #15. React.memo su HyroxBlock salta il render solo se il padre passa
// props stabili PER RIFERIMENTO. Quindi ci sono due modi di perdere il
// beneficio, e vanno coperti da due test diversi:
//
//   1. togliere memo dal figlio          → lo prende HyroxBlockMemo.test.jsx
//   2. rimettere un'arrow inline al call → lo prende SOLO questo, perché monta
//      site di CreateWorkout               CreateWorkout vero invece di un padre
//                                          finto
//
// Verificato il 26/08/2026: con un padre finto la mutazione (2) NON veniva
// rilevata. Da qui la scelta di montare la pagina intera.
//
// Il montaggio è stato possibile solo dopo aver messo un localStorage in
// memoria in src/test/setup.js: jsdom ne espone uno rotto, ed era il vero
// ostacolo ai test sulle pagine (BACKLOG #19), non i finti supabase e router.

vi.mock('../../lib/blockHints', async (originale) => {
  const vero = await originale()
  return { ...vero, blockHint: vi.fn(vero.blockHint) }
})

// CreateWorkout legge il workout da modificare al montaggio: senza editId non
// interroga niente, ma il client deve comunque esistere.
vi.mock('../../supabaseClient', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }),
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) },
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
  },
}))

const { blockHint } = await import('../../lib/blockHints')
const CreateWorkout = (await import('../CreateWorkout')).default

// Porta il builder al passo 2 con un blocco WarmUp già inserito.
async function builderConUnBlocco() {
  render(<MemoryRouter><CreateWorkout /></MemoryRouter>)
  await userEvent.type(screen.getByPlaceholderText(/Nome workout/), 'Prova')
  await userEvent.click(screen.getByRole('button', { name: /Crea Allenamento Hyrox/ }))
  await userEvent.click(screen.getByRole('button', { name: /Aggiungi Blocco/ }))
  await userEvent.click(screen.getByText('WarmUp'))
  expect(screen.getAllByLabelText('Elimina il blocco')).toHaveLength(1)
}

beforeEach(() => { blockHint.mockClear() })

describe('CreateWorkout non ridisegna i blocchi mentre si scrive il titolo', () => {
  it('otto caratteri nel titolo, zero render dei blocchi', async () => {
    await builderConUnBlocco()
    blockHint.mockClear()

    await userEvent.type(screen.getByPlaceholderText(/Nome workout/), 'Strength')

    // Prima della memoizzazione: 8 render sprecati per blocco, e ogni blocco
    // aperto contiene scroll picker da 102 opzioni.
    expect(blockHint).not.toHaveBeenCalled()
  })

  it('ma aggiungere un blocco li ridisegna, come deve', async () => {
    // Il contraltare: senza questo, il test sopra passerebbe anche con un
    // builder rotto che non mostra mai niente.
    await builderConUnBlocco()
    blockHint.mockClear()

    await userEvent.click(screen.getByRole('button', { name: /Aggiungi Blocco/ }))
    await userEvent.click(screen.getByText('AMRAP'))

    expect(blockHint).toHaveBeenCalled()
    expect(screen.getAllByLabelText('Elimina il blocco')).toHaveLength(2)
  })
})

describe('modificare un blocco non ridisegna gli altri', () => {
  // La seconda metà del guadagno, e quella che il test sul titolo NON copre.
  // Con useCallback([blocks]) i gestori restano stabili finché blocks non
  // cambia: digitare nel titolo funzionerebbe lo stesso. Ma appena si modifica
  // UN blocco, l'identità di tutti i gestori cambia e si ridisegnano TUTTI.
  // Verificato il 26/08/2026: questa era l'unica mutazione che sfuggiva.
  it('scrivere nelle note di un blocco non tocca gli altri', async () => {
    // AMRAP prima, WarmUp dopo: solo i blocchi WarmUp/Rest hanno il campo note,
    // e il blocco appena aggiunto è quello aperto. Così il campo appartiene con
    // certezza al WarmUp, e i due tipi sono distinguibili nel contatore —
    // blockHint riceve block.type, quindi due blocchi dello stesso tipo
    // sarebbero indistinguibili.
    render(<MemoryRouter><CreateWorkout /></MemoryRouter>)
    await userEvent.type(screen.getByPlaceholderText(/Nome workout/), 'Prova')
    await userEvent.click(screen.getByRole('button', { name: /Crea Allenamento Hyrox/ }))
    await userEvent.click(screen.getByRole('button', { name: /Aggiungi Blocco/ }))
    await userEvent.click(screen.getByText('AMRAP'))
    await userEvent.click(screen.getByRole('button', { name: /Aggiungi Blocco/ }))
    await userEvent.click(screen.getByText('WarmUp'))

    const note = screen.getByPlaceholderText('Opzionale...')
    blockHint.mockClear()

    await userEvent.type(note, 'test')

    const ridisegnati = blockHint.mock.calls.map(c => c[0])
    expect(ridisegnati).toContain('WarmUp')       // quello modificato: giusto
    expect(ridisegnati).not.toContain('AMRAP')    // l'altro: deve restare fermo
  })
})

describe('il riordino per id continua a funzionare dopo il refactor', () => {
  // I gestori non catturano più `idx`: lavorano per block.id dentro un
  // aggiornamento funzionale. Se qualcuno reintroducesse la posizione, il
  // riordino sposterebbe il blocco sbagliato — ed è invisibile a occhio.
  it('sposta il blocco giusto, non quello all indice giusto', async () => {
    await builderConUnBlocco()
    await userEvent.click(screen.getByRole('button', { name: /Aggiungi Blocco/ }))
    await userEvent.click(screen.getByText('AMRAP'))

    const tipi = () => screen.getAllByLabelText('Elimina il blocco')
      .map(b => b.closest('[data-drag-item]').querySelector('span span').textContent)
    expect(tipi()).toEqual(['WarmUp', 'AMRAP'])

    // Sposta su il SECONDO blocco: deve diventare il primo.
    await userEvent.click(screen.getAllByLabelText('Sposta il blocco su')[1])
    expect(tipi()).toEqual(['AMRAP', 'WarmUp'])
  })

  it('elimina il blocco giusto', async () => {
    await builderConUnBlocco()
    await userEvent.click(screen.getByRole('button', { name: /Aggiungi Blocco/ }))
    await userEvent.click(screen.getByText('AMRAP'))

    await userEvent.click(screen.getAllByLabelText('Elimina il blocco')[0])
    const rimasti = screen.getAllByLabelText('Elimina il blocco')
    expect(rimasti).toHaveLength(1)
    expect(rimasti[0].closest('[data-drag-item]').querySelector('span span').textContent).toBe('AMRAP')
  })
})
