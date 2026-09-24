import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Copy, Dumbbell } from 'lucide-react'

// Perché questo test esiste
// ─────────────────────────
// Dove l'app vibra è una scelta di prodotto (CLAUDE.md §9-duoquadragies), e
// ogni punto si può perdere in due modi opposti senza un errore: o smette di
// vibrare, o comincia a vibrare dove non deve — una scelta già attiva ritoccata,
// un esito sentito due volte. Qui si verifica il CABLAGGIO; il vocabolario è
// coperto da `src/lib/__tests__/aptica.test.js`.

const A = vi.hoisted(() => ({
  battito: vi.fn(), vibraScelta: vi.fn(), vibraPresa: vi.fn(),
  vibraSuccesso: vi.fn(), vibraErrore: vi.fn(), vibraRichiamo: vi.fn(),
}))
vi.mock('../lib/aptica', () => A)

const { CustomAlert } = await import('../components/CustomModals')
const { MenuScheda } = await import('../components/WorkoutDetailUI')
const { SOGLIA_CHIUSURA } = await import('../useBottomSheet')
const { Interruttore } = await import('../components/ImpostazioniUI')
const { CardCategoria } = await import('../components/CreaWorkoutUI')
const RpeModal = (await import('../components/RpeModal')).default

beforeEach(() => { Object.values(A).forEach(f => f.mockClear()) })

describe('gli esiti si sentono dall alert', () => {
  it('un errore vibra da errore, e UNA volta sola anche se la pagina si ridisegna', () => {
    const info = { title: 'Errore', message: 'no', type: 'error' }
    const { rerender } = render(<CustomAlert info={info} onClose={() => {}} />)
    rerender(<CustomAlert info={info} onClose={() => {}} />)
    expect(A.vibraErrore).toHaveBeenCalledTimes(1)
    expect(A.vibraSuccesso).not.toHaveBeenCalled()
  })

  it('un successo vibra da successo', () => {
    render(<CustomAlert info={{ title: 'Fatto', message: 'ok', type: 'success' }} onClose={() => {}} />)
    expect(A.vibraSuccesso).toHaveBeenCalledTimes(1)
    expect(A.vibraErrore).not.toHaveBeenCalled()
  })

  it('senza alert non vibra niente', () => {
    render(<CustomAlert info={null} onClose={() => {}} />)
    expect(A.vibraSuccesso).not.toHaveBeenCalled()
    expect(A.vibraErrore).not.toHaveBeenCalled()
  })
})

describe('il foglio: la soglia si sente prima di lasciare', () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }) })
  afterEach(() => { vi.useRealTimers() })

  it('un colpetto per ogni attraversamento, in giù e in su — e nessuno sotto soglia', () => {
    render(<MenuScheda onChiudi={() => {}} voci={[{ etichetta: 'Duplica', icona: Copy, onClick: () => {} }]} />)
    const maniglia = screen.getByRole('button', { name: /Chiudi il menu/i })
    fireEvent.touchStart(maniglia, { touches: [{ clientY: 0 }] })
    fireEvent.touchMove(maniglia, { touches: [{ clientY: SOGLIA_CHIUSURA - 20 }] })
    expect(A.battito).not.toHaveBeenCalled()
    fireEvent.touchMove(maniglia, { touches: [{ clientY: SOGLIA_CHIUSURA + 20 }] })
    fireEvent.touchMove(maniglia, { touches: [{ clientY: SOGLIA_CHIUSURA + 60 }] })
    expect(A.battito).toHaveBeenCalledTimes(1)
    fireEvent.touchMove(maniglia, { touches: [{ clientY: SOGLIA_CHIUSURA - 20 }] })
    expect(A.battito).toHaveBeenCalledTimes(2)
  })
})

describe('le scelte fra pari', () => {
  it('l interruttore vibra a ogni cambio', async () => {
    const utente = userEvent.setup()
    const onCambia = vi.fn()
    render(<Interruttore attivo={false} onCambia={onCambia} etichetta="Notifiche push" />)
    await utente.click(screen.getByRole('switch'))
    expect(A.vibraScelta).toHaveBeenCalledTimes(1)
    expect(onCambia).toHaveBeenCalledTimes(1)
  })

  it('🔴 ritoccare la scelta GIÀ attiva non vibra: non è cambiato niente', async () => {
    const utente = userEvent.setup()
    const onClick = vi.fn()
    const { rerender } = render(<CardCategoria attiva nome="Hyrox" icona={Dumbbell} colore="#f1ba17" descrizione="" onClick={onClick} />)
    await utente.click(screen.getByRole('button'))
    expect(A.vibraScelta).not.toHaveBeenCalled()
    expect(onClick).toHaveBeenCalledTimes(1)
    rerender(<CardCategoria attiva={false} nome="Hyrox" icona={Dumbbell} colore="#f1ba17" descrizione="" onClick={onClick} />)
    await utente.click(screen.getByRole('button'))
    expect(A.vibraScelta).toHaveBeenCalledTimes(1)
  })
})

describe('lo slider dell RPE', () => {
  it('un gradino per ogni valore attraversato, nessuno se il valore non cambia', () => {
    let score = '5'
    const { container, rerender } = render(
      <RpeModal score={score} onScoreChange={(v) => { score = v }} notes="" onNotesChange={() => {}}
        onSave={() => {}} onCancel={() => {}} saving={false} />)
    const pista = container.querySelector('.touch-none')
    pista.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 10 })

    fireEvent.mouseDown(pista, { clientX: 45 })          // 5 → 5: fermo
    expect(A.battito).not.toHaveBeenCalled()

    fireEvent.mouseMove(pista, { clientX: 75 })          // 5 → 8
    expect(A.battito).toHaveBeenCalledTimes(1)
    rerender(<RpeModal score={score} onScoreChange={(v) => { score = v }} notes="" onNotesChange={() => {}}
      onSave={() => {}} onCancel={() => {}} saving={false} />)
    act(() => { fireEvent.mouseMove(pista, { clientX: 78 }) })  // resta 8
    expect(A.battito).toHaveBeenCalledTimes(1)
  })
})
