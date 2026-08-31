import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Perché questo test esiste
// ─────────────────────────
// Il redesign della scheda (28/08/2026, artboard «Workout Detail») non ha
// riscritto la logica: ha cambiato che cosa la pagina MOSTRA. Le regressioni
// di questo genere non danno nessun errore — danno un numero plausibile e
// sbagliato, che è il caso peggiore. Le tre che questo file prende:
//
//  1. la terza colonna del riepilogo, che su un allenamento chiuso è l'RPE
//     DICHIARATO dall'atleta e non l'RPE ATTESO dal coach;
//  2. quel valore che, quando l'atleta non l'ha mai indicato, deve dire «—» e
//     non «5» — il ripiego di `parseNotesAndRpe` travestito da misura;
//  3. la didascalia di BLOCK_HINT accanto a «Cash In», che è la risposta al
//     rilievo 3.2.1(viii) di Apple e non un ornamento.

const ctrl = await vi.hoisted(async () => ({ stato: {} }))

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    workouts: [{
      id: 'w1', title: 'Hyrox Strength #1', date: '2026-08-28',
      coach_notes: '', sections: ctrl.stato.sections,
    }],
    athlete_workouts: ctrl.stato.assegnazioni,
    athletes: [{ id: 'u1', name: 'Marco', surname: 'Rinaldi' }],
  }))
})

vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))
vi.mock('jspdf', () => ({ default: class {}, jsPDF: class {} }))
vi.mock('html-to-image', () => ({ toPng: vi.fn(), toBlob: vi.fn() }))
vi.mock('@capacitor/network', () => ({ Network: {
  getStatus: vi.fn(() => Promise.resolve({ connected: true })),
  addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
} }))

const { AuthContext } = await import('../../App')
const WorkoutDetail = (await import('../WorkoutDetail')).default

const HYROX = {
  category: 'Hyrox', intensity: '8',
  blocks: [
    { id: 'b1', type: 'WarmUp', params: { duration: '8:00' }, exercises: [] },
    { id: 'b2', type: 'Cash In', params: { rounds: '1' }, exercises: [
      { id: 'e1', name: 'Ski Erg', meters: '500m', intensity: '7' },
      { id: 'e2', name: 'Sled Push', meters: '50m', kg: '125', intensity: '8' },
    ] },
    { id: 'b3', type: 'EMOM', params: { interval: '1:00', rounds: '24' }, exercises: [
      { id: 'e3', name: 'Wall Balls', reps: '20', kg: '9', intensity: '8' },
    ] },
  ],
}

const RUNNING = {
  category: 'Running',
  steps: [{ id: 1, type: 'repeat', rounds: '6', runDuration: '400m', recDuration: '90 sec' }],
}

const assegnazione = (extra = {}) => ([{
  id: 'aw1', athlete_id: 'u1', workout_id: 'w1', completed_date: '2026-08-28',
  status: 'pending', notes: null, voice_note_url: null,
  athletes: { id: 'u1', name: 'Marco', surname: 'Rinaldi', photo_url: null },
  ...extra,
}])

function apri({ ruolo = 'athlete', utente = 'u1' } = {}) {
  return render(
    <MemoryRouter initialEntries={['/workout/w1?athlete_id=u1']}>
      <AuthContext.Provider value={{ user: { id: utente, email: 'a@b.it', user_metadata: {} }, role: ruolo }}>
        <Routes><Route path="/workout/:id" element={<WorkoutDetail />} /></Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

const attendi = () => waitFor(() =>
  expect(screen.getByRole('heading', { name: 'Hyrox Strength #1' })).toBeInTheDocument())

/**
 * La lista dei blocchi.
 *
 * ⚠️ Le query vanno ristrette a questa: la grafica per Instagram resta nel DOM
 * fuori schermo (deve, o html-to-image esporta un'immagine vuota) e contiene
 * gli stessi nomi di esercizio. Senza il confine, «non c'è più» sarebbe sempre
 * falso e il test del richiudi passerebbe per il motivo sbagliato.
 */
const blocchi = () => within(document.querySelector('[data-blocchi]'))

/** La cella del riepilogo con quell'etichetta, o null se non c'è. */
const cella = (etichetta) => {
  const label = screen.queryByText(etichetta)
  return label ? label.parentElement.querySelector('span:last-child').textContent : null
}

beforeEach(() => {
  ctrl.stato = { sections: HYROX, assegnazioni: assegnazione() }
})

describe('il riepilogo in cima alla scheda', () => {
  it('dice durata, blocchi e RPE atteso — gli stessi tre numeri del builder', async () => {
    apri()
    await attendi()
    // 8:00 di WarmUp + i 550 m del Cash In + 24 × 1:00 di EMOM = 2.058 secondi.
    expect(cella('Durata')).toBe('34min')
    expect(cella('Blocchi')).toBe('3')
    expect(cella('RPE atteso')).toBeTruthy()
  })

  it('su un allenamento chiuso mostra l’RPE DELL’ATLETA, non quello atteso', async () => {
    // Sono due misure diverse: una la fa il coach a tavolino, l'altra chi si è
    // allenato. Sotto la stessa etichetta sarebbe la bugia peggiore della pagina.
    ctrl.stato.assegnazioni = assegnazione({ status: 'completed', notes: '[RPE: 9/10]\nWall balls pesanti' })
    apri()
    await attendi()
    await waitFor(() => expect(cella('Il tuo RPE')).toBe('9/10'))
    expect(screen.queryByText('RPE atteso')).not.toBeInTheDocument()
  })

  it('e scrive «—» quando l’atleta non l’ha indicato, non «5»', async () => {
    // `parseNotesAndRpe` torna 5 quando il marcatore manca: è il valore giusto
    // per il cursore della modale, ed è un numero inventato per chiunque lo
    // mostri come un dato. È la lezione di `rpeDichiarato` (CLAUDE.md §9-octies).
    ctrl.stato.assegnazioni = assegnazione({ status: 'completed', notes: 'nessun marcatore qui' })
    apri()
    await attendi()
    await waitFor(() => expect(cella('Il tuo RPE')).toBe('—'))
  })

  it('non compare su un allenamento di corsa, che non ha blocchi da stimare', async () => {
    // «0 min · 0 blocchi» sarebbe una bugia con l'aria di un dato.
    ctrl.stato.sections = RUNNING
    apri()
    await attendi()
    expect(screen.queryByText('Durata')).not.toBeInTheDocument()
    expect(screen.queryByText('Blocchi')).not.toBeInTheDocument()
  })
})

describe('i blocchi', () => {
  it('mostrano gli esercizi senza chiedere un tocco', async () => {
    // La scheda si legge mentre ci si allena: un esercizio dietro un tap è un
    // esercizio che si salta.
    apri()
    await attendi()
    expect(blocchi().getByText('Ski Erg')).toBeInTheDocument()
    expect(blocchi().getByText('Wall Balls')).toBeInTheDocument()
  })

  it('portano la didascalia in chiaro accanto al nome tecnico', async () => {
    // Rilievo 3.2.1(viii): «Cash In» non è un movimento di denaro, ed è la
    // didascalia a dirlo. CLAUDE.md §9-ter.
    apri()
    await attendi()
    expect(blocchi().getByText(/Blocco di apertura/)).toBeInTheDocument()
    expect(blocchi().getByText(/Ogni minuto/)).toBeInTheDocument()
  })

  it('dicono i parametri senza ripetere la durata già scritta a destra', async () => {
    apri()
    await attendi()
    expect(blocchi().getByText('1 esercizio · ogni 1:00 × 24')).toBeInTheDocument()
    // Il Cash In è su un round solo: «1 round» sarebbe rumore, e il numero di
    // esercizi resta l'unica cosa da dire.
    expect(blocchi().getByText('2 esercizi')).toBeInTheDocument()
    // 24 round da un minuto: la durata sta in testa alla riga, non nel sottotitolo.
    expect(blocchi().getByText('24:00')).toBeInTheDocument()
  })

  it('si possono richiudere, e allora gli esercizi spariscono', async () => {
    apri()
    await attendi()
    await userEvent.click(blocchi().getByRole('button', { expanded: true, name: /EMOM/ }))
    expect(blocchi().queryByText('Wall Balls')).not.toBeInTheDocument()
    // E solo lui: chiudere un blocco non chiude gli altri.
    expect(blocchi().getByText('Ski Erg')).toBeInTheDocument()
  })

  it('e il riscaldamento non si apre affatto: non ha niente dentro', async () => {
    apri()
    await attendi()
    expect(blocchi().queryByRole('button', { name: /WarmUp/ })).not.toBeInTheDocument()
    expect(blocchi().getByText(/Riscaldamento/)).toBeInTheDocument()
  })
})

describe('l’avviso sul riscaldamento', () => {
  // ⚠️ Il testo è fisso per decisione del committente (28/08/2026): è l'unico
  // avviso di sicurezza dell'app, e riassumerlo toglie proprio la parte che
  // spiega il perché. Il redesign lo aveva ridotto a una riga; questo test
  // esiste perché non succeda di nuovo senza che qualcuno lo decida.
  const TESTO = "Esegui sempre 5-10 minuti di mobilità articolare. Approccia l'allenamento in "
    + 'modo graduale per preparare il corpo allo sforzo e prevenire infortuni. Non partire mai a freddo!'

  it('dice il testo per intero, parola per parola', async () => {
    apri()
    await attendi()
    expect(screen.getByText('Prima di iniziare')).toBeInTheDocument()
    expect(screen.getByText(TESTO)).toBeInTheDocument()
  })

  it('e sta prima dei blocchi, che è dove «prima di iniziare» vuol dire qualcosa', async () => {
    apri()
    await attendi()
    const avviso = screen.getByText('Prima di iniziare')
    const lista = document.querySelector('[data-blocchi]')
    // Node.DOCUMENT_POSITION_FOLLOWING: la lista viene dopo l'avviso.
    expect(avviso.compareDocumentPosition(lista) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('la testata e il menu', () => {
  it('tengono fuori dalla pagina i comandi che si usano una volta', async () => {
    // Erano cinque bottoncini in fila sotto il titolo più quattro export in
    // fondo, tutti dello stesso peso. Fuori restano solo TV e cardio, che sono
    // due STATI: si accendono e si spengono durante l'allenamento.
    apri({ ruolo: 'admin', utente: 'coach' })
    await attendi()
    expect(screen.queryByRole('button', { name: /^Duplica$/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Elimina$/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^TV$/ })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Altre azioni/i }))
    const menu = screen.getByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: /Duplica/ })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: /Modifica/ })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: /Elimina/ })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: /Salva grafica IG/ })).toBeInTheDocument()
  })

  it('non offrono all’atleta i comandi del coach', async () => {
    apri()
    await attendi()
    await userEvent.click(screen.getByRole('button', { name: /Altre azioni/i }))
    const menu = screen.getByRole('menu')
    expect(within(menu).queryByRole('menuitem', { name: /Duplica/ })).not.toBeInTheDocument()
    expect(within(menu).queryByRole('menuitem', { name: /Elimina/ })).not.toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: /Esporta PDF/ })).toBeInTheDocument()
  })
})

describe('l’elenco delle assegnazioni', () => {
  const treAtleti = () => ([
    ...assegnazione({ status: 'completed', notes: '[RPE: 8/10]\nbene' }),
    { id: 'aw2', athlete_id: 'u2', workout_id: 'w1', completed_date: '2026-08-28',
      status: 'pending', notes: null, voice_note_url: null,
      athletes: { id: 'u2', name: 'Sara', surname: 'Bellini', photo_url: null } },
    { id: 'aw3', athlete_id: 'u3', workout_id: 'w1', completed_date: '2026-08-31',
      status: 'pending', notes: null, voice_note_url: 'https://x/y.aac',
      athletes: { id: 'u3', name: 'Luca', surname: 'Ferretti', photo_url: null } },
  ])

  it('dice cosa ha lasciato ogni atleta, non solo se ha finito', async () => {
    // Un contatore senza il riscontro obbliga ad aprire una scheda per atleta
    // per sapere se una delle tre era da leggere.
    ctrl.stato.assegnazioni = treAtleti()
    apri({ ruolo: 'admin', utente: 'coach' })
    await attendi()
    expect(await screen.findByText('RPE 8 · nota')).toBeInTheDocument()
    expect(screen.getByText('nessun riscontro')).toBeInTheDocument()
  })

  it('scrive la data solo quando è diversa da quella del workout', async () => {
    // ⚠️ Non è brevità: su 393px, accanto al nome, alla pillola di stato e al
    // cestino, una data che ripete il titolo della pagina tronca proprio il
    // riscontro. Quando invece l'atleta è programmato in un altro giorno,
    // quello è il dato che conta — e non c'è nessun altro posto che lo dica.
    ctrl.stato.assegnazioni = treAtleti()
    apri({ ruolo: 'admin', utente: 'coach' })
    await attendi()
    expect(await screen.findByText('lun 31 ago · vocale')).toBeInTheDocument()
    expect(screen.queryByText(/ven 28 ago · RPE 8/)).not.toBeInTheDocument()
  })

  it('e l’atleta non lo carica nemmeno', async () => {
    // ⚠️ La versione «non si vede in pagina» di questo test NON funzionava:
    // la guardia sul ruolo esiste in due punti — il fetch e il render — e
    // togliendone uno solo non succede niente. Un test che nessuna mutazione
    // singola fa fallire è verde per il motivo sbagliato (CLAUDE.md §9-sexies).
    // Quello che conta è comunque il fetch: la scheda dell'atleta non deve
    // scaricare le assegnazioni di tutti gli altri.
    ctrl.stato.assegnazioni = treAtleti()
    finto.chiamate.length = 0
    apri()
    await attendi()
    await waitFor(() => expect(finto.chiamateA('athlete_workouts', 'select').length).toBeGreaterThan(0))
    expect(finto.chiamateA('athlete_workouts', 'select')).toHaveLength(1)
    expect(screen.queryByText('Assegnato a')).not.toBeInTheDocument()
  })
})

describe('la barra fissa in basso', () => {
  it('per l’atleta tiene avvio e completamento uno accanto all’altro', async () => {
    apri()
    await attendi()
    expect(screen.getByRole('button', { name: /Avvia allenamento/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Segna come completato/i })).toBeInTheDocument()
  })

  it('per il coach tiene avvio e assegnazione', async () => {
    apri({ ruolo: 'admin', utente: 'coach' })
    await attendi()
    expect(screen.getByRole('button', { name: /Avvia allenamento/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Assegna ad atleta/i })).toBeInTheDocument()
  })

  it('su un allenamento già chiuso non offre più il giallo pieno', async () => {
    // La Regola del Tratto Unico: una sola superficie gialla per schermo, e
    // marca la cosa che conta. Su una scheda chiusa quella cosa non c'è più.
    ctrl.stato.assegnazioni = assegnazione({ status: 'completed', notes: '[RPE: 9/10]\nfatto' })
    apri()
    await attendi()
    const rifallo = await screen.findByRole('button', { name: /Rifallo/i })
    expect(rifallo.className).not.toMatch(/bg-brand/)
    expect(screen.getByText('Allenamento completato')).toBeInTheDocument()
  })
})

describe('la grafica per Instagram', () => {
  it('resta nel DOM anche se non è più contenuto della pagina', async () => {
    // ⚠️ Non è pignoleria: html-to-image clona un nodo VERO. Con `display:none`
    // o `opacity:0` l'export produce un'immagine vuota, e nessun test che
    // guardi solo la pagina se ne accorgerebbe.
    apri()
    await attendi()
    expect(screen.queryByText(/Anteprima Sticker/i)).not.toBeInTheDocument()

    const grafica = document.querySelector('[data-grafica-ig]')
    expect(grafica).not.toBeNull()
    // `toBeVisible` è il punto: cade su `display:none` e su `opacity:0`, che
    // sono i due modi «ovvi» di nascondere questa card — e i due che
    // spegnerebbero l'export senza che niente in pagina cambi.
    expect(grafica).toBeVisible()
    expect(within(grafica).getByText('@FLEOFIT')).toBeInTheDocument()
    // Ed è fuori dal flusso, non in fondo alla pagina come prima.
    expect(grafica).toHaveStyle({ position: 'fixed', left: '-10000px' })
  })
})
