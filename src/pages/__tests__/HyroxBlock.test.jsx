import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HyroxBlock } from '../CreateWorkout'

// Perché questi test esistono
// ────────────────────────────
// BACKLOG #15 vuole mettere React.memo su questo componente, e per farlo deve
// cambiare il contratto padre-figlio: passare block.id invece di idx, e
// stabilizzare con useCallback i nove gestori oggi definiti come arrow inline.
// È un refactor che può rompere due cose in silenzio: il riepilogo del blocco
// chiuso (se il figlio si tiene una copia vecchia di `block`) e la forma
// dell'oggetto passato a onUpdate. Questi test fissano entrambe.

const bloccoBase = (extra = {}) => ({
  id: 0.123,
  type: 'WarmUp',
  params: { duration: '5:00' },
  notes: '',
  exercises: [],
  ...extra,
})

const props = (extra = {}) => ({
  block: bloccoBase(),
  index: 1,
  total: 3,
  isOpen: false,
  onToggle: vi.fn(),
  onUpdate: vi.fn(),
  onRemove: vi.fn(),
  onMoveUp: vi.fn(),
  onMoveDown: vi.fn(),
  onDuplicate: vi.fn(),
  onDuplicateExerciseRequest: vi.fn(),
  ...extra,
})

describe('riepilogo del blocco chiuso', () => {
  // Ogni tipo ha una sua riga di riepilogo e un suo default. Se il refactor
  // fa arrivare al figlio un `block` stantio, è qui che si vede per primo.
  const casi = [
    ['WarmUp',   { duration: '7:00' },                        '7:00'],
    ['Rest',     { duration: '2:30' },                        '2:30'],
    ['ON/OFF',   { on: '0:40', off: '0:20', rounds: '8' },    '0:40 ON / 0:20 OFF · 8 rounds'],
    ['EMOM',     { interval: '1:30', rounds: '12' },          'Ogni 1:30 x 12 rounds'],
    ['AMRAP',    { duration: '15:00' },                       '15:00'],
    ['For Time', { rounds: '5' },                             '5 rounds'],
    ['Interval', { rounds: '4' },                             '4 rounds'],
  ]

  it.each(casi)('%s mostra il proprio riepilogo', (type, params, atteso) => {
    render(<HyroxBlock {...props({ block: bloccoBase({ type, params }) })} />)
    expect(screen.getByText(atteso)).toBeInTheDocument()
  })

  // I default non sono un dettaglio: un blocco creato e mai aperto non ha
  // params, e la riga deve dire comunque qualcosa di sensato.
  const default_ = [
    ['WarmUp',   '3:00'],
    ['ON/OFF',   '1:00 ON / 1:00 OFF · 10 rounds'],
    ['EMOM',     'Ogni 1:00 x 10 rounds'],
    ['AMRAP',    '10:00'],
    ['For Time', '3 rounds'],
    ['Interval', '1 rounds'],
  ]

  it.each(default_)('%s senza params ricade sul default', (type, atteso) => {
    render(<HyroxBlock {...props({ block: bloccoBase({ type, params: undefined }) })} />)
    expect(screen.getByText(atteso)).toBeInTheDocument()
  })
})

describe('Cash In / Cash Out', () => {
  // CLAUDE.md §9-ter: questi due nomi non si toccano, sono termini Hyrox
  // persistiti dentro workouts.sections. Il riepilogo ha una regola sua:
  // il rest compare solo con più di un round.
  it('con un solo round dice "1 round", al singolare e senza rest', () => {
    render(<HyroxBlock {...props({ block: bloccoBase({ type: 'Cash In', params: { rounds: '1', rest: '1:00' } }) })} />)
    expect(screen.getByText('1 round')).toBeInTheDocument()
  })

  it('con più round mostra anche il rest', () => {
    render(<HyroxBlock {...props({ block: bloccoBase({ type: 'Cash Out', params: { rounds: '3', rest: '1:30' } }) })} />)
    expect(screen.getByText('3 rounds · 1:30 rest')).toBeInTheDocument()
  })

  it('ignora il rest quando vale "-"', () => {
    render(<HyroxBlock {...props({ block: bloccoBase({ type: 'Cash In', params: { rounds: '2', rest: '-' } }) })} />)
    expect(screen.getByText('2 rounds')).toBeInTheDocument()
  })

  it('mostra il tipo con la sua didascalia in chiaro', () => {
    // Le didascalie sono la risposta al rilievo 3.2.1(viii) di Apple: il termine
    // resta, ma accanto c'è la spiegazione. Se sparisce, torna il rischio.
    render(<HyroxBlock {...props({ block: bloccoBase({ type: 'Cash In' }) })} />)
    expect(screen.getByText('Cash In')).toBeInTheDocument()
    expect(screen.getByText(/apertura|inizio|prima/i)).toBeInTheDocument()
  })
})

describe('contratto verso il padre', () => {
  // ⚠️ CAMBIATO il 26/08/2026 dal refactor di memoizzazione (BACKLOG #15).
  // Prima i gestori non ricevevano niente e il padre li richiudeva su `idx`,
  // il che rendeva impossibile stabilizzarli con useCallback([]) — e senza
  // gestori stabili React.memo non salta mai un render.
  // Ora il blocco si identifica: passa `block.id`, il padre lavora per id
  // dentro un aggiornamento funzionale e non cattura più né `blocks` né `idx`.
  //
  // ⚠️ Resta ASIMMETRICO rispetto a RunningStepRow, che passa l'INDICE
  // (`onMoveUp(index)`). Uniformarli romperebbe il riordino delle fasi di corsa:
  // vedi RunningStepRow.test.jsx.
  it('onMoveUp e onMoveDown ricevono block.id, non l indice', async () => {
    const p = props({ index: 1, total: 3 })
    render(<HyroxBlock {...p} />)
    await userEvent.click(screen.getByLabelText('Sposta il blocco su'))
    await userEvent.click(screen.getByLabelText('Sposta il blocco giù'))
    // 0.123 è l'id del blocco di prova, 1 sarebbe l'indice: devono arrivare l'id.
    expect(p.onMoveUp).toHaveBeenCalledWith(0.123)
    expect(p.onMoveDown).toHaveBeenCalledWith(0.123)
  })

  it('anche onRemove, onDuplicate e onToggle ricevono block.id', async () => {
    const p = props()
    render(<HyroxBlock {...p} />)
    await userEvent.click(screen.getByLabelText('Elimina il blocco'))
    expect(p.onRemove).toHaveBeenCalledWith(0.123)
    await userEvent.click(screen.getByLabelText('Duplica il blocco'))
    expect(p.onDuplicate).toHaveBeenCalledWith(0.123)
    await userEvent.click(screen.getByText('WarmUp'))
    expect(p.onToggle).toHaveBeenCalledWith(0.123)
  })

  it('il primo blocco non può salire e l ultimo non può scendere', () => {
    const { unmount } = render(<HyroxBlock {...props({ index: 0, total: 3 })} />)
    expect(screen.getByLabelText('Sposta il blocco su')).toBeDisabled()
    expect(screen.getByLabelText('Sposta il blocco giù')).toBeEnabled()
    unmount()

    render(<HyroxBlock {...props({ index: 2, total: 3 })} />)
    expect(screen.getByLabelText('Sposta il blocco su')).toBeEnabled()
    expect(screen.getByLabelText('Sposta il blocco giù')).toBeDisabled()
  })

  it('duplica ed elimina arrivano al padre una volta sola', async () => {
    const p = props()
    render(<HyroxBlock {...p} />)
    await userEvent.click(screen.getByLabelText('Duplica il blocco'))
    expect(p.onDuplicate).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByLabelText('Elimina il blocco'))
    expect(p.onRemove).toHaveBeenCalledTimes(1)
  })

  it('il click sull intestazione apre e chiude, quello sui bottoni no', async () => {
    // I bottoni sono dentro l'area cliccabile: senza stopPropagation, eliminare
    // un blocco lo aprirebbe anche. Il refactor non deve perdere quel dettaglio.
    const p = props()
    render(<HyroxBlock {...p} />)
    await userEvent.click(screen.getByText('WarmUp'))
    expect(p.onToggle).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByLabelText('Elimina il blocco'))
    expect(p.onToggle).toHaveBeenCalledTimes(1)
  })
})
