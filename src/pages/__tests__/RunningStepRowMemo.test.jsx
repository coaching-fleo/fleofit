import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// Perché questo test esiste
// ──────────────────────────
// BACKLOG #15-bis, il gemello di HyroxBlock. Le fasi di corsa non hanno scroll
// picker da 102 opzioni, quindi il guadagno è minore — ma la dinamica è la
// stessa: senza memo, ogni carattere digitato nel titolo le ridisegna tutte.
//
// Come si contano i render, qui. RunningStepRow non chiama blockHint (quello è
// dei blocchi Hyrox), quindi serve un altro contatore interno. L'icona `Copy`
// del bottone "Duplica la fase" va bene: nel flusso Running è renderizzata
// SOLO da RunningStepRow, quindi contarla equivale a contarne i render.
const spiaCopy = vi.fn()
vi.mock('lucide-react', async (originale) => {
  const vero = await originale()
  return {
    ...vero,
    Copy: (props) => { spiaCopy(); return createElement(vero.Copy, props) },
  }
})

vi.mock('../../supabaseClient', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }),
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) },
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
  },
}))

const CreateWorkout = (await import('../CreateWorkout')).default

// Porta il builder Running al passo 2 con una fase già inserita.
async function builderConUnaFase(tipo = 'Corsa') {
  render(<MemoryRouter><CreateWorkout /></MemoryRouter>)
  await userEvent.type(screen.getByPlaceholderText(/Nome workout/), 'Corsa')
  await userEvent.click(screen.getByRole('button', { name: 'Running' }))
  await userEvent.click(screen.getByRole('button', { name: /Crea Allenamento/ }))
  await userEvent.click(screen.getByRole('button', { name: /Aggiungi prima fase/ }))
  await userEvent.click(screen.getByRole('button', { name: tipo }))
  await userEvent.click(screen.getByRole('button', { name: 'Aggiungi Fase' }))
  expect(screen.getAllByLabelText('Elimina la fase')).toHaveLength(1)
}

async function aggiungiFase(tipo) {
  await userEvent.click(screen.getByRole('button', { name: /Aggiungi una fase di corsa/ }))
  await userEvent.click(screen.getByRole('button', { name: tipo }))
  await userEvent.click(screen.getByRole('button', { name: 'Aggiungi Fase' }))
}

beforeEach(() => { spiaCopy.mockClear() })

describe('CreateWorkout non ridisegna le fasi mentre si scrive il titolo', () => {
  it('otto caratteri nel titolo, zero render delle fasi', async () => {
    await builderConUnaFase()
    spiaCopy.mockClear()

    await userEvent.type(screen.getByPlaceholderText(/Nome workout/), 'Lunghi!')

    expect(spiaCopy).not.toHaveBeenCalled()
  })

  it('ma aggiungere una fase le ridisegna, come deve', async () => {
    // Il contraltare: senza, il test sopra passerebbe anche con un builder
    // rotto che non mostra mai niente.
    await builderConUnaFase()
    spiaCopy.mockClear()

    await aggiungiFase('Recupero')

    expect(spiaCopy).toHaveBeenCalled()
    expect(screen.getAllByLabelText('Elimina la fase')).toHaveLength(2)
  })
})

describe('il riordino e l eliminazione restano corretti', () => {
  // ⚠️ RunningStepRow passa l'INDICE a onMoveUp/onMoveDown e l'ID a onRemove:
  // il contratto è asimmetrico rispetto a HyroxBlock, e deve restarlo
  // (§9-quinquies). Questi test tengono onesto il refactor.
  const etichette = () => screen.getAllByLabelText('Elimina la fase')
    .map(b => b.closest('[data-drag-item]').querySelector('span').textContent)

  it('sposta la fase giusta', async () => {
    await builderConUnaFase('Riscaldamento')
    await aggiungiFase('Defaticamento')
    expect(etichette()).toEqual(['Riscaldamento', 'Defaticamento'])

    await userEvent.click(screen.getAllByLabelText('Sposta la fase su')[1])
    expect(etichette()).toEqual(['Defaticamento', 'Riscaldamento'])
  })

  it('elimina la fase giusta', async () => {
    await builderConUnaFase('Riscaldamento')
    await aggiungiFase('Defaticamento')

    await userEvent.click(screen.getAllByLabelText('Elimina la fase')[0])
    expect(etichette()).toEqual(['Defaticamento'])
  })
})
