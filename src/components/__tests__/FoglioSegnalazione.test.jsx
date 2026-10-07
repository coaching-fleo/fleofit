import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FoglioSegnalazione from '../FoglioSegnalazione'
import { CHIAVE_BOZZA } from '../../lib/segnalazione'

// Perché questi test esistono
// ────────────────────────────
// Il foglio è l'unico modulo dell'app che si compila quando qualcosa è già
// andato storto, e tre suoi guasti non danno errore a schermo:
//  1. il testo che si perde se l'invio non riesce (chi l'ha scritto non lo
//     riscrive, e la segnalazione semplicemente non arriva);
//  2. due mail uguali per un doppio tocco su «Invia»;
//  3. il tasto indietro di Android che chiude tutto a metà flusso: lo trova
//     solo un bottone che si chiama ESATTAMENTE «Indietro» o «Chiudi»
//     (src/lib/indietroAndroid.js), quindi l'etichetta è parte del contratto.

const TECNICI = [{ etichetta: 'Rete', valore: 'online' }, { etichetta: 'Ruolo', valore: 'Atleta' }]
const TESTO = 'Il timer si ferma al terzo round'

const monta = (props = {}) => {
  const onInvia = props.onInvia || vi.fn(() => Promise.resolve())
  const onChiudi = vi.fn()
  const onAttivaNotifiche = vi.fn()
  render(<FoglioSegnalazione onChiudi={onChiudi} onInvia={onInvia} tecnici={TECNICI}
    notificheSpente={false} onAttivaNotifiche={onAttivaNotifiche} {...props} />)
  return { onInvia, onChiudi, onAttivaNotifiche }
}

/** Dal passo 1 al riepilogo, con il tipo scelto e la descrizione scritta. */
async function finoAlRiepilogo(utente, tipo = /Timer e allenamento/) {
  await utente.click(screen.getByRole('button', { name: tipo }))
  await utente.type(screen.getByRole('textbox', { name: /Descrivi/ }), TESTO)
  await utente.click(screen.getByRole('button', { name: 'Continua' }))
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('la navigazione fra i passi', () => {
  it('al passo 1 il bottone in testata si chiama «Chiudi»', () => {
    monta()
    expect(screen.getByRole('button', { name: 'Chiudi' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Indietro' })).not.toBeInTheDocument()
  })

  it('scegliendo un tipo compaiono le sue domande, e il bottone diventa «Indietro»', async () => {
    const utente = userEvent.setup()
    monta()
    await utente.click(screen.getByRole('button', { name: /Notifiche/ }))
    expect(screen.getByText('Cosa succede?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Indietro' })).toBeInTheDocument()
  })

  it('«Indietro» torna al passo precedente senza chiudere il foglio', async () => {
    const utente = userEvent.setup()
    const { onChiudi } = monta()
    await utente.click(screen.getByRole('button', { name: /Notifiche/ }))
    await utente.click(screen.getByRole('button', { name: 'Indietro' }))
    expect(screen.getByRole('button', { name: /Qualcosa non funziona/ })).toBeInTheDocument()
    expect(onChiudi).not.toHaveBeenCalled()
  })

  it('il velo, a metà flusso, torna indietro di un passo invece di chiudere', async () => {
    // indietroAndroid tocca PRIMA il velo: se il velo chiudesse sempre, il
    // tasto indietro di Android al passo 2 porterebbe via tutto il foglio.
    const utente = userEvent.setup()
    const { onChiudi } = monta()
    await utente.click(screen.getByRole('button', { name: /Notifiche/ }))
    await utente.click(screen.getByRole('dialog').parentElement)
    expect(screen.getByRole('button', { name: /Qualcosa non funziona/ })).toBeInTheDocument()
    expect(onChiudi).not.toHaveBeenCalled()
  })

  it('una risposta scelta è segnata con aria-checked', async () => {
    const utente = userEvent.setup()
    monta()
    await utente.click(screen.getByRole('button', { name: /Notifiche/ }))
    const pillola = screen.getByRole('radio', { name: 'Arrivano doppie' })
    await utente.click(pillola)
    expect(pillola).toHaveAttribute('aria-checked', 'true')
  })
})

describe('il passo dei dettagli', () => {
  it('«Continua» resta spento con una descrizione di soli spazi', async () => {
    const utente = userEvent.setup()
    monta()
    await utente.click(screen.getByRole('button', { name: /Timer e allenamento/ }))
    const campo = screen.getByRole('textbox', { name: /Descrivi/ })
    await utente.type(campo, '            ')
    expect(screen.getByRole('button', { name: 'Continua' })).toBeDisabled()
    await utente.type(campo, TESTO)
    expect(screen.getByRole('button', { name: 'Continua' })).toBeEnabled()
  })

  it('con le notifiche spente propone di attivarle, solo per il tipo Notifiche', async () => {
    const utente = userEvent.setup()
    const { onAttivaNotifiche } = monta({ notificheSpente: true })
    await utente.click(screen.getByRole('button', { name: /Notifiche/ }))
    await utente.click(screen.getByRole('button', { name: 'Attivale' }))
    expect(onAttivaNotifiche).toHaveBeenCalledTimes(1)

    await utente.click(screen.getByRole('button', { name: 'Indietro' }))
    await utente.click(screen.getByRole('button', { name: /Qualcosa non funziona/ }))
    expect(screen.queryByRole('button', { name: 'Attivale' })).not.toBeInTheDocument()
  })
})

describe('l\'invio', () => {
  it('il riepilogo mostra i dati tecnici che partono', async () => {
    const utente = userEvent.setup()
    monta()
    await finoAlRiepilogo(utente)
    expect(screen.getByText(TESTO)).toBeInTheDocument()
    expect(screen.getByText('Atleta')).toBeInTheDocument()
  })

  it('un doppio tocco su «Invia» spedisce una volta sola', async () => {
    const utente = userEvent.setup()
    const onInvia = vi.fn(() => new Promise(() => {}))
    monta({ onInvia })
    await finoAlRiepilogo(utente)
    const invia = screen.getByRole('button', { name: 'Invia' })
    await utente.dblClick(invia)
    expect(onInvia).toHaveBeenCalledTimes(1)
  })

  it('spedisce il corpo composto', async () => {
    const utente = userEvent.setup()
    const { onInvia } = monta()
    await utente.click(screen.getByRole('button', { name: /Timer e allenamento/ }))
    await utente.click(screen.getByRole('radio', { name: 'Si ferma' }))
    await utente.type(screen.getByRole('textbox', { name: /Descrivi/ }), TESTO)
    await utente.click(screen.getByRole('button', { name: 'Continua' }))
    await utente.click(screen.getByRole('button', { name: 'Invia' }))
    expect(onInvia).toHaveBeenCalledWith({
      tipo: 'timer',
      risposte: [{ domanda: 'Cosa succede?', risposta: 'Si ferma' }],
      descrizione: TESTO,
      tecnici: { Rete: 'online', Ruolo: 'Atleta' },
      immagini: [],
    })
  })

  it('se l\'invio fallisce dice perché, propone «Riprova» e tiene la bozza', async () => {
    const utente = userEvent.setup()
    monta({ onInvia: vi.fn(() => Promise.reject(new Error('Rete assente'))) })
    await finoAlRiepilogo(utente)
    await utente.click(screen.getByRole('button', { name: 'Invia' }))
    expect(await screen.findByText('Rete assente')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem(CHIAVE_BOZZA)).descrizione).toBe(TESTO)
  })

  it('dopo un invio riuscito ringrazia e cancella la bozza', async () => {
    const utente = userEvent.setup()
    monta()
    await finoAlRiepilogo(utente)
    await utente.click(screen.getByRole('button', { name: 'Invia' }))
    expect(await screen.findByText('Grazie, Federico la legge')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chiudi' })).toBeInTheDocument()
    await waitFor(() => expect(window.localStorage.getItem(CHIAVE_BOZZA)).toBeNull())
  })
})

describe('la bozza', () => {
  it('riapre al passo 2 con il testo, e il riepilogo non promette immagini che non ci sono', async () => {
    window.localStorage.setItem(CHIAVE_BOZZA, JSON.stringify({ tipo: 'timer', risposte: {}, descrizione: TESTO }))
    const utente = userEvent.setup()
    monta()
    expect(screen.getByRole('textbox', { name: /Descrivi/ })).toHaveValue(TESTO)
    await utente.click(screen.getByRole('button', { name: 'Continua' }))
    expect(screen.queryByText(/immagin/i)).not.toBeInTheDocument()
  })
})
