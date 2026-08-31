import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { montaPagina } from '../../test/montaPagina'

// Perché questi test esistono
// ────────────────────────────
// Il rework dell'archivio non tocca un solo campo di Supabase: cambia l'ordine,
// il raggruppamento e ciò che ogni riga dice di sé. È il tipo di cambiamento
// che si rompe restando verde — un mese stampato due volte, un chip che filtra
// su una categoria che nella query non arriva mai, un contatore che il ruolo
// sbagliato vede.
//
// I casi presi qui sono quelli in cui la pagina resterebbe **plausibile e
// sbagliata**:
//  · i gruppi per mese, che pretendono un ordine per DATA mentre la query
//    torna per `created_at`;
//  · i chip, che devono venire dai dati e non da un elenco scritto a mano;
//  · la ricerca, che ora promette «blocco, esercizio» nel placeholder;
//  · il contatore degli assegnati, che per l'atleta non esiste — e la sua
//    query non lo carica nemmeno.

const dati = await vi.hoisted(async () => ({ workouts: [], assegnazioni: [] }))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    workouts: dati.workouts,
    athlete_workouts: dati.assegnazioni,
  }))
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const WorkoutsArchive = (await import('../WorkoutsArchive')).default

const EMOM = {
  id: 1, type: 'EMOM', params: { interval: '1:00', rounds: '20' },
  exercises: [{ name: 'Wall Balls', reps: '15' }],
}

const wk = (id, title, date, sections, assegnati = 0) => ({
  id, title, date, created_at: `2026-08-01T00:00:0${id}Z`,
  sections,
  athlete_workouts: Array.from({ length: assegnati }, (_, i) => ({ id: `${id}-${i}` })),
})

const HYROX = (id, title, date, assegnati) =>
  wk(id, title, date, { category: 'Hyrox', blocks: [EMOM] }, assegnati)
const CORSA = (id, title, date, assegnati) =>
  wk(id, title, date, { category: 'Running', steps: [{ type: 'run', duration: '18 km' }] }, assegnati)

beforeEach(() => {
  finto.chiamate.length = 0
  dati.workouts = []
  dati.assegnazioni = []
})

const montaCoach = () => montaPagina(<WorkoutsArchive />, { role: 'admin' })

describe('Archivio — intestazione', () => {
  it('dice la scala: quanti workout e su quante corsie', async () => {
    dati.workouts = [HYROX(1, 'Full Body', '2026-08-22'), CORSA(2, 'Long Run', '2026-08-20')]
    montaCoach()
    expect(await screen.findByText('2 workout · 2 corsie')).toBeInTheDocument()
  })

  // Erano DUE h1 — il logo FLEOFIT e «Archivio Workout» — più un sottotitolo
  // che ripeteva il titolo: tre righe prima di vedere un workout, su una
  // schermata che si raggiunge da un link chiamato «Archivio».
  it('non ha più il logo né il secondo titolo', async () => {
    dati.workouts = [HYROX(1, 'Full Body', '2026-08-22')]
    montaCoach()
    await screen.findByText('Full Body')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.queryByText(/FLEO/)).not.toBeInTheDocument()
    expect(screen.queryByText('Tutti i tuoi allenamenti creati')).not.toBeInTheDocument()
  })
})

describe('Archivio — i gruppi per mese', () => {
  // 🔴 La query torna per `created_at`. Con quell'ordine le date non sono
  // monotone e lo stesso mese ricompare in punti diversi dello scroll.
  it('raggruppa per mese, dal più recente, qualunque sia l\'ordine di creazione', async () => {
    dati.workouts = [
      wk(1, 'Luglio tardi creato', '2026-07-10', { category: 'Hyrox', blocks: [EMOM] }),
      wk(2, 'Agosto', '2026-08-22', { category: 'Hyrox', blocks: [EMOM] }),
    ]
    montaCoach()
    await screen.findByText('Agosto')
    const mesi = screen.getAllByText(/^(Agosto|Luglio) 2026$/).map(e => e.textContent)
    expect(mesi).toEqual(['Agosto 2026', 'Luglio 2026'])
  })

  it('l\'intestazione del mese porta quanti ne contiene', async () => {
    dati.workouts = [
      HYROX(1, 'Uno', '2026-08-22'), HYROX(2, 'Due', '2026-08-10'),
      HYROX(3, 'Tre', '2026-07-01'),
    ]
    montaCoach()
    const agosto = (await screen.findByText('Agosto 2026')).parentElement
    expect(within(agosto).getByText('2')).toBeInTheDocument()
  })
})

describe('Archivio — la riga', () => {
  it('dice giorno, blocchi e durata stimata sotto il titolo', async () => {
    dati.workouts = [HYROX(1, 'Full Body', '2026-08-22')]
    montaCoach()
    expect(await screen.findByText('Sab 22 · 1 blocco · 20′')).toBeInTheDocument()
  })

  // ⚠️ La data lunga («sabato 22 agosto 2026») era la stringa più larga della
  // riga: novanta pixel presi al titolo per ripetere quello che dice già
  // l'intestazione del mese.
  it('non stampa più la data in forma lunga', async () => {
    dati.workouts = [HYROX(1, 'Full Body', '2026-08-22')]
    montaCoach()
    await screen.findByText('Full Body')
    expect(screen.queryByText(/sabato 22 agosto 2026/i)).not.toBeInTheDocument()
  })

  it('al coach mostra quanti atleti l\'hanno ricevuto, come cifra', async () => {
    dati.workouts = [HYROX(1, 'Full Body', '2026-08-22', 4)]
    montaCoach()
    const riga = (await screen.findByText('Full Body')).closest('button')
    expect(within(riga).getByText('4')).toBeInTheDocument()
    expect(within(riga).getByText(/assegnato a 4 atleti/i)).toBeInTheDocument()
    // Era «Assegnato: 4» in grigio 11px nell'angolo, cioè invisibile.
    expect(screen.queryByText('Assegnato: 4')).not.toBeInTheDocument()
  })

  it('apre la scheda del workout', async () => {
    dati.workouts = [HYROX(7, 'Full Body', '2026-08-22')]
    montaCoach()
    await userEvent.click((await screen.findByText('Full Body')).closest('button'))
    await waitFor(() => expect(window.location.pathname).toBe('/'))
  })
})

describe('Archivio — i filtri di corsia', () => {
  // ⚠️ La query del coach ESCLUDE Custom ed Evento: un chip scritto a mano
  // sarebbe sempre a zero, e premuto svuoterebbe la pagina.
  it('i chip vengono dai dati, non da un elenco fisso', async () => {
    dati.workouts = [HYROX(1, 'Full Body', '2026-08-22'), CORSA(2, 'Long Run', '2026-08-20')]
    montaCoach()
    const filtri = await screen.findByRole('group', { name: /filtra per categoria/i })
    const nomi = within(filtri).getAllByRole('button').map(b => b.textContent)
    expect(nomi.some(n => n.includes('Hyrox'))).toBe(true)
    expect(nomi.some(n => n.includes('Running'))).toBe(true)
    // Le due corsie che la query del coach non fa MAI arrivare.
    expect(nomi.some(n => n.includes('Libero'))).toBe(false)
    expect(nomi.some(n => n.includes('Gara'))).toBe(false)
  })

  it('un chip riduce la lista con un tocco', async () => {
    dati.workouts = [HYROX(1, 'Full Body', '2026-08-22'), CORSA(2, 'Long Run', '2026-08-20')]
    montaCoach()
    await userEvent.click(await screen.findByRole('button', { name: /Running/ }))
    expect(screen.getByText('Long Run')).toBeInTheDocument()
    expect(screen.queryByText('Full Body')).not.toBeInTheDocument()
  })

  it('ripremuto, lo stesso chip toglie il filtro', async () => {
    dati.workouts = [HYROX(1, 'Full Body', '2026-08-22'), CORSA(2, 'Long Run', '2026-08-20')]
    montaCoach()
    const chip = await screen.findByRole('button', { name: /Running/ })
    await userEvent.click(chip)
    await userEvent.click(chip)
    expect(screen.getByText('Full Body')).toBeInTheDocument()
  })

  it('sotto filtro l\'intestazione dice quanti se ne stanno vedendo', async () => {
    dati.workouts = [HYROX(1, 'Full Body', '2026-08-22'), CORSA(2, 'Long Run', '2026-08-20')]
    montaCoach()
    await userEvent.click(await screen.findByRole('button', { name: /Running/ }))
    expect(screen.getByText('1 di 2 workout')).toBeInTheDocument()
  })

  it('con una corsia sola i chip non compaiono affatto', async () => {
    dati.workouts = [HYROX(1, 'Full Body', '2026-08-22')]
    montaCoach()
    await screen.findByText('Full Body')
    expect(screen.queryByRole('group', { name: /filtra per categoria/i })).not.toBeInTheDocument()
  })
})

describe('Archivio — la ricerca', () => {
  // Il placeholder promette «blocco, esercizio»: prima cercava solo titolo e
  // categoria, quindi era una promessa a vuoto.
  it('trova un workout dal nome di un esercizio', async () => {
    dati.workouts = [HYROX(1, 'Full Body', '2026-08-22'), CORSA(2, 'Long Run', '2026-08-20')]
    montaCoach()
    await userEvent.type(await screen.findByLabelText(/cerca nell'archivio/i), 'wall balls')
    expect(screen.getByText('Full Body')).toBeInTheDocument()
    expect(screen.queryByText('Long Run')).not.toBeInTheDocument()
  })

  it('trova un workout dal tipo di blocco', async () => {
    dati.workouts = [HYROX(1, 'Full Body', '2026-08-22'), CORSA(2, 'Long Run', '2026-08-20')]
    montaCoach()
    await userEvent.type(await screen.findByLabelText(/cerca nell'archivio/i), 'emom')
    expect(screen.getByText('Full Body')).toBeInTheDocument()
    expect(screen.queryByText('Long Run')).not.toBeInTheDocument()
  })

  // 🔴 La vecchia riga faceva `w.title.toLowerCase()` nudo.
  it('non si schianta su un workout senza titolo', async () => {
    dati.workouts = [wk(1, null, '2026-08-22', { category: 'Hyrox', blocks: [EMOM] })]
    montaCoach()
    // Che la riga esista è già metà della prova: l'indice di ricerca si
    // costruisce al montaggio, quindi un `.toLowerCase()` su un titolo nullo
    // farebbe cadere la pagina PRIMA che si digiti qualcosa.
    expect(await screen.findByText('Senza titolo')).toBeInTheDocument()
    // ⚠️ Non cercare 'x': è dentro «hyrox», che l'indice contiene, quindi il
    // workout verrebbe trovato e il vuoto non comparirebbe mai.
    await userEvent.type(screen.getByLabelText(/cerca nell'archivio/i), 'zzz')
    expect(screen.getByText(/nessun workout con questi filtri/i)).toBeInTheDocument()
  })

  it('dal vuoto della ricerca si esce azzerando i filtri', async () => {
    dati.workouts = [HYROX(1, 'Full Body', '2026-08-22')]
    montaCoach()
    await userEvent.type(await screen.findByLabelText(/cerca nell'archivio/i), 'zzz')
    await userEvent.click(screen.getByRole('button', { name: /azzera i filtri/i }))
    expect(screen.getByText('Full Body')).toBeInTheDocument()
  })

  it('un archivio davvero vuoto non offre di azzerare niente', async () => {
    dati.workouts = []
    montaCoach()
    expect(await screen.findByText(/nessun workout in archivio/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /azzera i filtri/i })).not.toBeInTheDocument()
  })
})

describe('Archivio — vista atleta', () => {
  const ASSEGNATA = (id, title, date, status) => ({
    id: `aw-${id}`, completed_date: date, status, created_at: `2026-08-0${id}T00:00:00Z`,
    workouts: { id, title, date, sections: { category: 'Hyrox', blocks: [EMOM] } },
  })

  it('al posto del contatore mostra se l\'ha completato', async () => {
    dati.assegnazioni = [ASSEGNATA(1, 'Fatto', '2026-08-22', 'completed'),
                         ASSEGNATA(2, 'Da fare', '2026-08-21', 'pending')]
    montaPagina(<WorkoutsArchive />, { role: 'athlete' })
    const fatto = (await screen.findByText('Fatto')).closest('button')
    const daFare = screen.getByText('Da fare').closest('button')
    expect(within(fatto).getByText('completato')).toBeInTheDocument()
    expect(within(daFare).queryByText('completato')).not.toBeInTheDocument()
  })

  // ⚠️ Il contatore degli assegnati non è solo nascosto: la query dell'atleta
  // NON lo carica. Mostrarlo vorrebbe dire stampare 0 a tutti.
  it('non mostra il contatore degli assegnati', async () => {
    dati.assegnazioni = [ASSEGNATA(1, 'Fatto', '2026-08-22', 'completed')]
    montaPagina(<WorkoutsArchive />, { role: 'athlete' })
    const riga = (await screen.findByText('Fatto')).closest('button')
    expect(within(riga).queryByText(/assegnato a/i)).not.toBeInTheDocument()
  })

  it('l\'atleta legge la propria tabella, non quella dei workout', async () => {
    dati.assegnazioni = [ASSEGNATA(1, 'Fatto', '2026-08-22', 'completed')]
    montaPagina(<WorkoutsArchive />, { role: 'athlete' })
    await screen.findByText('Fatto')
    expect(finto.chiamateA('workouts', 'select')).toHaveLength(0)
    expect(finto.chiamateA('athlete_workouts', 'select')).toHaveLength(1)
  })
})
