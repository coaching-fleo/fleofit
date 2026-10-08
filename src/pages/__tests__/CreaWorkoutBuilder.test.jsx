import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { CARTA_MODALE } from '../../lib/stiliCard'

// Perché questi test esistono
// ────────────────────────────
// Il redesign del builder (27/08/2026) cambia tre cose che possono rompersi in
// silenzio, cioè senza un errore a schermo:
//
//   1. il riepilogo in cima allo step 2, che è l'unica cosa che il builder
//      AFFERMA da sé — se smette di seguire i blocchi, dice un numero falso;
//   2. il passaggio fra i due passi, ora che nome e data vivono SOLO nel primo:
//      se il ritorno si perde, un workout in modifica non è più rinominabile;
//   3. il righello (prima gli Stepper) al posto delle rotelle, che deve scrivere lo stesso
//      identico vocabolario di prima ("20", "9 kg") dentro
//      workouts.sections.blocks[].exercises — il database è condiviso con la
//      web app in produzione (CLAUDE.md §1.1), e un formato nuovo lì dentro non
//      darebbe alcun errore: darebbe una scheda che l'altra app legge storta.

const workoutStorici = [{
  date: '2026-08-20',
  sections: { blocks: [{ type: 'AMRAP', exercises: [{ name: 'Wall Balls', reps: '15', kg: '6', intensity: '7' }] }] },
}]

vi.mock('../../supabaseClient', () => {
  const catena = {
    select: () => catena,
    eq: () => catena,
    order: () => catena,
    limit: () => Promise.resolve({ data: workoutStorici, error: null }),
    single: () => Promise.resolve({ data: null, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
  }
  return {
    supabase: {
      from: () => catena,
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) },
      functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    },
  }
})

const CreateWorkout = (await import('../CreateWorkout')).default

const monta = () => render(<MemoryRouter><CreateWorkout /></MemoryRouter>)

async function alPasso2(nome = 'Prova') {
  monta()
  await userEvent.type(screen.getByLabelText('Nome del workout'), nome)
  await userEvent.click(screen.getByRole('button', { name: /Costruisci l'allenamento/ }))
}

async function aggiungiBlocco(tipo) {
  await userEvent.click(screen.getByRole('button', { name: /Aggiungi blocco/i }))
  await userEvent.click(screen.getByText(tipo))
}

/** Il valore di una cella del riepilogo, letto dalla sua etichetta.
 *  ⚠️ Scoped al riepilogo: «Durata» è anche l'etichetta di una misura. */
/**
 * ⚠️ Aspetta due frame. Lo scorrimento passa da `requestAnimationFrame`, che
 * NON è un timer: senza questa attesa, un `expect(scorso).not.toHaveBeenCalled()`
 * gira prima che il frame scatti e passa qualunque cosa faccia il codice.
 * Verificato per mutazione il 27/08/2026 — il test negativo era vuoto.
 */
const dueFrame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

const cella = (etichetta) => {
  const riepilogo = document.querySelector('[data-riepilogo]')
  return within(riepilogo).getByText(etichetta).parentElement.textContent.replace(etichetta, '')
}

/** Il numero grande del foglio misure, per la misura aperta. */
const valore = (etichetta) => document.querySelector(`[data-valore-di="${etichetta}"]`).textContent

// ⚠️ La spia va su HTMLElement.prototype, non su Element.prototype: jsdom non
// implementa scrollIntoView e `src/test/setup.js` lo rimpiazza **lì**, quindi
// una spia su Element resta più in basso nella catena e non viene mai chiamata.
// Verificato: il test passava senza accorgersi di niente.
const scorso = vi.fn()
beforeEach(() => {
  localStorage.clear()
  scorso.mockClear()
  window.HTMLElement.prototype.scrollIntoView = scorso
})

describe('lo step 1 fa una domanda sola', () => {
  it('il nome è facoltativo anche per Hyrox: si prosegue senza', async () => {
    monta()
    expect(screen.getByRole('button', { name: /Costruisci l'allenamento/ })).toBeEnabled()
    expect(screen.queryByText(/Serve un nome/)).not.toBeInTheDocument()
  })

  it('senza nome la testata mostra un nome dai blocchi, e il codice li segue', async () => {
    monta()
    // Senza blocchi non c'è ancora niente da cui ricavare un nome.
    expect(screen.getByLabelText('Nome del workout')).toHaveAttribute('placeholder', 'Facoltativo · lo scelgo dai blocchi')
    await userEvent.click(screen.getByRole('button', { name: /Costruisci l'allenamento/ }))
    const testata = () => screen.getByRole('button', { name: 'Modifica nome e data' })

    await aggiungiBlocco('EMOM')                 // 1:00 × 10 round, vuoto
    expect(testata()).toHaveTextContent(/EMOM/)
    expect(document.querySelector('[data-codice]')).toHaveTextContent('EM 10′')

    await aggiungiBlocco('AMRAP')                // + 10:00
    expect(document.querySelector('[data-codice]')).toHaveTextContent('EM+AM 20′')
  })

  it('un nome scritto resta, e il codice lo segue comunque', async () => {
    await alPasso2('Gambe dure')
    await aggiungiBlocco('AMRAP')
    expect(screen.getByRole('button', { name: 'Modifica nome e data' })).toHaveTextContent('Gambe dure')
    expect(document.querySelector('[data-codice]')).toHaveTextContent('AM 10′')
  })

  it('«Custom» non ha bisogno di un nome: se ne genera uno dalla data', async () => {
    // CLAUDE.md §5: il titolo è facoltativo SOLO nel flusso Custom, e
    // workoutTitle.js ne genera uno. Il bottone deve saperlo.
    monta()
    await userEvent.click(screen.getByRole('button', { name: /Custom/ }))
    expect(screen.getByRole('button', { name: /Costruisci l'allenamento/ })).toBeEnabled()
  })

  it('la categoria scelta è dichiarata, non solo colorata', async () => {
    monta()
    expect(screen.getByRole('button', { name: /Hyrox/ })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: /Corsa/ }))
    expect(screen.getByRole('button', { name: /Corsa/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Hyrox/ })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('nome e data restano raggiungibili dal passo 2', () => {
  // ⚠️ Non è un dettaglio: al passo 2 il campo non esiste più. Senza questo
  // ritorno, un workout aperto in modifica non sarebbe più rinominabile.
  it('la testata riporta al passo 1', async () => {
    await alPasso2('Hyrox Strength #1')
    expect(screen.queryByLabelText('Nome del workout')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Modifica nome e data' }))
    expect(screen.getByLabelText('Nome del workout')).toHaveValue('Hyrox Strength #1')
  })
})

describe('il tasto indietro della testata', () => {
  // ⚠️ Una freccia, non una X: al passo 2 torna al passo 1, e una X si legge
  // come «butto via tutto». Dalla tab bar il builder è una destinazione come
  // Calendario e Atleti, quindi al passo 1 non ha un indietro.
  const montaDaBarra = () => render(
    <MemoryRouter initialEntries={[{ pathname: '/create', state: { daBarra: true } }]}>
      <CreateWorkout />
    </MemoryRouter>)

  it('aperto da un altro gesto, al passo 1 c\'è', () => {
    monta()
    expect(screen.getByRole('button', { name: 'Torna indietro' })).toBeInTheDocument()
  })

  it('aperto dalla tab bar, al passo 1 non c\'è', () => {
    montaDaBarra()
    expect(screen.getByRole('button', { name: /Costruisci l'allenamento/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Torna indietro' })).not.toBeInTheDocument()
  })

  it('al passo 2 c\'è sempre, e riporta al passo 1', async () => {
    montaDaBarra()
    await userEvent.click(screen.getByRole('button', { name: /Costruisci l'allenamento/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Torna al passo 1' }))
    expect(screen.getByLabelText('Nome del workout')).toBeInTheDocument()
  })

  it('con dei blocchi chiede conferma, e Annulla resta al passo 2', async () => {
    await alPasso2()
    await aggiungiBlocco('AMRAP')
    await userEvent.click(screen.getByRole('button', { name: 'Torna al passo 1' }))
    const dialogo = screen.getByRole('dialog', { name: 'Sei sicuro?' })
    expect(screen.queryByLabelText('Nome del workout')).not.toBeInTheDocument()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Annulla' }))
    expect(screen.queryByRole('dialog', { name: 'Sei sicuro?' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Nome del workout')).not.toBeInTheDocument()
  })

  it('confermando torna al passo 1, e i blocchi restano', async () => {
    await alPasso2()
    await aggiungiBlocco('AMRAP')
    await userEvent.click(screen.getByRole('button', { name: 'Torna al passo 1' }))
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Sei sicuro?' })).getByRole('button', { name: 'Conferma' }))
    expect(screen.getByLabelText('Nome del workout')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Costruisci l'allenamento/ }))
    expect(cella('Blocchi')).toBe('1')
  })
})

describe('il riepilogo segue i blocchi', () => {
  it('un builder vuoto non inventa numeri', async () => {
    await alPasso2()
    expect(cella('Durata')).toBe('0min')
    expect(cella('Blocchi')).toBe('0')
    expect(cella('RPE atteso')).toBe('—')
  })

  it('ogni blocco aggiunto sposta durata e conteggio', async () => {
    await alPasso2()
    await aggiungiBlocco('WarmUp')          // default 3:00
    expect(cella('Durata')).toBe('3min')
    expect(cella('Blocchi')).toBe('1')

    await aggiungiBlocco('AMRAP')           // default 10:00
    expect(cella('Durata')).toBe('13min')
    expect(cella('Blocchi')).toBe('2')
  })

  it('la durata del blocco è in testa alla sua riga', async () => {
    await alPasso2()
    await aggiungiBlocco('EMOM')            // 1:00 × 10 round
    expect(screen.getByText('10:00')).toBeInTheDocument()
  })
})

describe('il righello scrive il vocabolario di prima', () => {
  // Il righello (07/10/2026) ha sostituito lo Stepper: cambia il GESTO, non le
  // stringhe che finiscono in workouts.sections. Questi test montano il builder
  // vero e leggono la riga dell'esercizio, che è costruita da quelle stringhe.
  const apri = async (nome) => {
    await alPasso2()
    await aggiungiBlocco('AMRAP')
    await userEvent.click(screen.getByRole('button', { name: /Esercizio/ }))
    await userEvent.type(screen.getByPlaceholderText(/Cerca o scrivi/), nome)
    await userEvent.click(await screen.findByRole('button', { name: `Scegli ${nome}` }))
  }
  const sposta = async (misura, tasti) => {
    screen.getByRole('slider', { name: misura }).focus()
    await userEvent.keyboard(tasti)
  }

  it('le scorciatoie sono i valori dello storico di QUELL esercizio', async () => {
    // Lo storico ha una Wall Ball da 15 reps e 6 kg: sono le sue scorciatoie.
    // ⚠️ Prima i valori rapidi erano uguali per tutti, e proponevano i pesi
    // della Wall Ball anche sullo Squat.
    await apri('Wall Balls')
    await userEvent.click(await screen.findByRole('button', { name: '15' }))
    await userEvent.click(screen.getByRole('button', { name: /^Peso:/ }))
    await userEvent.click(screen.getByRole('button', { name: '6 kg' }))
    await userEvent.click(screen.getByRole('button', { name: /Aggiungi esercizio/ }))

    expect(screen.getByText('15 reps 6kg')).toBeInTheDocument()
  })

  it('senza storico, sul peso non si propone niente', async () => {
    await apri('Back Squat')
    await userEvent.click(screen.getByRole('button', { name: /^Peso:/ }))
    expect(screen.queryByRole('button', { name: /^\d+(,\d)? kg$/ })).not.toBeInTheDocument()
  })

  it('una tacca alla volta: le ripetizioni vanno di uno, i chili di 2,5 sopra i 20', async () => {
    await apri('Back Squat')
    // Senza valore il righello sta sulla partenza (10): un passo a destra è 11.
    await sposta('Ripetizioni', '{ArrowRight}')
    expect(valore('Ripetizioni')).toBe('11')

    await userEvent.click(screen.getByRole('button', { name: /^Peso:/ }))
    await userEvent.click(screen.getByRole('button', { name: /^Scrivi Peso/ }))
    await userEvent.type(screen.getByLabelText('Scrivi Peso'), '20{Enter}')
    await sposta('Peso', '{ArrowRight}')
    expect(valore('Peso')).toBe('22,5')

    await userEvent.click(screen.getByRole('button', { name: /Aggiungi esercizio/ }))
    // "22.5" con il punto: è la forma che `numero()` dei report e la web app leggono.
    expect(screen.getByText('11 reps 22.5kg')).toBeInTheDocument()
  })

  it('un valore che non si capisce non passa, e lo dice', async () => {
    await apri('Back Squat')
    await userEvent.click(screen.getByRole('button', { name: /^Scrivi Ripetizioni/ }))
    await userEvent.type(screen.getByLabelText('Scrivi Ripetizioni'), '12,5{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('Scrivi solo il numero')
    // Il campo resta aperto, e il valore di prima non è cambiato.
    expect(screen.getByRole('button', { name: /^Ripetizioni:/ })).toHaveAccessibleName('Ripetizioni: —')
  })

  it('aprire un esercizio non scrive niente da solo', async () => {
    // Il righello si posa sulla partenza, ma il valore resta vuoto finché il
    // coach non lo muove: un «10 reps» comparso da solo sarebbe un dato inventato.
    await apri('Back Squat')
    expect(screen.getByRole('button', { name: /^Ripetizioni:/ })).toHaveAccessibleName('Ripetizioni: —')
    expect(screen.getByRole('slider', { name: 'Ripetizioni' })).toHaveAttribute('aria-valuetext', 'Non ancora scelto')
  })

  it('«Due pesi» scrive il 2x di sempre', async () => {
    await apri('Back Squat')
    await userEvent.click(screen.getByRole('button', { name: /^Peso:/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Due pesi' }))
    await userEvent.click(screen.getByRole('button', { name: /Aggiungi esercizio/ }))
    expect(screen.getByText('2x16kg')).toBeInTheDocument()
  })
})

describe('«ultima volta»', () => {
  it('ripropone i valori dell ultima assegnazione dello stesso esercizio', async () => {
    await alPasso2()
    await aggiungiBlocco('AMRAP')
    await userEvent.click(screen.getByRole('button', { name: /Esercizio/ }))
    await userEvent.type(screen.getByPlaceholderText(/Cerca o scrivi/), 'Wall Balls')
    await userEvent.click(await screen.findByRole('button', { name: 'Scegli Wall Balls' }))

    expect(await screen.findByText(/Ultima volta/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Riusa' }))

    expect(valore('Ripetizioni')).toBe('15')
    expect(screen.getByRole('button', { name: /^Peso:/ })).toHaveAccessibleName('Peso: 6 kg')
  })
})

describe('la tastiera non deve comparire da sola', () => {
  // Aprire «Scegli esercizio» faceva salire la tastiera sulla ricerca, che
  // copre metà lista: il gesto normale è **guardare** i centotrenta esercizi,
  // non scriverne il nome. La tastiera resta a disposizione di chi tocca il campo.
  it('il campo di ricerca non prende il fuoco all apertura', async () => {
    await alPasso2()
    await aggiungiBlocco('AMRAP')
    await userEvent.click(screen.getByRole('button', { name: /Esercizio/ }))

    const ricerca = screen.getByPlaceholderText(/Cerca o scrivi/)
    expect(ricerca).not.toHaveFocus()
    // …e la lista si vede subito, che è il motivo per cui la tastiera è di
    // troppo: copre proprio quello che si è venuti a guardare.
    expect(screen.getAllByRole('button', { name: /^Scegli / }).length).toBeGreaterThan(10)
  })
})

describe('il blocco appena creato finisce sotto gli occhi', () => {
  // Aggiungere un blocco chiude quello aperto prima: la pagina si accorcia di
  // colpo e il blocco nuovo, che sta in fondo, esce dallo schermo. Il coach lo
  // crea e non lo vede.
  it('la pagina scorre fino al blocco nuovo', async () => {
    await alPasso2()
    await aggiungiBlocco('WarmUp')
    // ⚠️ Si aspetta il PRIMO scorrimento prima di azzerare la spia: lo scroll
    // passa da requestAnimationFrame, quindi senza questa attesa la chiamata
    // del WarmUp arriva dopo il mockClear e si legge come se fosse quella nuova.
    await vi.waitFor(() => expect(scorso).toHaveBeenCalled())
    scorso.mockClear()

    await aggiungiBlocco('EMOM')

    await vi.waitFor(() => expect(scorso).toHaveBeenCalled())
    const bersaglio = scorso.mock.instances[0]
    expect(bersaglio.querySelector('[data-tipo-blocco]').textContent).toBe('EMOM')
  })

  it('aprire un blocco che c era già lo riporta sotto gli occhi', async () => {
    // Segnalato dal committente il 15/09/2026. Aprire un blocco CHIUDE quello
    // aperto prima: se quello stava più in alto, la pagina si accorcia sopra la
    // testa e il blocco appena toccato scivola fuori schermo verso l'alto — a
    // schermo sembra che si sia aperto al contrario, non che la pagina si sia
    // mossa. ⚠️ Il caso che prende il difetto è APRIRE IL PRIMO mentre l'ultimo
    // è aperto: aprendo l'ultimo la pagina cresce solo sotto, e il titolo resta
    // dov'era anche senza correzione.
    await alPasso2()
    await aggiungiBlocco('WarmUp')
    // ⚠️ Si azzera la spia PRIMA di aggiungere l'EMOM: senza, il `waitFor`
    // successivo si accontenta della chiamata del WarmUp e il mockClear cade
    // poi sul frame dell'EMOM, che arriva dopo e si legge come se fosse il
    // tocco. È la stessa trappola annotata nel test qui sopra.
    await vi.waitFor(() => expect(scorso).toHaveBeenCalled())
    scorso.mockClear()
    await aggiungiBlocco('EMOM')          // l'EMOM resta aperto, il WarmUp si chiude
    await vi.waitFor(() => expect(scorso).toHaveBeenCalled())
    await dueFrame()
    scorso.mockClear()

    await userEvent.click(document.querySelectorAll('[data-tipo-blocco]')[0])

    await vi.waitFor(() => expect(scorso).toHaveBeenCalled())
    const bersaglio = scorso.mock.instances[0]
    expect(bersaglio.querySelector('[data-tipo-blocco]').textContent).toBe('WarmUp')
  })

  it('richiudere un blocco NON strappa la pagina', async () => {
    // Il contraltare del precedente: chiudendo, il blocco toccato è già in
    // cima a ciò che sparisce e resta dov'è. Uno scorrimento lì è la pagina
    // che si muove da sola sotto un dito che voleva solo fare spazio.
    await alPasso2()
    await aggiungiBlocco('EMOM')
    await vi.waitFor(() => expect(scorso).toHaveBeenCalled())
    scorso.mockClear()

    await userEvent.click(document.querySelectorAll('[data-tipo-blocco]')[0])

    await dueFrame()
    expect(scorso).not.toHaveBeenCalled()
  })

  it('non scorre quando si modifica un blocco che c era già', async () => {
    // Il contraltare: uno scorrimento a ogni tocco strapperebbe la pagina di
    // mano al coach mentre compila i parametri.
    await alPasso2()
    await aggiungiBlocco('EMOM')
    await vi.waitFor(() => expect(scorso).toHaveBeenCalled())
    scorso.mockClear()

    await userEvent.click(screen.getByRole('button', { name: 'Round: 10' }))
    screen.getByRole('slider', { name: 'Round' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    await dueFrame()
    expect(scorso).not.toHaveBeenCalled()
  })
})

describe('«Salva workout» sta in fondo, non davanti', () => {
  // Segnalato dal committente il 15/09/2026: la barra era `sticky`, quindi
  // occupava una riga di schermo per tutto il tempo in cui si compone il
  // workout — proprio mentre si ha bisogno di vedere i blocchi — e il suo
  // bordo superiore disegnava uno stacco netto sopra la capsula della tab bar.
  //
  // ⚠️ Si verifica l'ASSENZA di `sticky`, non la presenza di qualcos'altro: è
  // `sticky` a produrre il difetto, e una barra che guadagnasse per sbaglio un
  // secondo ancoraggio passerebbe qualunque asserzione sulle classi nuove.
  // (Stessa lezione del bordo di CARTA_RIGA, CLAUDE.md §9-octodecies.)
  const contenitoreDi = (nome) => screen.getByRole('button', { name: nome }).parentElement

  it('la barra dello step 2 non segue lo scroll', async () => {
    await alPasso2()
    const barra = contenitoreDi(/Salva workout/)
    expect(barra.className).not.toMatch(/sticky|fixed/)
    expect(barra.className).not.toMatch(/border-t/)
  })

  it('e nemmeno quella dello step 1', async () => {
    monta()
    await userEvent.type(screen.getByLabelText('Nome del workout'), 'Prova')
    expect(contenitoreDi(/Costruisci l'allenamento/).className).not.toMatch(/sticky|fixed/)
  })
})

describe('il passo: prima il modo, poi il valore', () => {
  // ⚠️ La lezione della ruota di prima resta: il passo ha DUE domande. Di che
  // tipo — ritmo, cadenza, a sensazione — e lì le voci sono poche e si vedono
  // tutte (pillole); poi quale valore, e lì è una scala fitta (il righello).
  // Mescolarle in una lista sola metteva «Z5» accanto a «1:30 /500m».
  const apriPasso = async (nome = 'Rowing') => {
    await alPasso2()
    await aggiungiBlocco('AMRAP')
    await userEvent.click(screen.getByRole('button', { name: /Esercizio/ }))
    await userEvent.type(screen.getByPlaceholderText(/Cerca o scrivi/), nome)
    await userEvent.click(await screen.findByRole('button', { name: `Scegli ${nome}` }))
    await userEvent.click(screen.getByRole('button', { name: /^Passo:/ }))
  }

  it('i tre modi dell ergometro sono tutti raggiungibili', async () => {
    await apriPasso()
    for (const m of ['Ritmo', 'Cadenza', 'Sensazione']) {
      expect(screen.getByRole('button', { name: m })).toBeInTheDocument()
    }
  })

  it('il ritmo è un righello con TUTTI i 61 valori, da 1:30 a 6:30', async () => {
    await apriPasso()
    const righello = screen.getByRole('slider', { name: 'Passo' })
    expect(righello).toHaveAttribute('aria-valuemax', '60')
  })

  it('cambiare modo cambia la scala, non la mescola', async () => {
    await apriPasso()
    await userEvent.click(screen.getByRole('button', { name: 'Sensazione' }))
    expect(screen.getByRole('button', { name: 'Z4' })).toBeInTheDocument()
    expect(screen.queryByRole('slider', { name: 'Passo' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Cadenza' }))
    expect(screen.queryByRole('button', { name: 'Z4' })).not.toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Passo' })).toHaveAttribute('aria-valuemax', '16')
  })

  it('scrive il valore INTERO, con la sua unità', async () => {
    // Il numero grande dice «2:00» perché accanto c'è «/500m». Quello che
    // finisce in workouts.sections deve però restare «2:00 /500m»: è la
    // stringa che la scheda, il PDF e la web app sanno leggere.
    await apriPasso()
    await userEvent.click(screen.getByRole('button', { name: /^Scrivi Passo/ }))
    await userEvent.type(screen.getByLabelText('Scrivi Passo'), '200{Enter}')
    await userEvent.click(screen.getByRole('button', { name: /^Distanza:/ }))
    await userEvent.click(screen.getByRole('button', { name: '500 m' }))
    await userEvent.click(screen.getByRole('button', { name: /Aggiungi esercizio/ }))

    expect(screen.getByText('500m @ 2:00 /500m')).toBeInTheDocument()
  })

  it('«Nessuno» toglie il passo', async () => {
    await apriPasso()
    await userEvent.click(screen.getByRole('button', { name: 'Sensazione' }))
    await userEvent.click(screen.getByRole('button', { name: 'Z3' }))
    expect(screen.getByRole('button', { name: /^Passo:/ })).toHaveAccessibleName('Passo: Z3')
    await userEvent.click(screen.getByRole('button', { name: 'Nessuno' }))
    expect(screen.getByRole('button', { name: /^Passo:/ })).toHaveAccessibleName('Passo: —')
  })
})

describe('i numeri del blocco stanno in un foglio dal basso', () => {
  // Erano due Stepper da 170px sempre aperti sopra gli esercizi. Ora la card
  // ha il loro riepilogo in pillole, e il righello sale solo quando serve.
  it('una tacca di «Ogni» sposta la durata del blocco', async () => {
    await alPasso2()
    await aggiungiBlocco('EMOM')                       // 1:00 × 10 = 10:00
    await userEvent.click(screen.getByRole('button', { name: 'Ogni: 1:00' }))
    const foglio = screen.getByRole('dialog', { name: 'EMOM' })

    within(foglio).getByRole('slider', { name: 'Ogni' }).focus()
    await userEvent.keyboard('{ArrowRight}')           // 1:15 × 10 = 12:30

    // La pillola nella card del blocco, non la scheda omonima nel foglio.
    const card = document.querySelector('[data-blocco-id]')
    expect(within(card).getByRole('button', { name: 'Ogni: 1:15' })).toBeInTheDocument()
    expect(within(foglio).getByText('Il blocco dura 12:30')).toBeInTheDocument()
    expect(cella('Durata')).toBe('13min')
  })

  it('il rest dei Cash In compare solo con più di un round', async () => {
    await alPasso2()
    await aggiungiBlocco('Cash In')
    expect(screen.queryByRole('button', { name: /^Rest:/ })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Round: 1' }))
    within(screen.getByRole('dialog', { name: 'Cash In' })).getByRole('slider', { name: 'Round' }).focus()
    await userEvent.keyboard('{ArrowRight}')

    expect(within(document.querySelector('[data-blocco-id]')).getByRole('button', { name: 'Rest: 1:00' })).toBeInTheDocument()
  })

  it('il foglio si chiude con la X, che il tasto indietro di Android sa trovare', async () => {
    await alPasso2()
    await aggiungiBlocco('AMRAP')
    await userEvent.click(screen.getByRole('button', { name: 'Durata: 10:00' }))
    const foglio = screen.getByRole('dialog', { name: 'AMRAP' })
    await userEvent.click(within(foglio).getByRole('button', { name: 'Chiudi' }))
    await vi.waitFor(() => expect(screen.queryByRole('dialog', { name: 'AMRAP' })).not.toBeInTheDocument())
  })
})

describe('il dito sul righello', () => {
  // 🔴 Trovati sull'emulatore Android il 07/10/2026, invisibili a ogni test di
  // prima: il righello nel foglio dei parametri NON SI MUOVEVA col dito.
  //   1. il blocco del «tira giù per ricaricare» annullava ogni touchmove in cui
  //      il dito scendeva di mezzo pixel, e con il foglio aperto la pagina è
  //      bloccata (scrollY = 0): ogni trascinamento orizzontale moriva lì;
  //   2. il tocco, nato in un portale, risaliva in React fino al blocco e dopo
  //      250ms fermi faceva partire il riordino del blocco.
  const tocco = (tipo, el, x, y) => {
    const e = new Event(tipo, { bubbles: true, cancelable: true })
    Object.defineProperty(e, 'touches', { value: [{ clientX: x, clientY: y }] })
    el.dispatchEvent(e)
    return e
  }
  const apriFoglio = async () => {
    await alPasso2()
    await aggiungiBlocco('EMOM')
    await userEvent.click(screen.getByRole('button', { name: 'Ogni: 1:00' }))
    return within(screen.getByRole('dialog', { name: 'EMOM' })).getByRole('slider', { name: 'Ogni' })
  }

  it('un trascinamento orizzontale che scende di poco NON viene annullato', async () => {
    const righello = await apriFoglio()
    tocco('touchstart', righello, 200, 500)
    expect(tocco('touchmove', righello, 120, 501).defaultPrevented).toBe(false)
  })

  it('un vero tirare giù in cima alla pagina sì, come prima', async () => {
    await alPasso2()
    await aggiungiBlocco('EMOM')   // con dei blocchi ci sono modifiche da non perdere
    const pagina = document.querySelector('[data-blocco-id]')
    tocco('touchstart', pagina, 200, 300)
    expect(tocco('touchmove', pagina, 205, 380).defaultPrevented).toBe(true)
  })

  it('tenere il dito fermo sul righello non afferra il blocco', async () => {
    const righello = await apriFoglio()
    fireEvent.touchStart(righello, { touches: [{ clientX: 200, clientY: 500 }] })
    await new Promise(r => setTimeout(r, 320))
    // Il riordino parte rendendo il blocco semitrasparente.
    expect(document.querySelector('[data-blocco-id]').style.opacity).not.toBe('0.3')
    fireEvent.touchEnd(righello)
  })
})

describe('le fasi di corsa', () => {
  const apriFase = async () => {
    monta()
    await userEvent.click(screen.getByRole('button', { name: /Corsa/ }))
    await userEvent.click(screen.getByRole('button', { name: /Costruisci l'allenamento/ }))
    await userEvent.click(screen.getByRole('button', { name: /Aggiungi la prima fase/ }))
  }

  it('un intervallo di passo si salva nel formato di prima', async () => {
    // `pace` composto da formatPace («5:00 - 5:10 /km») più paceMin e paceMax
    // separati: è quello che RunningStepRow, la scheda e la web app leggono.
    await apriFase()
    await userEvent.click(screen.getByRole('button', { name: /^Passo:/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Ritmo' }))
    await userEvent.click(screen.getByRole('button', { name: /Intervallo/ }))
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Nuova fase' })).getByRole('button', { name: 'Aggiungi fase' }))

    expect(screen.getByText('@5:00 - 5:10 /km')).toBeInTheDocument()
  })

  it('tempo o distanza è una pillola, e la distanza scrive metri e chilometri come prima', async () => {
    await apriFase()
    await userEvent.click(screen.getByRole('button', { name: 'Distanza' }))
    expect(screen.getByRole('button', { name: /^Distanza:/ })).toHaveAccessibleName('Distanza: 1 km')
    await userEvent.click(screen.getByRole('button', { name: '400 m' }))
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Nuova fase' })).getByRole('button', { name: 'Aggiungi fase' }))

    expect(screen.getByText('400m')).toBeInTheDocument()
  })

  it('le ripetute si aprono su «Volte»', async () => {
    await apriFase()
    await userEvent.click(screen.getByRole('button', { name: 'Ripetute' }))
    expect(screen.getByRole('slider', { name: 'Volte' })).toBeInTheDocument()
  })
})

describe('«Genera con IA» non scende con la lista', () => {
  it('sta sopra i blocchi, non dopo', async () => {
    // È il modo di PARTIRE da zero: sotto a cinque blocchi aperti non la trova
    // più nessuno, ed è proprio quando serve — a lista vuota — che sparirebbe
    // meno, ma cresce con essa.
    await alPasso2()
    await aggiungiBlocco('WarmUp')

    const ia = screen.getByRole('button', { name: /Genera con IA/ })
    const primoBlocco = document.querySelector('[data-blocco-id]')
    expect(ia.compareDocumentPosition(primoBlocco) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('Il numero che NON sale', () => {
  const vera = window.matchMedia
  afterEach(() => { window.matchMedia = vera })

  // 🔴 Nel builder i numeri del riepilogo cambiano a OGNI blocco aggiunto o
  // toccato: un conteggio da 1,3 secondi a ogni modifica vorrebbe dire un
  // numero sempre in movimento e mai leggibile, proprio mentre il coach lo sta
  // usando per dosare la seduta. `RiepilogoWorkout` ha `anima` falso di
  // default e la scheda è l'unica a chiederlo — questo test fissa la scelta.
  //
  // ⚠️ Il movimento va ACCESO a mano, o il test passa per il motivo sbagliato:
  // con `prefers-reduced-motion` di tutta la suite non anima niente comunque.
  it('il riepilogo del builder mostra subito il valore vero', async () => {
    window.matchMedia = (q) => ({
      matches: false, media: q, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    })
    await alPasso2()
    await aggiungiBlocco('WarmUp')   // 3:00 di default
    // Se il builder animasse, «Durata» partirebbe da 0 e «Blocchi» da 0.
    expect(cella('Durata')).toBe('3min')
    expect(cella('Blocchi')).toBe('1')
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('La CTA che si contrae', () => {
  // 🔴 A riposo il bottone NON deve contrarsi, e soprattutto non deve avere
  // `aria-busy`: un lettore di schermo direbbe «occupato» su un bottone pronto.
  it('a riposo «Salva workout» è largo e non è occupato', async () => {
    await alPasso2()
    await aggiungiBlocco('WarmUp')
    const salva = screen.getByRole('button', { name: /Salva workout/i })
    expect(salva.classList.contains('cta-contratta')).toBe(false)
    expect(salva).not.toHaveAttribute('aria-busy')
    expect(salva.querySelector('.puntini')).toBeNull()
  })

  // 🔴 E il valore di partenza di `max-width` deve essere una LUNGHEZZA.
  // Il default è `none`, e da `none` il CSS non sa interpolare: il bottone
  // salterebbe alla pillola invece di contrarsi. Il difetto non dà errori, non
  // si vede in jsdom, e l'ho trovato misurando il rettangolo nel browser a
  // 150ms dall'inizio — dove la larghezza era già quella finale.
  it('dichiara un `max-width` di partenza, o la transizione non avviene', async () => {
    await alPasso2()
    await aggiungiBlocco('WarmUp')
    const salva = screen.getByRole('button', { name: /Salva workout/i })
    expect([...salva.classList].some((c) => c.startsWith('max-w-'))).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('Il passo che entra', () => {
  // 🔴 Il keyframe dev'essere UNO CHE ESISTE. `animate-in slide-in-from-right`
  // viene da tw-animate-css, che in questo progetto NON è installato e genera
  // zero CSS: sarebbe la quarta volta che lo stesso difetto entra da una porta
  // diversa (CLAUDE.md §9-duodecies, §9-quindecies, §9-duodetricies).
  it('i due passi dichiarano `passo-entra`, non `animate-in`', async () => {
    monta()
    const passo1 = document.querySelector('.passo-entra')
    expect(passo1).not.toBeNull()
    // 🔴 E la PAGINA non si muove. `page-transition` sulla radice più
    // `passo-entra` sul passo è movimento doppio: la pagina sale di 15px mentre
    // il contenuto entra da destra. È lo stesso difetto tolto dalle altre nove
    // schermate il 21/09, ed era rimasto qui — in jsdom non si vede e nessun
    // altro test ci casca.
    expect(document.querySelector('.page-transition')).toBeNull()
    expect([...passo1.classList].some((c) => c.startsWith('animate-in'))).toBe(false)

    await userEvent.type(screen.getByLabelText('Nome del workout'), 'Prova')
    await userEvent.click(screen.getByRole('button', { name: /Costruisci l'allenamento/ }))

    // Anche il passo 2, e dev'essere un nodo NUOVO: se fosse lo stesso, il
    // keyframe non ripartirebbe e il cambio resterebbe netto.
    const passo2 = document.querySelector('.passo-entra')
    expect(passo2).not.toBeNull()
    expect(passo2).not.toBe(passo1)
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('La modale «Bozza Trovata»', () => {
  // Segnalata dal committente il 22/09/2026: «non è graficamente coerente con
  // il resto dell'app e compare secca». Era l'ultimo dialogo rimasto con il
  // vocabolario di PRIMA del rework, e il suo velo arrivava a nero pieno nello
  // stesso fotogramma in cui la carta cominciava a entrare — un nero che si
  // accende secco copre qualunque movimento ci sia dietro.
  const conBozza = () => localStorage.setItem('fleofit_workout_draft', JSON.stringify({
    sourceId: null, modo: 'nuovo', title: 'Hyrox Soglia', date: '2026-09-22', workoutIntensity: '7',
    category: 'Hyrox', blocks: [], runningSteps: [], coachNotes: '',
  }))

  it('la carta entra e il velo sfuma CON lei', async () => {
    conBozza()
    monta()
    const carta = await screen.findByRole('dialog', { name: 'Bozza Trovata' })
    // 🔴 Il keyframe dev'essere uno CHE ESISTE: `animate-in fade-in zoom-in`
    // viene da tw-animate-css, che qui NON è installato e genera zero CSS.
    expect(carta).toHaveClass('modal-transition')
    expect([...carta.classList].some((c) => c.startsWith('animate-in'))).toBe(false)
    // 🔴 E il velo è la metà che mancava: senza `velo-in` la carta si anima
    // dietro un nero già pieno, che è esattamente ciò che si vedeva.
    expect(carta.parentElement).toHaveClass('velo-in')
  })

  it('è fatta della carta sollevata condivisa, non di una copia', async () => {
    conBozza()
    monta()
    const carta = await screen.findByRole('dialog', { name: 'Bozza Trovata' })
    // Il confronto è con la COSTANTE, non con le classi riscritte a mano: è
    // l'unico modo perché questo dialogo non torni a divergere di un raggio
    // dalle card sopra cui si apre, e dagli altri cinque dialoghi che ora
    // nascono dalla stessa costante (§9-undequadragies).
    CARTA_MODALE.split(' ').forEach((classe) => expect(carta).toHaveClass(classe))
  })
})
