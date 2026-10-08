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

describe('lo schermo intero', () => {
  // Dal 08/10/2026 non è più un foglio dal basso (decisione del committente):
  // niente maniglia da trascinare, niente velo che chiude al tocco.
  it('è una modale a schermo intero, senza maniglia', () => {
    monta()
    expect(screen.getByRole('dialog', { name: 'Segnala un problema' })).toHaveAttribute('aria-modal', 'true')
    expect(screen.queryByRole('button', { name: /Trascina/ })).not.toBeInTheDocument()
  })

  it('al passo 1 c\'è «Annulla», e non «Indietro»', () => {
    monta()
    expect(screen.getByRole('button', { name: 'Annulla' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Indietro' })).not.toBeInTheDocument()
  })

  it('🔴 «Indietro» ha la parola nel TESTO, non solo nell\'aria-label', async () => {
    // indietroAndroid cerca le parole nel textContent: un bottone di sola
    // icona non lo troverebbe, e il tasto indietro aprirebbe «Annulla».
    const utente = userEvent.setup()
    monta()
    await utente.click(screen.getByRole('button', { name: /Notifiche/ }))
    expect(screen.getByRole('button', { name: 'Indietro' }).textContent.trim()).toBe('Indietro')
  })
})

describe('annullare', () => {
  it('«Annulla» chiede conferma, e «No» lascia tutto com\'era', async () => {
    const utente = userEvent.setup()
    const { onChiudi } = monta()
    await utente.click(screen.getByRole('button', { name: /Timer e allenamento/ }))
    await utente.type(screen.getByRole('textbox', { name: /Descrivi/ }), TESTO)
    await utente.click(screen.getByRole('button', { name: 'Annulla' }))
    expect(screen.getByRole('dialog', { name: 'Vuoi annullare la segnalazione?' })).toBeInTheDocument()
    await utente.click(screen.getByRole('button', { name: 'No' }))
    expect(screen.queryByRole('dialog', { name: 'Vuoi annullare la segnalazione?' })).not.toBeInTheDocument()
    expect(onChiudi).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: /Descrivi/ })).toHaveValue(TESTO)
  })

  it('confermando chiude e butta la bozza', async () => {
    const utente = userEvent.setup()
    const { onChiudi } = monta()
    await utente.click(screen.getByRole('button', { name: /Timer e allenamento/ }))
    await utente.type(screen.getByRole('textbox', { name: /Descrivi/ }), TESTO)
    await utente.click(screen.getByRole('button', { name: 'Annulla' }))
    await utente.click(screen.getByRole('button', { name: 'Sì, annulla' }))
    expect(onChiudi).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem(CHIAVE_BOZZA)).toBeNull()
  })

  it('c\'è anche al riepilogo', async () => {
    const utente = userEvent.setup()
    monta()
    await finoAlRiepilogo(utente)
    expect(screen.getByRole('button', { name: 'Annulla' })).toBeInTheDocument()
  })

  it('dopo l\'invio non c\'è più niente da annullare: «Chiudi» chiude senza chiedere', async () => {
    const utente = userEvent.setup()
    const { onChiudi } = monta()
    await finoAlRiepilogo(utente)
    await utente.click(screen.getByRole('button', { name: 'Invia' }))
    await screen.findByText('Grazie per il feedback')
    expect(screen.queryByRole('button', { name: 'Annulla' })).not.toBeInTheDocument()
    await utente.click(screen.getByRole('button', { name: 'Chiudi' }))
    expect(onChiudi).toHaveBeenCalledTimes(1)
  })
})

describe('la navigazione fra i passi', () => {

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
  it('il riepilogo NON mostra i dati tecnici (partono lo stesso: vedi «spedisce il corpo composto»)', async () => {
    // Decisione del committente (08/10/2026): a chi scrive non servono.
    const utente = userEvent.setup()
    monta()
    await finoAlRiepilogo(utente)
    expect(screen.getByText(TESTO)).toBeInTheDocument()
    expect(screen.queryByText(/Dati tecnici/)).not.toBeInTheDocument()
    expect(screen.queryByText('Atleta')).not.toBeInTheDocument()
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
    expect(await screen.findByText('Grazie per il feedback')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chiudi' })).toBeInTheDocument()
    await waitFor(() => expect(window.localStorage.getItem(CHIAVE_BOZZA)).toBeNull())
  })
})

describe('il testo', () => {
  it('non nomina mai una persona, e non promette una risposta', async () => {
    // Decisione del committente (08/10/2026): il foglio ringrazia e basta.
    // Nessun nome del coach, e nessun «ti rispondiamo»: non succederà.
    const utente = userEvent.setup()
    monta()
    expect(document.body.textContent).not.toMatch(/Federico/)
    await finoAlRiepilogo(utente)
    await utente.click(screen.getByRole('button', { name: 'Invia' }))
    await screen.findByText('Grazie per il feedback')
    expect(document.body.textContent).not.toMatch(/Federico|rispond/i)
  })
})

describe('il movimento fra i passi', () => {
  // Il passo che arriva entra da destra andando avanti e da sinistra tornando
  // indietro: le stesse due classi del builder (src/index.css), che con
  // «riduci movimento» si spengono da sole.
  const contenuto = () => screen.getByRole('dialog').querySelector('[data-passo]')

  it('andando avanti il passo entra da destra', async () => {
    const utente = userEvent.setup()
    monta()
    await utente.click(screen.getByRole('button', { name: /Notifiche/ }))
    expect(contenuto()).toHaveAttribute('data-passo', '2')
    expect(contenuto()).toHaveClass('passo-entra')
  })

  it('tornando indietro entra da sinistra', async () => {
    const utente = userEvent.setup()
    monta()
    await utente.click(screen.getByRole('button', { name: /Notifiche/ }))
    await utente.click(screen.getByRole('button', { name: 'Indietro' }))
    expect(contenuto()).toHaveAttribute('data-passo', '1')
    expect(contenuto()).toHaveClass('ritorno-entra')
  })

  it("all'apertura il primo passo non scivola: entra già il foglio", () => {
    monta()
    expect(contenuto()).not.toHaveClass('passo-entra')
    expect(contenuto()).not.toHaveClass('ritorno-entra')
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
