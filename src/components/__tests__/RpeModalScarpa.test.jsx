import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RpeModal from '../RpeModal'

// Perché questi test esistono
// ────────────────────────────
// «Scarpe da corsa» (spec §2): il foglio «Com'è andata?» porta la riga
// «Scarpa: <modello> ›» solo quando la pagina gliela passa. Senza la prop deve
// restare com'era: è il foglio che raccoglie l'RPE di tutte le categorie, e
// una riga «Scarpa» su un Hyrox o su chi non ha scarpe sarebbe rumore.

const base = {
  score: '5', onScoreChange: () => {}, notes: '', onNotesChange: () => {},
  onSave: () => {}, onCancel: () => {}, saving: false,
}

const attive = [
  { id: 's1', marca: 'Nike', modello: 'Pegasus 41' },
  { id: 's2', marca: 'Hoka', modello: 'Clifton 10' },
]

describe('RpeModal e la scarpa', () => {
  it('senza `scarpa` non dice niente di scarpe', () => {
    render(<RpeModal {...base} />)
    expect(screen.queryByText(/scarpa/i)).toBeNull()
    expect(screen.getByRole('button', { name: /Fatto/ })).toBeTruthy()
  })

  it('con `scarpa` mostra la scelta; toccandola si sceglie fra le attive', async () => {
    const onCambia = vi.fn()
    render(<RpeModal {...base} scarpa={{ attive, sceltaId: 's1', onCambia }} />)
    const riga = await screen.findByRole('button', { name: /Scarpa: Pegasus 41/ })
    expect(screen.queryByRole('option', { name: /Clifton 10/ })).toBeNull()
    await userEvent.click(riga)
    expect(screen.getByRole('option', { name: /Nessuna/ })).toBeTruthy()
    await userEvent.click(screen.getByRole('option', { name: /Clifton 10/ }))
    expect(onCambia).toHaveBeenCalledWith('s2')
  })

  it('senza scelta dice «Nessuna», e «Nessuna» si può scegliere', async () => {
    const onCambia = vi.fn()
    render(<RpeModal {...base} scarpa={{ attive, sceltaId: null, onCambia }} />)
    await userEvent.click(await screen.findByRole('button', { name: /Scarpa: Nessuna/ }))
    await userEvent.click(screen.getByRole('option', { name: /Pegasus 41/ }))
    expect(onCambia).toHaveBeenCalledWith('s1')
  })
})
