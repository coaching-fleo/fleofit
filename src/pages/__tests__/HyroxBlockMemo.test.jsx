import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useState, useCallback } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Come si contano i render di un componente che non si può modificare.
//
// Un componente-spia che avvolge HyroxBlock NON funziona: la spia non è
// memoizzata, quindi si ri-renderizza sempre e conta anche quando il figlio
// dentro di lei viene saltato. (Primo tentativo, 26/08/2026: dava un falso
// fallimento.) Serve un contatore che stia DENTRO il componente: blockHint()
// è chiamata a ogni render di HyroxBlock, quindi la si intercetta.
vi.mock('../../lib/blockHints', async (originale) => {
  const vero = await originale()
  return { ...vero, blockHint: vi.fn(vero.blockHint) }
})

const { blockHint } = await import('../../lib/blockHints')
const { HyroxBlock } = await import('../CreateWorkout')

// Perché questo test esiste
// ──────────────────────────
// BACKLOG #15. Ogni blocco aperto contiene scroll picker da 102 opzioni: con 8
// blocchi, un carattere digitato nel titolo ne ridisegnava migliaia.
// React.memo salta il render solo se le props sono identiche PER RIFERIMENTO:
// basta che il padre torni a passare una arrow inline e la memoizzazione smette
// di servire, senza che niente lo segnali. Questo test è quel segnale.

const BLOCCO = { id: 1, type: 'WarmUp', params: { duration: '5:00' }, notes: '', exercises: [] }

// Padre che riproduce il contratto di CreateWorkout: uno stato che cambia
// (il titolo) e un blocco che non cambia.
function Padre() {
  const [titolo, setTitolo] = useState('')
  const [blocks, setBlocks] = useState([BLOCCO])

  const onUpdate = useCallback((nuovo) => {
    setBlocks(prev => prev.map(b => (b.id === nuovo.id ? nuovo : b)))
  }, [])
  const noop = useCallback(() => {}, [])

  return (
    <div>
      <input aria-label="Titolo" value={titolo} onChange={e => setTitolo(e.target.value)} />
      {blocks.map((b, i) => (
        <HyroxBlock
          key={b.id} block={b} index={i} total={blocks.length} isOpen={false}
          onToggle={noop} onUpdate={onUpdate} onRemove={noop}
          onMoveUp={noop} onMoveDown={noop} onDuplicate={noop}
          onDragStartIndex={noop} onDragEnterIndex={noop} onDragEndIndex={noop}
          onDuplicateExerciseRequest={noop}
        />
      ))}
    </div>
  )
}

beforeEach(() => { blockHint.mockClear() })

describe('memoizzazione di HyroxBlock', () => {
  it('digitare nel titolo NON ri-renderizza i blocchi', async () => {
    render(<Padre />)
    expect(blockHint).toHaveBeenCalled()      // il primo render c'è stato
    blockHint.mockClear()

    await userEvent.type(screen.getByLabelText('Titolo'), 'Hyrox')

    // Cinque caratteri = cinque render del padre. Un blocco le cui props non
    // sono cambiate non deve renderizzarsi nemmeno una volta.
    // Prima della correzione qui arrivavano 5 render sprecati per blocco.
    expect(blockHint).not.toHaveBeenCalled()
  })

  it('ma un blocco che cambia DAVVERO si ri-renderizza', async () => {
    // Il contraltare: senza questo, il test sopra passerebbe anche con un
    // componente rotto che non si aggiorna mai.
    const { rerender } = render(
      <HyroxBlock block={BLOCCO} index={0} total={1} isOpen={false}
        onToggle={() => {}} onUpdate={() => {}} onRemove={() => {}}
        onMoveUp={() => {}} onMoveDown={() => {}} onDuplicate={() => {}}
        onDragStartIndex={() => {}} onDragEnterIndex={() => {}} onDragEndIndex={() => {}}
        onDuplicateExerciseRequest={() => {}} />
    )
    blockHint.mockClear()

    rerender(
      <HyroxBlock block={{ ...BLOCCO, type: 'AMRAP' }} index={0} total={1} isOpen={false}
        onToggle={() => {}} onUpdate={() => {}} onRemove={() => {}}
        onMoveUp={() => {}} onMoveDown={() => {}} onDuplicate={() => {}}
        onDragStartIndex={() => {}} onDragEnterIndex={() => {}} onDragEndIndex={() => {}}
        onDuplicateExerciseRequest={() => {}} />
    )
    expect(blockHint).toHaveBeenCalledWith('AMRAP')
  })
})
