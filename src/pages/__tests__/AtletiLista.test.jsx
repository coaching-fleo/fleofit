import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { montaPagina } from '../../test/montaPagina'
import { COACHING_ID } from '../../lib/constants'
import { GIORNI_FERMO } from '../../lib/statisticheCoach'

// Perché questi test esistono
// ────────────────────────────
// Il rework della rubrica non tocca un solo campo di Supabase: cambia cosa la
// riga DICE. È il tipo di cambiamento che si rompe restando verde — una
// frazione presa dai workout in pagina invece che dalla settimana, un allarme
// che si accende ogni lunedì mattina, un atleta in pausa che sparisce dalla
// lista in cui deve restare, o il marcatore `[PAUSA]` stampato come testo su
// una nota che l'atleta legge.
//
// I casi presi qui sono quelli in cui la pagina resterebbe **plausibile e
// sbagliata**.

const dati = await vi.hoisted(async () => ({ atleti: [], assegnazioni: [] }))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    athletes: dati.atleti,
    athlete_workouts: dati.assegnazioni,
  }))
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const Athletes = (await import('../Athletes')).default

// Mercoledì 26 agosto 2026: la settimana va da lun 24 a dom 30.
const MERCOLEDI = new Date('2026-08-26T10:00:00')
const giorniFa = (n) => {
  const d = new Date(MERCOLEDI.getTime() - n * 86400000)
  return d.toISOString().split('T')[0]
}

const atleta = (id, name, surname, extra = {}) =>
  ({ id, name, surname, weight: 78, height: 182, birth_date: '1995-01-10', notes: '', deleted_at: null, ...extra })

const ass = (athlete_id, completed_date, status = 'pending') =>
  ({ id: `${athlete_id}-${completed_date}`, athlete_id, completed_date, status })

/** Chi si è allenato ieri: basta a tenerlo fuori da «Da richiamare». */
const attivoDiRecente = (id) => ass(id, giorniFa(1), 'completed')

// ⚠️ L'orologio è fisso, e non è un vezzo: tutta la pagina — la settimana in
// corso, l'età, chi è fermo, il conto alla rovescia del cestino — è relativa a
// «oggi». Con l'orologio vero questi test cambierebbero esito ogni lunedì.
// `shouldAdvanceTime` lascia comunque scorrere i timer, altrimenti userEvent si
// blocca sulla prima attesa.
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(MERCOLEDI)
  finto.chiamate.length = 0
  dati.atleti = []
  dati.assegnazioni = []
})

afterEach(() => { vi.useRealTimers() })

const montaCoach = () => montaPagina(<Athletes />, { role: 'admin' })

// ── La testata ────────────────────────────────────────────────────────────

describe('Rubrica — testata', () => {
  it('dice quanti sono, e quanti si sono fermati per scelta', async () => {
    dati.atleti = [
      atleta('a', 'Andrea', 'Bianchi'),
      atleta('b', 'Marco', 'Rossi'),
      atleta('c', 'Chiara', 'Donati', { notes: '[PAUSA: 2026-08-20]\nCi sentiamo' }),
    ]
    dati.assegnazioni = [attivoDiRecente('a'), attivoDiRecente('b')]
    montaCoach()
    expect(await screen.findByText('2 attivi · 1 in pausa')).toBeInTheDocument()
  })

  // 🔴 Chi è in pausa non conta fra gli attivi. Se ci contasse, la testata
  // direbbe un numero e il conteggio della sezione sotto ne direbbe un altro.
  it('gli in pausa non sono contati fra gli attivi', async () => {
    dati.atleti = [
      atleta('a', 'Andrea', 'Bianchi'),
      atleta('c', 'Chiara', 'Donati', { notes: '[PAUSA]\n' }),
    ]
    dati.assegnazioni = [attivoDiRecente('a')]
    montaCoach()
    expect(await screen.findByText('1 attivi · 1 in pausa')).toBeInTheDocument()
  })

  it('l\'account del coach resta fuori dalla rubrica', async () => {
    dati.atleti = [
      atleta('a', 'Andrea', 'Bianchi'),
      atleta(COACHING_ID, 'Federico', 'Leo'),
    ]
    dati.assegnazioni = [attivoDiRecente('a')]
    montaCoach()
    expect(await screen.findByText('Andrea Bianchi')).toBeInTheDocument()
    expect(screen.queryByText('Federico Leo')).not.toBeInTheDocument()
  })
})

// ── L'aderenza ────────────────────────────────────────────────────────────

describe('Rubrica — aderenza della settimana', () => {
  it('la riga porta i completati sugli assegnati della settimana', async () => {
    dati.atleti = [atleta('a', 'Andrea', 'Bianchi')]
    dati.assegnazioni = [
      ass('a', '2026-08-24', 'completed'),
      ass('a', '2026-08-25', 'completed'),
      ass('a', '2026-08-28'),          // venerdì, ancora da fare
      ass('a', '2026-08-17', 'completed'), // settimana scorsa: non entra
    ]
    montaCoach()
    const riga = await screen.findByRole('button', { name: /Andrea Bianchi/ })
    expect(within(riga).getByLabelText('2 di 3 allenamenti completati questa settimana')).toBeInTheDocument()
  })

  // 🔴 Il caso che conta di più. Un atleta senza assegnazioni non è a zero di
  // aderenza: non c'è ancora niente da misurare, e «0/0» con la barra vuota si
  // legge come un fallimento — cioè un allarme per un atleta a cui il coach non
  // ha semplicemente ancora dato niente.
  it('chi non ha niente in programma scrive «—», non «0/0»', async () => {
    dati.atleti = [atleta('a', 'Andrea', 'Bianchi')]
    // Si è allenato, ma venti giorni fa: la settimana in corso è vuota.
    dati.assegnazioni = [ass('a', giorniFa(20), 'completed')]
    montaCoach()
    const riga = await screen.findByRole('button', { name: /Andrea Bianchi/ })
    expect(within(riga).getByText('—')).toBeInTheDocument()
    expect(within(riga).queryByText('/0')).not.toBeInTheDocument()
  })

  it('il meta anagrafico resta, compresso in una riga sola', async () => {
    dati.atleti = [atleta('a', 'Andrea', 'Bianchi')]
    dati.assegnazioni = [attivoDiRecente('a')]
    montaCoach()
    expect(await screen.findByText('78kg · 182cm · 31a')).toBeInTheDocument()
  })

  // ⚠️ Una sola lettura di `athlete_workouts` per l'intera pagina, non una per
  // atleta: con venti atleti sarebbero venti round trip a ogni apertura.
  it('carica le assegnazioni con una query sola', async () => {
    dati.atleti = [atleta('a', 'A', 'Uno'), atleta('b', 'B', 'Due'), atleta('c', 'C', 'Tre')]
    montaCoach()
    await screen.findByText('C Tre')
    expect(finto.chiamateA('athlete_workouts', 'select')).toHaveLength(1)
  })
})

// ── Da richiamare ─────────────────────────────────────────────────────────

describe('Rubrica — «Da richiamare»', () => {
  it('segnala chi non chiude un allenamento da troppo tempo', async () => {
    dati.atleti = [atleta('a', 'Andrea', 'Bianchi'), atleta('b', 'Marco', 'Rossi')]
    dati.assegnazioni = [attivoDiRecente('a'), ass('b', giorniFa(12), 'completed')]
    montaCoach()
    expect(await screen.findByText('Da richiamare')).toBeInTheDocument()
    expect(screen.getByText(`1 atleta fermo da ${GIORNI_FERMO} giorni o più`)).toBeInTheDocument()
  })

  // 🔴 La soglia è quella di `statisticheCoach`, la stessa che alimenta
  // «Richiedono attenzione» nella Home coach. Due soglie diverse darebbero due
  // numeri diversi per lo stesso concetto in due schermate della stessa app, e
  // nessuno dei due sarebbe sbagliato da solo.
  it('usa la stessa soglia della Home coach', async () => {
    dati.atleti = [atleta('b', 'Marco', 'Rossi')]
    dati.assegnazioni = [ass('b', giorniFa(GIORNI_FERMO - 1), 'completed')]
    montaCoach()
    await screen.findByText('Marco Rossi')
    expect(screen.queryByText('Da richiamare')).not.toBeInTheDocument()
  })

  // 🔴 Il lunedì mattina sono tutti a 0/N, perché gli assegnati comprendono i
  // giorni ancora da venire. Un allarme legato alla frazione dipingerebbe di
  // arancione l'intera rubrica ogni lunedì: si accenderebbe quando non è
  // successo ancora niente.
  it('non si accende per chi ha la settimana appena cominciata', async () => {
    dati.atleti = [atleta('a', 'Andrea', 'Bianchi')]
    dati.assegnazioni = [
      ass('a', giorniFa(1), 'completed'),
      ass('a', '2026-08-28'), ass('a', '2026-08-29'), ass('a', '2026-08-30'),
    ]
    montaCoach()
    const riga = await screen.findByRole('button', { name: /Andrea Bianchi/ })
    // Tre quarti della settimana devono ancora arrivare: la frazione è bassa e
    // non vuol dire niente. Né la fascia né la riga devono chiamarlo.
    expect(within(riga).getByLabelText('1 di 4 allenamenti completati questa settimana')).toBeInTheDocument()
    expect(screen.queryByText('Da richiamare')).not.toBeInTheDocument()
  })

  // 🔴 Il complemento del test qui sopra, e senza di esso quello non prende
  // niente: la fascia guarda `atletiFermi`, ma la FRAZIONE della riga ha un
  // colore suo, ed è lì che un «completati === 0» si infilerebbe senza toccare
  // la fascia. Verificato per mutazione: con l'allarme legato alla frazione
  // l'altro test resta verde e questo cade.
  // ⚠️ Lo scenario è costruito sul punto ESATTO in cui le due regole
  // divergono, e ci sono voluti due tentativi per trovarlo: quasi sempre «zero
  // questa settimana» e «fermo da cinque giorni» coincidono, e un test
  // costruito su un atleta qualsiasi passa con entrambe le logiche.
  // Andrea ha chiuso SABATO 22 — quattro giorni fa, quindi non è fermo — ma
  // sabato apparteneva alla settimana scorsa, quindi in quella in corso è a
  // zero. È il caso in cui la frazione dice «allarme» e la verità dice di no,
  // e a inizio settimana è il caso di mezza rubrica.
  it('la riga chiama solo chi è davvero fermo, non chi ha zero questa settimana', async () => {
    dati.atleti = [atleta('a', 'Andrea', 'Bianchi'), atleta('b', 'Marco', 'Rossi')]
    dati.assegnazioni = [
      ass('a', '2026-08-22', 'completed'),  // sabato: settimana scorsa, 4 giorni fa
      ass('a', '2026-08-28'),               // venerdì: assegnato, ancora da fare
      // Marco: nulla da dodici giorni, e tre assegnazioni aperte in settimana.
      ass('b', giorniFa(12), 'completed'),
      ass('b', '2026-08-24'), ass('b', '2026-08-25'), ass('b', '2026-08-28'),
    ]
    montaCoach()
    const andrea = await screen.findByRole('button', { name: /Andrea Bianchi/ })
    const marco = screen.getByRole('button', { name: /Marco Rossi/ })
    expect(within(andrea).getByLabelText('0 di 1 allenamenti completati questa settimana')).toBeInTheDocument()
    expect(within(marco).getByLabelText('0 di 3 allenamenti completati questa settimana · da richiamare')).toBeInTheDocument()
  })

  // Un allarme senza destinazione è una decorazione.
  it('porta alla lista già filtrata, e la chiude al secondo tocco', async () => {
    const utente = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    dati.atleti = [atleta('a', 'Andrea', 'Bianchi'), atleta('b', 'Marco', 'Rossi')]
    dati.assegnazioni = [attivoDiRecente('a'), ass('b', giorniFa(12), 'completed')]
    montaCoach()
    await utente.click(await screen.findByRole('button', { name: /Da richiamare/ }))

    expect(screen.getByText('Marco Rossi')).toBeInTheDocument()
    expect(screen.queryByText('Andrea Bianchi')).not.toBeInTheDocument()

    await utente.click(screen.getByRole('button', { name: /Da richiamare/ }))
    expect(screen.getByText('Andrea Bianchi')).toBeInTheDocument()
  })

  // CLAUDE.md §9-decies: mettere in pausa serve proprio a NON essere richiamati.
  it('chi è in pausa non finisce fra quelli da richiamare', async () => {
    dati.atleti = [atleta('c', 'Chiara', 'Donati', { notes: '[PAUSA: 2026-08-01]\n' })]
    dati.assegnazioni = [ass('c', giorniFa(30), 'completed')]
    montaCoach()
    await screen.findByText('Chiara Donati')
    expect(screen.queryByText('Da richiamare')).not.toBeInTheDocument()
  })
})

// ── La pausa ──────────────────────────────────────────────────────────────

describe('Rubrica — gli atleti in pausa', () => {
  // 🔴 CLAUDE.md §9-decies: la rubrica è l'UNICO posto in cui il coach si
  // accorge di averne messo in pausa uno e dimenticato. Sparisce dagli allarmi,
  // non dalla lista.
  it('restano visibili nella vista principale, in una sezione loro', async () => {
    dati.atleti = [
      atleta('a', 'Andrea', 'Bianchi'),
      atleta('c', 'Chiara', 'Donati', { notes: '[PAUSA: 2026-08-20]\nCi sentiamo' }),
    ]
    dati.assegnazioni = [attivoDiRecente('a')]
    montaCoach()
    expect(await screen.findByText('Chiara Donati')).toBeInTheDocument()
    expect(screen.getByText('In pausa dal 20 ago')).toBeInTheDocument()
  })

  // 🔴 Quella nota la legge anche l'atleta (CLAUDE.md §4): il marcatore non
  // deve comparire mai come testo, da nessuna parte.
  it('non mostra mai il marcatore grezzo', async () => {
    dati.atleti = [atleta('c', 'Chiara', 'Donati', { notes: '[PAUSA: 2026-08-20]\nCi sentiamo' })]
    montaCoach()
    await screen.findByText('Chiara Donati')
    expect(document.body.textContent).not.toContain('[PAUSA')
  })

  // Non esiste da nessuna parte nei dati una data di RIENTRO.
  it('non promette un rientro che i dati non contengono', async () => {
    dati.atleti = [atleta('c', 'Chiara', 'Donati', { notes: '[PAUSA: 2026-08-20]\n' })]
    montaCoach()
    await screen.findByText('Chiara Donati')
    expect(document.body.textContent).not.toMatch(/rientro/i)
  })

  it('il chip «In pausa» mostra solo loro', async () => {
    const utente = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    dati.atleti = [
      atleta('a', 'Andrea', 'Bianchi'),
      atleta('c', 'Chiara', 'Donati', { notes: '[PAUSA]\n' }),
    ]
    dati.assegnazioni = [attivoDiRecente('a')]
    montaCoach()
    await utente.click(await screen.findByRole('button', { name: /^In pausa/ }))
    expect(screen.getByText('Chiara Donati')).toBeInTheDocument()
    expect(screen.queryByText('Andrea Bianchi')).not.toBeInTheDocument()
  })
})

// ── Il cestino ────────────────────────────────────────────────────────────

describe('Rubrica — gli eliminati', () => {
  // Era un accordion in fondo alla pagina, con il conteggio fra parentesi nel
  // testo del bottone. Ora è una vista come le altre.
  it('sono una vista, non un accordion in fondo alla pagina', async () => {
    const utente = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    dati.atleti = [
      atleta('a', 'Andrea', 'Bianchi'),
      atleta('z', 'Luca', 'Verdi', { deleted_at: MERCOLEDI.getTime() - 2 * 86400000 }),
    ]
    dati.assegnazioni = [attivoDiRecente('a')]
    montaCoach()

    // Fuori dalla sua vista, un eliminato non compare fra gli atleti.
    expect(await screen.findByText('Andrea Bianchi')).toBeInTheDocument()
    expect(screen.queryByText('Luca Verdi')).not.toBeInTheDocument()
    expect(screen.queryByText(/Eliminati di recente \(/)).not.toBeInTheDocument()

    await utente.click(screen.getByRole('button', { name: /^Eliminati/ }))
    expect(screen.getByText('Luca Verdi')).toBeInTheDocument()
    expect(screen.getByText('Fra 5 giorni')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ripristina/ })).toBeInTheDocument()
  })

  it('ripristina rimette l\'atleta fra i tuoi', async () => {
    const utente = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    dati.atleti = [atleta('z', 'Luca', 'Verdi', { deleted_at: MERCOLEDI.getTime() - 86400000 })]
    montaCoach()
    await utente.click(await screen.findByRole('button', { name: /^Eliminati/ }))
    await utente.click(screen.getByRole('button', { name: /Ripristina/ }))
    await waitFor(() => expect(finto.chiamateA('athletes', 'update')).toHaveLength(1))
    expect(finto.chiamateA('athletes', 'update')[0].args[0]).toEqual({ deleted_at: null })
  })
})

// ── La ricerca ────────────────────────────────────────────────────────────

describe('Rubrica — ricerca', () => {
  it('trova per cognome', async () => {
    const utente = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    dati.atleti = [atleta('a', 'Andrea', 'Bianchi'), atleta('b', 'Marco', 'Rossi')]
    dati.assegnazioni = [attivoDiRecente('a'), attivoDiRecente('b')]
    montaCoach()
    await utente.type(await screen.findByLabelText('Cerca un atleta'), 'rossi')
    expect(screen.getByText('Marco Rossi')).toBeInTheDocument()
    expect(screen.queryByText('Andrea Bianchi')).not.toBeInTheDocument()
  })

  // Una ricerca senza esiti è un vicolo cieco: da lì serve la via d'uscita.
  it('senza esiti offre la via d\'uscita', async () => {
    const utente = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    dati.atleti = [atleta('a', 'Andrea', 'Bianchi')]
    dati.assegnazioni = [attivoDiRecente('a')]
    montaCoach()
    await utente.type(await screen.findByLabelText('Cerca un atleta'), 'zzz')
    expect(screen.getByText('Nessun atleta con questo nome')).toBeInTheDocument()
    await utente.click(screen.getByRole('button', { name: 'Azzera la ricerca' }))
    expect(screen.getByText('Andrea Bianchi')).toBeInTheDocument()
  })
})
