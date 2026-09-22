import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// Perché questi test esistono
// ────────────────────────────
// Il redesign del builder (27/08/2026) cambia tre cose che possono rompersi in
// silenzio, cioè senza un errore a schermo:
//
//   1. il riepilogo in cima allo step 2, che è l'unica cosa che il builder
//      AFFERMA da sé — se smette di seguire i blocchi, dice un numero falso;
//   2. il passaggio fra i due passi, ora che nome e data vivono SOLO nel primo:
//      se il ritorno si perde, un workout in modifica non è più rinominabile;
//   3. gli Stepper al posto delle rotelle, che devono scrivere lo stesso
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
 *  ⚠️ Scoped al riepilogo: «Durata» è anche l'etichetta di uno Stepper. */
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

/** Il valore grande di uno Stepper. */
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
  it('senza nome non si prosegue', async () => {
    monta()
    expect(screen.getByRole('button', { name: /Costruisci l'allenamento/ })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Nome del workout'), 'Prova')
    expect(screen.getByRole('button', { name: /Costruisci l'allenamento/ })).toBeEnabled()
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

describe('gli Stepper scrivono il vocabolario di prima', () => {
  it('un esercizio scelto dai valori rapidi finisce nel blocco con lo stesso formato', async () => {
    await alPasso2()
    await aggiungiBlocco('AMRAP')
    await userEvent.click(screen.getByRole('button', { name: /Esercizio/ }))

    await userEvent.type(screen.getByPlaceholderText(/Cerca o scrivi/), 'Wall Balls')
    await userEvent.click(await screen.findByRole('button', { name: 'Scegli Wall Balls' }))

    // I valori rapidi sono bottoni con l'etichetta esatta della lista completa.
    await userEvent.click(screen.getByRole('button', { name: '20' }))
    await userEvent.click(screen.getByRole('button', { name: '9 kg' }))

    await userEvent.click(screen.getByRole('button', { name: /Aggiungi esercizio/ }))

    // "20 reps · 9kg": è la stessa stringa che la scheda, il PDF e la web app
    // sanno leggere. Il gesto è cambiato, il dato no.
    expect(screen.getByText('20 reps 9kg')).toBeInTheDocument()
  })

  it('il più e il meno si muovono dentro la lista, non su un numero qualsiasi', async () => {
    await alPasso2()
    await aggiungiBlocco('AMRAP')
    await userEvent.click(screen.getByRole('button', { name: /Esercizio/ }))
    await userEvent.type(screen.getByPlaceholderText(/Cerca o scrivi/), 'Wall Balls')
    await userEvent.click(await screen.findByRole('button', { name: 'Scegli Wall Balls' }))

    await userEvent.click(screen.getByRole('button', { name: '20' }))
    await userEvent.click(screen.getByRole('button', { name: 'Aumenta Ripetizioni' }))

    // REPS_OPTIONS è ['-', 'Max', '1', '2', …]: dopo 20 viene 21, non 25.
    expect(valore('Ripetizioni')).toBe('21')
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
    expect(valore('Peso')).toBe('6')
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

    await userEvent.click(screen.getByRole('button', { name: 'Aumenta Rounds' }))
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

describe('il passo: prima il genere, poi la ruota', () => {
  // ⚠️ Due tentativi caduti prima di questo, e i test tengono in piedi la
  // ragione di entrambi:
  //   1. lo Stepper mostrava CINQUE valori su ottantacinque e il più/meno
  //      attraversava categorie senza rapporto («Z3» → «All out» → «1:30»);
  //   2. l'elenco a schermo pieno li mostrava tutti, ma per spostare un passo
  //      di cinque secondi chiedeva di aprire, cercare e tornare indietro.
  // Ora il genere è un segmento e il valore una ruota: dentro un genere la
  // rotella è lo strumento giusto, è attraversare la tassonomia che la rende cieca.
  const apriEsercizio = async (nome = 'Rowing') => {
    await alPasso2()
    await aggiungiBlocco('AMRAP')
    await userEvent.click(screen.getByRole('button', { name: /Esercizio/ }))
    await userEvent.type(screen.getByPlaceholderText(/Cerca o scrivi/), nome)
    await userEvent.click(await screen.findByRole('button', { name: `Scegli ${nome}` }))
  }
  const ruotaPasso = () => screen.getByRole('listbox', { name: /Passo/ })

  it('i tre generi dell ergometro sono tutti raggiungibili', async () => {
    await apriEsercizio()
    for (const g of ['A sensazione', 'Ritmo', 'Cadenza']) {
      expect(screen.getByRole('button', { name: g })).toBeInTheDocument()
    }
  })

  it('dentro «Ritmo» ci sono TUTTI e 61 i valori, non cinque', async () => {
    await apriEsercizio()
    await userEvent.click(screen.getByRole('button', { name: 'Ritmo' }))

    const voci = within(ruotaPasso()).getAllByRole('option')
    // 61 ritmi da 1:30 a 6:30 di cinque in cinque secondi, più il «—» in testa.
    expect(voci).toHaveLength(62)
    expect(within(ruotaPasso()).getByRole('option', { name: '1:30' })).toBeInTheDocument()
    expect(within(ruotaPasso()).getByRole('option', { name: '6:30' })).toBeInTheDocument()
  })

  it('cambiare genere cambia la scala, non la mescola', async () => {
    // Il difetto dello Stepper era proprio questo: una lista sola in cui «Z5» e
    // «1:30 /500m» erano vicini di casa.
    await apriEsercizio()
    await userEvent.click(screen.getByRole('button', { name: 'A sensazione' }))
    expect(within(ruotaPasso()).getByRole('option', { name: 'Z4' })).toBeInTheDocument()
    expect(within(ruotaPasso()).queryByRole('option', { name: '1:30' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Cadenza' }))
    expect(within(ruotaPasso()).getByRole('option', { name: '60' })).toBeInTheDocument()
    expect(within(ruotaPasso()).queryByRole('option', { name: 'Z4' })).not.toBeInTheDocument()
  })

  it('la voce scelta è quella al centro, ed è dichiarata come tale', async () => {
    // Il «grande al centro» è aspetto; aria-selected è la stessa informazione
    // per chi non vede la dimensione.
    await apriEsercizio()
    await userEvent.click(screen.getByRole('button', { name: 'Ritmo' }))
    await userEvent.click(within(ruotaPasso()).getByRole('option', { name: '2:00' }))

    const scelte = within(ruotaPasso()).getAllByRole('option', { selected: true })
    expect(scelte).toHaveLength(1)
    expect(scelte[0]).toHaveTextContent('2:00')
  })

  it('sceglie il valore INTERO, non l etichetta accorciata', async () => {
    // La voce dice «2:00» perché l'intestazione dice già «/500m». Quello che
    // finisce in workouts.sections deve però restare «2:00 /500m»: è la stringa
    // che la scheda, il PDF e la web app sanno leggere, e un'etichetta
    // accorciata lì dentro non darebbe **nessun** errore.
    await apriEsercizio()
    await userEvent.click(screen.getByRole('button', { name: 'Ritmo' }))
    await userEvent.click(within(ruotaPasso()).getByRole('option', { name: '2:00' }))
    await userEvent.click(screen.getByRole('button', { name: '500m' }))
    await userEvent.click(screen.getByRole('button', { name: /Aggiungi esercizio/ }))

    expect(screen.getByText('500m @ 2:00 /500m')).toBeInTheDocument()
  })

  it('«—» toglie il passo, da qualunque genere', async () => {
    // Il passo è facoltativo: se il modo di NON indicarlo vive in un solo
    // genere, chi sta guardando «Ritmo» deve cambiare scheda per cancellarlo.
    await apriEsercizio()
    for (const g of ['A sensazione', 'Ritmo', 'Cadenza']) {
      await userEvent.click(screen.getByRole('button', { name: g }))
      expect(within(ruotaPasso()).getByRole('option', { name: '—' })).toBeInTheDocument()
    }
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
