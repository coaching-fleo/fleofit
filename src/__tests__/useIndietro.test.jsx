import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { useIndietro } from '../useIndietro'

// Perché questi test esistono
// ────────────────────────────
// Il tasto «indietro» dell'app aveva DUE forme sbagliate, e ognuna delle due
// falliva nel caso che l'altra copre — per questo qui i test sono due e non uno:
//
//   • una DESTINAZIONE FISSA (`navigate('/athletes')`) ignora da dove si viene.
//     Passa il primo test e cade sul secondo.
//   • `navigate(-1)` NUDO non fa niente quando dietro non c'è nessuna pagina
//     dell'app: notifica push, deep link `fleofit://`, ricarica della webview.
//     Passa il secondo test e cade sul primo.
//
// Verificati per mutazione: sostituendo il corpo dell'hook con l'una o con
// l'altra, ogni volta cade esattamente un test.

function Partenza() {
  const navigate = useNavigate()
  return (
    <div>
      <p>Pagina di partenza</p>
      <button onClick={() => navigate('/dettaglio')}>Apri il dettaglio</button>
    </div>
  )
}

function Dettaglio() {
  const indietro = useIndietro('/ripiego')
  return (
    <div>
      <p>Pagina di dettaglio</p>
      <button onClick={indietro}>Torna indietro</button>
    </div>
  )
}

function Ripiego() {
  const indietro = useIndietro('/ripiego')
  return (
    <div>
      <p>Pagina di ripiego</p>
      <button onClick={indietro}>Torna indietro</button>
    </div>
  )
}

function monta(partenza) {
  return render(
    <MemoryRouter initialEntries={[partenza]}>
      <Routes>
        <Route path="/partenza" element={<Partenza />} />
        <Route path="/dettaglio" element={<Dettaglio />} />
        <Route path="/ripiego" element={<Ripiego />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('useIndietro', () => {
  // 🔴 Il caso della notifica push: la scheda È la prima pagina della sessione.
  // Con `navigate(-1)` nudo il tocco non produce NIENTE, e un tasto che non
  // fa niente si legge come un tasto rotto — nell'unico momento in cui è
  // indispensabile, perché non c'è nessun altro modo di uscire da lì.
  it('senza una pagina dietro va al ripiego dichiarato', async () => {
    const utente = userEvent.setup()
    monta('/dettaglio')

    await utente.click(screen.getByRole('button', { name: /Torna indietro/i }))
    expect(screen.getByText('Pagina di ripiego')).toBeInTheDocument()
  })

  // 🔴 L'altra metà, ed è quella che l'app sbagliava tutti i giorni: si apre un
  // atleta dai feedback della Home coach e il tasto indietro portava nella
  // rubrica, cioè in una schermata in cui non si era mai stati.
  it('con una pagina dietro torna a QUELLA, non al ripiego', async () => {
    const utente = userEvent.setup()
    monta('/partenza')

    await utente.click(screen.getByRole('button', { name: /Apri il dettaglio/i }))
    expect(screen.getByText('Pagina di dettaglio')).toBeInTheDocument()

    await utente.click(screen.getByRole('button', { name: /Torna indietro/i }))
    expect(screen.getByText('Pagina di partenza')).toBeInTheDocument()
    expect(screen.queryByText('Pagina di ripiego')).not.toBeInTheDocument()
  })

  // ⚠️ Il ripiego è un `replace`, e senza di esso il difetto è sottile: la
  // pagina in cui non si è entrati resterebbe nella pila, quindi un secondo
  // «indietro» ci riporterebbe DENTRO invece che fuori — un tasto indietro che
  // va avanti. Sulla mutazione (`replace` tolto) questo è l'unico test a cadere.
  it('il ripiego non lascia dietro di sé la pagina da cui si è usciti', async () => {
    const utente = userEvent.setup()
    monta('/dettaglio')

    await utente.click(screen.getByRole('button', { name: /Torna indietro/i }))
    expect(screen.getByText('Pagina di ripiego')).toBeInTheDocument()

    await utente.click(screen.getByRole('button', { name: /Torna indietro/i }))
    expect(screen.queryByText('Pagina di dettaglio')).not.toBeInTheDocument()
  })
})
