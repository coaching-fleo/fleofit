import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RunningStepRow } from '../CreateWorkout'

// Perché questi test esistono
// ────────────────────────────
// Stessa ragione di HyroxBlock.test.jsx (BACKLOG #15), più una specifica:
// RunningStepRow ha un contratto DIVERSO dal suo gemello Hyrox. Qui onMoveUp
// riceve l'indice, onRemove riceve step.id, onDuplicate e onEdit ricevono
// l'intero step. In HyroxBlock non riceve niente nessuno. Un refactor che
// "uniforma" i due componenti romperebbe il riordino delle fasi di corsa
// senza che nessun test se ne accorga: da oggi se ne accorge.

const passoBase = (extra = {}) => ({
  id: 0.42,
  type: 'run',
  duration: '10 min',
  pace: '5:00 /km',
  intensity: '6',
  notes: '',
  ...extra,
})

const props = (extra = {}) => ({
  step: passoBase(),
  index: 1,
  total: 3,
  onRemove: vi.fn(),
  onMoveUp: vi.fn(),
  onMoveDown: vi.fn(),
  onEdit: vi.fn(),
  onDuplicate: vi.fn(),
  ...extra,
})

describe('etichetta della fase', () => {
  const casi = [
    ['warmup', 'Riscaldamento'],
    ['run', 'Corsa'],
    ['recover', 'Recupero'],
    ['cooldown', 'Defaticamento'],
    ['repeat', 'Ripetute'],
  ]

  it.each(casi)('%s si legge "%s" in italiano', (type, atteso) => {
    render(<RunningStepRow {...props({ step: passoBase({ type, rounds: '8', runDuration: '400m', recDuration: '1 min' }) })} />)
    expect(screen.getByText(atteso)).toBeInTheDocument()
  })
})

describe('passo semplice', () => {
  it('mostra durata e ritmo', () => {
    render(<RunningStepRow {...props()} />)
    expect(screen.getByText('10 min')).toBeInTheDocument()
    expect(screen.getByText('@5:00 /km')).toBeInTheDocument()
  })

  it('senza ritmo non inventa una chiocciola vuota', () => {
    render(<RunningStepRow {...props({ step: passoBase({ pace: '' }) })} />)
    expect(screen.queryByText('@')).not.toBeInTheDocument()
  })
})

describe('ripetute', () => {
  // Le ripetute sono l'unico tipo con due sotto-fasi: corsa e recupero, ognuna
  // con durata e ritmo propri. Renderizzarle come un passo semplice
  // significherebbe perdere metà dell'allenamento senza errori a schermo.
  const ripetuta = passoBase({
    type: 'repeat',
    rounds: '8',
    runDuration: '400m',
    runPace: '3:45 /km',
    recDuration: '1 min',
    recPace: 'Camminata',
    intensity: '9',
  })

  it('mostra il numero di ripetizioni', () => {
    render(<RunningStepRow {...props({ step: ripetuta })} />)
    expect(screen.getByText('x8')).toBeInTheDocument()
  })

  it('mostra corsa e recupero separatamente, non fusi', () => {
    render(<RunningStepRow {...props({ step: ripetuta })} />)
    expect(screen.getByText('Corsa:')).toBeInTheDocument()
    expect(screen.getByText('400m')).toBeInTheDocument()
    expect(screen.getByText('@3:45 /km')).toBeInTheDocument()
    expect(screen.getByText('Recupero:')).toBeInTheDocument()
    expect(screen.getByText('1 min')).toBeInTheDocument()
    expect(screen.getByText('@Camminata')).toBeInTheDocument()
  })

  it('mostra l intensità come n/10', () => {
    render(<RunningStepRow {...props({ step: ripetuta })} />)
    expect(screen.getByText('9/10')).toBeInTheDocument()
  })

  it('un passo semplice non mostra le sotto-fasi', () => {
    render(<RunningStepRow {...props()} />)
    expect(screen.queryByText('Corsa:')).not.toBeInTheDocument()
    expect(screen.queryByText('Recupero:')).not.toBeInTheDocument()
  })
})

describe('contratto verso il padre — DIVERSO da HyroxBlock', () => {
  it('onMoveUp e onMoveDown ricevono l INDICE', async () => {
    const p = props({ index: 1, total: 3 })
    render(<RunningStepRow {...p} />)
    await userEvent.click(screen.getByLabelText('Sposta la fase su'))
    await userEvent.click(screen.getByLabelText('Sposta la fase giù'))
    expect(p.onMoveUp).toHaveBeenCalledWith(1)
    expect(p.onMoveDown).toHaveBeenCalledWith(1)
  })

  it('onRemove riceve step.id, non l indice', async () => {
    // Se ricevesse l'indice, cancellerebbe la fase sbagliata dopo un riordino.
    const p = props()
    render(<RunningStepRow {...p} />)
    await userEvent.click(screen.getByLabelText('Elimina la fase'))
    expect(p.onRemove).toHaveBeenCalledWith(0.42)
  })

  it('onDuplicate e onEdit ricevono l intero passo', async () => {
    const p = props()
    render(<RunningStepRow {...p} />)
    await userEvent.click(screen.getByLabelText('Duplica la fase'))
    expect(p.onDuplicate).toHaveBeenCalledWith(p.step)

    await userEvent.click(screen.getByText('Corsa'))
    expect(p.onEdit).toHaveBeenCalledWith(p.step)
  })

  it('la prima fase non può salire e l ultima non può scendere', () => {
    const { unmount } = render(<RunningStepRow {...props({ index: 0, total: 3 })} />)
    expect(screen.getByLabelText('Sposta la fase su')).toBeDisabled()
    expect(screen.getByLabelText('Sposta la fase giù')).toBeEnabled()
    unmount()

    render(<RunningStepRow {...props({ index: 2, total: 3 })} />)
    expect(screen.getByLabelText('Sposta la fase su')).toBeEnabled()
    expect(screen.getByLabelText('Sposta la fase giù')).toBeDisabled()
  })

  it('con total mancante la riga unica è comunque bloccata in entrambi i versi', () => {
    // total è opzionale: il codice ricade su 1. Senza questo default, l'unica
    // fase di un allenamento avrebbe una freccia giù attiva che non fa niente.
    render(<RunningStepRow {...props({ index: 0, total: undefined })} />)
    expect(screen.getByLabelText('Sposta la fase su')).toBeDisabled()
    expect(screen.getByLabelText('Sposta la fase giù')).toBeDisabled()
  })
})
